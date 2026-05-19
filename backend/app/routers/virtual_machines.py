import math

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/virtual-machines", tags=["virtual-machines"])


@router.get("/summary", summary="VM security posture overview")
async def vm_summary(ds: DataSource = Depends(get_data_source)):
    vms = await ds.get_virtual_machines()
    patch_issues = [v for v in vms if v["securityProfile"]["patchStatus"]["state"] in ("CriticalPatches", "SecurityPatches")]
    not_enrolled = [v for v in vms if not v["securityProfile"]["mdeEnrolled"]]
    no_encryption = [v for v in vms if not v["securityProfile"]["diskEncrypted"]]
    by_patch: dict[str, int] = {}
    by_os: dict[str, int] = {}
    for v in vms:
        p = v["securityProfile"]["patchStatus"]["state"]
        by_patch[p] = by_patch.get(p, 0) + 1
        os_ = v["properties"]["osType"]
        by_os[os_] = by_os.get(os_, 0) + 1
    return {
        "total": len(vms),
        "running": sum(1 for v in vms if v["properties"]["powerState"] == "running"),
        "patchIssues": len(patch_issues),
        "notMdeEnrolled": len(not_enrolled),
        "noEncryption": len(no_encryption),
        "byPatchStatus": by_patch,
        "byOs": by_os,
        "totalVulnerabilities": sum(v["securityProfile"]["vulnerabilityCount"] for v in vms),
    }


@router.get("", summary="List virtual machines with security metadata")
async def list_vms(
    patch_status: str | None = None,
    os_type: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    ds: DataSource = Depends(get_data_source),
):
    items = await ds.get_virtual_machines()
    if patch_status:
        items = [v for v in items if v["securityProfile"]["patchStatus"]["state"].lower() == patch_status.lower()]
    if os_type:
        items = [v for v in items if v["properties"]["osType"].lower() == os_type.lower()]
    items = sorted(items, key=lambda v: v["securityProfile"]["secureScore"])
    total = len(items)
    start = (page - 1) * limit
    return {"items": items[start: start + limit], "total": total, "page": page, "limit": limit, "pages": math.ceil(total / limit)}


@router.get("/{vm_id:path}", summary="Single VM detail")
async def get_vm(vm_id: str, ds: DataSource = Depends(get_data_source)):
    all_vms = await ds.get_virtual_machines()
    vm = next((v for v in all_vms if v["id"] == vm_id or v["name"] == vm_id), None)
    if not vm:
        raise HTTPException(404, "Virtual machine not found")
    return vm
