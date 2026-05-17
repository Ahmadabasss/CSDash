from fastapi import APIRouter, Depends

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/secure-score", tags=["secure-score"])


@router.get("")
async def get_secure_score(ds: DataSource = Depends(get_data_source)):
    return await ds.get_secure_score()
