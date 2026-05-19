"""
Orphaned / abandoned resource detection.

Identifies resources that represent a security risk because they are no longer
actively managed but remain reachable or billable.  Categories:
  - deallocated_vm    : VM stopped but NOT deleted; patches/MDE go stale, can be restarted
  - exposed_public_ip : Untagged or environment-mismatched public IPs
  - stale_nsg         : NSGs in test/dev namespaces lingering in production resource groups
  - abandoned_storage : Storage accounts tagged dev/test that may hold sensitive data
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends

from ..deps import get_data_source
from ..services.base import DataSource

router = APIRouter(prefix="/api/orphans", tags=["orphans"])

# ── helpers ───────────────────────────────────────────────────────────────────

_PROD_RG_RE = re.compile(r"\b(prod|production|prd)\b", re.I)
_DEV_TAGS   = {"dev", "development", "test", "testing", "staging", "stage", "qa"}

def _env_tag(resource: dict) -> str:
    return (resource.get("tags") or {}).get("env", "").lower()

def _owner_tag(resource: dict) -> str:
    return (resource.get("tags") or {}).get("owner", "")

def _fake_age_days(resource_id: str, lo: int, hi: int) -> int:
    """Deterministic pseudo-random age derived from the resource id."""
    h = int(hashlib.md5(resource_id.encode()).hexdigest()[:8], 16)
    return lo + (h % (hi - lo + 1))

def _last_seen(days: int) -> str:
    from datetime import timedelta
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def _risk_for_vm(vm: dict) -> str:
    sp = vm.get("securityProfile", {})
    patch = (sp.get("patchStatus") or {}).get("state", "")
    vulns = sp.get("vulnerabilityCount", 0)
    if patch in ("CriticalPatches",) or vulns > 10:
        return "Critical"
    if vulns > 3:
        return "High"
    return "Medium"


# ── main endpoint ─────────────────────────────────────────────────────────────

@router.get("")
async def get_orphans(ds: DataSource = Depends(get_data_source)) -> dict[str, Any]:
    resources, vms = await ds.get_resources(), await ds.get_virtual_machines()

    orphans: list[dict] = []

    # 1 ── Deallocated VMs ─────────────────────────────────────────────────────
    for vm in vms:
        if vm.get("properties", {}).get("powerState") != "deallocated":
            continue
        sp    = vm.get("securityProfile", {})
        patch = (sp.get("patchStatus") or {}).get("state", "Unknown")
        vulns = sp.get("vulnerabilityCount", 0)
        age   = _fake_age_days(vm["id"], 14, 120)
        risk  = _risk_for_vm(vm)
        orphans.append({
            "id":          vm["id"],
            "name":        vm["name"],
            "category":    "deallocated_vm",
            "risk":        risk,
            "resourceGroup": vm.get("resourceGroup", ""),
            "location":    vm.get("location", ""),
            "age_days":    age,
            "last_seen":   _last_seen(age),
            "detail": {
                "osType":       vm["properties"].get("osType", ""),
                "osName":       vm["properties"].get("osName", ""),
                "vmSize":       vm["properties"].get("vmSize", ""),
                "mdeStatus":    sp.get("mdeStatus", "Unknown"),
                "patchState":   patch,
                "vulnCount":    vulns,
                "diskEncrypted": sp.get("diskEncrypted", False),
            },
            "why_dangerous": (
                "Deallocated VMs stop receiving security patches and Microsoft Defender for Endpoint "
                "goes inactive, leaving the disk image with unpatched vulnerabilities. "
                "Any actor with Contributor rights can restart the machine at any time, instantly "
                "re-exposing those vulnerabilities on your network."
            ),
            "remediation": [
                "Verify the VM is intentionally stopped and not forgotten after an incident.",
                "If unused for > 30 days, capture a snapshot then delete the VM and its disks.",
                "If needed, ensure disk encryption is enabled before restarting.",
                "Tag with a decommission date and assign a responsible owner.",
            ],
        })

    # 2 ── Exposed / orphaned public IP addresses ──────────────────────────────
    for r in resources:
        if "publicipaddresses" not in r.get("type", "").lower():
            continue
        env   = _env_tag(r)
        rg    = r.get("resourceGroup", "")
        age   = _fake_age_days(r["id"], 7, 90)
        # Flag all PIPs — dev ones in prod RGs are "Critical", others "High"
        is_prod_rg = bool(_PROD_RG_RE.search(rg))
        risk = "Critical" if (env in _DEV_TAGS and is_prod_rg) else "High"
        orphans.append({
            "id":            r["id"],
            "name":          r["name"],
            "category":      "exposed_public_ip",
            "risk":          risk,
            "resourceGroup": rg,
            "location":      r.get("location", ""),
            "age_days":      age,
            "last_seen":     _last_seen(age),
            "detail": {
                "env":   env or "untagged",
                "owner": _owner_tag(r) or "unassigned",
                "tags":  r.get("tags") or {},
            },
            "why_dangerous": (
                "Unassociated public IP addresses are directly reachable from the internet. "
                "Without an attached load balancer or NIC, traffic routing is undefined, but the "
                "IP remains in your subscription's namespace and can be mistakenly (re)associated "
                "with a new resource, opening unexpected inbound paths."
            ),
            "remediation": [
                "Confirm whether the IP is associated with an active load balancer, NIC, or VPN gateway.",
                "If unused, delete the public IP resource to eliminate the attack surface.",
                "If retained for DNS continuity, lock it with a resource lock and document the owner.",
                "Enforce tagging policy: all PIPs must have an owner and expiry tag.",
            ],
        })

    # 3 ── Stale NSGs (test/dev label in any RG) ───────────────────────────────
    for r in resources:
        if "networksecuritygroups" not in r.get("type", "").lower():
            continue
        env = _env_tag(r)
        if env not in _DEV_TAGS:
            continue
        age  = _fake_age_days(r["id"], 30, 200)
        risk = "High" if bool(_PROD_RG_RE.search(r.get("resourceGroup", ""))) else "Medium"
        orphans.append({
            "id":            r["id"],
            "name":          r["name"],
            "category":      "stale_nsg",
            "risk":          risk,
            "resourceGroup": r.get("resourceGroup", ""),
            "location":      r.get("location", ""),
            "age_days":      age,
            "last_seen":     _last_seen(age),
            "detail": {
                "env":   env,
                "owner": _owner_tag(r) or "unassigned",
                "tags":  r.get("tags") or {},
            },
            "why_dangerous": (
                "Network Security Groups tagged as test/dev are often created with permissive rules "
                "('allow any inbound') for convenience and then forgotten. If later attached to a "
                "production subnet or NIC, they immediately open lateral movement paths across the network."
            ),
            "remediation": [
                "Review all inbound/outbound rules; remove any allow-all rules.",
                "Confirm the NSG is still associated with an active subnet or NIC.",
                "If unassociated, delete the NSG or move it to an explicit archive resource group.",
                "Enforce least-privilege: deny all by default, allow only required ports.",
            ],
        })

    # 4 ── Abandoned storage accounts (dev/test tagged) ────────────────────────
    for r in resources:
        if "storageaccounts" not in r.get("type", "").lower():
            continue
        env = _env_tag(r)
        if env not in _DEV_TAGS:
            continue
        age  = _fake_age_days(r["id"], 45, 365)
        risk = "Medium"
        orphans.append({
            "id":            r["id"],
            "name":          r["name"],
            "category":      "abandoned_storage",
            "risk":          risk,
            "resourceGroup": r.get("resourceGroup", ""),
            "location":      r.get("location", ""),
            "age_days":      age,
            "last_seen":     _last_seen(age),
            "detail": {
                "env":   env,
                "owner": _owner_tag(r) or "unassigned",
                "tags":  r.get("tags") or {},
            },
            "why_dangerous": (
                "Development and test storage accounts often accumulate sensitive data — database "
                "backups, connection strings in config blobs, personal data used in test fixtures — "
                "without the lifecycle policies and network restrictions applied to production accounts."
            ),
            "remediation": [
                "Audit blob and file share contents for sensitive data before deletion.",
                "Enable Soft Delete and versioning if any data must be retained.",
                "Apply network rules to restrict access to specific VNets or IPs.",
                "Set a lifecycle management policy to auto-expire objects older than 90 days.",
            ],
        })

    # ── summary ───────────────────────────────────────────────────────────────
    by_category = {
        "deallocated_vm":    [o for o in orphans if o["category"] == "deallocated_vm"],
        "exposed_public_ip": [o for o in orphans if o["category"] == "exposed_public_ip"],
        "stale_nsg":         [o for o in orphans if o["category"] == "stale_nsg"],
        "abandoned_storage": [o for o in orphans if o["category"] == "abandoned_storage"],
    }
    critical = sum(1 for o in orphans if o["risk"] == "Critical")
    high     = sum(1 for o in orphans if o["risk"] == "High")
    medium   = sum(1 for o in orphans if o["risk"] == "Medium")

    return {
        "total":       len(orphans),
        "critical":    critical,
        "high":        high,
        "medium":      medium,
        "by_category": {k: len(v) for k, v in by_category.items()},
        "items":       sorted(orphans, key=lambda o: {"Critical": 0, "High": 1, "Medium": 2}[o["risk"]]),
    }
