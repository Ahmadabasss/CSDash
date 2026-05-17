# Big Mock Data — Azure Security Dashboard

Two complementary tools for getting realistic, large-scale mock data into the dashboard project:

1. **`scripts/download_microsoft_data.py`** — fetches real (sanitized) sample data Microsoft publishes on GitHub (Defender for Endpoint events, Entra ID sign-in logs from the Sentinel Training Lab, O365 audit logs, etc.).
2. **`scripts/generate_synthetic_data.py`** — generates 500–900 alerts, 200–400 recommendations, 100+ resources, 20+ CVEs, and 5–8 compliance standards in shapes matching the real Microsoft API responses.

## Why both?

The Microsoft sample data on GitHub is **log telemetry** (rows that would land in Log Analytics tables like `DeviceProcessEvents` or `SigninLogs`). Real, sanitized, scenario-driven — but in *log* shape, not *API response* shape.

The synthetic generator produces data in the exact response shape of the Microsoft Graph Security API, Defender for Cloud REST API, and Azure Resource Graph. It also generates *coherent* data — a ransomware alert points at a real VM in `resources.json`, which has matching unhealthy recommendations, and the secure score reflects the overall posture.

Use them together: the generator powers the main dashboard endpoints (alerts, recommendations, secure score, etc.), and the downloaded Microsoft data powers extra panels like "endpoint activity feed" and "cloud app activity" (the `reshape_microsoft_data.py` script bridges them).

## Quick start

```bash
# 1. Fetch the real Microsoft data from GitHub
python scripts/download_microsoft_data.py

# 2. Reshape it into the dashboard's API format (creates endpoint_activity.json,
#    network_events.json, cloud_app_activity.json, real_signins.json)
python scripts/reshape_microsoft_data.py

# 3. Generate large synthetic data (default: "noisy" scenario, seed 42)
python scripts/generate_synthetic_data.py

# 4. Copy everything into the dashboard project
cp generated/*.json /path/to/azure-sec-dashboard/backend/mock_data/
```

## Generator scenarios

The generator supports three scenarios that produce different "tenant flavors":

```bash
python scripts/generate_synthetic_data.py --scenario secured     # well-secured tenant
python scripts/generate_synthetic_data.py --scenario noisy       # default, mid-posture
python scripts/generate_synthetic_data.py --scenario compromised # ongoing attack
```

| Scenario | Secure score | Resources | Alerts | Unhealthy recs | Story |
|----------|--------------|-----------|--------|----------------|-------|
| `secured` | ~78% | 80 | 80 | low rate | "What we want to look like" |
| `noisy` | ~55% | 120 | 900 | medium rate | "Real-world enterprise" — your default |
| `compromised` | ~32% | 150 | 600 | high rate | "Tenant under active attack" |

The `compromised` scenario has fewer total alerts than `noisy` but a higher proportion of high-severity ones — this matches what SOCs actually see during incidents (signal-to-noise increases). Compliance failures spike, secure score tanks.

Re-run with `--seed N` for deterministic but different data. Useful for portfolio screenshots (consistent across re-takes) and demos (predictable outputs).

## Generated file sizes (default "noisy" scenario, seed 42)

```
secure_score.json        2 KB    (current score + 12-week history + 7 controls)
recommendations.json   406 KB    (300 recommendations across 120 resources)
alerts.json           1171 KB    (900 alerts with MITRE techniques, evidence)
vulnerabilities.json     8 KB    (15 real CVEs with CVSS, exploit tags)
compliance.json          3 KB    (8 standards: CIS, NIST, ISO, PCI, SOC, HIPAA, CMMC, ASB)
resources.json          64 KB    (120 resources, 20 resource types, 27 regions)
signins.json           118 KB    (200 sign-ins, ~8% from risky IPs)
summary.json            <1 KB    (pre-aggregated counts for dashboard cards)
```

That's ~1.8 MB total — handles paginated tables, charts, and filters without feeling sparse.

## What's real in the synthetic data

The generator pulls from real reference catalogs:

