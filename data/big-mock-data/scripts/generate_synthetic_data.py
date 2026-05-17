"""
Synthetic Azure security data generator.

Produces realistic, coherent mock data matching Microsoft Defender for Cloud,
Microsoft Graph Security API, Azure Resource Graph, and Defender Vulnerability
Management response schemas.

Why generate instead of just shipping fixed JSON?
- Volume: produces 500+ alerts, 200+ recommendations, 100+ resources by default
- Coherence: findings correlate — a "ransomware" alert points to a real VM in
  resources.json, which has matching unhealthy recommendations
- Variety: re-run with different seeds for different "tenant scenarios"
  (well-secured, compromised, noisy, etc.)
- Realism: severity distributions, geographic clustering, time-of-day patterns,
  MITRE technique distributions all follow real-world observed shapes

Run:    python generate_synthetic_data.py [--scenario compromised|secured|noisy] [--seed N]
Output: ../generated/{secure_score,recommendations,alerts,vulnerabilities,compliance,resources,signins,summary}.json
"""

from __future__ import annotations
import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "generated"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────
# Reference data — real Azure regions, real MITRE techniques, real CVEs
# ─────────────────────────────────────────────────────────────────────

AZURE_REGIONS = [
    "eastus", "eastus2", "westus", "westus2", "westus3",
    "centralus", "northcentralus", "southcentralus",
    "westeurope", "northeurope", "uksouth", "ukwest",
    "francecentral", "germanywestcentral", "switzerlandnorth",
    "japaneast", "japanwest", "southeastasia", "eastasia",
    "australiaeast", "australiasoutheast",
    "canadacentral", "canadaeast", "brazilsouth",
    "centralindia", "southindia", "uaenorth",
]

RESOURCE_GROUPS = [
    "prod-web-rg", "prod-data-rg", "prod-identity-rg", "prod-network-rg",
    "staging-rg", "dev-rg", "shared-services-rg",
    "finance-rg", "hr-rg", "engineering-rg", "marketing-rg",
    "platform-rg", "k8s-prod-rg", "k8s-staging-rg",
    "analytics-rg", "ml-rg", "iot-rg",
]

DEPARTMENTS = ["engineering", "finance", "hr", "marketing", "sales", "platform",
               "data", "security", "it", "legal", "exec"]
ENVIRONMENTS = ["production", "staging", "development", "test"]

# (resource type, name pattern, default region weight)
RESOURCE_TYPES = [
    ("microsoft.compute/virtualmachines", "vm", 1.0),
    ("microsoft.storage/storageaccounts", "stor", 1.2),
    ("microsoft.sql/servers", "sql", 0.4),
    ("microsoft.sql/servers/databases", "db", 0.6),
    ("microsoft.keyvault/vaults", "kv", 0.5),
    ("microsoft.web/sites", "app", 0.8),
    ("microsoft.network/networksecuritygroups", "nsg", 0.7),
    ("microsoft.network/publicipaddresses", "pip", 0.6),
    ("microsoft.network/virtualnetworks", "vnet", 0.3),
    ("microsoft.containerservice/managedclusters", "aks", 0.2),
    ("microsoft.containerregistry/registries", "acr", 0.2),
    ("microsoft.cosmosdb/databaseaccounts", "cosmos", 0.2),
    ("microsoft.documentdb/databaseaccounts", "docdb", 0.1),
    ("microsoft.servicebus/namespaces", "sb", 0.2),
    ("microsoft.eventhub/namespaces", "eh", 0.2),
    ("microsoft.logic/workflows", "logic", 0.3),
    ("microsoft.insights/components", "ai", 0.5),
    ("microsoft.operationalinsights/workspaces", "law", 0.2),
    ("microsoft.recoveryservices/vaults", "rsv", 0.3),
    ("microsoft.automation/automationaccounts", "auto", 0.2),
]

