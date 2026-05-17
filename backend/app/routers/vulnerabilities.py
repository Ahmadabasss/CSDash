from fastapi import APIRouter, Depends

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/vulnerabilities", tags=["vulnerabilities"])


@router.get("")
async def list_vulnerabilities(ds: DataSource = Depends(get_data_source)):
    return await ds.get_vulnerabilities()
