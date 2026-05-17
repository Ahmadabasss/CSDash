# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An Azure Security Posture Dashboard — a single-pane-of-glass view pulling vulnerabilities, recommendations, alerts, and compliance posture from Microsoft Defender for Cloud, Microsoft Graph Security API, and Azure Resource Graph.

**Phase 1** (current): Build the entire UI against realistic mock data in `backend/data/big-mock-data/generated/scenarios/`. The mock JSON schemas match real Microsoft API responses exactly — switching to live Azure is a drop-in config change later.

## Dev Commands

**Backend (FastAPI):**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Frontend (Next.js):**
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev       # http://localhost:3000
```

## Build Status

### Backend

| Endpoint | Method | Feature | Status |
|----------|--------|---------|--------|
| `/health` | GET | Health check | ✅ Done |
| `/api/secure-score` | GET | Current score + 12-week history | ✅ Done |
| `/api/summary` | GET | Aggregated dashboard card counts | ✅ Done |
| `/api/alerts` | GET | Paginated, sorted, filtered alerts | ✅ Done |
| `/api/alerts/{id}` | GET | Single alert detail | ✅ Done |
| `/api/alerts/mitre-summary` | GET | ATT&CK technique frequency heatmap | ✅ Done |
| `/api/recommendations` | GET | Paginated, sorted, filtered recs | ✅ Done |
| `/api/recommendations/{id}` | GET | Single recommendation detail | ✅ Done |
| `/api/recommendations/categories` | GET | Category counts for filter dropdown | ✅ Done |
| `/api/vulnerabilities` | GET | CVE list with CVSS + exploit tags | ✅ Done |
| `/api/compliance` | GET | Regulatory standards posture | ✅ Done |
| `/api/resources` | GET | Azure resources with security metadata | ✅ Done |
| `/api/resources/{id}` | GET | Resource detail + related alerts & recs | ✅ Done |
| `/api/signins` | GET | Sign-in logs | ✅ Done |
| `/api/signins/risk-summary` | GET | Risky/failed counts, top IPs, countries | ✅ Done |
| `/api/scenario` | GET | Current active mock scenario | ✅ Done |
| `/api/scenario` | POST | Hot-swap scenario (noisy/compromised/secured) | ✅ Done |
| `app/services/azure.py` | — | Real Azure SDK implementation | ⬜ Phase 2 |

### Frontend

| Component | Feature | Status |
|-----------|---------|--------|
| `app/page.tsx` | Main dashboard layout | ⬜ Todo |
| `SecureScoreGauge` | Gauge with red/amber/green tiers | ⬜ Todo |
| `SecureScoreTrend` | 12-week trend line chart | ⬜ Todo |
| `ComplianceDonut` | Pass/fail/skipped donut, standard selector | ⬜ Todo |
| `AlertsTable` | Paginated, sortable, MITRE column | ⬜ Todo |
| `RecommendationsTable` | Paginated, sortable, category filter | ⬜ Todo |
| `VulnerabilitiesTable` | Top 5 by risk score, exploit/ransomware tags | ⬜ Todo |
| `SeverityBadge` | Color-coded severity chip | ⬜ Todo |
| `app/alerts/page.tsx` | Full alerts drill-down | ⬜ Todo |
| `app/recommendations/page.tsx` | Full recommendations drill-down | ⬜ Todo |
| `app/vulnerabilities/page.tsx` | CVE drill-down | ⬜ Todo |
| `app/resources/page.tsx` | Resource list + detail | ⬜ Todo |
| `app/compliance/page.tsx` | Compliance drill-down | ⬜ Todo |
| `lib/api.ts` | Typed `fetchJSON<T>` helper | ⬜ Todo |
| `types/azure.ts` | TypeScript interfaces matching API shapes | ⬜ Todo |
| Scenario switcher UI | Toggle between noisy/compromised/secured | ⬜ Todo |
| MITRE ATT&CK heatmap | Technique frequency panel | ⬜ Todo |
| Sign-in risk panel | Risky logins, top IPs, geo table | ⬜ Todo |

## Architecture

### Backend (`backend/`)

- `app/main.py` — FastAPI entry point; CORS allows `http://localhost:3000`; lifespan starts cache-refresh background task
- `app/config.py` — `DATA_SOURCE` env var switches between `mock` and `azure`; `MOCK_SCENARIO` sets active scenario; `CACHE_REFRESH_SECONDS` controls reload interval (default 300, set 0 to disable)
- `app/deps.py` — module-level `_instance` singleton; `switch_scenario()` hot-swaps without restarting
- `app/services/base.py` — `DataSource` Protocol (10 methods); both mock and Azure must satisfy it
- `app/services/mock.py` — loads JSON from scenario dir at startup; `reload()` re-reads files without restart
- `app/services/azure.py` — Phase 2 stub (commented out)
- `app/routers/` — one file per resource; pagination handled at router level, data source returns full lists

