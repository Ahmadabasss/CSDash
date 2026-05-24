import json
from pathlib import Path
from typing import Any

_NETWORK_FILE = Path(__file__).parent.parent.parent / "mock_data" / "network.json"


class MockDataSource:
    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir
        self._cache: dict[str, Any] = {}
        self.reload()

    def reload(self) -> None:
        self._cache = {f.stem: json.loads(f.read_text()) for f in self._dir.glob("*.json")}

    # ── core resources ────────────────────────────────────────────────────────

    async def get_secure_score(self) -> dict[str, Any]:
        return self._cache["secure_score"]

    async def get_recommendations(self, severity: str | None = None) -> list[dict]:
        items: list[dict] = self._cache["recommendations"]["value"]
        if severity:
            items = [
                r for r in items
                if r["properties"]["metadata"]["severity"].lower() == severity.lower()
            ]
        return items

    async def get_recommendation(self, rec_id: str) -> dict | None:
        return next(
            (r for r in self._cache["recommendations"]["value"] if r["id"] == rec_id or r["name"] == rec_id),
            None,
        )

    async def get_alerts(self, status: str | None = None) -> list[dict]:
        items: list[dict] = self._cache["alerts"]["value"]
        if status:
            items = [a for a in items if a["status"].lower() == status.lower()]
        return items

    async def get_alert(self, alert_id: str) -> dict | None:
        return next(
            (a for a in self._cache["alerts"]["value"] if a["id"] == alert_id),
            None,
        )

    async def get_vulnerabilities(self) -> list[dict]:
        return self._cache["vulnerabilities"]["value"]

    async def get_compliance(self) -> list[dict]:
        return self._cache["compliance"]["value"]

    async def get_resources(self) -> list[dict]:
        return self._cache["resources"]["data"]

    async def get_resource(self, resource_id: str) -> dict | None:
        return next(
            (r for r in self._cache["resources"]["data"] if r["id"] == resource_id or r["name"] == resource_id),
            None,
        )

    async def get_signins(self) -> list[dict]:
        return self._cache["signins"]["value"]

    async def get_signin(self, signin_id: str) -> dict | None:
        return next(
            (s for s in self._cache["signins"]["value"] if s["id"] == signin_id),
            None,
        )

    async def get_endpoints(self) -> list[dict]:
        return self._cache["endpoints"]["value"]

    async def get_endpoint(self, device_id: str) -> dict | None:
        return next(
            (e for e in self._cache["endpoints"]["value"] if e["id"] == device_id),
            None,
        )

    async def get_virtual_machines(self) -> list[dict]:
        return self._cache["virtual_machines"]["value"]

    async def get_virtual_machine(self, vm_id: str) -> dict | None:
        return next(
            (v for v in self._cache["virtual_machines"]["value"] if v["id"] == vm_id or v["name"] == vm_id),
            None,
        )

    async def get_incidents(self) -> list[dict]:
        return self._cache["incidents"]["value"]

    async def get_incident(self, incident_id: str) -> dict | None:
        return next(
            (i for i in self._cache["incidents"]["value"] if i["id"] == incident_id),
            None,
        )

    async def get_risky_users(self) -> list[dict]:
        return self._cache["risky_users"]["value"]

    async def get_risky_user(self, user_id: str) -> dict | None:
        return next(
            (u for u in self._cache["risky_users"]["value"] if u["id"] == user_id),
            None,
        )

    async def get_network_topology(self) -> dict:
        raw  = json.loads(_NETWORK_FILE.read_text())
        nsgs = raw["nsgs"]
        rts  = raw["routeTables"]
        for vnet in raw["vnets"]:
            for subnet in vnet["subnets"]:
                subnet["nsgDetail"] = nsgs.get(subnet["nsg"]) if subnet["nsg"] else None
                subnet["rtDetail"]  = rts.get(subnet["routeTable"]) if subnet.get("routeTable") else None
        return {
            "resourceGroups": raw["resourceGroups"],
            "vnets":          raw["vnets"],
            "peerings":       raw["peerings"],
        }
