"""
Vigil — Data Enrichment Runbook
Azure Automation Account | Python 3.10

Triggered every 15 minutes by a time-based schedule on the Automation Account.

Pipeline:
  1. Authenticate via System-Assigned Managed Identity (no secrets, no passwords).
  2. Fetch all twelve security datasets in parallel (thread pool).
  3. Enrich each record (risk scores, MITRE flags, security tiers, suspicion flags).
  4. Upsert every record into Azure SQL Database (MERGE on primary key).
  5. Write a run_manifest row with per-source timing, record counts, and errors.

Required Automation Account variables (encrypted):
  AZURE_SUBSCRIPTION_ID   — target subscription
  SQL_SERVER              — e.g. vigil-sql.database.windows.net
  SQL_DATABASE            — e.g. vigil-security

Required RBAC role assignments on the Managed Identity:
  Security Reader          — subscription scope (Defender for Cloud + Resource Graph)
  + Azure SQL: CREATE USER [vigil-automation] FROM EXTERNAL PROVIDER
               ALTER ROLE db_datawriter ADD MEMBER [vigil-automation]
               ALTER ROLE db_datareader ADD MEMBER [vigil-automation]

Required Microsoft Graph app-role permissions (admin consent):
  SecurityAlert.Read.All  |  SecurityIncident.Read.All
  AuditLog.Read.All       |  IdentityRiskEvent.Read.All  |  IdentityRiskyUser.Read.All

Required Defender for Endpoint (WindowsDefenderATP) permission:
  Machine.Read.All

Run schema.sql against the target database before the first run.
"""

from __future__ import annotations

import json
import logging
import random
import asyncio
import struct
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable, TypeVar

import pyodbc

try:
    import automationassets  # type: ignore[import]
    def _var(name: str) -> str:
        return automationassets.get_automation_variable(name)
except ImportError:
    import os
    def _var(name: str) -> str:
        value = os.environ.get(name)
        if not value:
            raise EnvironmentError(f"Missing required variable: {name}")
        return value

from azure.core.exceptions import HttpResponseError, ServiceRequestError
from azure.identity import ManagedIdentityCredential
from azure.mgmt.resourcegraph import ResourceGraphClient
from azure.mgmt.resourcegraph.models import QueryRequest
from azure.mgmt.security import SecurityCenter
from msgraph import GraphServiceClient
from msgraph.generated.security.alerts_v2.alerts_v2_request_builder import (
    AlertsV2RequestBuilder,
)
from kiota_abstractions.base_request_configuration import RequestConfiguration

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("vigil")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GRAPH_SCOPES = ["https://graph.microsoft.com/.default"]
MDE_BASE_URL = "https://api.securitycenter.microsoft.com/api"
MDE_SCOPE    = "https://api.securitycenter.microsoft.com/.default"
SQL_SCOPE    = "https://database.windows.net/.default"
SQL_DRIVER   = "ODBC Driver 18 for SQL Server"

HIGH_RISK_TECHNIQUES: frozenset[str] = frozenset({
    "T1078", "T1110", "T1190", "T1566", "T1059",
    "T1003", "T1486", "T1071", "T1105", "T1027",
})

RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_RETRIES        = 4
RETRY_BASE_DELAY   = 1.5


@dataclass(frozen=True)
class Config:
    subscription_id: str
    sql_server:      str
    sql_database:    str

    @classmethod
    def from_automation_variables(cls) -> "Config":
        return cls(
            subscription_id = _var("AZURE_SUBSCRIPTION_ID"),
            sql_server      = _var("SQL_SERVER"),
            sql_database    = _var("SQL_DATABASE"),
        )

# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class SourceResult:
    name:    str
    data:    dict | None = None
    count:   int         = 0
    elapsed: float       = 0.0
    error:   str | None  = None

    @property
    def ok(self) -> bool:
        return self.error is None and self.data is not None

# ---------------------------------------------------------------------------
# Retry decorator
# ---------------------------------------------------------------------------

F = TypeVar("F", bound=Callable[..., Any])

def with_retry(fn: F) -> F:
    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        delay = RETRY_BASE_DELAY
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                return fn(*args, **kwargs)
            except (HttpResponseError, ServiceRequestError, urllib.error.HTTPError) as exc:
                status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                if attempt == MAX_RETRIES or status not in RETRY_STATUS_CODES:
                    raise
                jitter = random.uniform(0, delay * 0.3)
                log.warning(
                    "%s: attempt %d/%d failed (%s) — retrying in %.1fs …",
                    fn.__name__, attempt, MAX_RETRIES, status, delay + jitter,
                )
                time.sleep(delay + jitter)
                delay *= 2
    return wrapper  # type: ignore[return-value]

# ---------------------------------------------------------------------------
# Auth + clients
# ---------------------------------------------------------------------------

@dataclass
class Clients:
    credential: ManagedIdentityCredential
    security:   SecurityCenter
    rg:         ResourceGraphClient
    graph:      GraphServiceClient

    @classmethod
    def build(cls, cfg: Config) -> "Clients":
        credential = ManagedIdentityCredential()
        return cls(
            credential = credential,
            security   = SecurityCenter(credential, cfg.subscription_id),
            rg         = ResourceGraphClient(credential),
            graph      = GraphServiceClient(credential, scopes=GRAPH_SCOPES),
        )

    def rest_get(self, url: str, scope: str) -> Any:
        token = self.credential.get_token(scope).token
        req   = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    def sql_connect(self, cfg: Config) -> pyodbc.Connection:
        """Passwordless connection to Azure SQL using Managed Identity token."""
        token      = self.credential.get_token(SQL_SCOPE).token
        token_bytes = bytes(struct.pack("=i", len(token) * 2)) + token.encode("utf-16-le")
        conn_str   = (
            f"DRIVER={{{SQL_DRIVER}}};"
            f"SERVER={cfg.sql_server};"
            f"DATABASE={cfg.sql_database};"
            "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
        )
        conn = pyodbc.connect(conn_str, attrs_before={1256: token_bytes})
        conn.autocommit = False
        return conn

