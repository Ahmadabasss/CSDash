"""
Reshape downloaded Microsoft sample data into the dashboard's mock API format.

The raw files from the Azure-Sentinel repo are log events (rows that would
land in Log Analytics tables like SigninLogs, DeviceProcessEvents). Our
dashboard expects shapes matching Microsoft Graph Security API and Defender
for Cloud REST API responses.

This script reads from ../downloaded/ and writes additional endpoint payloads
to ../generated/. Run AFTER download_microsoft_data.py.

Output files (added to whatever the generator script produces):
  endpoint_activity.json     — DeviceProcessEvents → an endpoint activity feed
  cloud_app_activity.json    — CloudAppEvents → SaaS activity panel
  real_signins.json          — SigninLogs CSV → enriched sign-in entries
  network_events.json        — DeviceNetworkEvents → network connection feed
"""

from __future__ import annotations
import csv
import json
from pathlib import Path

IN_DIR = Path(__file__).parent.parent / "downloaded"
OUT_DIR = Path(__file__).parent.parent / "generated"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def load_json_array(path: Path) -> list[dict]:
    """Load a JSON file that's either a top-level array or has a 'value' key."""
    if not path.exists():
        return []
    raw = json.loads(path.read_text())
    if isinstance(raw, list):
        return raw
    return raw.get("value", [])


def load_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def reshape_device_process_events():
    events = load_json_array(IN_DIR / "device_process_events.json")
    if not events:
        return
    # Match the dashboard's "endpoint activity" panel: surface processes that
    # look interesting (powershell, cmd, scripting, base64, encoded commands).
    keywords = ("powershell", "pwsh.exe", "cmd.exe", "wscript", "cscript",
                "frombase64", "downloadstring", "iex ", "invoke-expression",
                "encodedcommand", "-enc ")
    reshaped = []
    for ev in events:
        cmdline = (ev.get("ProcessCommandLine") or ev.get("InitiatingProcessCommandLine") or "").lower()
        suspicious = any(k in cmdline for k in keywords)
        reshaped.append({
            "timestamp": ev.get("TimeGenerated") or ev.get("Timestamp"),
            "deviceName": ev.get("DeviceName"),
            "account": ev.get("AccountName") or ev.get("InitiatingProcessAccountName"),
            "processName": ev.get("FileName") or ev.get("InitiatingProcessFileName"),
            "commandLine": ev.get("ProcessCommandLine") or ev.get("InitiatingProcessCommandLine"),
            "parentProcess": ev.get("InitiatingProcessParentFileName"),
            "fileHash": ev.get("SHA256") or ev.get("InitiatingProcessSHA256"),
            "suspicious": suspicious,
        })
    out = {"@odata.context": "synthetic-from-DeviceProcessEvents", "value": reshaped}
    (OUT_DIR / "endpoint_activity.json").write_text(json.dumps(out, indent=2))
    print(f"  ✓ endpoint_activity.json — {len(reshaped)} events")


def reshape_device_network_events():
    events = load_json_array(IN_DIR / "device_network_events.json")
    if not events:
        return
    reshaped = []
    for ev in events:
        reshaped.append({
            "timestamp": ev.get("TimeGenerated") or ev.get("Timestamp"),
            "deviceName": ev.get("DeviceName"),
            "remoteIP": ev.get("RemoteIP"),
            "remotePort": ev.get("RemotePort"),
            "remoteUrl": ev.get("RemoteUrl"),
            "protocol": ev.get("Protocol"),
            "initiatingProcess": ev.get("InitiatingProcessFileName"),
            "action": ev.get("ActionType"),
        })
    out = {"@odata.context": "synthetic-from-DeviceNetworkEvents", "value": reshaped}
    (OUT_DIR / "network_events.json").write_text(json.dumps(out, indent=2))
    print(f"  ✓ network_events.json — {len(reshaped)} events")


def reshape_cloud_app_events():
    events = load_json_array(IN_DIR / "cloud_app_events.json")
    if not events:
        return
    reshaped = []
    for ev in events:
        reshaped.append({
            "timestamp": ev.get("TimeGenerated") or ev.get("Timestamp"),
            "user": ev.get("AccountUpn") or ev.get("AccountObjectId"),
            "app": ev.get("Application") or ev.get("ApplicationId"),
            "actionType": ev.get("ActionType"),
            "ip": ev.get("IPAddress"),
            "city": ev.get("City"),
            "country": ev.get("CountryCode"),
            "isAnonymousProxy": ev.get("IsAnonymousProxy"),
            "isp": ev.get("ISP"),
            "userAgent": ev.get("UserAgent"),
        })
    out = {"@odata.context": "synthetic-from-CloudAppEvents", "value": reshaped}
    (OUT_DIR / "cloud_app_activity.json").write_text(json.dumps(out, indent=2))
    print(f"  ✓ cloud_app_activity.json — {len(reshaped)} events")


def reshape_signin_logs_csv():
    """Sentinel Training Lab signin logs are CSV — reshape into Graph API shape."""
    rows = load_csv(IN_DIR / "signin_logs.csv")
    if not rows:
        return
    reshaped = []
    for r in rows:
        # Training Lab CSV has columns like TimeGenerated, UserPrincipalName, IPAddress,
        # AppDisplayName, ResultType, RiskLevelAggregated, RiskState, Location, etc.
        loc = {}
        for col in ("LocationDetails", "Location"):
            if r.get(col):
                try:
                    loc = json.loads(r[col]) if r[col].startswith("{") else {"countryOrRegion": r[col]}
                    break
                except Exception:
                    pass
        reshaped.append({
            "id": r.get("Id") or r.get("CorrelationId"),
            "createdDateTime": r.get("TimeGenerated"),
            "userDisplayName": r.get("UserDisplayName"),
            "userPrincipalName": r.get("UserPrincipalName"),
            "ipAddress": r.get("IPAddress"),
            "clientAppUsed": r.get("ClientAppUsed"),
            "appDisplayName": r.get("AppDisplayName"),
            "status": {
                "errorCode": int(r.get("ResultType") or 0),
                "failureReason": r.get("ResultDescription") or "",
            },
            "location": {
                "city": loc.get("city") if isinstance(loc, dict) else None,
                "state": loc.get("state") if isinstance(loc, dict) else None,
                "countryOrRegion": loc.get("countryOrRegion") if isinstance(loc, dict) else None,
            },
            "riskLevelAggregated": (r.get("RiskLevelAggregated") or "none").lower(),
            "riskState": (r.get("RiskState") or "none").lower(),
        })
    out = {"@odata.context": "real-from-SigninLogs-CSV", "value": reshaped}
    (OUT_DIR / "real_signins.json").write_text(json.dumps(out, indent=2))
    print(f"  ✓ real_signins.json — {len(reshaped)} sign-ins")


def main():
    if not IN_DIR.exists():
        print(f"No downloaded data found at {IN_DIR}.")
        print("Run download_microsoft_data.py first.")
        return

    print(f"Reshaping data from {IN_DIR} → {OUT_DIR}\n")
    reshape_device_process_events()
    reshape_device_network_events()
    reshape_cloud_app_events()
    reshape_signin_logs_csv()
    print("\nDone. These files complement the synthetic generator output.")
    print("Copy them (along with generator output) into backend/mock_data/.")


if __name__ == "__main__":
    main()
