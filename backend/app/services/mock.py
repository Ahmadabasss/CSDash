import json
from pathlib import Path
from typing import Any


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
            (r for r in self._cache["recommendations"]["value"] if r["id"] == rec_id),
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
            (r for r in self._cache["resources"]["data"] if r["id"] == resource_id),
            None,
        )

    async def get_signins(self) -> list[dict]:
        return self._cache["signins"]["value"]
