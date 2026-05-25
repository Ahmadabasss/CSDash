#!/usr/bin/env python3
"""
Seed the Azure SQL Database from mock JSON files.

Reads from:
  - data/big-mock-data/generated/scenarios/<SCENARIO>/   (alerts, recs, etc.)
  - backend/mock_data/network.json

Usage:
    # from the repo root
    python backend/scripts/seed_sql.py \
        --conn "Driver={ODBC Driver 18 for SQL Server};Server=tcp:..." \
        [--scenario noisy|compromised|secured]

Requires: pip install pyodbc
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent   # repo root
SCENARIOS_DIR = ROOT / "data" / "big-mock-data" / "generated" / "scenarios"
NETWORK_FILE  = ROOT / "backend" / "mock_data" / "network.json"


def get_connection(conn_str: str):
    import pyodbc
    return pyodbc.connect(conn_str, autocommit=False)


def upsert(cur, table: str, pk_col: str, pk_val: str, row: dict) -> None:
    cols   = ", ".join(row.keys())
    params = ", ".join("?" * len(row))
    vals   = list(row.values())
    cur.execute(
        f"MERGE dbo.{table} AS t "
        f"USING (VALUES ({params})) AS s ({cols}) ON t.{pk_col} = s.{pk_col} "
        f"WHEN MATCHED THEN UPDATE SET {', '.join(f't.{c}=s.{c}' for c in row if c != pk_col)} "
        f"WHEN NOT MATCHED THEN INSERT ({cols}) VALUES ({params});",
        vals + vals,
    )


def to_dt(s: str | None, fallback: str = "1970-01-01T00:00:00Z") -> str:
    """Parse ISO datetime string, return as SQL-compatible string."""
    raw = s or fallback
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw[:26].rstrip("Z"), fmt.rstrip("Z")).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return "1970-01-01 00:00:00"


def seed_alerts(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "alerts", "id", r["id"], {
            "id":               r["id"],
            "status":           r.get("status", ""),
            "severity":         r.get("severity", ""),
            "created_datetime": to_dt(r.get("createdDateTime")),
            "payload":          json.dumps(r),
        })
    return len(rows)


def seed_incidents(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "incidents", "id", r["id"], {
            "id":               r["id"],
            "severity":         r.get("severity", ""),
            "status":           r.get("status", ""),
            "created_datetime": to_dt(r.get("createdDateTime") or r.get("createdTime")),
            "payload":          json.dumps(r),
        })
    return len(rows)


def seed_recommendations(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        sev = r.get("properties", {}).get("metadata", {}).get("severity", "")
        upsert(cur, "recommendations", "id", r["id"], {
            "id":      r["id"],
            "severity": sev,
            "payload":  json.dumps(r),
        })
    return len(rows)


def seed_vulnerabilities(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "vulnerabilities", "id", r["id"], {
            "id":      r["id"],
            "cvss_v3": float(r.get("cvssV3", 0) or 0),
            "payload": json.dumps(r),
        })
    return len(rows)


def seed_compliance(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "compliance_standards", "id", r["id"], {
            "id":      r["id"],
            "payload": json.dumps(r),
        })
    return len(rows)


def seed_resources(cur, data: dict) -> int:
    rows = data.get("data", [])
    for r in rows:
        upsert(cur, "resources", "id", r["id"], {
            "id":             r["id"],
            "name":           r.get("name", ""),
            "type":           r.get("type", ""),
            "resource_group": r.get("resourceGroup", ""),
            "payload":        json.dumps(r),
        })
    return len(rows)


def seed_virtual_machines(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "virtual_machines", "id", r["id"], {
            "id":      r["id"],
            "name":    r.get("name", ""),
            "payload": json.dumps(r),
        })
    return len(rows)


def seed_endpoints(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "endpoints", "id", r["id"], {
            "id":         r["id"],
            "risk_score": float(r.get("riskScore", 0) or 0),
            "payload":    json.dumps(r),
        })
    return len(rows)


def seed_signins(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "signins", "id", r["id"], {
            "id":               r["id"],
            "created_datetime": to_dt(r.get("createdDateTime")),
            "risk_level":       r.get("riskLevelAggregated", "none") or "none",
            "payload":          json.dumps(r),
        })
    return len(rows)


def seed_risky_users(cur, data: dict) -> int:
    rows = data.get("value", [])
    for r in rows:
        upsert(cur, "risky_users", "id", r["id"], {
            "id":         r["id"],
            "risk_level": r.get("riskLevel", "none") or "none",
            "payload":    json.dumps(r),
        })
    return len(rows)


def seed_secure_score(cur, data: dict) -> int:
    payload = json.dumps(data)
    cur.execute(
        "MERGE dbo.secure_score AS t "
        "USING (VALUES (1, SYSUTCDATETIME(), ?)) AS s (singleton_id, refreshed_at, payload) "
        "ON t.singleton_id = s.singleton_id "
        "WHEN MATCHED THEN UPDATE SET t.payload = s.payload, t.refreshed_at = s.refreshed_at "
        "WHEN NOT MATCHED THEN INSERT (singleton_id, refreshed_at, payload) VALUES (s.singleton_id, s.refreshed_at, s.payload);",
        (payload,),
    )
    return 1


def seed_network_topology(cur, raw: dict) -> int:
    # Merge NSG details into subnets before storing
    nsgs = raw.get("nsgs", {})
    rts  = raw.get("routeTables", {})
    for vnet in raw.get("vnets", []):
        for subnet in vnet.get("subnets", []):
            subnet["nsgDetail"] = nsgs.get(subnet["nsg"]) if subnet.get("nsg") else None
            subnet["rtDetail"]  = rts.get(subnet["routeTable"]) if subnet.get("routeTable") else None

    topology = {
        "resourceGroups": raw["resourceGroups"],
        "vnets":          raw["vnets"],
        "peerings":       raw["peerings"],
    }
    payload = json.dumps(topology)
    cur.execute(
        "MERGE dbo.network_topology AS t "
        "USING (VALUES (1, SYSUTCDATETIME(), ?)) AS s (singleton_id, refreshed_at, payload) "
        "ON t.singleton_id = s.singleton_id "
        "WHEN MATCHED THEN UPDATE SET t.payload = s.payload, t.refreshed_at = s.refreshed_at "
        "WHEN NOT MATCHED THEN INSERT (singleton_id, refreshed_at, payload) VALUES (s.singleton_id, s.refreshed_at, s.payload);",
        (payload,),
    )
    return 1


SEEDERS = {
    "alerts":          seed_alerts,
    "incidents":       seed_incidents,
    "recommendations": seed_recommendations,
    "vulnerabilities": seed_vulnerabilities,
    "compliance":      seed_compliance,
    "resources":       seed_resources,
    "virtual_machines": seed_virtual_machines,
    "endpoints":       seed_endpoints,
    "signins":         seed_signins,
    "risky_users":     seed_risky_users,
    "secure_score":    seed_secure_score,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Azure SQL DB from mock JSON files")
    parser.add_argument("--conn",     required=True, help="Full ODBC connection string (from Azure Portal → Connection strings → ODBC)")
    parser.add_argument("--scenario", default="noisy", choices=["noisy", "compromised", "secured"])
    args = parser.parse_args()

    scenario_dir = SCENARIOS_DIR / args.scenario
    if not scenario_dir.exists():
        sys.exit(f"Scenario directory not found: {scenario_dir}")

    print("Connecting …")
    conn = get_connection(args.conn)
    cur  = conn.cursor()

    try:
        # Scenario-based tables
        for stem, seeder in SEEDERS.items():
            path = scenario_dir / f"{stem}.json"
            if not path.exists():
                print(f"  skip  {stem}.json (not found)")
                continue
            data  = json.loads(path.read_text())
            count = seeder(cur, data)
            print(f"  seeded {stem:<22} {count:>5} rows")

        # Network topology (shared across scenarios)
        if NETWORK_FILE.exists():
            raw   = json.loads(NETWORK_FILE.read_text())
            count = seed_network_topology(cur, raw)
            print(f"  seeded network_topology       {count:>5} row")
        else:
            print(f"  skip  network.json (not found at {NETWORK_FILE})")

        conn.commit()
        print("\nDone — all data committed.")
    except Exception as exc:
        conn.rollback()
        sys.exit(f"Error (rolled back): {exc}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
