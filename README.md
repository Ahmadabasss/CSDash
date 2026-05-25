<div align="center">

<img src="docs/screenshots/overview.png" alt="Vigil Dashboard" width="900"/>

<h1>Vigil — Azure Security Posture Dashboard</h1>

<p>A single-pane-of-glass security operations dashboard for Microsoft Azure.<br/>
Surfaces alerts, compliance posture, identity risk, network topology, CVEs, and threat investigation — all in one place.</p>

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Azure SQL](https://img.shields.io/badge/Azure_SQL-Database-0078D4?style=flat&logo=microsoftazure&logoColor=white)

</div>

---

## What is Vigil?

Vigil replaces clicking through 10 different Azure Portal blades by pulling everything into one clean dashboard — built for security engineers and cloud operators who need situational awareness fast.

It connects to **Azure SQL Database** and displays data across every security domain:

- Who is attacking you (alerts, incidents, MITRE ATT&CK techniques)
- What is exposed (CVEs, open recommendations, ghost resources)
- How compliant you are (CIS, NIST, ISO 27001, PCI-DSS, SOC 2, HIPAA)
- Who is logging in (sign-in risk, risky users, geography)
- How your network looks (VNet topology, NSG rules, traffic simulation)

---

## Pages & Features

<table>
  <tr>
    <td align="center"><b>Overview</b></td>
    <td align="center"><b>Alerts</b></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/overview.png"/></td>
    <td><img src="docs/screenshots/alerts.png"/></td>
  </tr>
  <tr>
    <td align="center"><b>Network Topology</b></td>
    <td align="center"><b>Compliance</b></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/network.png"/></td>
    <td><img src="docs/screenshots/compliance.png"/></td>
  </tr>
  <tr>
    <td align="center"><b>CVEs</b></td>
    <td align="center"><b>Incidents</b></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/vulnerabilities.png"/></td>
    <td><img src="docs/screenshots/incidents.png"/></td>
  </tr>
</table>

| Page | What it shows |
|------|--------------|
| **Overview** | Secure score gauge + trend, compliance donut, top alerts, MITRE ATT&CK heatmap, sign-in risk, ghost resource callout |
| **Alerts** | All security alerts — paginated, sortable, filterable by severity/status/category — with MITRE technique tags and full detail drill-down |
| **Recommendations** | Unhealthy Defender for Cloud recommendations ranked by severity with category filters |
| **CVEs** | Vulnerabilities ranked by risk score — CVSS v3, exposed machine count, CISA KEV exploit tags, ransomware/APT threat tags |
| **Compliance** | 8 regulatory standards (CIS 1.4, NIST 800-53, ISO 27001, PCI-DSS 4.0, SOC 2, HIPAA-HITRUST, CMMC-L3, Security Benchmark) with pass/fail/skipped counts |
| **Sign-ins** | Authentication log with risk level, failed logins, top risky IPs, sign-in geography map |
| **Risky Users** | Users flagged by Microsoft Entra ID with risk level history |
| **Incidents** | Microsoft Sentinel incidents with severity breakdown, tactic chains, related alerts |
| **Network Topology** | Interactive VNet peering map, subnet topology, NSG rule inspector with per-rule Allow/Deny badges, live traffic simulator |
| **Ghost Resources** | Detects deallocated VMs, orphaned public IPs, stale NSGs, and abandoned storage — with risk scoring and step-by-step remediation |
| **Blast Radius** | Force-directed graph showing how an attack propagates from any compromised resource |
| **Resources** | Full Azure resource inventory with security scores and issue counts |
| **Virtual Machines** | VM inventory with MDE status, patch state, vulnerability counts |
| **Endpoints** | Endpoint security posture from Microsoft Defender for Endpoint |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | Python 3.11 · FastAPI · pyodbc · pydantic-settings · uvicorn |
| **Database** | Azure SQL Database (any service tier — Basic at $5/mo works) |
| **Frontend** | Next.js 14 App Router · TypeScript · Tailwind CSS · Recharts · React Flow · Lucide React |

---

## Prerequisites — Install These First

Before you start, make sure you have all of these installed:

### 1. Python 3.11+
Download from https://python.org/downloads — check "Add to PATH" during installation.
```bash
python3 --version   # should print 3.11 or higher
```

### 2. Node.js 18+
Download from https://nodejs.org (choose the LTS version).
```bash
node --version   # should print v18 or higher
npm --version
```

### 3. Git
Download from https://git-scm.com/downloads
```bash
git --version
```

### 4. ODBC Driver 18 for SQL Server
This is required for the Python backend to talk to Azure SQL.

- **Windows:** https://aka.ms/downloadmsodbcsql
- **macOS:** `brew install msodbcsql18`
- **Ubuntu/Debian:** Follow the official guide at https://learn.microsoft.com/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server

### 5. Azure Account
You need an active Azure subscription. Sign up free at https://azure.microsoft.com/free — you get $200 credit.

---

## Part 1 — Set Up Azure SQL Database

You need to create a database in the Azure Portal before running the app.

### Step 1 — Create a SQL Server

1. Go to **portal.azure.com**
2. Click **Create a resource** → search for **SQL Database** → click **Create**
3. On the **Basics** tab:
   - **Subscription:** choose yours
   - **Resource group:** create new, e.g. `vigil-rg`
   - **Database name:** `vigil-security`
   - **Server:** click **Create new**
     - Server name: e.g. `vigil-sql` (must be globally unique → becomes `vigil-sql.database.windows.net`)
     - Location: choose the region closest to you
     - Authentication: choose **Use SQL authentication**
     - Admin login: `sqladmin`
     - Password: choose a strong password and **save it** — you'll need it
4. **Compute + storage:** click **Configure database** → choose **Basic** ($5/mo) for development
5. Click **Review + create** → **Create**

Wait ~2 minutes for deployment to complete.

### Step 2 — Allow your IP through the firewall

1. Go to your new **SQL Server** resource (not the database — the server)
2. Click **Security → Networking**
3. Under **Firewall rules**, click **Add your client IPv4 address**
4. Click **Save**

> If you're on a VPN or your IP changes often, you can temporarily allow `0.0.0.0` to `255.255.255.255` for development. **Remove this rule before going to production.**

### Step 3 — Get your connection string

1. Go to your **SQL Database** resource (`vigil-security`)
2. In the left menu click **Settings → Connection strings**
3. Click the **ODBC** tab
4. Copy the connection string — it looks like this:
   ```
   Driver={ODBC Driver 18 for SQL Server};Server=tcp:vigil-sql.database.windows.net,1433;Database=vigil-security;Uid=sqladmin;Pwd={your_password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;
   ```
5. Replace `{your_password}` with the password you set in Step 1
6. **Save this string** — you'll paste it into `.env` shortly

---

## Part 2 — Clone and Install

### Step 1 — Clone the repository

```bash
git clone https://github.com/Ahmadabasss/CSDash.git
cd CSDash
```

### Step 2 — Set up the backend

```bash
cd backend

# Create a virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate        # macOS / Linux
# OR
.venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
```

### Step 3 — Set up the frontend

```bash
cd ../frontend
npm install
```

---

## Part 3 — Database Setup

### Step 1 — Create the tables

Run the schema script against your Azure SQL database. This creates all 12 tables. It is **safe to run multiple times**.

**Option A — sqlcmd (command line):**
```bash
sqlcmd -S vigil-sql.database.windows.net \
       -d vigil-security \
       -U sqladmin \
       -P YOUR_PASSWORD \
       -i backend/scripts/create_schema.sql
```

**Option B — Azure Data Studio (GUI):**
1. Download Azure Data Studio from https://aka.ms/azuredatastudio
2. Connect to your server using the credentials from Part 1
3. Open `backend/scripts/create_schema.sql`
4. Click **Run**

### Step 2 — Seed the database with data

This loads realistic security data into your database (alerts, recommendations, CVEs, compliance posture, sign-ins, resources, and more).

```bash
# From the repo root — paste your full connection string after --conn
python backend/scripts/seed_sql.py \
  --conn "Driver={ODBC Driver 18 for SQL Server};Server=tcp:vigil-sql.database.windows.net,1433;Database=vigil-security;Uid=sqladmin;Pwd=YOUR_PASSWORD;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;" \
  --scenario noisy
```

You should see output like:
```
Connecting …
  seeded alerts                556 rows
  seeded incidents              15 rows
  seeded recommendations       107 rows
  seeded vulnerabilities        15 rows
  seeded compliance_standards    8 rows
  seeded resources             120 rows
  seeded virtual_machines       45 rows
  seeded endpoints              30 rows
  seeded signins               200 rows
  seeded risky_users            12 rows
  seeded secure_score            1 rows
  seeded network_topology        1 row

Done — all data committed.
```

> **Scenarios:** `noisy` (typical enterprise, 556 alerts) · `compromised` (active attack, 600 high-severity alerts) · `secured` (hardened tenant, 80 alerts)

---

## Part 4 — Configure Environment

### Backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` in any text editor and fill it in:

```env
DATA_SOURCE=sql

# Paste your full ODBC connection string here (from Part 1 Step 3)
SQL_CONNECTION_STRING=Driver={ODBC Driver 18 for SQL Server};Server=tcp:vigil-sql.database.windows.net,1433;Database=vigil-security;Uid=sqladmin;Pwd=YOUR_PASSWORD;Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;

FRONTEND_ORIGIN=http://localhost:3000
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
```

`frontend/.env.local` — the default works for local development:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Part 5 — Run the App

Open **two terminals** side by side.

**Terminal 1 — Backend:**
```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

Open **http://localhost:3000** in your browser. 🎉

---

## Running Without Azure (Mock Mode)

No Azure account? No problem. Run entirely on local data — no database needed.

```bash
# backend/.env
DATA_SOURCE=mock
```

Skip Parts 1 and 3 entirely. Just configure the env files and run both servers.

**Switch scenarios without restarting:**
```bash
# Simulate an active attack
curl -X POST http://localhost:8000/api/scenario \
     -H "Content-Type: application/json" \
     -d '{"scenario": "compromised"}'

# Switch to a hardened tenant
curl -X POST http://localhost:8000/api/scenario \
     -H "Content-Type: application/json" \
     -d '{"scenario": "secured"}'

# Back to normal
curl -X POST http://localhost:8000/api/scenario \
     -H "Content-Type: application/json" \
     -d '{"scenario": "noisy"}'
```

| Scenario | Secure Score | Alerts | What it simulates |
|----------|-------------|--------|--------------------|
| `noisy` | 55% | 556 | Real-world enterprise with typical alert noise |
| `compromised` | 32% | 600 high-sev | Active attack — lateral movement, ransomware indicators, credential theft |
| `secured` | 78% | 80 | Well-hardened tenant with minimal exposure |

---

## Configuration Reference

### `backend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATA_SOURCE` | Yes | `sql` | `sql` = Azure SQL · `mock` = local JSON files |
| `SQL_CONNECTION_STRING` | When using sql | — | Full ODBC connection string from Azure Portal |
| `FRONTEND_ORIGIN` | No | `http://localhost:3000` | CORS allowed origin — change when deploying |

### `frontend/.env.local`

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL — update when deploying to production |

---

## API Reference

Full interactive docs available at **http://localhost:8000/docs** when the backend is running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/summary` | All dashboard card data in one request |
| `GET` | `/api/secure-score` | Current score + 12-week history |
| `GET` | `/api/alerts` | Paginated alerts — supports `?page`, `?limit`, `?sort`, `?order`, `?severity`, `?status` |
| `GET` | `/api/alerts/{id}` | Single alert detail |
| `GET` | `/api/alerts/mitre-summary` | Technique frequency data for MITRE heatmap |
| `GET` | `/api/recommendations` | Paginated recommendations |
| `GET` | `/api/recommendations/{id}` | Single recommendation detail |
| `GET` | `/api/vulnerabilities` | CVE list ranked by risk score |
| `GET` | `/api/compliance` | All regulatory standards posture |
| `GET` | `/api/resources` | Azure resource inventory |
| `GET` | `/api/resources/{id}` | Resource detail with related alerts and recommendations |
| `GET` | `/api/signins` | Sign-in logs |
| `GET` | `/api/signins/risk-summary` | Risky IPs, countries, risk level breakdown |
| `GET` | `/api/incidents` | Security incidents |
| `GET` | `/api/network/topology` | VNet topology with NSG details |
| `GET` | `/api/orphans` | Ghost / abandoned resources |
| `GET` | `/api/scenario` | Current active scenario |
| `POST` | `/api/scenario` | Hot-swap scenario without restarting |

---

## Project Structure

```
CSDash/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point, CORS config
│   │   ├── config.py            # All settings via pydantic-settings
│   │   ├── deps.py              # DataSource singleton + scenario switcher
│   │   ├── services/
│   │   │   ├── base.py          # DataSource Protocol interface
│   │   │   ├── sql.py           # Azure SQL — async-safe pyodbc
│   │   │   └── mock.py          # Local JSON files
│   │   └── routers/             # One file per domain (alerts, recommendations, etc.)
│   ├── scripts/
│   │   ├── create_schema.sql    # T-SQL DDL — creates all 12 tables (idempotent)
│   │   └── seed_sql.py          # Loads mock data into Azure SQL
│   └── mock_data/               # Network topology source JSON
├── frontend/
│   ├── app/                     # Next.js 14 App Router pages
│   ├── components/              # Reusable UI components
│   ├── lib/api.ts               # Typed fetch wrapper
│   └── types/azure.ts           # TypeScript types matching API shapes
└── data/
    └── big-mock-data/scenarios/ # noisy · compromised · secured JSON datasets
```

---

## Troubleshooting

**`pyodbc.Error: [08001]` — Cannot connect to SQL Server**
- ODBC Driver 18 is not installed → [download it here](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server)
- Your IP is blocked → Azure Portal → SQL Server → **Networking** → add your IP to the firewall
- Wrong server name → must end with `.database.windows.net`

**`ValueError: SQL_CONNECTION_STRING is not set`**
- `backend/.env` is missing or you haven't filled in `SQL_CONNECTION_STRING`
- Make sure you copied `.env.example` to `.env` (not `.env.example`)

**Frontend shows "Backend offline"**
- Backend is not running — start it with `uvicorn app.main:app --reload --port 8000`
- Port mismatch — check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`

**`npm run dev` fails**
- Run `npm install` first inside the `frontend/` folder
- Make sure Node.js 18+ is installed: `node --version`

**Seed script runs but tables are empty**
- Run `create_schema.sql` first to create the tables, then run `seed_sql.py`
- Check the seed output — each table prints a row count; if it shows `0` the JSON file may be missing

**`pip install -r requirements.txt` fails on pyodbc**
- ODBC Driver 18 must be installed before pyodbc can build
- On macOS also run: `brew install unixodbc`

---

## License

MIT
