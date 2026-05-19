import hashlib
from typing import Any

# Named controls per standard — mirrors real Azure regulatory compliance control IDs
STANDARD_CONTROLS: dict[str, list[tuple[str, str]]] = {
    "Azure-CIS-1.4.0": [
        ("1.1", "Ensure that multi-factor authentication is enabled for all privileged users"),
        ("1.2", "Ensure that multi-factor authentication is enabled for all non-privileged users"),
        ("1.3", "Ensure guest users are reviewed monthly"),
        ("1.4", "Ensure that 'Allow users to remember multi-factor authentication on devices' is disabled"),
        ("2.1", "Ensure that Microsoft Defender for Servers is set to 'On'"),
        ("2.2", "Ensure that Microsoft Defender for App Service is set to 'On'"),
        ("2.3", "Ensure that Microsoft Defender for SQL servers on machines is set to 'On'"),
        ("2.4", "Ensure that Microsoft Defender for SQL is set to 'On' for critical SQL Servers"),
        ("2.5", "Ensure that Microsoft Defender for open-source relational databases is set to 'On'"),
        ("2.6", "Ensure that Microsoft Defender for Storage is set to 'On'"),
        ("2.7", "Ensure that Microsoft Defender for Containers is set to 'On'"),
        ("2.8", "Ensure that Microsoft Defender for Key Vault is set to 'On'"),
        ("3.1", "Ensure that 'Secure transfer required' is set to 'Enabled'"),
        ("3.2", "Ensure that storage account access keys are periodically regenerated"),
        ("3.3", "Ensure Storage logging is enabled for Queue service"),
        ("3.4", "Ensure that shared access signature tokens expire within an hour"),
        ("3.5", "Ensure that 'Public access level' is set to Private for blob containers"),
        ("4.1", "Ensure that 'Auditing' is set to 'On'"),
        ("4.2", "Ensure that 'Data encryption' is set to 'On' on a SQL Database"),
        ("4.3", "Ensure that 'Auditing' Retention is 'greater than 90 days'"),
        ("4.4", "Ensure that Azure Active Directory Admin is configured"),
        ("4.5", "Ensure that 'Threat Detection types' is set to 'All'"),
        ("5.1", "Ensure that a diagnostics setting exists"),
        ("5.2", "Ensure that 'Activity Retention Log' is set to '1 year or greater'"),
        ("5.3", "Ensure audit profile captures all the activities"),
        ("5.4", "Ensure the log profile captures activity logs for all regions"),
        ("6.1", "Ensure that RDP access is restricted from the internet"),
        ("6.2", "Ensure that SSH access is restricted from the internet"),
        ("6.3", "Ensure that UDP services are restricted from the internet"),
        ("7.1", "Ensure Virtual Machines are utilizing Managed Disks"),
        ("7.2", "Ensure that 'OS and Data' disks are encrypted with Customer Managed Keys"),
        ("7.3", "Ensure that 'Unattached disks' are encrypted"),
        ("8.1", "Ensure that the expiration date is set on all keys in non-RBAC key vaults"),
        ("8.2", "Ensure that the expiration date is set on all secrets in non-RBAC key vaults"),
        ("8.3", "Ensure that 'Enable soft delete' is set to 'Yes' for Key Vaults"),
        ("9.1", "Ensure App Service Authentication is set on Azure App Service"),
        ("9.2", "Ensure web app redirects all HTTP traffic to HTTPS in Azure App Service"),
        ("9.3", "Ensure web app is using the latest version of TLS encryption"),
        ("9.4", "Ensure that 'PHP version' is the latest, if used to run the web app"),
        ("9.5", "Ensure that 'Python version' is the latest, if used to run the web app"),
    ],
    "NIST-SP-800-53-R5": [
        ("AC-1", "Access Control Policy and Procedures"),
        ("AC-2", "Account Management"),
        ("AC-3", "Access Enforcement"),
        ("AC-6", "Least Privilege"),
        ("AC-7", "Unsuccessful Logon Attempts"),
        ("AC-11", "Device Lock"),
        ("AC-17", "Remote Access"),
        ("AU-2", "Event Logging"),
        ("AU-3", "Content of Audit Records"),
        ("AU-6", "Audit Record Review, Analysis, and Reporting"),
        ("AU-9", "Protection of Audit Information"),
        ("AU-12", "Audit Record Generation"),
        ("CA-7", "Continuous Monitoring"),
        ("CM-2", "Baseline Configuration"),
        ("CM-6", "Configuration Settings"),
        ("CM-7", "Least Functionality"),
        ("CM-8", "System Component Inventory"),
        ("IA-2", "Identification and Authentication"),
        ("IA-5", "Authenticator Management"),
        ("IA-8", "Identification and Authentication (Non-Organizational Users)"),
        ("IR-4", "Incident Handling"),
        ("IR-6", "Incident Reporting"),
        ("MA-4", "Nonlocal Maintenance"),
        ("MP-2", "Media Access"),
        ("RA-5", "Vulnerability Monitoring and Scanning"),
        ("SA-9", "External System Services"),
        ("SC-5", "Denial-of-service Protection"),
        ("SC-7", "Boundary Protection"),
        ("SC-8", "Transmission Confidentiality and Integrity"),
        ("SC-28", "Protection of Information at Rest"),
        ("SI-2", "Flaw Remediation"),
        ("SI-3", "Malicious Code Protection"),
        ("SI-4", "System Monitoring"),
        ("SI-7", "Software, Firmware, and Information Integrity"),
    ],
    "ISO-27001-2013": [
        ("A.5.1.1", "Policies for information security"),
        ("A.5.1.2", "Review of the policies for information security"),
        ("A.6.1.1", "Information security roles and responsibilities"),
        ("A.6.1.2", "Segregation of duties"),
        ("A.8.1.1", "Inventory of assets"),
        ("A.8.1.2", "Ownership of assets"),
        ("A.9.1.1", "Access control policy"),
        ("A.9.2.1", "User registration and de-registration"),
        ("A.9.2.3", "Management of privileged access rights"),
        ("A.9.2.4", "Management of secret authentication information of users"),
        ("A.9.4.1", "Information access restriction"),
        ("A.10.1.1", "Policy on the use of cryptographic controls"),
        ("A.10.1.2", "Key management"),
        ("A.11.1.1", "Physical security perimeter"),
        ("A.12.1.1", "Documented operating procedures"),
        ("A.12.4.1", "Event logging"),
        ("A.12.4.2", "Protection of log information"),
        ("A.12.6.1", "Management of technical vulnerabilities"),
        ("A.13.1.1", "Network controls"),
        ("A.13.2.1", "Information transfer policies and procedures"),
        ("A.14.2.2", "System change control procedures"),
        ("A.16.1.1", "Responsibilities and procedures"),
        ("A.16.1.2", "Reporting information security events"),
        ("A.18.1.3", "Protection of records"),
    ],
}

