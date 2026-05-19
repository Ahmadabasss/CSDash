import math
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

_SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}
_ALERT_SORT_FIELDS = {"createdDateTime", "severity", "status", "title", "category"}


def _sort_key(alert: dict, field: str) -> object:
    if field == "severity":
        return _SEVERITY_RANK.get(alert.get("severity", "").lower(), 0)
    return alert.get(field, "")


@router.get("/mitre-summary", summary="ATT&CK technique frequency across all alerts")
async def mitre_summary(ds: DataSource = Depends(get_data_source)):
    alerts = await ds.get_alerts()
    counts: dict[str, dict] = defaultdict(lambda: {"technique": "", "count": 0, "severities": defaultdict(int)})
    for alert in alerts:
        for technique in alert.get("mitreTechniques", []):
            counts[technique]["technique"] = technique
            counts[technique]["count"] += 1
            counts[technique]["severities"][alert.get("severity", "unknown")] += 1
    result = sorted(counts.values(), key=lambda x: x["count"], reverse=True)
    # convert inner defaultdicts to plain dicts
    for row in result:
        row["severities"] = dict(row["severities"])
    return result


@router.get("", summary="List alerts with pagination, filtering, and sorting")
async def list_alerts(
    status: str | None = None,
    severity: str | None = None,
    sort: str = Query(default="createdDateTime", pattern=f"^({'|'.join(_ALERT_SORT_FIELDS)})$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    ds: DataSource = Depends(get_data_source),
):
    items = await ds.get_alerts(status=status)
    if severity:
        items = [a for a in items if a.get("severity", "").lower() == severity.lower()]
    items = sorted(items, key=lambda a: _sort_key(a, sort), reverse=(order == "desc"))
    total = len(items)
    start = (page - 1) * limit
    return {
        "items": items[start : start + limit],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit),
    }


@router.get("/{alert_id}", summary="Single alert detail")
async def get_alert(alert_id: str, ds: DataSource = Depends(get_data_source)):
    all_alerts = await ds.get_alerts()
    alert = next((a for a in all_alerts if a["id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