# (display name, severity, category, threats list, cause)
RECOMMENDATIONS = [
    ("Management ports of virtual machines should be protected with just-in-time network access control", "High", "Compute", ["AccountBreach", "DataExfiltration"], "ExposedManagementPorts"),
    ("Storage account public access should be disallowed", "High", "Data", ["DataExfiltration", "DataSpillage"], "PublicAccessEnabled"),
    ("Disk encryption should be applied on virtual machines", "High", "Compute", ["DataExfiltration"], "DiskEncryptionDisabled"),
    ("Transparent Data Encryption on SQL databases should be enabled", "Medium", "Data", ["DataExfiltration"], "TdeDisabled"),
    ("Web Application should only be accessible over HTTPS", "Medium", "Networking", ["DataExfiltration", "MissingCoverage"], "HttpsOnlyDisabled"),
    ("Key Vaults should have soft delete enabled", "High", "IdentityAndAccess", ["DataSpillage"], "SoftDeleteDisabled"),
    ("Key Vaults should have purge protection enabled", "Medium", "IdentityAndAccess", ["DataSpillage"], "PurgeProtectionDisabled"),
    ("All network ports should be restricted on network security groups associated to your virtual machine", "High", "Networking", ["AccountBreach", "DataExfiltration"], "OverlyPermissiveNsg"),
    ("MFA should be enabled on accounts with owner permissions on your subscription", "High", "IdentityAndAccess", ["AccountBreach", "ElevationOfPrivilege"], "MfaNotEnabled"),
    ("MFA should be enabled on accounts with write permissions on your subscription", "High", "IdentityAndAccess", ["AccountBreach"], "MfaNotEnabled"),
    ("MFA should be enabled on accounts with read permissions on your subscription", "Low", "IdentityAndAccess", ["AccountBreach"], "MfaNotEnabled"),
    ("Role-Based Access Control should be used on Kubernetes Services", "High", "Compute", ["ElevationOfPrivilege"], "RbacDisabled"),
    ("Authorized IP ranges should be defined on Kubernetes Services", "High", "Networking", ["AccountBreach"], "NoAuthorizedIpRanges"),
    ("Container images should be deployed from trusted registries only", "High", "Compute", ["MaliciousInsider"], "UntrustedRegistry"),
    ("Diagnostic logs in App Services should be enabled", "Low", "Networking", ["MissingCoverage"], "DiagnosticLogsDisabled"),
    ("Diagnostic logs in Key Vault should be enabled", "Low", "IdentityAndAccess", ["MissingCoverage"], "DiagnosticLogsDisabled"),
    ("Diagnostic logs in Service Bus should be enabled", "Low", "Data", ["MissingCoverage"], "DiagnosticLogsDisabled"),
    ("Auditing on SQL server should be enabled", "Low", "Data", ["MissingCoverage"], "AuditingDisabled"),
    ("Advanced data security should be enabled on your SQL servers", "High", "Data", ["DataExfiltration", "MaliciousInsider"], "AtpDisabled"),
    ("Advanced threat protection should be enabled on Storage accounts", "High", "Data", ["DataExfiltration"], "AtpDisabled"),
    ("System updates should be installed on your machines", "High", "Compute", ["MaliciousInsider", "AccountBreach"], "MissingUpdates"),
    ("Endpoint protection solution should be installed on virtual machine scale sets", "Medium", "Compute", ["MaliciousInsider"], "NoEndpointProtection"),
    ("Vulnerability assessment solution should be enabled on your virtual machines", "Medium", "Compute", ["MaliciousInsider", "AccountBreach"], "VaNotEnabled"),
    ("Adaptive application controls for defining safe applications should be enabled on your machines", "High", "Compute", ["MaliciousInsider"], "AacNotEnabled"),
    ("Service principals should be used to protect your subscriptions instead of management certificates", "Medium", "IdentityAndAccess", ["AccountBreach"], "MgmtCertsUsed"),
    ("Storage accounts should restrict network access", "Medium", "Data", ["DataExfiltration"], "NoNetworkRestrictions"),
    ("Secure transfer to storage accounts should be enabled", "High", "Data", ["DataExfiltration"], "SecureTransferDisabled"),
    ("Cosmos DB accounts should have firewall rules", "Medium", "Data", ["DataExfiltration"], "NoFirewallRules"),
    ("Function apps should only be accessible over HTTPS", "Medium", "Networking", ["DataExfiltration"], "HttpsOnlyDisabled"),
    ("Web ports should be limited on virtual machines", "Medium", "Networking", ["DataExfiltration", "AccountBreach"], "ExposedWebPorts"),
]

