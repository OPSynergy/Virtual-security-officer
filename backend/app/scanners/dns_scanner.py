from typing import Any

import dns.resolver


COMMON_SUBDOMAINS = [
    "www",
    "mail",
    "ftp",
    "api",
    "admin",
    "dev",
    "staging",
    "test",
    "vpn",
    "remote",
    "portal",
    "app",
    "blog",
    "cdn",
    "docs",
    "m",
    "beta",
    "status",
    "internal",
    "support",
]


def _max_severity(current: str, incoming: str) -> str:
    order = {"pass": 0, "info": 1, "warning": 2, "critical": 3}
    return incoming if order[incoming] > order[current] else current


def scan_dns(domain_name: str) -> dict[str, Any]:
    """Virtual Security Officer DNS exposure and hygiene scan."""
    findings: list[dict[str, Any]] = []
    raw_data: dict[str, Any] = {"a_records": [], "mx_records": [], "subdomains_found": [], "wildcard": False}
    severity = "pass"
    status = "completed"

    resolver = dns.resolver.Resolver()

    try:
        a_answers = resolver.resolve(domain_name, "A")
        a_records = [r.to_text() for r in a_answers]
        raw_data["a_records"] = a_records
        findings.append(
            {
                "title": "A records resolved",
                "description": f"Resolved {len(a_records)} A record(s): {a_records}",
                "plain_english": "Virtual Security Officer confirmed your domain resolves to live servers.",
                "remediation_steps": [
                    "Keep DNS records up to date with active infrastructure.",
                ],
                "severity": "info",
            }
        )
        severity = _max_severity(severity, "info")
    except Exception as exc:
        severity = _max_severity(severity, "critical")
        findings.append(
            {
                "title": "Missing or broken A record",
                "description": f"A record lookup failed for {domain_name}: {exc}",
                "plain_english": "Virtual Security Officer could not find a working IP address for your domain, which can cause outages.",
                "remediation_steps": [
                    "Create or correct A/AAAA records at your DNS provider.",
                    "Verify DNS propagation and authoritative nameservers.",
                ],
                "severity": "critical",
            }
        )

    try:
        mx_answers = resolver.resolve(domain_name, "MX")
        mx_records = [r.to_text() for r in mx_answers]
        raw_data["mx_records"] = mx_records
        findings.append(
            {
                "title": "MX records found",
                "description": f"Resolved {len(mx_records)} MX record(s): {mx_records}",
                "plain_english": "Virtual Security Officer verified that mail routing records exist for your domain.",
                "remediation_steps": [
                    "Ensure MX targets are current and monitored.",
                ],
                "severity": "info",
            }
        )
        severity = _max_severity(severity, "info")
    except Exception:
        severity = _max_severity(severity, "warning")
        findings.append(
            {
                "title": "MX records missing",
                "description": f"No MX records found for {domain_name}.",
                "plain_english": "Virtual Security Officer found no mail server records. If you send or receive mail on this domain, delivery may fail.",
                "remediation_steps": [
                    "Add MX records if email service is required.",
                    "If not using email, document this to avoid false alerts.",
                ],
                "severity": "warning",
            }
        )

    discovered = []
    for sub in COMMON_SUBDOMAINS:
        fqdn = f"{sub}.{domain_name}"
        try:
            answers = resolver.resolve(fqdn, "A")
            ips = [a.to_text() for a in answers]
            discovered.append({"subdomain": fqdn, "a_records": ips})
            findings.append(
                {
                    "title": f"Subdomain discovered: {fqdn}",
                    "description": f"Public DNS records found for {fqdn}: {ips}",
                    "plain_english": "We found publicly visible subdomains. If they run old test systems, attackers may use them to access your environment.",
                    "remediation_steps": [
                        "Inventory each discovered subdomain owner and purpose.",
                        "Retire unused subdomains and remove stale DNS records.",
                        "Apply patching and access controls to non-production hosts.",
                    ],
                    "severity": "info",
                }
            )
            severity = _max_severity(severity, "info")
        except Exception:
            continue
    raw_data["subdomains_found"] = discovered

    wildcard_probe = f"vso-wildcard-probe-12345.{domain_name}"
    try:
        wildcard_answers = resolver.resolve(wildcard_probe, "A")
        wildcard_ips = [a.to_text() for a in wildcard_answers]
        raw_data["wildcard"] = True
        raw_data["wildcard_ips"] = wildcard_ips
        severity = _max_severity(severity, "warning")
        findings.append(
            {
                "title": "Wildcard DNS detected",
                "description": f"Unexpected host {wildcard_probe} resolved to: {wildcard_ips}",
                "plain_english": "Virtual Security Officer detected wildcard DNS, which can make typo domains resolve and hide risky shadow services.",
                "remediation_steps": [
                    "Review wildcard DNS need and scope.",
                    "Use explicit records for production endpoints when possible.",
                ],
                "severity": "warning",
            }
        )
    except Exception:
        raw_data["wildcard"] = False

    if not findings:
        status = "failed"
        severity = "critical"

    return {
        "scan_type": "dns",
        "status": status,
        "severity": severity,
        "findings": findings,
        "raw_data": raw_data,
    }
