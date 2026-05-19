import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/network", tags=["network"])

_DATA_FILE = Path(__file__).parent.parent.parent / "mock_data" / "network.json"


def _load() -> dict[str, Any]:
    return json.loads(_DATA_FILE.read_text())


@router.get("/topology")
async def get_topology(rg: str | None = Query(default=None)) -> dict[str, Any]:
    data = _load()
    vnets = data["vnets"]
    if rg:
        vnets = [v for v in vnets if v["resourceGroup"] == rg]

    vnet_names = {v["name"] for v in vnets}
    peerings = [
        p for p in data["peerings"]
        if p["fromVnet"] in vnet_names or p["toVnet"] in vnet_names
    ]

    # Attach NSG and route table detail to each subnet
    nsgs = data["nsgs"]
    rts = data["routeTables"]
    for vnet in vnets:
        for subnet in vnet["subnets"]:
            subnet["nsgDetail"]  = nsgs.get(subnet["nsg"])  if subnet["nsg"]  else None
            subnet["rtDetail"]   = rts.get(subnet["routeTable"]) if subnet["routeTable"] else None

    return {
        "resourceGroups": data["resourceGroups"],
        "vnets": vnets,
        "peerings": peerings,
    }


@router.get("/nsg/{name}")
async def get_nsg(name: str) -> dict[str, Any]:
    data = _load()
    nsg = data["nsgs"].get(name)
    if not nsg:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"NSG '{name}' not found")
    return {"name": name, **nsg}