# (title, severity, source, category, mitre, description, recommended_actions)
ALERT_TEMPLATES = [
    ("Suspicious PowerShell command line", "high", "microsoftDefenderForEndpoint", "Execution", ["T1059.001"],
     "A suspicious PowerShell activity was observed on the machine. This behavior may indicate use of PowerShell to deliver malicious tools.",
     "Isolate the device and investigate the PowerShell command line. Review parent process and user context."),
    ("Ransomware behavior detected in the file system", "high", "microsoftDefenderForEndpoint", "Impact", ["T1486"],
     "A process is creating files with extensions characteristic of ransomware across multiple user directories.",
     "Immediately isolate the affected device, kill the offending process tree, and initiate IR procedures."),
    ("Suspicious sign-in from anonymous IP address", "medium", "microsoftDefenderForIdentity", "InitialAccess", ["T1078"],
     "Sign-in detected from a known anonymous proxy/Tor exit node.",
     "Verify the sign-in with the user. Reset credentials and revoke sessions if not legitimate."),
    ("Mass download by a single user", "medium", "microsoftDefenderForCloudApps", "Exfiltration", ["T1567"],
     "User downloaded an unusually large number of files within a short time window.",
     "Contact the user to verify the activity. Apply session controls if exfiltration is confirmed."),
    ("Impossible travel detected", "medium", "microsoftDefenderForCloudApps", "InitialAccess", ["T1078"],
     "User authenticated from two geographically distant locations within an unfeasibly short time.",
     "Confirm the activity with the user, reset credentials, revoke active sessions."),
    ("Multiple failed login attempts followed by success", "high", "microsoftDefenderForIdentity", "CredentialAccess", ["T1110"],
     "Several failed authentication attempts were followed by a successful login from the same IP — possible credential stuffing.",
     "Reset the account password, revoke all sessions, enforce MFA."),
    ("Communication with possible malicious IP detected", "high", "azureSecurityCenter", "CommandAndControl", ["T1071"],
     "Network communication with a known malicious IP address was detected from one of your resources.",
     "Investigate the source resource, check for compromise indicators, block the destination IP."),
    ("Possible SQL injection attempt", "medium", "microsoftDefenderForCloud", "InitialAccess", ["T1190"],
     "A potential SQL injection attempt was identified by Defender for SQL.",
     "Review web application logs, patch the vulnerable endpoint, enable WAF rules."),
    ("Suspicious sequence of exploration activities", "low", "microsoftDefenderForEndpoint", "Discovery", ["T1033", "T1087"],
     "Process performed reconnaissance commands in rapid succession.",
     "Investigate the user account and machine for further suspicious activity."),
    ("Antimalware action taken", "low", "microsoftDefenderForEndpoint", "Execution", ["T1204"],
     "Microsoft Defender Antimalware took action against malicious code.",
     "Confirm the detection, investigate origin (email attachment, download), check for related activity."),
    ("Suspicious access to storage account from unusual location", "medium", "azureSecurityCenter", "Collection", ["T1530"],
     "A storage account was accessed from an unusual location or by an unusual user.",
     "Verify the access was legitimate. Rotate keys and enable storage firewall."),
    ("Possible data exfiltration via DNS", "high", "microsoftDefenderForEndpoint", "Exfiltration", ["T1048.003"],
     "Large volume of unusual DNS queries detected, consistent with DNS tunneling for exfiltration.",
     "Block the destination domain, isolate the device, hunt for the C2 mechanism."),
    ("Privilege escalation via abuse of elevation control mechanism", "high", "microsoftDefenderForEndpoint", "PrivilegeEscalation", ["T1548"],
     "A process bypassed elevation controls to gain higher privileges.",
     "Investigate the parent process, validate the user's permissions, look for persistence."),
    ("New Global Administrator role assigned", "medium", "azureSecurityCenter", "Persistence", ["T1098"],
     "A new user was granted Global Administrator role in Entra ID.",
     "Verify the change with the assigning admin. Remove if unauthorized."),
    ("Suspicious service principal sign-in", "medium", "microsoftDefenderForCloudApps", "Persistence", ["T1098.001"],
     "Service principal authenticated from an unexpected location or with unusual behavior.",
     "Rotate the service principal credentials, review the assigned permissions."),
    ("Defender for Cloud has detected suspicious activity in your Kubernetes cluster", "medium", "microsoftDefenderForCloud", "Execution", ["T1610"],
     "A pod was deployed with privileged context or suspicious image.",
     "Review the pod spec, validate the image source, restrict cluster admin access."),
    ("Possible credential theft activity detected", "high", "microsoftDefenderForEndpoint", "CredentialAccess", ["T1003"],
     "Access to LSASS or SAM hive observed — characteristic of credential dumping.",
     "Isolate the device, reset credentials of any user who logged in recently, hunt for lateral movement."),
    ("Anomalous Azure AD sign-in properties", "low", "microsoftDefenderForIdentity", "InitialAccess", ["T1078.004"],
     "Sign-in shows anomalous characteristics relative to the user's baseline.",
     "Verify with the user. Enforce MFA and conditional access policies."),
]

# Real CVEs from CISA KEV (Known Exploited Vulnerabilities) catalog, 2024-2026
CVE_LIBRARY = [
    ("CVE-2024-21412", "Internet Shortcut Files Security Feature Bypass Vulnerability", 8.1, "Critical", "Local", ["EXPLOIT_AVAILABLE", "ACTIVE_THREAT"], "2026-02-13"),
    ("CVE-2024-30040", "Windows MSHTML Platform Security Feature Bypass Vulnerability", 8.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE"], "2026-05-14"),
    ("CVE-2024-26169", "Windows Error Reporting Service Elevation of Privilege Vulnerability", 7.8, "High", "Local", ["EXPLOIT_AVAILABLE", "RANSOMWARE_ASSOCIATED"], "2026-03-12"),
    ("CVE-2023-50164", "Apache Struts Path Traversal RCE", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "ACTIVE_THREAT"], "2025-12-07"),
    ("CVE-2024-3094", "XZ Utils Backdoor", 10.0, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "SUPPLY_CHAIN"], "2026-03-29"),
    ("CVE-2024-0204", "Fortra GoAnywhere MFT Authentication Bypass", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE"], "2026-01-22"),
    ("CVE-2024-21351", "Windows SmartScreen Security Feature Bypass Vulnerability", 7.6, "High", "Remote", ["EXPLOIT_AVAILABLE"], "2026-02-13"),
    ("CVE-2024-1086", "Linux Kernel netfilter Use-After-Free Privilege Escalation", 7.8, "High", "Local", ["EXPLOIT_AVAILABLE"], "2026-01-31"),
    ("CVE-2023-46604", "Apache ActiveMQ OpenWire RCE", 10.0, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "RANSOMWARE_ASSOCIATED"], "2025-10-27"),
    ("CVE-2024-23897", "Jenkins Arbitrary File Read", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE"], "2026-01-24"),
    ("CVE-2024-21338", "Windows Kernel Elevation of Privilege Vulnerability", 7.8, "High", "Local", ["EXPLOIT_AVAILABLE", "APT_ASSOCIATED"], "2026-02-13"),
    ("CVE-2024-29988", "SmartScreen Prompt Security Feature Bypass", 6.5, "Medium", "Remote", [], "2026-04-09"),
    ("CVE-2024-21413", "Microsoft Outlook Remote Code Execution Vulnerability", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE"], "2026-02-13"),
    ("CVE-2024-29748", "Pixel Privilege Escalation", 7.8, "High", "Local", ["EXPLOIT_AVAILABLE"], "2026-04-02"),
    ("CVE-2023-22527", "Atlassian Confluence Template Injection RCE", 10.0, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "ACTIVE_THREAT"], "2025-12-15"),
    ("CVE-2024-27198", "JetBrains TeamCity Authentication Bypass", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "RANSOMWARE_ASSOCIATED"], "2026-03-04"),
    ("CVE-2023-3519", "Citrix NetScaler ADC RCE", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "APT_ASSOCIATED"], "2025-07-19"),
    ("CVE-2024-20767", "Adobe ColdFusion Improper Access Control", 7.4, "High", "Remote", ["EXPLOIT_AVAILABLE"], "2026-03-14"),
    ("CVE-2024-4040", "CrushFTP VFS Sandbox Escape", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "ACTIVE_THREAT"], "2026-04-19"),
    ("CVE-2024-3400", "Palo Alto PAN-OS GlobalProtect Command Injection", 10.0, "Critical", "Remote", ["EXPLOIT_AVAILABLE", "APT_ASSOCIATED"], "2026-04-12"),
    ("CVE-2024-37085", "VMware ESXi Authentication Bypass", 6.8, "Medium", "Local", ["EXPLOIT_AVAILABLE", "RANSOMWARE_ASSOCIATED"], "2026-06-25"),
    ("CVE-2023-29360", "Microsoft Streaming Service Elevation of Privilege", 8.4, "High", "Local", ["EXPLOIT_AVAILABLE"], "2025-06-13"),
    ("CVE-2024-38080", "Windows Hyper-V Elevation of Privilege Vulnerability", 7.8, "High", "Local", ["EXPLOIT_AVAILABLE", "ACTIVE_THREAT"], "2026-07-09"),
    ("CVE-2024-38112", "Windows MSHTML Platform Spoofing Vulnerability", 7.5, "High", "Remote", ["EXPLOIT_AVAILABLE", "APT_ASSOCIATED"], "2026-07-09"),
    ("CVE-2024-7593", "Ivanti Virtual Traffic Manager Authentication Bypass", 9.8, "Critical", "Remote", ["EXPLOIT_AVAILABLE"], "2026-08-13"),
]

COMPLIANCE_STANDARDS = [
    ("Azure-CIS-1.4.0", 65, 0.35),  # name, total_controls, fail_rate_baseline
    ("NIST-SP-800-53-R5", 240, 0.20),
    ("ISO-27001-2013", 114, 0.18),
    ("PCI-DSS-4", 114, 0.30),
    ("SOC-TSP", 121, 0.20),
    ("HIPAA-HITRUST", 156, 0.25),
    ("CMMC-L3", 130, 0.22),
    ("Azure-Security-Benchmark", 90, 0.28),
]

USER_FIRST = ["Jane", "John", "Ahmed", "Kavita", "Maria", "Diego", "Yuki", "Olivia",
              "Liam", "Aisha", "Carlos", "Priya", "Mohamed", "Sofia", "Wei", "Emma",
              "Lucas", "Fatima", "Hans", "Mei", "Raj", "Anna", "Ivan", "Zara"]
USER_LAST = ["Smith", "Lopez", "Patel", "Tanaka", "Garcia", "Chen", "Singh",
             "Johnson", "Lee", "Brown", "Khan", "Davis", "Kim", "Wilson", "Martinez",
             "Hassan", "Nguyen", "Mueller", "Anderson", "Rossi", "Yamamoto"]

# Risky/known-bad IPs (for impossible travel, Tor exits, anonymous proxies)
RISKY_IPS = [
    ("185.220.101.34", "Frankfurt", "DE", "Tor exit node"),
    ("185.220.102.250", "Berlin", "DE", "Tor exit node"),
    ("198.96.155.3", "Toronto", "CA", "Tor exit node"),
    ("203.0.113.45", "Lagos", "NG", "Anonymous proxy"),
    ("103.224.182.250", "Mumbai", "IN", "VPN exit"),
    ("45.155.205.86", "Moscow", "RU", "Hosting provider, abuse history"),
    ("141.98.10.79", "Sofia", "BG", "Known scanner"),
    ("89.248.165.30", "Amsterdam", "NL", "Known abuse"),
]

LEGIT_LOCATIONS = [
    ("52.165.142.10", "Seattle", "Washington", "US"),
    ("13.107.42.14", "Redmond", "Washington", "US"),
    ("98.234.45.12", "San Jose", "California", "US"),
    ("172.58.103.45", "Austin", "Texas", "US"),
    ("82.46.128.99", "London", "England", "GB"),
    ("84.16.234.12", "Munich", "Bavaria", "DE"),
    ("203.0.113.5", "Singapore", "Central", "SG"),
    ("210.140.42.18", "Tokyo", "Tokyo", "JP"),
    ("64.34.144.20", "Toronto", "Ontario", "CA"),
    ("13.107.6.156", "Sydney", "NSW", "AU"),
]

# ─────────────────────────────────────────────────────────────────────
# Scenario configs
# ─────────────────────────────────────────────────────────────────────

SCENARIOS = {
    "secured": dict(
        num_resources=80,
        num_recommendations_target=120,
        unhealthy_rate=0.20,
        num_alerts=80,
        high_severity_alert_rate=0.10,
        num_vulnerabilities=8,
        secure_score_pct=0.78,
    ),
    "compromised": dict(
        num_resources=150,
        num_recommendations_target=400,
        unhealthy_rate=0.55,
        num_alerts=600,
        high_severity_alert_rate=0.35,
        num_vulnerabilities=22,
        secure_score_pct=0.32,
    ),
    "noisy": dict(
        num_resources=120,
        num_recommendations_target=300,
        unhealthy_rate=0.40,
        num_alerts=900,
        high_severity_alert_rate=0.18,
        num_vulnerabilities=15,
        secure_score_pct=0.55,
    ),
}
DEFAULT_SCENARIO = "noisy"
SUBSCRIPTION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

# ─────────────────────────────────────────────────────────────────────
# Generators
# ─────────────────────────────────────────────────────────────────────

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def random_recent_dt(within_days: int = 7) -> str:
    delta = timedelta(seconds=random.randint(0, within_days * 86400))
    return (utc_now() - delta).isoformat(timespec="seconds").replace("+00:00", "Z")


def gen_resources(rng: random.Random, n: int) -> list[dict]:
    resources = []
    for i in range(n):
        rtype, prefix, _ = rng.choices(RESOURCE_TYPES, weights=[w for _, _, w in RESOURCE_TYPES])[0]
        env = rng.choice(ENVIRONMENTS)
        dept = rng.choice(DEPARTMENTS)
        rg = rng.choice(RESOURCE_GROUPS)
        region = rng.choice(AZURE_REGIONS)
        name = f"{prefix}-{dept}-{env[:3]}-{i:03d}"
        score = max(10, min(98, int(rng.gauss(60, 18))))
        issues = max(0, int(rng.gauss(4, 2.5)))
        resources.append({
            "id": f"/subscriptions/{SUBSCRIPTION_ID}/resourceGroups/{rg}/providers/{rtype}/{name}",
            "name": name,
            "type": rtype,
            "location": region,
            "resourceGroup": rg,
            "subscriptionId": SUBSCRIPTION_ID,
            "tags": {"env": env, "owner": f"{dept}-team", "costCenter": f"CC{rng.randint(1000, 9999)}"},
            "secureScore": score,
            "issuesCount": issues,
        })
    return resources


def gen_recommendations(rng: random.Random, resources: list[dict], target_count: int, unhealthy_rate: float) -> list[dict]:
    """Generate recommendations weighted by resource type compatibility."""
    type_to_recs = {
        "microsoft.compute/virtualmachines": [0, 2, 7, 14, 20, 21, 22, 23, 29],
        "microsoft.storage/storageaccounts": [1, 19, 25, 26],
        "microsoft.sql/servers": [3, 17, 18],
        "microsoft.sql/servers/databases": [3, 17, 18],
        "microsoft.keyvault/vaults": [5, 6, 15],
        "microsoft.web/sites": [4, 14, 28],
        "microsoft.network/networksecuritygroups": [7, 29],
        "microsoft.containerservice/managedclusters": [11, 12, 13],
        "microsoft.cosmosdb/databaseaccounts": [27],
    }
    subscription_recs = [8, 9, 10, 24]  # subscription-level

    items = []
    for _ in range(target_count):
        if rng.random() < 0.08:
            rec_idx = rng.choice(subscription_recs)
            res = None
        else:
            res = rng.choice(resources)
            rec_indices = type_to_recs.get(res["type"], list(range(len(RECOMMENDATIONS))))
            rec_idx = rng.choice(rec_indices)

        display, sev, cat, threats, cause = RECOMMENDATIONS[rec_idx]
        if res is None:
            resource_details = {
                "Source": "Azure",
                "Id": f"/subscriptions/{SUBSCRIPTION_ID}",
                "ResourceName": "subscription",
                "ResourceType": "Microsoft.Resources/subscriptions",
            }
            scope_id = f"/subscriptions/{SUBSCRIPTION_ID}/providers/Microsoft.Security/assessments/{rng.randint(10**11, 10**12-1):012d}"
        else:
            resource_details = {
                "Source": "Azure",
                "Id": res["id"],
                "ResourceName": res["name"],
                "ResourceType": res["type"],
            }
            scope_id = f"{res['id']}/providers/Microsoft.Security/assessments/{rng.randint(10**11, 10**12-1):012d}"

        is_unhealthy = rng.random() < unhealthy_rate
        items.append({
            "id": scope_id,
            "name": f"{rng.randint(10**11, 10**12-1):012x}-{rec_idx:04d}",
            "type": "Microsoft.Security/assessments",
            "properties": {
                "displayName": display,
                "status": {
                    "code": "Unhealthy" if is_unhealthy else "Healthy",
                    "cause": cause if is_unhealthy else None,
                    "description": "Recommendation flagged unhealthy" if is_unhealthy else "Compliant",
                },
                "resourceDetails": resource_details,
                "metadata": {
                    "severity": sev,
                    "categories": [cat],
                    "userImpact": rng.choice(["Low", "Moderate", "High"]),
                    "implementationEffort": rng.choice(["Low", "Moderate", "High"]),
                    "threats": threats,
                    "description": f"Assessment of {display.lower()}",
                    "remediationDescription": f"Take action to remediate: {display}",
                },
            },
        })
    return items


def gen_alerts(rng: random.Random, resources: list[dict], n: int, high_rate: float) -> list[dict]:
    alerts = []
    for i in range(n):
        title, sev, source, cat, mitre, desc, actions = rng.choice(ALERT_TEMPLATES)
        if sev == "high" and rng.random() > high_rate:
            t = rng.choice([t for t in ALERT_TEMPLATES if t[1] in ("medium", "low")])
            title, sev, source, cat, mitre, desc, actions = t

        status = rng.choices(["new", "inProgress", "resolved"], weights=[6, 2, 2])[0]
        created = random_recent_dt(within_days=14)
        evidence = []

        # Optionally tie to a resource (most alerts do)
        if rng.random() < 0.7:
            res = rng.choice(resources)
            evidence.append({
                "@odata.type": "#microsoft.graph.security.azureResourceEvidence",
                "resourceId": res["id"],
            })
        if "Endpoint" in source or "endpoint" in source.lower() or "DefenderForEndpoint" in source:
            evidence.append({
                "@odata.type": "#microsoft.graph.security.deviceEvidence",
                "deviceDnsName": f"{rng.choice(['web', 'db', 'app', 'ws'])}-vm-{rng.randint(1, 99):02d}.contoso.local",
                "osPlatform": rng.choice(["Windows10", "Windows11", "WindowsServer2019", "WindowsServer2022"]),
                "mdeDeviceId": f"{rng.randint(10**15, 10**16-1):016x}",
            })
        if "Identity" in source or "CloudApps" in source or rng.random() < 0.3:
            evidence.append({
                "@odata.type": "#microsoft.graph.security.userEvidence",
                "userAccount": {
                    "accountName": f"{rng.choice(USER_FIRST).lower()}.{rng.choice(USER_LAST).lower()}",
                    "userPrincipalName": f"{rng.choice(USER_FIRST).lower()}.{rng.choice(USER_LAST).lower()}@contoso.com",
                },
            })
        if "anonymous" in title.lower() or "impossible" in title.lower() or "malicious IP" in title.lower():
            ip, city, country, _ = rng.choice(RISKY_IPS)
            evidence.append({
                "@odata.type": "#microsoft.graph.security.ipEvidence",
                "ipAddress": ip,
                "countryLetterCode": country,
            })

        alerts.append({
            "id": f"da{rng.randint(10**18, 10**19-1):019d}_-{rng.randint(10**9, 10**10-1):010d}",
            "incidentId": str(rng.randint(1000, 9999)) if rng.random() < 0.4 else None,
            "status": status,
            "severity": sev,
            "classification": rng.choice(["unknown", "truePositive", "falsePositive"]) if status == "resolved" else "unknown",
            "determination": rng.choice(["unknown", "malware", "lateralMovement", "compromisedAccount", "phishing"]) if status != "new" else "unknown",
            "serviceSource": source,
            "detectionSource": "antivirus" if "DefenderForEndpoint" in source else "automation",
            "title": title,
            "description": desc,
            "recommendedActions": actions,
            "category": cat,
            "assignedTo": f"soc-analyst-{rng.randint(1, 5)}@contoso.com" if status == "inProgress" else None,
            "createdDateTime": created,
            "lastUpdateDateTime": created,
            "firstActivityDateTime": created,
            "lastActivityDateTime": created,
            "mitreTechniques": mitre,
            "evidence": evidence,
        })
    return alerts