# Fallback: generate generic control IDs when a standard is not in the map
def _fallback_controls(name: str, total: int) -> list[tuple[str, str]]:
    return [(f"CTL-{i+1:03d}", f"Security control {i+1} for {name}") for i in range(total)]


def generate_controls(standard: dict[str, Any]) -> list[dict[str, Any]]:
    name = standard["name"]
    props = standard["properties"]
    failed = props["failedControls"]
    passed = props["passedControls"]
    skipped = props["skippedControls"]

    controls = STANDARD_CONTROLS.get(name) or _fallback_controls(name, failed + passed + skipped)

    # Deterministically assign states based on the summary counts
    result = []
    for i, (ctrl_id, description) in enumerate(controls):
        # Use a hash so the same control always gets the same state across requests
        h = int(hashlib.md5(f"{name}:{ctrl_id}".encode()).hexdigest(), 16)
        total = failed + passed + skipped
        bucket = h % total if total > 0 else 0
        if bucket < failed:
            state = "Failed"
        elif bucket < failed + skipped:
            state = "Skipped"
        else:
            state = "Passed"

        result.append({
            "id": ctrl_id,
            "description": description,
            "state": state,
        })

    return sorted(result, key=lambda c: (0 if c["state"] == "Failed" else 1 if c["state"] == "Skipped" else 2, c["id"]))
