-- ============================================================
-- Vigil Security Dashboard — Azure SQL Database Schema
-- Run once against your database before seeding.
-- Compatible with Azure SQL Database (any service tier).
--
-- Usage (Azure Data Studio / sqlcmd):
--   sqlcmd -S vigil-sql.database.windows.net -d vigil-security \
--          -G -i scripts/create_schema.sql
-- ============================================================

-- secure_score  (single row, refreshed on ingest)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.secure_score') AND type = 'U')
CREATE TABLE dbo.secure_score (
    singleton_id   INT            NOT NULL CONSTRAINT pk_secure_score PRIMARY KEY DEFAULT 1,
    refreshed_at   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    payload        NVARCHAR(MAX)  NOT NULL
);
GO

-- alerts
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.alerts') AND type = 'U')
CREATE TABLE dbo.alerts (
    id                 NVARCHAR(500)  NOT NULL CONSTRAINT pk_alerts PRIMARY KEY,
    status             NVARCHAR(50)   NOT NULL,
    severity           NVARCHAR(50)   NOT NULL,
    created_datetime   DATETIME2      NOT NULL,
    payload            NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_alerts_status'   AND object_id = OBJECT_ID(N'dbo.alerts'))
    CREATE INDEX ix_alerts_status   ON dbo.alerts (status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_alerts_severity' AND object_id = OBJECT_ID(N'dbo.alerts'))
    CREATE INDEX ix_alerts_severity ON dbo.alerts (severity);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_alerts_created'  AND object_id = OBJECT_ID(N'dbo.alerts'))
    CREATE INDEX ix_alerts_created  ON dbo.alerts (created_datetime DESC);
GO

-- incidents
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.incidents') AND type = 'U')
CREATE TABLE dbo.incidents (
    id                 NVARCHAR(500)  NOT NULL CONSTRAINT pk_incidents PRIMARY KEY,
    severity           NVARCHAR(50)   NOT NULL,
    status             NVARCHAR(50)   NOT NULL,
    created_datetime   DATETIME2      NOT NULL,
    payload            NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_incidents_created' AND object_id = OBJECT_ID(N'dbo.incidents'))
    CREATE INDEX ix_incidents_created ON dbo.incidents (created_datetime DESC);
GO

-- recommendations
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.recommendations') AND type = 'U')
CREATE TABLE dbo.recommendations (
    id       NVARCHAR(500)  NOT NULL CONSTRAINT pk_recommendations PRIMARY KEY,
    severity NVARCHAR(50)   NOT NULL,
    payload  NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_recs_severity' AND object_id = OBJECT_ID(N'dbo.recommendations'))
    CREATE INDEX ix_recs_severity ON dbo.recommendations (severity);
GO

-- vulnerabilities
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.vulnerabilities') AND type = 'U')
CREATE TABLE dbo.vulnerabilities (
    id      NVARCHAR(500)  NOT NULL CONSTRAINT pk_vulnerabilities PRIMARY KEY,
    cvss_v3 FLOAT          NOT NULL DEFAULT 0,
    payload NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_vulns_cvss' AND object_id = OBJECT_ID(N'dbo.vulnerabilities'))
    CREATE INDEX ix_vulns_cvss ON dbo.vulnerabilities (cvss_v3 DESC);
GO

-- compliance_standards
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.compliance_standards') AND type = 'U')
CREATE TABLE dbo.compliance_standards (
    id      NVARCHAR(500)  NOT NULL CONSTRAINT pk_compliance PRIMARY KEY,
    payload NVARCHAR(MAX)  NOT NULL
);
GO

-- resources
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.resources') AND type = 'U')
CREATE TABLE dbo.resources (
    id              NVARCHAR(500)  NOT NULL CONSTRAINT pk_resources PRIMARY KEY,
    name            NVARCHAR(255)  NOT NULL,
    type            NVARCHAR(255)  NOT NULL,
    resource_group  NVARCHAR(255)  NOT NULL DEFAULT '',
    payload         NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_resources_name' AND object_id = OBJECT_ID(N'dbo.resources'))
    CREATE INDEX ix_resources_name ON dbo.resources (name);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_resources_type' AND object_id = OBJECT_ID(N'dbo.resources'))
    CREATE INDEX ix_resources_type ON dbo.resources (type);
GO

-- virtual_machines
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.virtual_machines') AND type = 'U')
CREATE TABLE dbo.virtual_machines (
    id      NVARCHAR(500)  NOT NULL CONSTRAINT pk_vms PRIMARY KEY,
    name    NVARCHAR(255)  NOT NULL,
    payload NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_vms_name' AND object_id = OBJECT_ID(N'dbo.virtual_machines'))
    CREATE INDEX ix_vms_name ON dbo.virtual_machines (name);
GO

-- endpoints
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.endpoints') AND type = 'U')
CREATE TABLE dbo.endpoints (
    id         NVARCHAR(500)  NOT NULL CONSTRAINT pk_endpoints PRIMARY KEY,
    risk_score FLOAT          NOT NULL DEFAULT 0,
    payload    NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_endpoints_risk' AND object_id = OBJECT_ID(N'dbo.endpoints'))
    CREATE INDEX ix_endpoints_risk ON dbo.endpoints (risk_score DESC);
GO

-- signins
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.signins') AND type = 'U')
CREATE TABLE dbo.signins (
    id               NVARCHAR(500)  NOT NULL CONSTRAINT pk_signins PRIMARY KEY,
    created_datetime DATETIME2      NOT NULL,
    risk_level       NVARCHAR(50)   NOT NULL DEFAULT 'none',
    payload          NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_signins_created' AND object_id = OBJECT_ID(N'dbo.signins'))
    CREATE INDEX ix_signins_created ON dbo.signins (created_datetime DESC);
GO

-- risky_users
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.risky_users') AND type = 'U')
CREATE TABLE dbo.risky_users (
    id         NVARCHAR(500)  NOT NULL CONSTRAINT pk_risky_users PRIMARY KEY,
    risk_level NVARCHAR(50)   NOT NULL,
    payload    NVARCHAR(MAX)  NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_risky_users_level' AND object_id = OBJECT_ID(N'dbo.risky_users'))
    CREATE INDEX ix_risky_users_level ON dbo.risky_users (risk_level);
GO

-- network_topology  (single row, refreshed on ingest)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.network_topology') AND type = 'U')
CREATE TABLE dbo.network_topology (
    singleton_id  INT            NOT NULL CONSTRAINT pk_network_topology PRIMARY KEY DEFAULT 1,
    refreshed_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    payload       NVARCHAR(MAX)  NOT NULL
);
GO