- **27 real Azure regions** (eastus, westeurope, japaneast, …)
- **20 real resource types** (microsoft.compute/virtualmachines, microsoft.sql/servers/databases, …)
- **30 real Defender recommendations** with their real cause codes and threat categories
- **25 real CVEs from CISA's KEV catalog** (XZ Utils backdoor, MOVEit, Citrix bleed, etc.) with correct CVSS scores
- **18 real MITRE ATT&CK techniques** (T1059.001 PowerShell, T1486 Data Encrypted for Impact, T1078 Valid Accounts, …)
- **8 real compliance standards** (CIS, NIST 800-53, ISO 27001, PCI-DSS, SOC, HIPAA, CMMC, ASB) with real control counts
- **Real risky IP examples** (Tor exits, known anonymous proxies) for impossible-travel and anonymous-IP alerts

Frame this honestly in a portfolio: "data is synthetic but generated from real Microsoft catalogs and CISA KEV entries; the schemas match the actual API responses I'd query in production."

## Microsoft data: what gets downloaded

| File | Source | Use |
|------|--------|-----|
| `device_process_events.json` | MDE process events | Endpoint activity feed |
| `device_network_events.json` | MDE network connections | Network events panel |
| `device_logon_events.json` | MDE logons | Logon analysis |
| `cloud_app_events.json` | MDCA activity | SaaS activity panel |
| `office_activity.json` | O365 audit | File ops, mailbox events |
| `signin_logs.csv` | Sentinel Training Lab | Real sign-in scenarios w/ risky users |
| `security_event.csv` | Sentinel Training Lab | Windows Security events from sim attack |
| `azure_activity.csv` | Sentinel Training Lab | ARM control-plane events |

⚠️ Microsoft occasionally moves files in the Azure-Sentinel repo. If `download_microsoft_data.py` reports 404s, check https://github.com/Azure/Azure-Sentinel/tree/master/Sample%20Data and update the `FILES[]` list at the top of the script with new paths.

## Folder structure

```
big-mock-data/
├── scripts/
│   ├── download_microsoft_data.py    # Fetches from GitHub
│   ├── reshape_microsoft_data.py     # Converts downloads to API shape
│   └── generate_synthetic_data.py    # Produces large API-shaped data
├── downloaded/                       # Output of download script
├── generated/                        # Output of generator + reshape scripts
└── README.md                         # This file
```

## Wiring into the dashboard backend

The dashboard's `MockDataSource` reads from `backend/mock_data/*.json`. After running the generators, copy the union of `generated/*.json` into that folder:

```bash
cp generated/*.json ../azure-sec-dashboard/backend/mock_data/
```

For the extra panels (endpoint activity, cloud app events, network events, real sign-ins from downloaded data), add corresponding methods to `DataSource` and routes in `app/routers/`. The `fastapi-azure-backend` skill has the patterns.

## Portfolio talking points

When you write the project README or talk about it in an interview:

> "I built a synthetic data generator producing 900+ alerts, 300+ recommendations, and 120+ Azure resources in the exact schemas Microsoft's Graph Security and Defender for Cloud APIs return. The data is coherent — alerts reference real resources with matching unhealthy recommendations, and the secure score reflects the overall posture. I sourced real CVEs from CISA's KEV catalog, real MITRE techniques, and real compliance frameworks (CIS, NIST 800-53, ISO 27001). Three scenarios — secured, noisy, compromised — let me demo different tenant states. I also wrote a downloader that pulls Microsoft's published Sentinel Training Lab data and reshapes it for endpoint activity panels."

That's a real piece of work and worth a paragraph of its own.

## Future improvements

- Time-correlated incidents: link multiple alerts into a single incident (e.g., suspicious sign-in → PowerShell execution → mass file download → ransomware all from the same user/device)
- Generated KQL hunting query results for a "hunting" panel
- Per-resource secure score breakdowns (currently the per-resource score is a single number)
- Adversary emulation profiles (mimic specific threat actors: FIN7, APT29, …)
