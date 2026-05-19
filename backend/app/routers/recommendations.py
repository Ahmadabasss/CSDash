import math
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

_SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}
_REC_SORT_FIELDS = {"severity", "displayName", "category", "status", "implementationEffort"}


def _rec_severity(rec: dict) -> int:
    sev = rec["properties"]["metadata"].get("severity", "").lower()
    return _SEVERITY_RANK.get(sev, 0)


def _rec_sort_key(rec: dict, field: str) -> object:
    if field == "severity":
        return _rec_severity(rec)
    if field == "displayName":
        return rec["properties"].get("displayName", "")
    if field == "category":
        cats = rec["properties"]["metadata"].get("categories", [])
        return cats[0] if cats else ""
    if field == "status":
        return rec["properties"]["status"].get("code", "")
    if field == "implementationEffort":
        return rec["properties"]["metadata"].get("implementationEffort", "")
    return ""


@router.get("/categories", summary="Unique recommendation categories with counts")
async def list_categories(ds: DataSource = Depends(get_data_source)):
    recs = await ds.get_recommendations()
    counts: dict[str, int] = defaultdict(int)
    for rec in recs:
        for cat in rec["properties"]["metadata"].get("categories", []):
            counts[cat] += 1
    return sorted(
        [{"category": k, "count": v} for k, v in counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )


@router.get("", summary="List recommendations with pagination, filtering, and sorting")
async def list_recommendations(
    severity: str | None = None,
    status: str | None = None,
    category: str | None = None,
    sort: str = Query(default="severity", pattern=f"^({'|'.join(_REC_SORT_FIELDS)})$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    ds: DataSource = Depends(get_data_source),
):
    items = await ds.get_recommendations(severity=severity)
    if status:
        items = [r for r in items if r["properties"]["status"]["code"].lower() == status.lower()]
    if category:
        items = [
            r for r in items
            if category.lower() in [c.lower() for c in r["properties"]["metadata"].get("categories", [])]
        ]
    items = sorted(items, key=lambda r: _rec_sort_key(r, sort), reverse=(order == "desc"))
    total = len(items)
    start = (page - 1) * limit
    return {
        "items": items[start : start + limit],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit),
    }


@router.get("/{rec_id}", summary="Single recommendation detail")
async def get_recommendation(rec_id: str, ds: DataSource = Depends(get_data_source)):
    all_recs = await ds.get_recommendations()
    rec = next((r for r in all_recs if r["id"] == rec_id or r["name"] == rec_id), None)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec
