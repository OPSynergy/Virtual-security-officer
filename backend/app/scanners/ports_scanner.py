from typing import Any

import nmap


COMMON_PORTS = [21, 22, 23, 25, 53, 80, 443, 445, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 8888, 27017, 5984, 11211, 9200]

PORT_CLASSIFICATION = {
    21: ("FTP exposed", "warning"),
    22: ("SSH exposed", "info"),
    23: ("Telnet exposed", "critical"),
    80: ("HTTP exposed", "info"),
    443: ("HTTPS exposed", "info"),
    3306: ("MySQL exposed", "critical"),
    3389: ("RDP exposed", "critical"),
    5432: ("PostgreSQL exposed", "critical"),
    5900: ("VNC exposed", "critical"),
    6379: ("Redis exposed", "critical"),
    27017: ("MongoDB exposed", "critical"),
}


def _max_severity(current: str, incoming: str) -> str:
    order = {"pass": 0, "info": 1, "warning": 2, "critical": 3}
    return incoming if order[incoming] > order[current] else current


def _port_plain_english(port: int, label: str, severity: str) -> str:
    if severity == "critical" and port in {3306, 5432, 6379, 27017}:
        return f"Your database port ({port}/{label.split()[0]}) is publicly accessible from the internet. This is like leaving your filing cabinet unlocked on the street — attackers can attempt to directly access your data."
    return f"Virtual Security Officer detected open port {port} ({label}). Public exposure should be validated against intended architecture."


def scan_ports(domain_name: str) -> dict[str, Any]:
    """Virtual Security Officer top-20 common internet port exposure scan."""
    findings: list[dict[str, Any]] = []
    severity = "pass"
    raw_data: dict[str, Any] = {"open_ports": []}

    try:
        scanner = nmap.PortScanner()
        port_arg = ",".join(str(p) for p in COMMON_PORTS)
        # --host-timeout caps scan time to avoid hanging jobs.
        result = scanner.scan(hosts=domain_name, ports=port_arg, arguments="-sT --host-timeout 30s")
        raw_data["nmap_result"] = result

        # Nmap keys `scan` by resolved IP (and sometimes multiple A records), not the input hostname.
        # Comparing `domain_name not in all_hosts()` was always true for normal DNS names → false "failure".
        hosts_list = scanner.all_hosts()
        if not hosts_list:
            return {
                "scan_type": "ports",
                "status": "completed",
                "severity": "info",
                "findings": [
                    {
                        "title": "No reachable host found for port scan",
                        "description": f"Nmap did not return host data for {domain_name}.",
                        "plain_english": "Virtual Security Officer could not verify externally reachable ports for this host.",
                        "remediation_steps": [
                            "Confirm DNS resolves publicly.",
                            "Check firewall rules and scan from a trusted network.",
                        ],
                        "severity": "info",
                    }
                ],
                "raw_data": raw_data,
            }

        tcp_data: dict[int, dict] = {}
        for hk in hosts_list:
            for port, details in scanner[hk].get("tcp", {}).items():
                if details.get("state") != "open":
                    continue
                p = int(port) if not isinstance(port, int) else port
                if p not in tcp_data:
                    tcp_data[p] = details
        raw_data["scanned_hosts"] = list(hosts_list)

        for port, details in tcp_data.items():
            if details.get("state") != "open":
                continue

            label, level = PORT_CLASSIFICATION.get(port, ("Service exposed", "warning"))
            severity = _max_severity(severity, level)
            service_name = details.get("name", "unknown")
            product = details.get("product", "")
            version = details.get("version", "")
            raw_data["open_ports"].append(
                {
                    "port": port,
                    "service": service_name,
                    "state": details.get("state"),
                    "product": product,
                    "version": version,
                }
            )
            findings.append(
                {
                    "title": f"Open port {port} detected ({label})",
                    "description": f"Port {port}/tcp open; service={service_name}; product={product}; version={version}",
                    "plain_english": _port_plain_english(port, label, level),
                    "remediation_steps": [
                        "Restrict exposure with firewall allowlists and network ACLs.",
                        "Disable unused services or move them behind private networks/VPN.",
                        "Require strong authentication and patch exposed services.",
                    ],
                    "severity": level,
                }
            )

        if not findings:
            findings.append(
                {
                    "title": "No open common ports detected",
                    "description": "Top-20 common ports did not appear open in this scan.",
                    "plain_english": "Virtual Security Officer did not detect exposed common services on this host from the scanner vantage point.",
                    "remediation_steps": [
                        "Keep periodic external scans to detect configuration drift.",
                    ],
                    "severity": "pass",
                }
            )
    except Exception as exc:
        severity = "warning"
        err = str(exc)
        raw_data = {"error": err}
        err_l = err.lower()
        nmap_missing = "nmap program was not found" in err_l or "not found in path" in err_l
        if nmap_missing:
            plain = (
                "The port scanner could not run because the `nmap` program is missing or not on PATH for the "
                "Celery worker process. Install Nmap on the same machine that runs the worker and restart it."
            )
            remediation_steps = [
                "Debian/Ubuntu: sudo apt install nmap",
                "macOS: brew install nmap",
                "Ensure `which nmap` works in the same shell/environment as Celery, then restart the worker.",
            ]
        else:
            plain = "Virtual Security Officer could not complete network port visibility checks due to scanner or network failure."
            remediation_steps = [
                "Confirm nmap is installed and accessible to python-nmap.",
                "Verify DNS/network reachability and retry.",
            ]
        findings = [
            {
                "title": "Port scan failed" if not nmap_missing else "Port scan unavailable (nmap missing)",
                "description": f"Port scan for {domain_name} failed: {exc}",
                "plain_english": plain,
                "remediation_steps": remediation_steps,
                "severity": "warning",
            }
        ]

    return {
        "scan_type": "ports",
        "status": "completed" if "error" not in raw_data else "failed",
        "severity": severity,
        "findings": findings,
        "raw_data": raw_data,
    }
