from typing import Any

from fastapi import APIRouter, Depends, Query

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/network", tags=["network"])


@router.get("/topology")
async def get_topology(
    rg: str | None = Query(default=None),
    ds: DataSource = Depends(get_data_source),
) -> dict[str, Any]:
    data = await ds.get_network_topology()
    if not data:
        return {"resourceGroups": [], "vnets": [], "peerings": []}

    vnets = data["vnets"]
    if rg:
        vnets = [v for v in vnets if v["resourceGroup"] == rg]
        vnet_names = {v["name"] for v in vnets}
        peerings = [
            p for p in data["peerings"]
            if p["fromVnet"] in vnet_names or p["toVnet"] in vnet_names
        ]
    else:
        peerings = data["peerings"]

    return {
        "resourceGroups": data["resourceGroups"],
        "vnets": vnets,
        "peerings": peerings,
    }


@router.get("/nsg/{name}")
async def get_nsg(
    name: str,
    ds: DataSource = Depends(get_data_source),
) -> dict[str, Any]:
    data = await ds.get_network_topology()
    # topology payload already has nsgDetail merged into subnets;
    # rebuild an NSG lookup from the merged subnet data.
    for vnet in data.get("vnets", []):
        for subnet in vnet.get("subnets", []):
            if subnet.get("nsg") == name and subnet.get("nsgDetail"):
                return {"name": name, **subnet["nsgDetail"]}
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"NSG '{name}' not found")
