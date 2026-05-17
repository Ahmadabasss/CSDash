# Azure Security Posture Dashboard

A single-pane-of-glass security dashboard that surfaces vulnerabilities, alerts, recommendations, and compliance posture from **Microsoft Defender for Cloud**, **Microsoft Graph Security API**, and **Azure Resource Graph** — built with FastAPI and Next.js 14.

> **Phase 1 (current):** Full UI running against 900+ realistic mock alerts, 300+ recommendations, and 120+ resources generated from real Microsoft API schemas and CISA KEV catalog data. Switching to live Azure is a single env-var change.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13 · FastAPI · pydantic-settings · uvicorn |
| Mock data | Synthetic generator — real CISA KEV CVEs, MITRE ATT&CK techniques, Azure resource types |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts |
| Auth (Phase 2) | Azure Entra ID · `ClientSecretCredential` |
| Cloud APIs (Phase 2) | Defender for Cloud · Microsoft Graph Security · Azure Resource Graph |

---

## Features

### Backend API (17 endpoints)

**Alerts**
- Paginated, sorted, and filtered alert list (sort by severity / date / MITRE category)
- Single alert detail
- `GET /api/alerts/mitre-summary` — ATT&CK technique frequency across all alerts (heatmap data)

**Recommendations**
- Paginated, sorted, and filtered recommendations (sort by severity / effort / category)
- Single recommendation detail
- `GET /api/recommendations/categories` — category counts for filter dropdowns

**Resources**
- Full resource list with security metadata (score, issue count, tags, region)
- `GET /api/resources/{id}` — resource detail with **joined** related alerts and recommendations

**Sign-ins**
- Raw sign-in log
- `GET /api/signins/risk-summary` — risky/failed counts, top risky IPs, top countries

**Dashboard**
- `GET /api/summary` — single call for all dashboard card data (runs 5 Azure queries in parallel via `asyncio.gather`)
- `GET /api/secure-score` — current score + 12-week history
- `GET /api/compliance` — regulatory standards posture (CIS, NIST, ISO 27001, PCI-DSS, SOC 2, HIPAA, CMMC, ASB)
- `GET /api/vulnerabilities` — CVEs with CVSS scores and exploit/ransomware tags from CISA KEV

**Demo**
- `GET /api/scenario` — current active data scenario
- `POST /api/scenario` — hot-swap mock scenario **without restarting the server**

### Mock Data Scenarios

Three coherent scenarios — each scenario's alerts, recommendations, resources, and secure score all tell a consistent story:

| Scenario | Secure Score | Alerts | Story |
|---|---|---|---|
| `noisy` (default) | ~55% | 900 | Real-world enterprise, typical posture |
| `secured` | ~78% | 80 | Well-hardened tenant |
| `compromised` | ~32% | 600 (high-severity) | Active attack in progress |

Switch at runtime: `POST /api/scenario {"scenario": "compromised"}`

### What's real in the mock data

- **25 real CVEs** from CISA's Known Exploited Vulnerabilities catalog (XZ Utils, MOVEit, Citrix Bleed…) with correct CVSS scores
- **18 real MITRE ATT&CK techniques** (T1059.001 PowerShell, T1486 Data Encrypted for Impact, T1078 Valid Accounts…)
- **30 real Defender for Cloud recommendations** with genuine cause codes
- **8 real compliance standards** with real control counts (CIS 1.4, NIST 800-53, ISO 27001, PCI-DSS 4.0…)
- **27 real Azure regions** and **20 real resource types**

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

API docs available at **http://localhost:8000/docs**

### Frontend *(coming soon — Phase 1 in progress)*

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

---

## Architecture

```
CSDash/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, lifespan cache-refresh task
│   │   ├── config.py        # pydantic-settings — DATA_SOURCE, MOCK_SCENARIO, CACHE_REFRESH_SECONDS
│   │   ├── deps.py          # Data source singleton — hot-swappable via switch_scenario()
│   │   ├── services/
│   │   │   ├── base.py      # DataSource Protocol (10 methods)
│   │   │   ├── mock.py      # Loads JSON from scenario dir; reload() re-reads without restart
│   │   │   └── azure.py     # Phase 2 stub — real Azure SDK calls
│   │   └── routers/         # One file per resource
│   └── data/
│       └── big-mock-data/
│           └── scenarios/   # noisy · compromised · secured
└── frontend/                # Next.js 14 — in progress
```

**Key design:** `DataSource` is a structural `Protocol` — mock and Azure implementations are interchangeable. All routes call `data_source.get_X()` with no awareness of the underlying source.

**Background refresh:** A lifespan task reloads JSON files from disk every 5 minutes (`CACHE_REFRESH_SECONDS=0` to disable). Useful for live-editing mock data during development.

---

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `DATA_SOURCE` | `mock` | `mock` or `azure` |
| `MOCK_SCENARIO` | `noisy` | Active scenario (`noisy`, `compromised`, `secured`) |
| `CACHE_REFRESH_SECONDS` | `300` | How often to reload mock data from disk (0 = off) |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allowed origin |
| `AZURE_TENANT_ID` | — | Phase 2 |
| `AZURE_CLIENT_ID` | — | Phase 2 |
| `AZURE_CLIENT_SECRET` | — | Phase 2 |
| `AZURE_SUBSCRIPTION_ID` | — | Phase 2 |

---

## Roadmap

- [x] FastAPI backend with 17 endpoints
- [x] Paginated, sortable, filterable alerts and recommendations
- [x] Resource detail with joined alerts and recommendations
- [x] MITRE ATT&CK heatmap data endpoint
- [x] Sign-in risk summary (risky IPs, failure rates, geography)
- [x] Hot-swappable mock scenarios (noisy / compromised / secured)
- [x] Background cache refresh with lifespan task
- [ ] Next.js 14 frontend dashboard
- [ ] Secure Score gauge + 12-week trend chart
- [ ] Compliance donut chart (per standard)
- [ ] Drill-down pages (alerts, recommendations, resources, compliance)
- [ ] MITRE ATT&CK heatmap panel
- [ ] Sign-in risk panel
- [ ] Scenario switcher UI
- [ ] Phase 2: live Azure SDK integration

---

## Phase 2 — Live Azure

1. Enable Defender for Cloud (free tier) on your Azure subscription
2. Register an Entra ID app with **Security Reader** role and `SecurityAlert.Read.All` + `SecurityEvents.Read.All` Graph permissions
3. Set `DATA_SOURCE=azure` and fill in the four Azure env vars
4. Implement `app/services/azure.py` — the router layer is unchanged

See [`CLAUDE.md`](CLAUDE.md) for the full Phase 2 setup guide.
