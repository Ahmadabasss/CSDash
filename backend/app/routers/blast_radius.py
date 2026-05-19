from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/blast-radius", tags=["blast-radius"])


@router.get("/{resource_name:path}", summary="Blast radius graph for a resource")
async def get_blast_radius(resource_name: str, ds: DataSource = Depends(get_data_source)):
    all_resources = await ds.get_resources()
    center = next(
        (r for r in all_resources if r["name"] == resource_name or r["id"] == resource_name),
        None,
    )
    if not center:
        raise HTTPException(404, "Resource not found")

    all_alerts = await ds.get_alerts()

    def alerts_for(resource_id: str) -> list[dict]:
        rid = resource_id.lower()
        return [
            a for a in all_alerts
            if any(rid in ev.get("resourceId", "").lower() for ev in a.get("evidence", []))
        ]

    center_alerts = alerts_for(center["id"])

    # Neighbors = same resource group, capped at 14 for visual clarity
    neighbors = [r for r in all_resources if r["resourceGroup"] == center["resourceGroup"] and r["id"] != center["id"]][:14]

    nodes = []
    for res in neighbors:
        shared = alerts_for(res["id"])
        issues = res.get("issuesCount", 0)
        risk = "high" if issues >= 5 or len(shared) >= 2 else "medium" if issues >= 2 or shared else "low"
        nodes.append({
            **res,
            "relationship": "shared-alert" if shared else "same-rg",
            "sharedAlertCount": len(shared),
            "risk": risk,
        })

    nodes.sort(key=lambda n: (-n["sharedAlertCount"], -n.get("issuesCount", 0)))

    # Collect affected users from all alerts touching this RG
    rg_ids = {center["id"]} | {n["id"] for n in nodes}
    users: dict[str, dict] = {}
    for alert in all_alerts:
        touches_rg = any(
            any(rid.lower() in ev.get("resourceId", "").lower() for ev in alert.get("evidence", []))
            for rid in rg_ids
        )
        if touches_rg:
            for ev in alert.get("evidence", []):
                if ev.get("@odata.type", "").endswith("userEvidence"):
                    ua = ev.get("userAccount", {})
                    upn = ua.get("userPrincipalName", "")
                    if upn:
                        if upn not in users:
                            users[upn] = {"userPrincipalName": upn, "accountName": ua.get("accountName", ""), "alertCount": 0}
                        users[upn]["alertCount"] += 1

    sev_counts: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for a in center_alerts:
        s = a.get("severity", "low").lower()
        if s in sev_counts:
            sev_counts[s] += 1

    return {
        "center": center,
        "nodes": nodes,
        "affectedUsers": sorted(users.values(), key=lambda u: -u["alertCount"])[:8],
        "centerAlerts": [
            {"id": a["id"], "title": a["title"], "severity": a["severity"]}
            for a in center_alerts[:10]
        ],
        "summary": {
            "resourcesAtRisk": len(nodes),
            "centerAlertCount": len(center_alerts),
            "affectedUserCount": len(users),
            "severities": sev_counts,
        },
    }
