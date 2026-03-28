from uuid import uuid4


def get_demo_scan_data(domain: str = "demo-company.com") -> dict:
    domain_id = str(uuid4())
    # Latest scan timestamp — module results align to the most recent history point
    scan_ts = "2026-03-27T12:00:00+00:00"
    now = scan_ts
    return {
        "domain_id": domain_id,
        "domain_name": domain,
        "score": {
            "id": str(uuid4()),
            "domain_id": domain_id,
            "total_score": 38,
            "grade": "F",
            "ssl_score": 20,
            "email_score": 0,
            "headers_score": 12,
            "dns_score": 6,
            "ports_score": 0,
            "created_at": now,
        },
        "results": [
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "scan_type": "ssl",
                "severity": "warning",
                "created_at": now,
                "raw_data": {
                    "findings": [
                        {
                            "title": "SSL certificate expires soon",
                            "description": "Certificate expiry window is 22 days.",
                            "plain_english": "Virtual Security Officer found your SSL certificate expires in 22 days. Plan renewal now to avoid customer trust warnings.",
                            "remediation_steps": [
                                "Renew the certificate with your provider.",
                                "Enable automatic renewal where supported.",
                            ],
                            "severity": "warning",
                        }
                    ]
                },
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "scan_type": "dns",
                "severity": "critical",
                "created_at": now,
                "raw_data": {
                    "findings": [
                        {
                            "title": "Sensitive subdomain exposed",
                            "description": "admin.demo-company.com is publicly visible and staging.demo-company.com is discoverable.",
                            "plain_english": "Virtual Security Officer found exposed subdomains including admin.demo-company.com and staging.demo-company.com, which increases takeover risk.",
                            "remediation_steps": [
                                "Restrict admin host access by IP allowlist or VPN.",
                                "Move staging hosts behind authentication and remove stale records.",
                                "Require MFA for all administrator logins.",
                            ],
                            "severity": "critical",
                        },
                    ]
                },
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "scan_type": "spf_dkim",
                "severity": "critical",
                "created_at": now,
                "raw_data": {
                    "findings": [
                        {
                            "title": "Email authentication policies are weak",
                            "description": "No _dmarc TXT record exists and SPF policy contains +all.",
                            "plain_english": "Virtual Security Officer found no DMARC policy and an overly permissive SPF record (+all), so attackers can spoof your email domain.",
                            "remediation_steps": [
                                "Publish a DMARC record with p=none first.",
                                "Move to p=quarantine/reject after monitoring.",
                                "Replace +all with -all after validating senders.",
                            ],
                            "severity": "critical",
                        },
                    ]
                },
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "scan_type": "headers",
                "severity": "warning",
                "created_at": now,
                "raw_data": {
                    "findings": [
                        {
                            "title": "Browser security headers missing",
                            "description": "Content-Security-Policy and X-Frame-Options headers are missing.",
                            "plain_english": "Virtual Security Officer found missing browser protections (CSP and X-Frame-Options), increasing script injection and clickjacking risk.",
                            "remediation_steps": [
                                "Add a baseline Content-Security-Policy header.",
                                "Set X-Frame-Options to DENY or SAMEORIGIN.",
                                "Roll out strict CSP in report-only mode first.",
                            ],
                            "severity": "warning",
                        },
                    ]
                },
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "scan_type": "ports",
                "severity": "critical",
                "created_at": now,
                "raw_data": {
                    "findings": [
                        {
                            "title": "MySQL port publicly accessible",
                            "description": "Port 3306 is open on internet-facing host.",
                            "plain_english": "Virtual Security Officer found MySQL (3306) open to the internet. Attackers can attempt direct access to sensitive data.",
                            "remediation_steps": [
                                "Restrict 3306 to private network addresses only.",
                                "Rotate DB credentials and enforce strong authentication.",
                            ],
                            "severity": "critical",
                        }
                    ]
                },
            },
        ],
        # Newest-first (matches /history API) — frontend reverses for chronological chart
        "history": [
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "total_score": 38,
                "ssl_score": 20,
                "email_score": 0,
                "headers_score": 12,
                "dns_score": 6,
                "ports_score": 0,
                "created_at": scan_ts,
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "total_score": 36,
                "ssl_score": 18,
                "email_score": 0,
                "headers_score": 11,
                "dns_score": 6,
                "ports_score": 1,
                "created_at": "2026-03-26T12:00:00+00:00",
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "total_score": 35,
                "ssl_score": 17,
                "email_score": 0,
                "headers_score": 11,
                "dns_score": 5,
                "ports_score": 2,
                "created_at": "2026-03-24T12:00:00+00:00",
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "total_score": 34,
                "ssl_score": 16,
                "email_score": 0,
                "headers_score": 10,
                "dns_score": 5,
                "ports_score": 3,
                "created_at": "2026-03-22T12:00:00+00:00",
            },
            {
                "id": str(uuid4()),
                "domain_id": domain_id,
                "total_score": 32,
                "ssl_score": 14,
                "email_score": 0,
                "headers_score": 10,
                "dns_score": 4,
                "ports_score": 4,
                "created_at": "2026-03-20T12:00:00+00:00",
            },
        ],
    }
