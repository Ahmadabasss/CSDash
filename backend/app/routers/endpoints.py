import math

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/endpoints", tags=["endpoints"])

_RISK_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1, "none": 0}


@router.get("/summary", summary="Endpoint health and risk overview")
async def endpoint_summary(ds: DataSource = Depends(get_data_source)):
    devices = await ds.get_endpoints()
    by_risk: dict[str, int] = {}
    by_health: dict[str, int] = {}
    by_os: dict[str, int] = {}
    for d in devices:
        r = d.get("riskScore", "None")
        by_risk[r] = by_risk.get(r, 0) + 1
        h = d.get("healthStatus", "Unknown")
        by_health[h] = by_health.get(h, 0) + 1
        os_ = d.get("osPlatform", "Unknown").replace("Windows10","Windows").replace("Windows11","Windows").replace("WindowsServer2019","Windows Server").replace("WindowsServer2022","Windows Server")
        by_os[os_] = by_os.get(os_, 0) + 1
    total_vulns = sum(d.get("vulnerabilitiesCount", 0) for d in devices)
    return {
        "total": len(devices),
        "onboarded": sum(1 for d in devices if d.get("onboardingStatus") == "Onboarded"),
        "highRisk": by_risk.get("High", 0) + by_risk.get("Critical", 0),
        "byRisk": by_risk,
        "byHealth": by_health,
        "byOs": by_os,
        "totalVulnerabilities": total_vulns,
    }


@router.get("", summary="List endpoints with filtering and pagination")
async def list_endpoints(
    risk: str | None = None,
    health: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    ds: DataSource = Depends(get_data_source),
):
    items = await ds.get_endpoints()
    if risk:
        items = [d for d in items if d.get("riskScore", "").lower() == risk.lower()]
    if health:
        items = [d for d in items if d.get("healthStatus", "").lower() == health.lower()]
    items = sorted(items, key=lambda d: _RISK_RANK.get(d.get("riskScore", "").lower(), 0), reverse=True)
    total = len(items)
    start = (page - 1) * limit
    return {"items": items[start: start + limit], "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit)}


@router.get("/{device_id}", summary="Single endpoint detail")
async def get_endpoint(device_id: str, ds: DataSource = Depends(get_data_source)):
    all_devices = await ds.get_endpoints()
    device = next((d for d in all_devices if d["id"] == device_id), None)
    if not device:
        raise HTTPException(404, "Endpoint not found")
    return device