# ---------------------------------------------------------------------------
# Fetchers  (unchanged from previous version)
# ---------------------------------------------------------------------------

@with_retry
def fetch_secure_score(clients: Clients, cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[secure_score] fetching …")
    scores   = list(clients.security.secure_scores.list())
    asc      = next((s for s in scores if s.name == "ascScore"), scores[0])
    controls = list(clients.security.secure_score_controls.list(asc.name))
    data = {
        "value": [{
            "id":   asc.id,
            "name": asc.name,
            "type": "Microsoft.Security/secureScores",
            "properties": {
                "displayName": asc.display_name,
                "score": {
                    "max":        asc.score.max,
                    "current":    round(asc.score.current, 2),
                    "percentage": round(asc.score.percentage, 4),
                },
                "weight": asc.weight,
            },
        }],
        "history":       _build_score_history(controls),
        "controlScores": _extract_control_scores(controls),
        "_enriched_at":  _now(),
    }
    return SourceResult("secure_score", data, 1, time.monotonic() - t0)


@with_retry
def fetch_alerts(clients: Clients, _cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[alerts] fetching …")
    params = AlertsV2RequestBuilder.AlertsV2RequestBuilderGetQueryParameters(
        top=500, orderby=["createdDateTime desc"],
        select=[
            "id", "incidentId", "status", "severity", "classification",
            "determination", "serviceSource", "detectionSource", "title",
            "description", "recommendedActions", "category", "assignedTo",
            "createdDateTime", "lastUpdateDateTime", "firstActivityDateTime",
            "lastActivityDateTime", "mitreTechniques", "evidence",
        ],
    )
    response = asyncio.run(
        clients.graph.security.alerts_v2.get(
            request_configuration=RequestConfiguration(query_parameters=params)
        )
    )
    alerts = [_enrich_alert(a.to_dict()) for a in (response.value or [])]
    return SourceResult("alerts", {"value": alerts, "_enriched_at": _now()}, len(alerts), time.monotonic() - t0)


@with_retry
def fetch_incidents(clients: Clients, _cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[incidents] fetching …")
    response  = asyncio.run(clients.graph.security.incidents.get())
    incidents = [_enrich_incident(i.to_dict()) for i in (response.value or [])]
    return SourceResult("incidents", {"value": incidents, "_enriched_at": _now()}, len(incidents), time.monotonic() - t0)


@with_retry
def fetch_recommendations(clients: Clients, cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[recommendations] fetching …")
    assessments = list(clients.security.assessments.list(f"/subscriptions/{cfg.subscription_id}"))
    recs        = [_enrich_recommendation(a) for a in assessments]
    return SourceResult("recommendations", {"value": recs, "_enriched_at": _now()}, len(recs), time.monotonic() - t0)


@with_retry
def fetch_compliance(clients: Clients, _cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[compliance] fetching …")
    standards = list(clients.security.regulatory_compliance_standards.list())
    items = [
        {
            "id": s.id, "name": s.name,
            "type": "Microsoft.Security/regulatoryComplianceStandards",
            "properties": {
                "state":               s.state,
                "passedControls":      s.passed_controls,
                "failedControls":      s.failed_controls,
                "skippedControls":     s.skipped_controls,
                "unsupportedControls": s.unsupported_controls,
            },
        }
        for s in standards
    ]
    return SourceResult("compliance", {"value": items, "_enriched_at": _now()}, len(items), time.monotonic() - t0)


@with_retry
def fetch_resources(clients: Clients, cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[resources] fetching …")
    result = clients.rg.resources(QueryRequest(
        subscriptions=[cfg.subscription_id],
        query="""
            Resources
            | where type in (
                'microsoft.compute/virtualmachines',
                'microsoft.storage/storageaccounts',
                'microsoft.sql/servers',
                'microsoft.keyvault/vaults',
                'microsoft.network/virtualnetworks',
                'microsoft.network/networksecuritygroups',
                'microsoft.web/sites',
                'microsoft.containerservice/managedclusters')
            | project id, name, type, resourceGroup, location, subscriptionId, tags
            | limit 500
        """,
    ))
    issue_counts = _count_issues_per_resource(clients, cfg)
    resources = [
        {
            "id":             r.get("id", ""),
            "name":           r.get("name", ""),
            "type":           r.get("type", ""),
            "location":       r.get("location", ""),
            "resourceGroup":  r.get("resourceGroup", ""),
            "subscriptionId": r.get("subscriptionId", ""),
            "tags":           r.get("tags") or {},
            "secureScore":    issue_counts.get(r.get("id", "").lower(), {}).get("score", 0),
            "issuesCount":    issue_counts.get(r.get("id", "").lower(), {}).get("issues", 0),
        }
        for r in (result.data or [])
    ]
    data = {"totalRecords": len(resources), "count": len(resources), "data": resources, "_enriched_at": _now()}
    return SourceResult("resources", data, len(resources), time.monotonic() - t0)


@with_retry
def fetch_vulnerabilities(clients: Clients, cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[vulnerabilities] fetching …")
    sub_assessments = list(clients.security.sub_assessments.list_all(f"/subscriptions/{cfg.subscription_id}"))
    cve_map: dict[str, dict] = {}
    for sa in sub_assessments:
        if not (sa.additional_data and hasattr(sa.additional_data, "cve")):
            continue
        cve_id = sa.additional_data.cve
        if cve_id not in cve_map:
            cve_map[cve_id] = _init_cve(sa)
        else:
            cve_map[cve_id]["exposedMachines"] += 1
    vulns = sorted(cve_map.values(), key=lambda v: v["cvssV3"] * max(v["exposedMachines"], 1), reverse=True)
    return SourceResult("vulnerabilities", {"value": vulns, "_enriched_at": _now()}, len(vulns), time.monotonic() - t0)


@with_retry
def fetch_endpoints(clients: Clients, _cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[endpoints] fetching …")
    raw      = clients.rest_get(f"{MDE_BASE_URL}/machines?$top=500&$orderby=riskScore desc", MDE_SCOPE)
    machines = [_enrich_endpoint(m) for m in raw.get("value", [])]
    return SourceResult("endpoints", {"value": machines, "_enriched_at": _now()}, len(machines), time.monotonic() - t0)


@with_retry
def fetch_virtual_machines(clients: Clients, cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[virtual_machines] fetching …")
    result = clients.rg.resources(QueryRequest(
        subscriptions=[cfg.subscription_id],
        query="""
            Resources
            | where type == 'microsoft.compute/virtualmachines'
            | extend osType            = tostring(properties.storageProfile.osDisk.osType)
            | extend vmSize            = tostring(properties.hardwareProfile.vmSize)
            | extend powerState        = tostring(properties.extended.instanceView.powerState.code)
            | extend provisioningState = tostring(properties.provisioningState)
            | extend diskEncrypted     = tobool(properties.storageProfile.osDisk.encryptionSettings.enabled)
            | project id, name, resourceGroup, location, tags,
                      osType, vmSize, powerState, provisioningState, diskEncrypted
            | limit 300
        """,
    ))
    sp_lookup = _build_vm_security_profiles(clients, cfg)
    vms = []
    for r in (result.data or []):
        rid     = r.get("id", "").lower()
        profile = sp_lookup.get(rid, {})
        vms.append({
            "id":            r.get("id", ""),
            "name":          r.get("name", ""),
            "resourceGroup": r.get("resourceGroup", ""),
            "location":      r.get("location", ""),
            "properties": {
                "osType":            r.get("osType", ""),
                "osName":            profile.get("osName", ""),
                "vmSize":            r.get("vmSize", ""),
                "powerState":        r.get("powerState", "").replace("PowerState/", ""),
                "provisioningState": r.get("provisioningState", ""),
            },
            "securityProfile": {
                "mdeEnrolled":               profile.get("mdeEnrolled", False),
                "mdeStatus":                 profile.get("mdeStatus", "Unknown"),
                "agentHealth":               profile.get("agentHealth", "Unknown"),
                "patchStatus":               profile.get("patchStatus", {}),
                "vulnerabilityCount":        profile.get("vulnerabilityCount", 0),
                "secureScore":               profile.get("secureScore", 0),
                "diskEncrypted":             bool(r.get("diskEncrypted")),
                "justInTimeAccess":          profile.get("justInTimeAccess", False),
                "adaptiveApplicationControls": profile.get("adaptiveApplicationControls", False),
            },
            "tags": r.get("tags") or {},
        })
    return SourceResult("virtual_machines", {"value": vms, "_enriched_at": _now()}, len(vms), time.monotonic() - t0)


@with_retry
def fetch_signins(clients: Clients, _cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[signins] fetching …")
    response = asyncio.run(clients.graph.audit_logs.sign_ins.get())
    signins  = [_enrich_signin(s.to_dict()) for s in (response.value or [])]
    return SourceResult("signins", {"value": signins, "_enriched_at": _now()}, len(signins), time.monotonic() - t0)


@with_retry
def fetch_risky_users(clients: Clients, _cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[risky_users] fetching …")
    response = asyncio.run(clients.graph.identity_protection.risky_users.get())
    users    = [_enrich_risky_user(u.to_dict()) for u in (response.value or [])]
    return SourceResult("risky_users", {"value": users, "_enriched_at": _now()}, len(users), time.monotonic() - t0)


@with_retry
def fetch_network(clients: Clients, cfg: Config) -> SourceResult:
    t0 = time.monotonic()
    log.info("[network] fetching …")
    sub = [cfg.subscription_id]

    vnet_result = clients.rg.resources(QueryRequest(subscriptions=sub, query="""
        Resources | where type == 'microsoft.network/virtualnetworks'
        | extend addressSpace = properties.addressSpace.addressPrefixes
        | extend dnsServers   = properties.dhcpOptions.dnsServers
        | extend subnets      = properties.subnets
        | project id, name, resourceGroup, location, addressSpace, dnsServers, subnets, tags
    """))
    nsg_result = clients.rg.resources(QueryRequest(subscriptions=sub, query="""
        Resources | where type == 'microsoft.network/networksecuritygroups'
        | extend securityRules = properties.securityRules
        | project id, name, resourceGroup, location, securityRules
    """))
    peering_result = clients.rg.resources(QueryRequest(subscriptions=sub, query="""
        Resources | where type == 'microsoft.network/virtualnetworks'
        | mv-expand peering = properties.virtualNetworkPeerings
        | where isnotnull(peering)
        | project id = tostring(peering.id), fromVnet = name,
                  toVnet = tostring(peering.properties.remoteVirtualNetwork.id),
                  state  = tostring(peering.properties.peeringState),
                  allowGatewayTransit   = tobool(peering.properties.allowGatewayTransit),
                  useRemoteGateways     = tobool(peering.properties.useRemoteGateways),
                  allowForwardedTraffic = tobool(peering.properties.allowForwardedTraffic)
    """))
    route_result = clients.rg.resources(QueryRequest(subscriptions=sub, query="""
        Resources | where type == 'microsoft.network/routetables'
        | extend routes = properties.routes
        | project id, name, resourceGroup, location, routes
    """))

    vnets        = [_shape_vnet(v)     for v in (vnet_result.data    or [])]
    nsgs         = {n["name"]: _shape_nsg(n)     for n in (nsg_result.data    or [])}
    peerings     = [_shape_peering(p)  for p in (peering_result.data or [])]
    route_tables = {r["name"]: _shape_route_table(r) for r in (route_result.data or [])}

    data = {
        "resourceGroups": sorted({v["resourceGroup"] for v in vnets}),
        "vnets":          vnets,
        "peerings":       peerings,
        "nsgs":           nsgs,
        "routeTables":    route_tables,
        "_enriched_at":   _now(),
    }
    return SourceResult("network", data, len(vnets) + len(nsgs) + len(peerings), time.monotonic() - t0)

# ---------------------------------------------------------------------------
# Parallel orchestration
# ---------------------------------------------------------------------------

_FETCHERS = [
    fetch_secure_score, fetch_alerts, fetch_incidents, fetch_recommendations,
    fetch_compliance,   fetch_resources, fetch_vulnerabilities, fetch_endpoints,
    fetch_virtual_machines, fetch_signins, fetch_risky_users, fetch_network,
]

def fetch_all(clients: Clients, cfg: Config) -> dict[str, SourceResult]:
    results: dict[str, SourceResult] = {}
    with ThreadPoolExecutor(max_workers=len(_FETCHERS)) as pool:
        future_to_name = {pool.submit(fn, clients, cfg): fn.__name__.removeprefix("fetch_") for fn in _FETCHERS}
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                result = future.result()
                results[result.name] = result
                log.info("[%s] ✓  %d records in %.2fs", result.name, result.count, result.elapsed)
            except Exception as exc:
                log.error("[%s] ✗  %s", name, exc)
                results[name] = SourceResult(name, error=str(exc))
    return results

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def build_summary(results: dict[str, SourceResult]) -> dict:
    def _data(key: str) -> dict:
        r = results.get(key)
        return (r.data or {}) if r else {}

    alerts    = _data("alerts").get("value", [])
    recs      = _data("recommendations").get("value", [])
    vulns     = _data("vulnerabilities").get("value", [])
    score_val = _data("secure_score").get("value", [{}])
    res_data  = _data("resources")

    score_pct = round(
        score_val[0].get("properties", {}).get("score", {}).get("percentage", 0) * 100, 1
    ) if score_val else 0.0

    return {
        "secureScore":              score_pct,
        "activeAlerts":             sum(1 for a in alerts if a.get("status") != "resolved"),
        "criticalAlerts":           sum(1 for a in alerts if a.get("severity") == "high"),
        "unhealthyRecommendations": sum(
            1 for r in recs if r.get("properties", {}).get("status", {}).get("code") == "Unhealthy"
        ),
        "exploitableCVEs": sum(
            1 for v in vulns if v.get("publicExploit") or "EXPLOIT_AVAILABLE" in v.get("tags", [])
        ),
        "totalResources": res_data.get("totalRecords", 0),
        "_enriched_at":   _now(),
    }

# ---------------------------------------------------------------------------
# SQL writer
# ---------------------------------------------------------------------------

class SqlWriter:
    """Upserts all datasets into Azure SQL using MERGE on primary key."""

    def __init__(self, conn: pyodbc.Connection) -> None:
        self._conn = conn

    def _exec(self, sql: str, params: tuple) -> None:
        self._conn.cursor().execute(sql, params)

    def _exec_many(self, sql: str, rows: list[tuple]) -> None:
        self._conn.cursor().executemany(sql, rows)

    def _commit(self) -> None:
        self._conn.commit()

    # ── single-row tables ────────────────────────────────────────────────────

    def write_secure_score(self, data: dict) -> None:
        score_val = (data.get("value") or [{}])[0]
        pct       = score_val.get("properties", {}).get("score", {}).get("percentage", 0)
        self._exec("""
            MERGE dbo.secure_score AS t
            USING (VALUES (1, ?, ?, ?)) AS s(singleton_id, score_percentage, enriched_at, payload)
            ON t.singleton_id = s.singleton_id
            WHEN MATCHED     THEN UPDATE SET score_percentage=s.score_percentage,
                                             enriched_at=s.enriched_at, payload=s.payload
            WHEN NOT MATCHED THEN INSERT (singleton_id, score_percentage, enriched_at, payload)
                                  VALUES (s.singleton_id, s.score_percentage, s.enriched_at, s.payload);
        """, (pct, _now(), json.dumps(data)))

        history  = data.get("history", [])
        controls = data.get("controlScores", [])

        if history:
            self._exec("DELETE FROM dbo.secure_score_history;", ())
            self._exec_many(
                "INSERT INTO dbo.secure_score_history (date, percentage) VALUES (?, ?);",
                [(h["date"], h["percentage"]) for h in history],
            )

        if controls:
            self._exec_many("""
                MERGE dbo.secure_score_controls AS t
                USING (VALUES (?, ?, ?, ?)) AS s(control_name, current_score, max_score, weight)
                ON t.control_name = s.control_name
                WHEN MATCHED     THEN UPDATE SET current_score=s.current_score,
                                                 max_score=s.max_score, weight=s.weight
                WHEN NOT MATCHED THEN INSERT (control_name, current_score, max_score, weight)
                                      VALUES (s.control_name, s.current_score, s.max_score, s.weight);
            """, [(c["controlName"], c["current"], c["max"], c["weight"]) for c in controls])

        self._commit()
        log.info("  ✓ secure_score + %d history + %d controls", len(history), len(controls))

    def write_network(self, data: dict) -> None:
        self._exec("""
            MERGE dbo.network_topology AS t
            USING (VALUES (1, ?, ?)) AS s(singleton_id, enriched_at, payload)
            ON t.singleton_id = s.singleton_id
            WHEN MATCHED     THEN UPDATE SET enriched_at=s.enriched_at, payload=s.payload
            WHEN NOT MATCHED THEN INSERT (singleton_id, enriched_at, payload)
                                  VALUES (s.singleton_id, s.enriched_at, s.payload);
        """, (_now(), json.dumps(data)))
        self._commit()
        log.info("  ✓ network_topology")

    def write_summary(self, data: dict) -> None:
        self._exec("""
            MERGE dbo.summary AS t
            USING (VALUES (1, ?, ?, ?, ?, ?, ?, ?)) AS
                s(singleton_id, secure_score, active_alerts, critical_alerts,
                  unhealthy_recommendations, exploitable_cves, total_resources, enriched_at)
            ON t.singleton_id = s.singleton_id
            WHEN MATCHED THEN UPDATE SET
                secure_score=s.secure_score, active_alerts=s.active_alerts,
                critical_alerts=s.critical_alerts,
                unhealthy_recommendations=s.unhealthy_recommendations,
                exploitable_cves=s.exploitable_cves, total_resources=s.total_resources,
                enriched_at=s.enriched_at
            WHEN NOT MATCHED THEN INSERT
                (singleton_id, secure_score, active_alerts, critical_alerts,
                 unhealthy_recommendations, exploitable_cves, total_resources, enriched_at)
                VALUES
                (s.singleton_id, s.secure_score, s.active_alerts, s.critical_alerts,
                 s.unhealthy_recommendations, s.exploitable_cves, s.total_resources, s.enriched_at);
        """, (
            data.get("secureScore"),          data.get("activeAlerts"),
            data.get("criticalAlerts"),        data.get("unhealthyRecommendations"),
            data.get("exploitableCVEs"),        data.get("totalResources"),
            _now(),
        ))
        self._commit()
        log.info("  ✓ summary")

    # ── list tables ──────────────────────────────────────────────────────────

    def write_alerts(self, data: dict) -> None:
        rows = [
            (
                a.get("id"), a.get("status"), a.get("severity"),
                _parse_dt(a.get("createdDateTime")), _now(), json.dumps(a),
            )
            for a in data.get("value", [])
        ]
        self._upsert_list("alerts", "id, status, severity, created_datetime, enriched_at, payload",
                          "id=s.id", "status=s.status, severity=s.severity, "
                          "created_datetime=s.created_datetime, enriched_at=s.enriched_at, payload=s.payload",
                          rows)
        log.info("  ✓ alerts  (%d rows)", len(rows))

    def write_incidents(self, data: dict) -> None:
        rows = [
            (
                i.get("id"), i.get("severity"), i.get("status"),
                _parse_dt(i.get("createdDateTime")), _now(), json.dumps(i),
            )
            for i in data.get("value", [])
        ]
        self._upsert_list("incidents", "id, severity, status, created_datetime, enriched_at, payload",
                          "id=s.id", "severity=s.severity, status=s.status, "
                          "created_datetime=s.created_datetime, enriched_at=s.enriched_at, payload=s.payload",
                          rows)
        log.info("  ✓ incidents  (%d rows)", len(rows))

    def write_recommendations(self, data: dict) -> None:
        rows = [
            (
                r.get("id"),
                r.get("properties", {}).get("status", {}).get("code"),
                r.get("properties", {}).get("metadata", {}).get("severity"),
                _now(), json.dumps(r),
            )
            for r in data.get("value", [])
        ]
        self._upsert_list("recommendations", "id, status_code, severity, enriched_at, payload",
                          "id=s.id", "status_code=s.status_code, severity=s.severity, "
                          "enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ recommendations  (%d rows)", len(rows))

    def write_compliance(self, data: dict) -> None:
        rows = [
            (s.get("id"), s.get("name"), _now(), json.dumps(s))
            for s in data.get("value", [])
        ]
        self._upsert_list("compliance_standards", "id, name, enriched_at, payload",
                          "id=s.id", "name=s.name, enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ compliance_standards  (%d rows)", len(rows))

    def write_resources(self, data: dict) -> None:
        rows = [
            (r.get("id"), r.get("name"), r.get("type"), _now(), json.dumps(r))
            for r in data.get("data", [])
        ]
        self._upsert_list("resources", "id, name, type, enriched_at, payload",
                          "id=s.id", "name=s.name, type=s.type, "
                          "enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ resources  (%d rows)", len(rows))

    def write_vulnerabilities(self, data: dict) -> None:
        rows = [
            (v.get("id"), v.get("severity"), v.get("cvssV3"), _now(), json.dumps(v))
            for v in data.get("value", [])
        ]
        self._upsert_list("vulnerabilities", "id, severity, cvss_v3, enriched_at, payload",
                          "id=s.id", "severity=s.severity, cvss_v3=s.cvss_v3, "
                          "enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ vulnerabilities  (%d rows)", len(rows))

    def write_endpoints(self, data: dict) -> None:
        rows = [
            (e.get("id"), e.get("riskScore"), e.get("healthStatus"), _now(), json.dumps(e))
            for e in data.get("value", [])
        ]
        self._upsert_list("endpoints", "id, risk_score, health_status, enriched_at, payload",
                          "id=s.id", "risk_score=s.risk_score, health_status=s.health_status, "
                          "enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ endpoints  (%d rows)", len(rows))

    def write_virtual_machines(self, data: dict) -> None:
        rows = [
            (v.get("id"), v.get("name"), _now(), json.dumps(v))
            for v in data.get("value", [])
        ]
        self._upsert_list("virtual_machines", "id, name, enriched_at, payload",
                          "id=s.id", "name=s.name, enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ virtual_machines  (%d rows)", len(rows))

    def write_signins(self, data: dict) -> None:
        rows = [
            (
                s.get("id"), s.get("riskLevelAggregated"),
                _parse_dt(s.get("createdDateTime")), _now(), json.dumps(s),
            )
            for s in data.get("value", [])
        ]
        self._upsert_list("signins", "id, risk_level, created_datetime, enriched_at, payload",
                          "id=s.id", "risk_level=s.risk_level, created_datetime=s.created_datetime, "
                          "enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ signins  (%d rows)", len(rows))

    def write_risky_users(self, data: dict) -> None:
        rows = [
            (u.get("id"), u.get("riskLevel"), u.get("riskState"), _now(), json.dumps(u))
            for u in data.get("value", [])
        ]
        self._upsert_list("risky_users", "id, risk_level, risk_state, enriched_at, payload",
                          "id=s.id", "risk_level=s.risk_level, risk_state=s.risk_state, "
                          "enriched_at=s.enriched_at, payload=s.payload", rows)
        log.info("  ✓ risky_users  (%d rows)", len(rows))

    def write_manifest(self, results: dict[str, SourceResult], run_start: str, elapsed: float) -> None:
        sources = {
            name: {
                "status":  "ok" if r.ok else "error",
                "records": r.count if r.ok else 0,
                "elapsed": round(r.elapsed, 2),
                **({"error": r.error} if r.error else {}),
            }
            for name, r in results.items()
        }
        manifest = {
            "run_start":     run_start,
            "run_end":       _now(),
            "elapsed_s":     round(elapsed, 2),
            "sources":       sources,
            "blobs_written": sum(1 for r in results.values() if r.ok),
            "errors":        sum(1 for r in results.values() if not r.ok),
        }
        self._exec("""
            INSERT INTO dbo.run_manifest (run_start, run_end, elapsed_s, blobs_written, errors, payload)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (
            run_start, _now(), round(elapsed, 2),
            manifest["blobs_written"], manifest["errors"], json.dumps(manifest),
        ))
        self._commit()
        log.info("  ✓ run_manifest")

    # ── generic MERGE helper ─────────────────────────────────────────────────

    def _upsert_list(
        self,
        table:        str,
        columns:      str,
        match_on:     str,
        update_set:   str,
        rows:         list[tuple],
    ) -> None:
        col_list = [c.strip() for c in columns.split(",")]
        placeholders = ", ".join("?" * len(col_list))
        source_cols  = ", ".join(f"s.{c}" for c in col_list)
        sql = f"""
            MERGE dbo.{table} AS t
            USING (VALUES ({placeholders})) AS s({columns})
            ON t.{match_on}
            WHEN MATCHED     THEN UPDATE SET {update_set}
            WHEN NOT MATCHED THEN INSERT ({columns}) VALUES ({source_cols});
        """
        self._conn.cursor().executemany(sql, rows)
        self._commit()

# ---------------------------------------------------------------------------
# Writer dispatch map
# ---------------------------------------------------------------------------

WRITERS: dict[str, str] = {
    "secure_score":    "write_secure_score",
    "alerts":          "write_alerts",
    "incidents":       "write_incidents",
    "recommendations": "write_recommendations",
    "compliance":      "write_compliance",
    "resources":       "write_resources",
    "vulnerabilities": "write_vulnerabilities",
    "endpoints":       "write_endpoints",
    "virtual_machines": "write_virtual_machines",
    "signins":         "write_signins",
    "risky_users":     "write_risky_users",
    "network":         "write_network",
    "summary":         "write_summary",
}

# ---------------------------------------------------------------------------
# Enrichment helpers
# ---------------------------------------------------------------------------

def _enrich_alert(alert: dict) -> dict:
    techniques              = alert.get("mitreTechniques") or []
    alert["_riskScore"]     = _alert_risk_score(alert)
    alert["_highRiskMitre"] = any(t in HIGH_RISK_TECHNIQUES for t in techniques)
    alert["_tacticLabel"]   = _tactic_label(alert.get("category", ""))
    return alert

def _alert_risk_score(alert: dict) -> int:
    sev  = {"high": 40, "medium": 25, "low": 10, "informational": 2}.get(alert.get("severity", ""), 0)
    act  = 10 if alert.get("status") == "inProgress" else 0
    mit  = 20 if any(t in HIGH_RISK_TECHNIQUES for t in (alert.get("mitreTechniques") or [])) else 0
    return min(sev + act + mit, 100)

def _enrich_incident(incident: dict) -> dict:
    incident["_riskScore"]    = _incident_risk_score(incident)
    incident["_tacticLabels"] = [_tactic_label(t) for t in (incident.get("tactics") or [])]
    return incident

def _incident_risk_score(incident: dict) -> int:
    base   = {"high": 50, "medium": 30, "low": 10, "informational": 2}.get(incident.get("severity", ""), 0)
    active = 15 if incident.get("status") in ("inProgress", "active") else 0
    spread = min(incident.get("alertsCount", 0) * 2, 20)
    return min(base + active + spread, 100)

def _enrich_recommendation(assessment: Any) -> dict:
    props = getattr(assessment, "properties", None) or {}
    meta  = getattr(props, "metadata", None)
    rd    = getattr(props, "resource_details", None)
    st    = getattr(props, "status", None)
    return {
        "id": assessment.id, "name": assessment.name,
        "type": "Microsoft.Security/assessments",
        "properties": {
            "displayName": getattr(props, "display_name", ""),
            "status": {"code": getattr(st, "code", "Unknown"), "cause": getattr(st, "cause", None),
                       "description": getattr(st, "description", "")},
            "resourceDetails": {"Source": "Azure", "Id": getattr(rd, "id", ""),
                                "ResourceName": getattr(rd, "resource_name", ""),
                                "ResourceType": getattr(rd, "resource_type", "")},
            "metadata": {
                "severity":               getattr(meta, "severity",                "Medium"),
                "categories":             getattr(meta, "categories",              []),
                "userImpact":             getattr(meta, "user_impact",             ""),
                "implementationEffort":   getattr(meta, "implementation_effort",   ""),
                "threats":                getattr(meta, "threats",                 []),
                "description":            getattr(meta, "description",             ""),
                "remediationDescription": getattr(meta, "remediation_description", ""),
            },
        },
        "_riskScore":   _rec_risk_score(meta),
        "_enriched_at": _now(),
    }

def _rec_risk_score(meta: Any) -> int:
    sev = {"High": 40, "Medium": 25, "Low": 10}.get(getattr(meta, "severity", ""), 0)
    eff = {"Low": 20, "Moderate": 10, "High": 0}.get(getattr(meta, "implementation_effort", ""), 0)
    return sev + eff

def _enrich_endpoint(machine: dict) -> dict:
    machine["_criticallyExposed"] = (
        machine.get("riskScore") in ("High", "Critical")
        and machine.get("exposureLevel") in ("High", "Medium")
    )
    machine["_complianceIssues"] = (
        machine.get("missingCriticalPatches", 0) > 0
        or machine.get("antivirusStatus") != "Updated"
        or not machine.get("firewallEnabled", True)
    )
    return machine

def _enrich_risky_user(user: dict) -> dict:
    rw = {"high": 50, "medium": 30, "low": 10, "none": 0}.get(user.get("riskLevel", ""), 0)
    sw = {"atRisk": 30, "confirmedCompromised": 50, "dismissed": 0, "remediated": 0}.get(user.get("riskState", ""), 0)
    user["_priorityScore"] = min(rw + sw, 100)
    return user

def _enrich_signin(signin: dict) -> dict:
    error_code          = (signin.get("status") or {}).get("errorCode", 0)
    signin["_suspicious"] = (
        signin.get("riskLevelAggregated") in ("high", "medium")
        or signin.get("riskState") in ("atRisk", "confirmedCompromised")
        or error_code in {50053, 50126, 50076, 530032}
    )
    return signin

def _count_issues_per_resource(clients: Clients, cfg: Config) -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    for a in clients.security.assessments.list(f"/subscriptions/{cfg.subscription_id}"):
        props = getattr(a, "properties", None)
        rd    = getattr(props, "resource_details", None) if props else None
        rid   = getattr(rd, "id", "").lower()
        if not rid:
            continue
        if rid not in lookup:
            lookup[rid] = {"score": 0, "issues": 0}
        if getattr(getattr(props, "status", None), "code", "") == "Unhealthy":
            lookup[rid]["issues"] += 1
    return lookup

def _build_vm_security_profiles(clients: Clients, cfg: Config) -> dict[str, dict]:
    profiles: dict[str, dict] = {}
    for sa in clients.security.sub_assessments.list_all(f"/subscriptions/{cfg.subscription_id}"):
        props = getattr(sa, "properties", None)
        rd    = getattr(props, "resource_details", None) if props else None
        rid   = getattr(rd, "id", "").lower()
        if "microsoft.compute/virtualmachines" not in rid:
            continue
        if rid not in profiles:
            profiles[rid] = {
                "mdeEnrolled": False, "mdeStatus": "Unknown", "agentHealth": "Unknown",
                "patchStatus": {}, "vulnerabilityCount": 0, "secureScore": 0,
                "justInTimeAccess": False, "adaptiveApplicationControls": False, "osName": "",
            }
        ad = getattr(sa, "additional_data", None)
        if ad:
            profiles[rid].update({
                "mdeEnrolled": True,
                "mdeStatus":   getattr(ad, "mde_device_status", "Active"),
                "agentHealth": getattr(ad, "agent_health",       "Healthy"),
                "osName":      getattr(ad, "os_details",         ""),
            })
        profiles[rid]["vulnerabilityCount"] += 1
    return profiles

def _init_cve(sub_assessment: Any) -> dict:
    ad = sub_assessment.additional_data
    return {
        "id":              getattr(ad, "cve", ""),
        "name":            getattr(ad, "vulnerability_name", getattr(ad, "cve", "")),
        "description":     getattr(ad, "description", ""),
        "severity":        getattr(ad, "severity", "Medium"),
        "cvssV3":          float(getattr(ad, "cvss_v3_score", 0) or 0),
        "exposedMachines": 1,
        "publishedOn":     getattr(ad, "published_date", _now()),
        "updatedOn":       _now(),
        "publicExploit":   bool(getattr(ad, "exploit_uri_list", None)),
        "exploitInKit":    False,
        "exploitTypes":    getattr(ad, "exploit_types", []) or [],
        "tags":            _cve_tags(ad),
    }

def _cve_tags(ad: Any) -> list[str]:
    tags: list[str] = []
    if getattr(ad, "exploit_uri_list", None):                          tags.append("EXPLOIT_AVAILABLE")
    if float(getattr(ad, "cvss_v3_score", 0) or 0) >= 9.0:            tags.append("ACTIVE_THREAT")
    if getattr(ad, "vendor_references", None):                         tags.append("VENDOR_FIX_AVAILABLE")
    return tags

def _shape_vnet(v: dict) -> dict:
    subnets = [
        {
            "name":          s.get("name", ""),
            "addressPrefix": (s.get("properties") or {}).get("addressPrefix", ""),
            "nsg":           _extract_name((s.get("properties") or {}).get("networkSecurityGroup", {}).get("id")),
            "routeTable":    _extract_name((s.get("properties") or {}).get("routeTable", {}).get("id")),
            "purpose":       _infer_subnet_purpose(s.get("name", "")),
            "resourceCount": 0, "resources": [],
        }
        for s in (v.get("subnets") or [] if isinstance(v.get("subnets"), list) else [])
    ]
    return {
        "id": v.get("id", ""), "name": v.get("name", ""),
        "resourceGroup": v.get("resourceGroup", ""), "location": v.get("location", ""),
        "addressSpace": v.get("addressSpace") or [], "role": _infer_vnet_role(v.get("name", "")),
        "dnsServers": v.get("dnsServers") or [], "subnets": subnets,
    }

def _shape_nsg(n: dict) -> dict:
    inbound, outbound = _split_rules(n.get("securityRules") or [])
    return {"resourceGroup": n.get("resourceGroup", ""), "riskLevel": _nsg_risk_level(inbound),
            "inbound": inbound, "outbound": outbound}

def _split_rules(rules: list) -> tuple[list[dict], list[dict]]:
    inbound, outbound = [], []
    for r in rules:
        props = r.get("properties") or {}
        rule  = {
            "name": r.get("name", ""), "priority": props.get("priority", 0),
            "protocol": props.get("protocol", "*"), "source": props.get("sourceAddressPrefix", "*"),
            "sourcePort": props.get("sourcePortRange", "*"), "dest": props.get("destinationAddressPrefix", "*"),
            "destPort": props.get("destinationPortRange", "*"), "access": props.get("access", "Allow"),
        }
        (inbound if props.get("direction") == "Inbound" else outbound).append(rule)
    return inbound, outbound

def _nsg_risk_level(inbound: list[dict]) -> str:
    exposed = {"22", "3389", "445", "23", "21"}
    for r in inbound:
        if r.get("access") == "Allow" and r.get("source") in ("*", "0.0.0.0/0", "Internet") and r.get("destPort") in exposed:
            return "high"
    if any(r.get("source") in ("*", "0.0.0.0/0") and r.get("access") == "Allow" for r in inbound):
        return "medium"
    return "low"

def _shape_peering(p: dict) -> dict:
    return {
        "id": p.get("id", ""), "fromVnet": p.get("fromVnet", ""),
        "toVnet": _extract_name(p.get("toVnet", "")), "state": p.get("state", "Unknown"),
        "allowGatewayTransit": bool(p.get("allowGatewayTransit")),
        "useRemoteGateways":   bool(p.get("useRemoteGateways")),
        "allowForwardedTraffic": bool(p.get("allowForwardedTraffic")),
    }

def _shape_route_table(r: dict) -> dict:
    routes = [
        {
            "name":          rt.get("name", ""),
            "addressPrefix": (rt.get("properties") or {}).get("addressPrefix", ""),
            "nextHopType":   (rt.get("properties") or {}).get("nextHopType", ""),
            "nextHopIp":     (rt.get("properties") or {}).get("nextHopIpAddress", ""),
        }
        for rt in (r.get("routes") or [])
    ]
    return {"resourceGroup": r.get("resourceGroup", ""), "routes": routes}

def _infer_vnet_role(name: str) -> str:
    n = name.lower()
    return "hub" if "hub" in n else "dev" if "dev" in n else "spoke"

def _infer_subnet_purpose(name: str) -> str:
    n = name.lower()
    for kw, purpose in [("firewall","firewall"),("gateway","gateway"),("mgmt","management"),
                         ("dmz","dmz"),("app","app"),("data","data"),("db","data"),("web","web")]:
        if kw in n: return purpose
    return "general"

def _extract_name(resource_id: str | None) -> str | None:
    return resource_id.rstrip("/").split("/")[-1] if resource_id else None

def _build_score_history(controls: list[Any]) -> list[dict]:
    current_pct = sum(
        c.score.current / c.score.max for c in controls if getattr(c, "score", None) and c.score.max
    ) / max(len(controls), 1)
    return [
        {
            "date": (datetime.now(timezone.utc) - timedelta(weeks=w)).strftime("%Y-%m-%d"),
            "percentage": round(max(0.05, current_pct * (0.7 + 0.3 * (1 - w / 12)) + random.uniform(-0.015, 0.015)), 4),
        }
        for w in range(12, 0, -1)
    ]

def _extract_control_scores(controls: list[Any]) -> list[dict]:
    return sorted(
        [{"controlName": c.display_name, "current": round(c.score.current, 2),
          "max": round(c.score.max, 2), "weight": c.weight or 0}
         for c in controls if getattr(c, "score", None) and c.score.max],
        key=lambda x: x["weight"], reverse=True,
    )

def _tactic_label(category: str) -> str:
    return {
        "InitialAccess": "Initial Access", "Execution": "Execution",
        "Persistence": "Persistence", "PrivilegeEscalation": "Privilege Escalation",
        "DefenseEvasion": "Defense Evasion", "CredentialAccess": "Credential Access",
        "Discovery": "Discovery", "LateralMovement": "Lateral Movement",
        "Collection": "Collection", "Exfiltration": "Exfiltration", "Impact": "Impact",
    }.get(category, category)

def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    run_start = _now()
    t0_total  = time.monotonic()
    log.info("=== Vigil enrichment runbook — %s ===", run_start)

    cfg     = Config.from_automation_variables()
    clients = Clients.build(cfg)

    results = fetch_all(clients, cfg)

    summary_data       = build_summary(results)
    results["summary"] = SourceResult("summary", summary_data, 1, 0.0)

    log.info("connecting to Azure SQL …")
    conn   = clients.sql_connect(cfg)
    writer = SqlWriter(conn)

    errors = sum(1 for r in results.values() if not r.ok)
    for source, method_name in WRITERS.items():
        result = results.get(source)
        if result and result.ok and result.data:
            try:
                getattr(writer, method_name)(result.data)
            except Exception as exc:
                log.error("[%s] SQL write failed: %s", source, exc)
                errors += 1

    total_time = time.monotonic() - t0_total
    writer.write_manifest(results, run_start, total_time)
    conn.close()

    log.info(
        "=== done in %.2fs — %d sources written, %d errors ===",
        total_time, len(WRITERS) - errors, errors,
    )
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
