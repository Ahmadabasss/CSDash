-- =============================================================================
-- Vigil — Azure SQL Database Schema
-- Run once against the target database to initialise all tables.
-- Compatible with Azure SQL (T-SQL).
--
-- Design: each table stores key filterable columns for efficient WHERE/ORDER BY
-- plus a full JSON payload column so the FastAPI backend can deserialise
-- complete records without reconstructing nested objects from many columns.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Secure Score
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.secure_score', 'U') IS NULL
CREATE TABLE dbo.secure_score (
    singleton_id      INT           NOT NULL DEFAULT 1,
    score_percentage  FLOAT         NOT NULL DEFAULT 0,
    enriched_at       DATETIME2     NOT NULL,
    payload           NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_secure_score PRIMARY KEY (singleton_id),
    CONSTRAINT chk_secure_score_singleton CHECK (singleton_id = 1)
);

IF OBJECT_ID('dbo.secure_score_history', 'U') IS NULL
CREATE TABLE dbo.secure_score_history (
    date              DATE          NOT NULL,
    percentage        FLOAT         NOT NULL,
    CONSTRAINT pk_score_history PRIMARY KEY (date)
);

IF OBJECT_ID('dbo.secure_score_controls', 'U') IS NULL
CREATE TABLE dbo.secure_score_controls (
    control_name      NVARCHAR(300) NOT NULL,
    current_score     FLOAT         NOT NULL DEFAULT 0,
    max_score         FLOAT         NOT NULL DEFAULT 0,
    weight            INT           NOT NULL DEFAULT 0,
    CONSTRAINT pk_score_controls PRIMARY KEY (control_name)
);

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.alerts', 'U') IS NULL
CREATE TABLE dbo.alerts (
    id                NVARCHAR(200) NOT NULL,
    status            NVARCHAR(50)  NULL,
    severity          NVARCHAR(50)  NULL,
    created_datetime  DATETIME2     NULL,
    enriched_at       DATETIME2     NOT NULL,
    payload           NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_alerts PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_alerts_status'   AND object_id = OBJECT_ID('dbo.alerts'))
    CREATE INDEX ix_alerts_status   ON dbo.alerts (status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_alerts_severity' AND object_id = OBJECT_ID('dbo.alerts'))
    CREATE INDEX ix_alerts_severity ON dbo.alerts (severity);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_alerts_created'  AND object_id = OBJECT_ID('dbo.alerts'))
    CREATE INDEX ix_alerts_created  ON dbo.alerts (created_datetime DESC);

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.incidents', 'U') IS NULL
CREATE TABLE dbo.incidents (
    id                NVARCHAR(200) NOT NULL,
    severity          NVARCHAR(50)  NULL,
    status            NVARCHAR(50)  NULL,
    created_datetime  DATETIME2     NULL,
    enriched_at       DATETIME2     NOT NULL,
    payload           NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_incidents PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_incidents_severity' AND object_id = OBJECT_ID('dbo.incidents'))
    CREATE INDEX ix_incidents_severity ON dbo.incidents (severity);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_incidents_status'   AND object_id = OBJECT_ID('dbo.incidents'))
    CREATE INDEX ix_incidents_status   ON dbo.incidents (status);

-- ---------------------------------------------------------------------------
-- Recommendations
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.recommendations', 'U') IS NULL
CREATE TABLE dbo.recommendations (
    id              NVARCHAR(500) NOT NULL,
    status_code     NVARCHAR(50)  NULL,
    severity        NVARCHAR(50)  NULL,
    enriched_at     DATETIME2     NOT NULL,
    payload         NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_recommendations PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_recs_status'   AND object_id = OBJECT_ID('dbo.recommendations'))
    CREATE INDEX ix_recs_status   ON dbo.recommendations (status_code);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_recs_severity' AND object_id = OBJECT_ID('dbo.recommendations'))
    CREATE INDEX ix_recs_severity ON dbo.recommendations (severity);

-- ---------------------------------------------------------------------------
-- Compliance Standards
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.compliance_standards', 'U') IS NULL
CREATE TABLE dbo.compliance_standards (
    id          NVARCHAR(300) NOT NULL,
    name        NVARCHAR(200) NULL,
    enriched_at DATETIME2     NOT NULL,
    payload     NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_compliance PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Resources
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.resources', 'U') IS NULL
CREATE TABLE dbo.resources (
    id              NVARCHAR(500) NOT NULL,
    name            NVARCHAR(200) NULL,
    type            NVARCHAR(200) NULL,
    enriched_at     DATETIME2     NOT NULL,
    payload         NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_resources PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_resources_type' AND object_id = OBJECT_ID('dbo.resources'))
    CREATE INDEX ix_resources_type ON dbo.resources (type);

-- ---------------------------------------------------------------------------
-- Vulnerabilities
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.vulnerabilities', 'U') IS NULL
CREATE TABLE dbo.vulnerabilities (
    id          NVARCHAR(100) NOT NULL,
    severity    NVARCHAR(50)  NULL,
    cvss_v3     FLOAT         NULL,
    enriched_at DATETIME2     NOT NULL,
    payload     NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_vulnerabilities PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_vulns_cvss' AND object_id = OBJECT_ID('dbo.vulnerabilities'))
    CREATE INDEX ix_vulns_cvss ON dbo.vulnerabilities (cvss_v3 DESC);

-- ---------------------------------------------------------------------------
-- Endpoints (Defender for Endpoint devices)
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.endpoints', 'U') IS NULL
CREATE TABLE dbo.endpoints (
    id            NVARCHAR(100) NOT NULL,
    risk_score    NVARCHAR(50)  NULL,
    health_status NVARCHAR(50)  NULL,
    enriched_at   DATETIME2     NOT NULL,
    payload       NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_endpoints PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_endpoints_risk' AND object_id = OBJECT_ID('dbo.endpoints'))
    CREATE INDEX ix_endpoints_risk ON dbo.endpoints (risk_score);

-- ---------------------------------------------------------------------------
-- Virtual Machines
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.virtual_machines', 'U') IS NULL
CREATE TABLE dbo.virtual_machines (
    id          NVARCHAR(500) NOT NULL,
    name        NVARCHAR(200) NULL,
    enriched_at DATETIME2     NOT NULL,
    payload     NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_virtual_machines PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Sign-ins
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.signins', 'U') IS NULL
CREATE TABLE dbo.signins (
    id               NVARCHAR(200) NOT NULL,
    risk_level       NVARCHAR(50)  NULL,
    created_datetime DATETIME2     NULL,
    enriched_at      DATETIME2     NOT NULL,
    payload          NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_signins PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_signins_risk'    AND object_id = OBJECT_ID('dbo.signins'))
    CREATE INDEX ix_signins_risk    ON dbo.signins (risk_level);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_signins_created' AND object_id = OBJECT_ID('dbo.signins'))
    CREATE INDEX ix_signins_created ON dbo.signins (created_datetime DESC);

-- ---------------------------------------------------------------------------
-- Risky Users
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.risky_users', 'U') IS NULL
CREATE TABLE dbo.risky_users (
    id          NVARCHAR(200) NOT NULL,
    risk_level  NVARCHAR(50)  NULL,
    risk_state  NVARCHAR(50)  NULL,
    enriched_at DATETIME2     NOT NULL,
    payload     NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_risky_users PRIMARY KEY (id)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_risky_users_level' AND object_id = OBJECT_ID('dbo.risky_users'))
    CREATE INDEX ix_risky_users_level ON dbo.risky_users (risk_level);

-- ---------------------------------------------------------------------------
-- Network Topology (single-row JSON blob — topology is hierarchical)
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.network_topology', 'U') IS NULL
CREATE TABLE dbo.network_topology (
    singleton_id INT           NOT NULL DEFAULT 1,
    enriched_at  DATETIME2     NOT NULL,
    payload      NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_network PRIMARY KEY (singleton_id),
    CONSTRAINT chk_network_singleton CHECK (singleton_id = 1)
);

-- ---------------------------------------------------------------------------
-- Summary (single-row dashboard card counts)
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.summary', 'U') IS NULL
CREATE TABLE dbo.summary (
    singleton_id              INT       NOT NULL DEFAULT 1,
    secure_score              FLOAT     NULL,
    active_alerts             INT       NULL,
    critical_alerts           INT       NULL,
    unhealthy_recommendations INT       NULL,
    exploitable_cves          INT       NULL,
    total_resources           INT       NULL,
    enriched_at               DATETIME2 NOT NULL,
    CONSTRAINT pk_summary PRIMARY KEY (singleton_id),
    CONSTRAINT chk_summary_singleton CHECK (singleton_id = 1)
);

-- ---------------------------------------------------------------------------
-- Run Manifest (one row per automation run)
-- ---------------------------------------------------------------------------

IF OBJECT_ID('dbo.run_manifest', 'U') IS NULL
CREATE TABLE dbo.run_manifest (
    id            INT           IDENTITY(1,1) NOT NULL,
    run_start     DATETIME2     NOT NULL,
    run_end       DATETIME2     NOT NULL,
    elapsed_s     FLOAT         NOT NULL,
    blobs_written INT           NOT NULL DEFAULT 0,
    errors        INT           NOT NULL DEFAULT 0,
    payload       NVARCHAR(MAX) NOT NULL,
    CONSTRAINT pk_run_manifest PRIMARY KEY (id)
);
