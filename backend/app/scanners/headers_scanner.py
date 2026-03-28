from typing import Any

import requests


def _max_severity(current: str, incoming: str) -> str:
    order = {"pass": 0, "info": 1, "warning": 2, "critical": 3}
    return incoming if order[incoming] > order[current] else current


def _missing_header_finding(header_name: str, severity: str) -> dict[str, Any]:
    return {
        "title": f"Missing security header: {header_name}",
        "description": f"HTTP response does not include {header_name}.",
        "plain_english": "Virtual Security Officer found missing HTTPS security headers that reduce browser-based attack protections such as clickjacking and content injection.",
        "remediation_steps": [
            f"Configure web server or CDN to add {header_name}.",
            "Validate headers on all application and static asset responses.",
        ],
        "severity": severity,
    }


def scan_http_headers(domain_name: str) -> dict[str, Any]:
    """Virtual Security Officer HTTP/HTTPS header and redirect scan."""
    findings: list[dict[str, Any]] = []
    raw_data: dict[str, Any] = {}
    severity = "pass"

    try:
        https_resp = requests.get(f"https://{domain_name}", timeout=10, allow_redirects=True)
        http_resp = requests.get(f"http://{domain_name}", timeout=10, allow_redirects=True)
        headers = dict(https_resp.headers)
        raw_data = {
            "https_final_url": https_resp.url,
            "https_status_code": https_resp.status_code,
            "http_final_url": http_resp.url,
            "http_status_code": http_resp.status_code,
            "headers": headers,
        }

        if not http_resp.url.lower().startswith("https://"):
            severity = _max_severity(severity, "critical")
            findings.append(
                {
                    "title": "HTTP does not enforce HTTPS redirect",
                    "description": "HTTP endpoint did not redirect to HTTPS final URL.",
                    "plain_english": "Virtual Security Officer found that users can connect without encryption, allowing traffic interception and tampering risks.",
                    "remediation_steps": [
                        "Force HTTP to HTTPS redirects at load balancer or web server.",
                        "Enable HSTS after verifying HTTPS is stable.",
                    ],
                    "severity": "critical",
                }
            )

        required_headers = {
            "Strict-Transport-Security": "critical",
            "X-Frame-Options": "warning",
            "X-Content-Type-Options": "warning",
            "Content-Security-Policy": "warning",
            "X-XSS-Protection": "info",
            "Referrer-Policy": "info",
        }
        for header_name, level in required_headers.items():
            if header_name not in headers:
                severity = _max_severity(severity, level)
                findings.append(_missing_header_finding(header_name, level))

        server_header = headers.get("Server")
        if server_header:
            if "/" in server_header and any(ch.isdigit() for ch in server_header):
                severity = _max_severity(severity, "warning")
                findings.append(
                    {
                        "title": "Server header reveals version information",
                        "description": f"Server header discloses software/version: {server_header}",
                        "plain_english": "Virtual Security Officer found software version details in responses, which can help attackers target known vulnerabilities.",
                        "remediation_steps": [
                            "Suppress or sanitize Server and X-Powered-By headers.",
                            "Patch exposed software to latest supported versions.",
                        ],
                        "severity": "warning",
                    }
                )

        if not findings:
            findings.append(
                {
                    "title": "Security headers baseline looks good",
                    "description": "No major missing headers detected in this check.",
                    "plain_english": "Virtual Security Officer found your core browser security headers in place for this endpoint.",
                    "remediation_steps": [
                        "Continue monitoring headers in CI/CD and edge configurations.",
                    ],
                    "severity": "pass",
                }
            )
    except Exception as exc:
        severity = "critical"
        raw_data = {"error": str(exc)}
        findings.append(
            {
                "title": "Header scan failed",
                "description": f"HTTPS/HTTP request to {domain_name} failed: {exc}",
                "plain_english": "Virtual Security Officer could not validate website transport and header protections due to a connection or response failure.",
                "remediation_steps": [
                    "Verify domain DNS and TLS configuration.",
                    "Confirm web service is reachable from the public internet.",
                ],
                "severity": "critical",
            }
        )

    return {
        "scan_type": "headers",
        "status": "completed" if "error" not in raw_data else "failed",
        "severity": severity,
        "findings": findings,
        "raw_data": raw_data,
    }
