import socket
import ssl
from datetime import UTC, datetime
from typing import Any


def _max_severity(current: str, incoming: str) -> str:
    order = {"pass": 0, "info": 1, "warning": 2, "critical": 3}
    return incoming if order[incoming] > order[current] else current


def _days_until_expiry(not_after: str | None) -> int | None:
    if not not_after:
        return None
    expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=UTC)
    return (expiry - datetime.now(UTC)).days


def scan_ssl(domain_name: str) -> dict[str, Any]:
    """Virtual Security Officer SSL/TLS certificate and protocol scan."""
    findings: list[dict[str, Any]] = []
    severity = "pass"
    raw_data: dict[str, Any] = {}

    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain_name, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=domain_name) as secure_sock:
                cert = secure_sock.getpeercert()
                tls_version = secure_sock.version() or "UNKNOWN"
                raw_data = {"certificate": cert, "tls_version": tls_version}

                expiry_days = _days_until_expiry(cert.get("notAfter"))
                issuer = cert.get("issuer", [])
                sans = cert.get("subjectAltName", [])

                findings.append(
                    {
                        "title": "Certificate issuer and SAN inspection",
                        "description": f"Issuer: {issuer}; Subject Alternative Names count: {len(sans)}.",
                        "plain_english": "Virtual Security Officer confirmed your SSL certificate issuer and alternate domain coverage.",
                        "remediation_steps": [
                            "Ensure all expected hostnames are present in certificate SANs.",
                            "Use a trusted certificate authority for certificate renewal.",
                        ],
                        "severity": "info",
                    }
                )

                if expiry_days is None:
                    severity = _max_severity(severity, "warning")
                    findings.append(
                        {
                            "title": "Certificate expiry could not be determined",
                            "description": "The certificate did not contain a parseable notAfter field.",
                            "plain_english": "Virtual Security Officer could not confirm certificate expiry, so renewal risk cannot be assessed.",
                            "remediation_steps": [
                                "Re-issue the certificate from a trusted CA.",
                                "Verify the server provides a valid certificate chain.",
                            ],
                            "severity": "warning",
                        }
                    )
                elif expiry_days < 7:
                    severity = _max_severity(severity, "critical")
                    findings.append(
                        {
                            "title": "SSL certificate expiring very soon",
                            "description": f"Certificate expires in {expiry_days} days (<7 days threshold).",
                            "plain_english": f"Your SSL certificate expires in {expiry_days} days. Visitors will see a 'Not Secure' warning in their browser, causing them to leave your site.",
                            "remediation_steps": [
                                "Renew the TLS certificate immediately.",
                                "Automate certificate renewal monitoring and alerts.",
                            ],
                            "severity": "critical",
                        }
                    )
                elif expiry_days < 30:
                    severity = _max_severity(severity, "warning")
                    findings.append(
                        {
                            "title": "SSL certificate expiring soon",
                            "description": f"Certificate expires in {expiry_days} days (<30 days threshold).",
                            "plain_english": f"Virtual Security Officer detected that your SSL certificate expires in {expiry_days} days, which can cause trust warnings soon.",
                            "remediation_steps": [
                                "Schedule certificate renewal in your next maintenance window.",
                                "Set automated reminders at 30/14/7 day intervals.",
                            ],
                            "severity": "warning",
                        }
                    )

                tls_order = {
                    "SSLv3": 0,
                    "TLSv1": 1,
                    "TLSv1.1": 2,
                    "TLSv1.2": 3,
                    "TLSv1.3": 4,
                }
                if tls_order.get(tls_version, 0) < tls_order["TLSv1.2"]:
                    severity = _max_severity(severity, "warning")
                    findings.append(
                        {
                            "title": "Outdated TLS protocol negotiated",
                            "description": f"Server negotiated {tls_version}; minimum recommended is TLSv1.2.",
                            "plain_english": "Virtual Security Officer found an outdated encryption protocol, which can weaken secure browsing protections.",
                            "remediation_steps": [
                                "Disable TLSv1.0 and TLSv1.1 on the server.",
                                "Allow only TLSv1.2+ cipher suites.",
                            ],
                            "severity": "warning",
                        }
                    )
    except Exception as exc:
        severity = "critical"
        findings.append(
            {
                "title": "SSL connection or certificate validation failed",
                "description": f"Connection to {domain_name}:443 failed or certificate validation raised: {exc}",
                "plain_english": "Virtual Security Officer could not establish a trusted secure connection. Users may see browser security warnings and abandon the site.",
                "remediation_steps": [
                    "Verify DNS points to the correct web server.",
                    "Install a valid certificate and complete certificate chain.",
                    "Confirm port 443 is open and serving HTTPS.",
                ],
                "severity": "critical",
            }
        )
        raw_data = {"error": str(exc)}

    return {
        "scan_type": "ssl",
        "status": "completed" if severity != "critical" or "error" not in raw_data else "failed",
        "severity": severity,
        "findings": findings,
        "raw_data": raw_data,
    }
