"""
Fetches real security sample data from Microsoft's Azure-Sentinel public repo.

Run locally:  python download_microsoft_data.py
Outputs to:   ../downloaded/

These are real (sanitized) sample log files Microsoft publishes for Sentinel
training. They match the schemas of Defender for Endpoint, Defender for Cloud
Apps, Entra ID Sign-in Logs, and several third-party connectors.

For our security dashboard project, the most useful ones are flagged with
USE_FOR_DASHBOARD=True — these get reshaped into our API response format by
the companion script `reshape_microsoft_data.py`.
"""

from __future__ import annotations
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from dataclasses import dataclass

GITHUB_RAW = "https://raw.githubusercontent.com/Azure/Azure-Sentinel/master"
OUT_DIR = Path(__file__).parent.parent / "downloaded"
OUT_DIR.mkdir(parents=True, exist_ok=True)

@dataclass
class SampleFile:
    repo_path: str         # path inside the Azure-Sentinel repo (no leading slash)
    local_name: str        # filename to save as
    description: str       # what this contains
    use_for_dashboard: bool # whether reshape_microsoft_data.py will use it
    table_name: str = ""   # the Log Analytics table this maps to


# Curated list of useful sample data files from the Azure-Sentinel repo.
# Paths verified against the master branch tree. Files marked as
# use_for_dashboard=True feed into the dashboard's mock_data/.
FILES: list[SampleFile] = [
    # Microsoft Defender for Endpoint
    SampleFile(
        repo_path="Sample%20Data/Custom/DeviceProcessEvents.json",
        local_name="device_process_events.json",
        description="MDE process creation events — useful for an Endpoint Activity panel",
        use_for_dashboard=True,
        table_name="DeviceProcessEvents",
    ),
    SampleFile(
        repo_path="Sample%20Data/Custom/DeviceNetworkEvents.json",
        local_name="device_network_events.json",
        description="MDE network connection events",
        use_for_dashboard=True,
        table_name="DeviceNetworkEvents",
    ),
    SampleFile(
        repo_path="Sample%20Data/Custom/DeviceLogonEvents.json",
        local_name="device_logon_events.json",
        description="MDE logon attempts (successful and failed)",
        use_for_dashboard=True,
        table_name="DeviceLogonEvents",
    ),
    SampleFile(
        repo_path="Sample%20Data/Custom/DeviceFileEvents.json",
        local_name="device_file_events.json",
        description="MDE file system events",
        use_for_dashboard=False,
        table_name="DeviceFileEvents",
    ),

    # Microsoft Defender for Cloud Apps
    SampleFile(
        repo_path="Sample%20Data/Custom/CloudAppEvents.json",
        local_name="cloud_app_events.json",
        description="MDCA activity events — useful for SaaS activity",
        use_for_dashboard=True,
        table_name="CloudAppEvents",
    ),

    # Office 365
    SampleFile(
        repo_path="Sample%20Data/Custom/OfficeActivity.json",
        local_name="office_activity.json",
        description="O365 audit events — file downloads, mailbox operations",
        use_for_dashboard=True,
        table_name="OfficeActivity",
    ),

    # Box (file sharing) — example of third-party SaaS activity
    SampleFile(
        repo_path="Sample%20Data/Custom/BoxEvents_CL.json",
        local_name="box_events.json",
        description="Box file events (DOWNLOAD/EDIT/COPY) — sanitized real data",
        use_for_dashboard=False,
        table_name="BoxEvents_CL",
    ),

    # Sentinel Training Lab telemetry — multi-day attack scenario
    SampleFile(
        repo_path="Solutions/Training/Azure-Sentinel-Training-Lab/Data/SecurityEvent.csv",
        local_name="security_event.csv",
        description="Windows Security Events from a simulated attack — 4624/4625/4688 etc.",
        use_for_dashboard=True,
        table_name="SecurityEvent",
    ),
    SampleFile(
        repo_path="Solutions/Training/Azure-Sentinel-Training-Lab/Data/SigninLogs.csv",
        local_name="signin_logs.csv",
        description="Entra ID sign-in logs from training lab — risky sign-ins, MFA, locations",
        use_for_dashboard=True,
        table_name="SigninLogs",
    ),
    SampleFile(
        repo_path="Solutions/Training/Azure-Sentinel-Training-Lab/Data/OfficeActivity.csv",
        local_name="office_activity_lab.csv",
        description="O365 audit events from training lab — including suspicious inbox rules",
        use_for_dashboard=True,
        table_name="OfficeActivity",
    ),
    SampleFile(
        repo_path="Solutions/Training/Azure-Sentinel-Training-Lab/Data/AzureActivity.csv",
        local_name="azure_activity.csv",
        description="Azure control plane activity — resource creation/deletion",
        use_for_dashboard=True,
        table_name="AzureActivity",
    ),
    SampleFile(
        repo_path="Solutions/Training/Azure-Sentinel-Training-Lab/Data/Cisco_Umbrella_dns_CL.csv",
        local_name="cisco_umbrella_dns.csv",
        description="DNS queries from Cisco Umbrella — useful for C2 detection panel",
        use_for_dashboard=False,
        table_name="Cisco_Umbrella_dns_CL",
    ),
]


def fetch(url: str, timeout: int = 30) -> bytes | None:
    """Download a URL, with a real UA and retries."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (sec-dashboard-data-fetcher)",
            "Accept": "*/*",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # don't retry 404s
            print(f"  attempt {attempt + 1} failed: HTTP {e.code}", file=sys.stderr)
        except Exception as e:
            print(f"  attempt {attempt + 1} failed: {e}", file=sys.stderr)
        time.sleep(2)
    return None


def main():
    print(f"Downloading Microsoft sample data → {OUT_DIR}")
    print(f"Total files to fetch: {len(FILES)}\n")

    ok, missing, failed = 0, 0, 0
    catalog = []

    for f in FILES:
        url = f"{GITHUB_RAW}/{f.repo_path}"
        out_path = OUT_DIR / f.local_name
        print(f"[{f.local_name}]")
        print(f"  ← {url}")

        data = fetch(url)
        if data is None:
            print(f"  ✗ not found (404 or all retries failed)\n")
            failed += 1
            continue

        out_path.write_bytes(data)
        size_kb = len(data) / 1024
        print(f"  ✓ {size_kb:.1f} KB → {out_path.name}\n")
        ok += 1

        catalog.append({
            "file": f.local_name,
            "size_bytes": len(data),
            "description": f.description,
            "table": f.table_name,
            "use_for_dashboard": f.use_for_dashboard,
            "source_url": url,
        })

    # Write a manifest so the reshape script knows what to process
    manifest = {
        "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_repo": "https://github.com/Azure/Azure-Sentinel",
        "files": catalog,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"Done. {ok} succeeded, {failed} failed.")
    print(f"Manifest: {OUT_DIR / 'manifest.json'}")
    if failed:
        print("\nNote: Microsoft occasionally reorganizes the repo. If files moved,")
        print("update FILES[] at the top of this script with new repo_paths.")
        print("Browse the repo at: https://github.com/Azure/Azure-Sentinel/tree/master/Sample%20Data")


if __name__ == "__main__":
    main()
