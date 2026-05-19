from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/signins", tags=["signins"])

@router.get("/risk-summary", summary="Aggregated sign-in risk metrics for dashboard cards")
async def risk_summary(ds: DataSource = Depends(get_data_source)):
    signins = await ds.get_signins()
    total = len(signins)
    risky = [s for s in signins if s.get("riskLevelAggregated", "none") not in ("none", "")]
    failed = [s for s in signins if s.get("status", {}).get("errorCode", 0) != 0]

    risk_by_level: dict[str, int] = defaultdict(int)
    for s in risky:
        risk_by_level[s.get("riskLevelAggregated", "unknown")] += 1

    top_risky_ips: dict[str, int] = defaultdict(int)
    for s in risky:
        ip = s.get("ipAddress", "unknown")
        top_risky_ips[ip] += 1

    top_countries: dict[str, int] = defaultdict(int)
    for s in signins:
        country = s.get("location", {}).get("countryOrRegion", "unknown")
        top_countries[country] += 1

    return {
        "total": total,
        "risky": len(risky),
        "failed": len(failed),
        "riskByLevel": dict(risk_by_level),
        "topRiskyIps": sorted(
            [{"ip": k, "count": v} for k, v in top_risky_ips.items()],
            key=lambda x: x["count"],
            reverse=True,
        )[:10],
        "topCountries": sorted(
            [{"country": k, "count": v} for k, v in top_countries.items()],
            key=lambda x: x["count"],
            reverse=True,
        )[:10],
    }


@router.get("", summary="List sign-in logs")
async def list_signins(ds: DataSource = Depends(get_data_source)):
    return await ds.get_signins()


@router.get("/{signin_id}", summary="Single sign-in event detail")
async def get_signin(signin_id: str, ds: DataSource = Depends(get_data_source)):
    signin = await ds.get_signin(signin_id)
    if not signin:
        raise HTTPException(404, "Sign-in not found")
    return signin