The `DATA_SOURCE` toggle is the only difference between mock and real modes. Keep response shapes identical — never diverge schemas.

### Mock Data Scenarios

Three scenarios in `data/big-mock-data/generated/scenarios/`:

| Scenario | Secure Score | Alerts | Story |
|----------|-------------|--------|-------|
| `noisy` | ~55% | 900 | Default — real-world enterprise |
| `secured` | ~78% | 80 | Well-hardened tenant |
| `compromised` | ~32% | 600 (high-sev) | Active attack in progress |

Hot-swap at runtime: `POST /api/scenario {"scenario": "compromised"}`

### Pagination Shape

All paginated endpoints (`/api/alerts`, `/api/recommendations`) return:
```json
{ "items": [...], "total": 900, "page": 1, "limit": 50, "pages": 18 }
```

Query params: `page`, `limit` (max 500), `sort`, `order` (asc|desc).

### Frontend (`frontend/`)

- Next.js 14 App Router with TypeScript + Tailwind + `recharts` + `lucide-react`
- `lib/api.ts` — typed `fetchJSON<T>(path)` helper using `NEXT_PUBLIC_API_URL`
- `types/azure.ts` — TypeScript interfaces that mirror the mock JSON shapes
- `app/page.tsx` — main dashboard (summary cards, trend chart, compliance donut, tables)
- Drill-down pages under `app/alerts/`, `app/recommendations/`, etc.

### Dashboard Layout

1. **Top row** — 4 summary cards: Secure Score gauge (red <40%, amber 40–70%, green >70%), Active Alerts, Unhealthy Recommendations, Exploitable CVEs
2. **Middle row** — Secure Score trend line (last 12 weeks) + Compliance donut (pass/fail/skipped, switchable by standard)
3. **Recommendations table** — paginated, sortable by severity, filterable by category
4. **Alerts table** — paginated, sortable by date/severity, MITRE column
5. **Top 5 vulnerabilities** — ranked by `exposedMachines * cvssV3`, with exploit/ransomware tags

## Key Skills Available

- `/azure-security-apis` — correct SDK methods, API versions, and endpoint paths for Defender/Graph calls
- `/fastapi-azure-backend` — backend conventions, DataSource abstraction, router patterns
- `/security-dashboard-ui` — severity color coding, CVSS thresholds, MITRE ATT&CK display conventions
- `/kql-queries` — tested KQL for Azure Resource Graph queries
- `/azure-app-registration` — Entra ID setup steps for Phase 2

## Phase 2 (Real Azure)

When ready: set `DATA_SOURCE=azure` in `.env`, fill in `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SUBSCRIPTION_ID`, then implement `app/services/azure.py` using `ClientSecretCredential`. The app registration needs **Security Reader** role on the subscription and `SecurityAlert.Read.All` + `SecurityEvents.Read.All` Graph permissions with admin consent granted.