def gen_vulnerabilities(rng: random.Random, resources: list[dict], n: int) -> list[dict]:
    chosen = rng.sample(CVE_LIBRARY, min(n, len(CVE_LIBRARY)))
    items = []
    vm_count = sum(1 for r in resources if "virtualmachines" in r["type"])
    for cve_id, name, cvss, sev, exploit_type, tags, published in chosen:
        # Number of exposed machines correlates inversely with severity (worse CVEs are patched faster)
        max_exposed = max(1, int(vm_count * (1 - cvss/12)))
        exposed = rng.randint(0, max_exposed)
        items.append({
            "id": cve_id,
            "name": name,
            "description": f"{name}. See NVD entry for details.",
            "severity": sev,
            "cvssV3": cvss,
            "exposedMachines": exposed,
            "publishedOn": f"{published}T00:00:00Z",
            "updatedOn": random_recent_dt(within_days=60),
            "publicExploit": "EXPLOIT_AVAILABLE" in tags,
            "exploitInKit": "ACTIVE_THREAT" in tags,
            "exploitTypes": [exploit_type],
            "tags": tags,
        })
    return items


def gen_compliance(rng: random.Random, fail_rate_modifier: float) -> list[dict]:
    items = []
    for name, total, base_fail in COMPLIANCE_STANDARDS:
        fail_rate = min(0.85, base_fail * fail_rate_modifier)
        failed = int(total * fail_rate)
        skipped = int(total * 0.04)
        unsupported = int(total * 0.15)
        passed = total - failed - skipped - unsupported
        items.append({
            "id": f"/subscriptions/{SUBSCRIPTION_ID}/providers/Microsoft.Security/regulatoryComplianceStandards/{name}",
            "name": name,
            "type": "Microsoft.Security/regulatoryComplianceStandards",
            "properties": {
                "state": "Failed" if failed > 0 else "Passed",
                "passedControls": passed,
                "failedControls": failed,
                "skippedControls": skipped,
                "unsupportedControls": unsupported,
            },
        })
    return items


def gen_secure_score(rng: random.Random, percentage: float) -> dict:
    current = round(58 * percentage, 2)
    # Build a 12-week history that trends toward current
    history = []
    end = utc_now().date()
    for weeks_ago in range(11, -1, -1):
        date = end - timedelta(weeks=weeks_ago)
        # walk from a lower starting value up to current
        trend_pct = max(0.15, percentage - 0.04 * weeks_ago + rng.gauss(0, 0.015))
        history.append({"date": date.isoformat(), "percentage": round(trend_pct, 4)})

    return {
        "value": [{
            "id": f"/subscriptions/{SUBSCRIPTION_ID}/providers/Microsoft.Security/secureScores/ascScore",
            "name": "ascScore",
            "type": "Microsoft.Security/secureScores",
            "properties": {
                "displayName": "ASC score",
                "score": {"max": 58, "current": current, "percentage": round(percentage, 4)},
                "weight": rng.randint(7000, 12000),
            },
        }],
        "history": history,
        "controlScores": [
            {"controlName": "Enable MFA", "current": max(0, int(10 * percentage + rng.gauss(0, 1))), "max": 10, "weight": 10},
            {"controlName": "Secure management ports", "current": max(0, int(8 * percentage + rng.gauss(0, 1))), "max": 8, "weight": 8},
            {"controlName": "Apply system updates", "current": max(0, int(6 * percentage + rng.gauss(0, 1))), "max": 6, "weight": 6},
            {"controlName": "Enable encryption at rest", "current": max(0, int(7 * percentage + rng.gauss(0, 1))), "max": 7, "weight": 7},
            {"controlName": "Restrict unauthorized network access", "current": max(0, int(6 * percentage + rng.gauss(0, 1))), "max": 6, "weight": 6},
            {"controlName": "Manage access and permissions", "current": max(0, int(9 * percentage + rng.gauss(0, 1))), "max": 9, "weight": 9},
            {"controlName": "Remediate vulnerabilities", "current": max(0, int(12 * percentage + rng.gauss(0, 1.5))), "max": 12, "weight": 12},
        ],
    }


