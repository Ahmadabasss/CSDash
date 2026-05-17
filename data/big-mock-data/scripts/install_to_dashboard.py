"""
Install a scenario's generated data into the dashboard's mock_data folder.

Usage:
    python install_to_dashboard.py /path/to/azure-sec-dashboard [--scenario noisy]
    python install_to_dashboard.py ../azure-sec-dashboard --scenario compromised

This copies generated/scenarios/<scenario>/*.json into <dashboard>/backend/mock_data/.
Optionally includes reshape output too if it exists.
"""

from __future__ import annotations
import argparse
import shutil
import sys
from pathlib import Path

SCENARIOS_DIR = Path(__file__).parent.parent / "generated" / "scenarios"
RESHAPED_DIR = Path(__file__).parent.parent / "generated"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dashboard_path", type=Path, help="Path to the azure-sec-dashboard repo")
    ap.add_argument("--scenario", choices=["secured", "noisy", "compromised"], default="noisy")
    ap.add_argument("--include-reshaped", action="store_true",
                    help="Also copy reshaped Microsoft data (endpoint_activity.json, etc.) if present")
    args = ap.parse_args()

    src = SCENARIOS_DIR / args.scenario
    if not src.exists():
        print(f"Error: scenario '{args.scenario}' not generated yet.", file=sys.stderr)
        print(f"Run: python scripts/generate_synthetic_data.py --scenario {args.scenario}", file=sys.stderr)
        sys.exit(1)

    dst = args.dashboard_path / "backend" / "mock_data"
    if not dst.parent.exists():
        print(f"Error: {dst.parent} does not exist. Wrong dashboard path?", file=sys.stderr)
        sys.exit(1)
    dst.mkdir(parents=True, exist_ok=True)

    print(f"Installing '{args.scenario}' scenario into {dst}\n")
    files_copied = 0
    for json_file in src.glob("*.json"):
        target = dst / json_file.name
        shutil.copy2(json_file, target)
        size_kb = target.stat().st_size / 1024
        print(f"  ✓ {json_file.name:30s} {size_kb:7.1f} KB")
        files_copied += 1

    if args.include_reshaped:
        print()
        for name in ("endpoint_activity.json", "network_events.json",
                     "cloud_app_activity.json", "real_signins.json"):
            src_file = RESHAPED_DIR / name
            if src_file.exists():
                target = dst / name
                shutil.copy2(src_file, target)
                size_kb = target.stat().st_size / 1024
                print(f"  ✓ {name:30s} {size_kb:7.1f} KB  (reshaped)")
                files_copied += 1

    print(f"\nDone. {files_copied} files installed to {dst}")
    print(f"\nNext: cd {args.dashboard_path} && start your FastAPI backend")


if __name__ == "__main__":
    main()
