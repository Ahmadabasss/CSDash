from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import VALID_SCENARIOS
from ..deps import current_scenario, switch_scenario

router = APIRouter(prefix="/api/scenario", tags=["scenario"])


class ScenarioRequest(BaseModel):
    scenario: str


@router.get("", summary="Current active scenario")
async def get_scenario():
    return {"scenario": current_scenario()}


@router.post("", summary="Hot-swap mock data scenario (noisy | compromised | secured)")
async def set_scenario(body: ScenarioRequest):
    if body.scenario not in VALID_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario '{body.scenario}'. Valid options: {sorted(VALID_SCENARIOS)}",
        )
    try:
        switch_scenario(body.scenario)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"scenario": body.scenario, "message": f"Switched to '{body.scenario}' scenario"}
