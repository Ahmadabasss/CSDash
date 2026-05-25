"""
SqlDataSource — reads all security data from Azure SQL Database.
Implements the same DataSource protocol as MockDataSource so routers
need zero changes.

Setup:
  1. Set DATA_SOURCE=sql in .env
  2. Set SQL_CONNECTION_STRING to the ODBC connection string from Azure Portal:
       Azure Portal → your SQL Database → Connection strings → ODBC tab
     Example:
       Driver={ODBC Driver 18 for SQL Server};Server=tcp:myserver.database.windows.net,1433;
       Database=mydb;Uid=myuser;Pwd=mypassword;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
  3. Run scripts/create_schema.sql to create tables
  4. Run scripts/seed_sql.py to load data
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import pyodbc


class SqlDataSource:
    def __init__(self, connection_string: str) -> None:
        if not connection_string:
            raise ValueError(
                "SQL_CONNECTION_STRING is not set in .env. "
                "Copy it from Azure Portal → SQL Database → Connection strings → ODBC."
            )
        self._conn_str = connection_string

    # ── connection ───────────────────────────────────────────────────────────

    def _connect(self) -> pyodbc.Connection:
        return pyodbc.connect(self._conn_str)

    def _q1(self, sql: str, params: tuple = ()) -> dict | None:
        with self._connect() as conn:
            row = conn.cursor().execute(sql, params).fetchone()
            return json.loads(row[0]) if row else None

    def _qn(self, sql: str, params: tuple = ()) -> list[dict]:
        with self._connect() as conn:
            rows = conn.cursor().execute(sql, params).fetchall()
            return [json.loads(r[0]) for r in rows]

    async def _fetch_one(self, sql: str, params: tuple = ()) -> dict | None:
        return await asyncio.to_thread(self._q1, sql, params)

    async def _fetch_many(self, sql: str, params: tuple = ()) -> list[dict]:
        return await asyncio.to_thread(self._qn, sql, params)

    # ── DataSource protocol ──────────────────────────────────────────────────

    async def get_secure_score(self) -> dict[str, Any]:
        return await self._fetch_one(
            "SELECT payload FROM dbo.secure_score WHERE singleton_id = 1;"
        ) or {}

    async def get_alerts(self, status: str | None = None) -> list[dict]:
        if status:
            return await self._fetch_many(
                "SELECT payload FROM dbo.alerts WHERE status = ? ORDER BY created_datetime DESC;",
                (status,),
            )
        return await self._fetch_many(
            "SELECT payload FROM dbo.alerts ORDER BY created_datetime DESC;"
        )

    async def get_alert(self, alert_id: str) -> dict | None:
        return await self._fetch_one(
            "SELECT payload FROM dbo.alerts WHERE id = ?;", (alert_id,)
        )

    async def get_incidents(self) -> list[dict]:
        return await self._fetch_many(
            "SELECT payload FROM dbo.incidents ORDER BY created_datetime DESC;"
        )

    async def get_incident(self, incident_id: str) -> dict | None:
        return await self._fetch_one(
            "SELECT payload FROM dbo.incidents WHERE id = ?;", (incident_id,)
        )

    async def get_recommendations(self, severity: str | None = None) -> list[dict]:
        if severity:
            return await self._fetch_many(
                "SELECT payload FROM dbo.recommendations WHERE severity = ?;",
                (severity.capitalize(),),
            )
        return await self._fetch_many("SELECT payload FROM dbo.recommendations;")

    async def get_recommendation(self, rec_id: str) -> dict | None:
        return await self._fetch_one(
            "SELECT payload FROM dbo.recommendations WHERE id = ?;", (rec_id,)
        )

    async def get_vulnerabilities(self) -> list[dict]:
        return await self._fetch_many(
            "SELECT payload FROM dbo.vulnerabilities ORDER BY cvss_v3 DESC;"
        )

    async def get_compliance(self) -> list[dict]:
        return await self._fetch_many("SELECT payload FROM dbo.compliance_standards;")

    async def get_resources(self) -> list[dict]:
        return await self._fetch_many("SELECT payload FROM dbo.resources;")

    async def get_resource(self, resource_id: str) -> dict | None:
        row = await self._fetch_one(
            "SELECT payload FROM dbo.resources WHERE id = ?;", (resource_id,)
        )
        if row:
            return row
        return await self._fetch_one(
            "SELECT payload FROM dbo.resources WHERE name = ?;", (resource_id,)
        )

    async def get_endpoints(self) -> list[dict]:
        return await self._fetch_many(
            "SELECT payload FROM dbo.endpoints ORDER BY risk_score DESC;"
        )

    async def get_endpoint(self, device_id: str) -> dict | None:
        return await self._fetch_one(
            "SELECT payload FROM dbo.endpoints WHERE id = ?;", (device_id,)
        )

    async def get_virtual_machines(self) -> list[dict]:
        return await self._fetch_many("SELECT payload FROM dbo.virtual_machines;")

    async def get_virtual_machine(self, vm_id: str) -> dict | None:
        row = await self._fetch_one(
            "SELECT payload FROM dbo.virtual_machines WHERE id = ?;", (vm_id,)
        )
        if row:
            return row
        return await self._fetch_one(
            "SELECT payload FROM dbo.virtual_machines WHERE name = ?;", (vm_id,)
        )

    async def get_signins(self) -> list[dict]:
        return await self._fetch_many(
            "SELECT payload FROM dbo.signins ORDER BY created_datetime DESC;"
        )

    async def get_signin(self, signin_id: str) -> dict | None:
        return await self._fetch_one(
            "SELECT payload FROM dbo.signins WHERE id = ?;", (signin_id,)
        )

    async def get_risky_users(self) -> list[dict]:
        return await self._fetch_many(
            "SELECT payload FROM dbo.risky_users ORDER BY risk_level DESC;"
        )

    async def get_risky_user(self, user_id: str) -> dict | None:
        return await self._fetch_one(
            "SELECT payload FROM dbo.risky_users WHERE id = ?;", (user_id,)
        )

    async def get_network_topology(self) -> dict[str, Any]:
        return await self._fetch_one(
            "SELECT payload FROM dbo.network_topology WHERE singleton_id = 1;"
        ) or {}
