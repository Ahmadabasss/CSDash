from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("", summary="List all Azure resources with security metadata")
async def list_resources(ds: DataSource = Depends(get_data_source)):
    return await ds.get_resources()


@router.get("/{resource_id:path}", summary="Resource detail with related alerts and recommendations")
async def get_resource(resource_id: str, ds: DataSource = Depends(get_data_source)):
    resource = await ds.get_resource(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Join related alerts — match on evidence resourceId containing this resource id
    all_alerts = await ds.get_alerts()
    related_alerts = [
        a for a in all_alerts
        if any(
            resource_id.lower() in (ev.get("resourceId", "")).lower()
            for ev in a.get("evidence", [])
        )
    ]

    # Join related recommendations — match on resourceDetails.Id
    all_recs = await ds.get_recommendations()
    related_recs = [
        r for r in all_recs
        if resource_id.lower() in r["properties"].get("resourceDetails", {}).get("Id", "").lower()
    ]

    return {
        **resource,
        "relatedAlerts": related_alerts[:20],   # cap at 20 for payload size
        "relatedRecommendations": related_recs[:20],
    }
