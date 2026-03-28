from .dns_scanner import scan_dns
from .email_scanner import scan_email_security
from .headers_scanner import scan_http_headers
from .ports_scanner import scan_ports
from .ssl_scanner import scan_ssl


def run_all_scanners(domain_name: str) -> dict:
    """
    Virtual Security Officer — runs all 5 security scanners
    and returns a combined dict of all results.
    """
    scanners = {
        "ssl": scan_ssl,
        "dns": scan_dns,
        "spf_dkim": scan_email_security,
        "headers": scan_http_headers,
        "ports": scan_ports,
    }
    results: dict[str, dict] = {}
    for key, scanner in scanners.items():
        try:
            results[key] = scanner(domain_name)
        except Exception as exc:
            results[key] = {
                "scan_type": key,
                "status": "failed",
                "severity": "critical",
                "findings": [
                    {
                        "title": f"{key} scanner failed",
                        "description": f"Virtual Security Officer scanner error: {exc}",
                        "plain_english": "Virtual Security Officer could not complete this scan module, but other modules continued successfully.",
                        "remediation_steps": [
                            "Inspect scanner logs and retry the scan.",
                            "Validate network reachability and DNS records.",
                        ],
                        "severity": "critical",
                    }
                ],
                "raw_data": {"error": str(exc)},
            }
    return {"domain_name": domain_name, "results": results}
