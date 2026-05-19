from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_data_source
from ..services.base import DataSource
from ..services.compliance_controls import generate_controls

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get("")
async def list_compliance(ds: DataSource = Depends(get_data_source)):
    return await ds.get_compliance()


@router.get("/{name}/controls")
async def get_compliance_controls(name: str, ds: DataSource = Depends(get_data_source)):
    standards = await ds.get_compliance()
    standard = next((s for s in standards if s["name"] == name), None)
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")
    return generate_controls(standard)
