import asyncio

from fastapi import APIRouter, Depends

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/summary", tags=["summary"])


def _bucket_by_severity(items: list[dict], severity_key: str = "severity") -> dict:
    counts: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    for item in items:
        sev = item.get(severity_key, "").lower()
        if sev in counts:
            counts[sev] += 1
    counts["total"] = sum(counts.values())
    return counts


@router.get("")
async def get_summary(ds: DataSource = Depends(get_data_source)):
    score, recs, alerts, vulns, compliance = await asyncio.gather(
        ds.get_secure_score(),
        ds.get_recommendations(),
        ds.get_alerts(),
        ds.get_vulnerabilities(),
        ds.get_compliance(),
    )

    score_pct = score["value"][0]["properties"]["score"]["percentage"] * 100

    unhealthy = [
        r for r in recs if r["properties"]["status"]["code"] == "Unhealthy"
    ]
    unhealthy_by_sev = _bucket_by_severity(
        [{"severity": r["properties"]["metadata"]["severity"]} for r in unhealthy]
    )

    open_alerts = [a for a in alerts if a["status"] == "new"]
    alerts_by_sev = _bucket_by_severity(open_alerts)

    exploitable_cves = sum(
        1 for v in vulns if v.get("publicExploit") and v.get("exposedMachines", 0) > 0
    )
    failing_controls = sum(c["properties"]["failedControls"] for c in compliance)

    resources = await ds.get_resources()

    return {
        "secureScorePct": round(score_pct, 2),
        "openAlerts": alerts_by_sev,
        "unhealthyRecommendations": unhealthy_by_sev,
        "exploitableCves": exploitable_cves,
        "totalResources": len(resources),
        "complianceFailingControls": failing_controls,
    }
