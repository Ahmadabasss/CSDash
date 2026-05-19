import math

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

_SEV_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}


@router.get("", summary="List security incidents with pagination")
async def list_incidents(
    severity: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    ds: DataSource = Depends(get_data_source),
):
    items = await ds.get_incidents()
    if severity:
        items = [i for i in items if i["severity"].lower() == severity.lower()]
    if status:
        items = [i for i in items if i["status"].lower() == status.lower()]
    items = sorted(items, key=lambda i: (_SEV_RANK.get(i["severity"].lower(), 0), i["createdDateTime"]), reverse=True)
    total = len(items)
    start = (page - 1) * limit
    return {"items": items[start: start + limit], "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit)}


@router.get("/{incident_id}", summary="Single incident detail")
async def get_incident(incident_id: str, ds: DataSource = Depends(get_data_source)):
    all_incidents = await ds.get_incidents()
    incident = next((i for i in all_incidents if i["id"] == incident_id), None)
    if not incident:
        raise HTTPException(404, "Incident not found")
    return incident
