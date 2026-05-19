from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/risky-users", tags=["identity"])

_RISK_RANK = {"high": 3, "medium": 2, "low": 1}


@router.get("/summary", summary="Risky user count by risk level")
async def risky_users_summary(ds: DataSource = Depends(get_data_source)):
    users = await ds.get_risky_users()
    by_level: dict[str, int] = {}
    by_state: dict[str, int] = {}
    for u in users:
        lv = u.get("riskLevel", "none")
        by_level[lv] = by_level.get(lv, 0) + 1
        st = u.get("riskState", "none")
        by_state[st] = by_state.get(st, 0) + 1
    return {
        "total": len(users),
        "atRisk": sum(1 for u in users if u.get("riskState") == "atRisk"),
        "confirmedCompromised": sum(1 for u in users if u.get("riskState") == "confirmedCompromised"),
        "byLevel": by_level,
        "byState": by_state,
    }


@router.get("", summary="List risky users sorted by risk level")
async def list_risky_users(ds: DataSource = Depends(get_data_source)):
    users = await ds.get_risky_users()
    return sorted(users, key=lambda u: _RISK_RANK.get(u.get("riskLevel", ""), 0), reverse=True)


@router.get("/{user_id}", summary="Single risky user detail")
async def get_risky_user(user_id: str, ds: DataSource = Depends(get_data_source)):
    all_users = await ds.get_risky_users()
    user = next((u for u in all_users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(404, "Risky user not found")
    return user