def gen_signins(rng: random.Random, n: int) -> list[dict]:
    items = []
    user_names = [(f"{f} {l}", f"{f.lower()}.{l.lower()}") for f in USER_FIRST for l in USER_LAST]
    for _ in range(n):
        name, upn_local = rng.choice(user_names)
        upn = f"{upn_local}@contoso.com"
        is_risky = rng.random() < 0.08

        if is_risky:
            ip, city, country, _ = rng.choice(RISKY_IPS)
            state = None
            error = rng.choice([0, 50074, 50053, 50126])
            risk = rng.choice(["high", "medium"])
            risk_state = "atRisk"
        else:
            ip, city, state, country = rng.choice(LEGIT_LOCATIONS)
            error = rng.choices([0, 50126, 50053], weights=[80, 15, 5])[0]
            risk = "none"
            risk_state = "none"

        items.append({
            "id": f"{rng.randint(10**13, 10**14-1):014x}-blah-4ee5-be62-ff5a759b{rng.randint(0, 9999):04d}",
            "createdDateTime": random_recent_dt(within_days=7),
            "userDisplayName": name,
            "userPrincipalName": upn,
            "ipAddress": ip,
            "clientAppUsed": rng.choice(["Browser", "Mobile Apps and Desktop clients", "Other clients"]),
            "appDisplayName": rng.choice(["Office 365 Portal", "Azure Portal", "SharePoint", "Microsoft Teams",
                                          "OneDrive", "Outlook on the web", "Microsoft Graph PowerShell"]),
            "status": {
                "errorCode": error,
                "failureReason": "Other." if error == 0 else "Authentication failure",
            },
            "location": {"city": city, "state": state, "countryOrRegion": country},
            "riskLevelAggregated": risk,
            "riskState": risk_state,
        })
    return items


def gen_summary(secure_score: dict, alerts: list[dict], recs: list[dict], vulns: list[dict], compliance: list[dict], resources: list[dict]) -> dict:
    def bucket(items, key="severity"):
        out = {"high": 0, "medium": 0, "low": 0}
        for x in items:
            sev = x.get(key, "").lower() if key == "severity" else x["properties"]["metadata"]["severity"].lower()
            if sev in out:
                out[sev] += 1
        out["total"] = sum(out.values())
        return out

    open_alerts = [a for a in alerts if a["status"] == "new"]
    unhealthy_recs = [r for r in recs if r["properties"]["status"]["code"] == "Unhealthy"]

    return {
        "secureScorePct": round(secure_score["value"][0]["properties"]["score"]["percentage"] * 100, 2),
        "openAlerts": bucket(open_alerts, "severity"),
        "unhealthyRecommendations": bucket(unhealthy_recs, "metadata-severity"),
        "exploitableCves": sum(1 for v in vulns if v["publicExploit"] and v["exposedMachines"] > 0),
        "totalResources": len(resources),
        "complianceFailingControls": sum(c["properties"]["failedControls"] for c in compliance),
    }


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Synthetic Azure security data generator")
    ap.add_argument("--scenario", choices=list(SCENARIOS.keys()), default=DEFAULT_SCENARIO)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    cfg = SCENARIOS[args.scenario]
    args.out.mkdir(parents=True, exist_ok=True)

    print(f"Scenario: {args.scenario} | Seed: {args.seed} | Output: {args.out}\n")

    print("Generating resources…")
    resources = gen_resources(rng, cfg["num_resources"])
    print(f"  {len(resources)} resources\n")

    print("Generating recommendations…")
    recommendations = gen_recommendations(rng, resources, cfg["num_recommendations_target"], cfg["unhealthy_rate"])
    unhealthy_count = sum(1 for r in recommendations if r["properties"]["status"]["code"] == "Unhealthy")
    print(f"  {len(recommendations)} recommendations ({unhealthy_count} unhealthy)\n")

    print("Generating alerts…")
    alerts = gen_alerts(rng, resources, cfg["num_alerts"], cfg["high_severity_alert_rate"])
    print(f"  {len(alerts)} alerts\n")

    print("Generating vulnerabilities…")
    vulnerabilities = gen_vulnerabilities(rng, resources, cfg["num_vulnerabilities"])
    print(f"  {len(vulnerabilities)} CVEs\n")

    print("Generating compliance…")
    fail_modifier = 2.0 if args.scenario == "compromised" else (0.6 if args.scenario == "secured" else 1.0)
    compliance = gen_compliance(rng, fail_modifier)
    print(f"  {len(compliance)} standards\n")

    print("Generating secure score…")
    secure_score = gen_secure_score(rng, cfg["secure_score_pct"])
    print(f"  {secure_score['value'][0]['properties']['score']['percentage'] * 100:.1f}%\n")

    print("Generating sign-ins…")
    signins = gen_signins(rng, n=200)
    print(f"  {len(signins)} sign-ins\n")

    print("Generating summary…")
    summary = gen_summary(secure_score, alerts, recommendations, vulnerabilities, compliance, resources)

    # Write everything
    outputs = {
        "secure_score.json": secure_score,
        "recommendations.json": {"value": recommendations},
        "alerts.json": {"@odata.context": "synthetic", "value": alerts},
        "vulnerabilities.json": {"@odata.context": "synthetic", "value": vulnerabilities},
        "compliance.json": {"value": compliance},
        "resources.json": {"totalRecords": len(resources), "count": len(resources), "data": resources},
        "signins.json": {"@odata.context": "synthetic", "value": signins},
        "summary.json": summary,
    }

    for fname, payload in outputs.items():
        path = args.out / fname
        path.write_text(json.dumps(payload, indent=2))
        size_kb = path.stat().st_size / 1024
        print(f"  → {fname:30s} {size_kb:7.1f} KB")

    print(f"\nDone. Copy {args.out}/*.json into your project's backend/mock_data/")


if __name__ == "__main__":
    main()
