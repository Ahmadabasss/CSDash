# Vigil — Azure Security Posture Dashboard

A single-pane-of-glass security dashboard for Microsoft Azure — surfaces alerts, recommendations, vulnerabilities, compliance posture, identity risk, network topology, and more.

Built with **FastAPI** (Python) + **Next.js 14** (TypeScript), backed by **Azure SQL Database**.

---

## Features

- **Security Overview** — secure score gauge, 12-week trend, compliance donut, MITRE ATT&CK heatmap
- **Alerts** — paginated, sortable, filterable with MITRE technique tags
- **Recommendations** — severity-ranked with category filters
- **CVEs** — risk-ranked vulnerabilities with CVSS scores and exploit/ransomware tags
- **Compliance** — CIS, NIST 800-53, ISO 27001, PCI-DSS, SOC 2, HIPAA, CMMC, Security Benchmark
- **Identity Risk** — sign-in logs, risky users, top risky IPs, geography map
- **Network Topology** — interactive VNet peering map, subnet topology, NSG rule inspector, traffic simulator
- **Ghost Resources** — detects deallocated VMs, orphaned public IPs, stale NSGs, abandoned storage
- **Blast Radius** — visualise attack propagation from a compromised resource
- **Incidents** — Microsoft Sentinel incident management

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11+ · FastAPI · pyodbc · uvicorn |
| Database | Azure SQL Database |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts · React Flow |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- [ODBC Driver 18 for SQL Server](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server) installed
- An Azure SQL Database (any service tier)

---

### 1. Clone the repo

```bash
git clone https://github.com/Ahmadabasss/CSDash.git
cd CSDash
```

### 2. Create the database schema

**Option A — Azure Data Studio:** open `backend/scripts/create_schema.sql` and click Run.

**Option B — sqlcmd:**
```bash
sqlcmd -S YOUR_SERVER.database.windows.net -d YOUR_DATABASE \
       -U YOUR_USERNAME -P YOUR_PASSWORD \
       -i backend/scripts/create_schema.sql
```

### 3. Seed the database

```bash
pip install pyodbc

python backend/scripts/seed_sql.py \
  --conn "Driver={ODBC Driver 18 for SQL Server};Server=tcp:YOUR_SERVER.database.windows.net,1433;Database=YOUR_DATABASE;Uid=YOUR_USERNAME;Pwd=YOUR_PASSWORD;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;" \
  --scenario noisy
```

`--scenario` options: `noisy` (default) · `compromised` · `secured`

### 4. Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and paste your connection string:

```env
DATA_SOURCE=sql
SQL_CONNECTION_STRING=Driver={ODBC Driver 18 for SQL Server};Server=tcp:YOUR_SERVER.database.windows.net,1433;Database=YOUR_DATABASE;Uid=YOUR_USERNAME;Pwd=YOUR_PASSWORD;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
```

> **Where to find your connection string:**
> Azure Portal → your SQL Database → **Settings → Connection strings → ODBC tab**
> Copy the string and replace `{your_password}` with your actual password.

### 5. Start the backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: **http://localhost:8000/docs**

### 6. Start the frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Running without a database (mock mode)

If you want to explore the UI without setting up Azure SQL:

```bash
# in backend/.env
DATA_SOURCE=mock
```

No database or seed step needed. Switch scenarios at runtime:

```bash
curl -X POST http://localhost:8000/api/scenario \
     -H "Content-Type: application/json" \
     -d '{"scenario": "compromised"}'
```

| Scenario | Secure Score | Alerts | Story |
|----------|-------------|--------|-------|
| `noisy` | ~55% | 556 | Typical enterprise |
| `secured` | ~78% | 80 | Well-hardened tenant |
| `compromised` | ~32% | 600 high-sev | Active attack in progress |

---

## Configuration

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATA_SOURCE` | Yes | `sql` (default) or `mock` |
| `SQL_CONNECTION_STRING` | When `DATA_SOURCE=sql` | Full ODBC connection string from Azure Portal |
| `FRONTEND_ORIGIN` | No | CORS allowed origin (default: `http://localhost:3000`) |

### `frontend/.env.local`

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL — change when deploying |

---

## Project Structure

```
CSDash/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── deps.py              # DataSource singleton
│   │   ├── services/
│   │   │   ├── base.py          # DataSource Protocol
│   │   │   ├── sql.py           # Azure SQL implementation
│   │   │   └── mock.py          # Mock JSON implementation
│   │   └── routers/             # One file per resource domain
│   ├── scripts/
│   │   ├── create_schema.sql    # T-SQL DDL (idempotent, safe to re-run)
│   │   └── seed_sql.py          # Seed DB from mock JSON files
│   └── mock_data/               # Network topology source data
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # Reusable UI components
│   └── types/                   # TypeScript interfaces
└── data/
    └── big-mock-data/scenarios/ # noisy · compromised · secured
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/summary` | Dashboard summary cards |
| GET | `/api/secure-score` | Score + 12-week history |
| GET | `/api/alerts` | Paginated alerts |
| GET | `/api/alerts/{id}` | Alert detail |
| GET | `/api/alerts/mitre-summary` | MITRE ATT&CK heatmap data |
| GET | `/api/recommendations` | Paginated recommendations |
| GET | `/api/recommendations/{id}` | Recommendation detail |
| GET | `/api/vulnerabilities` | CVE list ranked by risk |
| GET | `/api/compliance` | Compliance standards posture |
| GET | `/api/resources` | Azure resource inventory |
| GET | `/api/resources/{id}` | Resource detail |
| GET | `/api/signins` | Sign-in logs |
| GET | `/api/signins/risk-summary` | Risky IPs, countries, risk levels |
| GET | `/api/incidents` | Security incidents |
| GET | `/api/network/topology` | VNet topology with NSG details |
| GET | `/api/scenario` | Current active scenario |
| POST | `/api/scenario` | Hot-swap scenario without restart |
