from typing import Any


def build_system_prompt() -> str:
    return "You are Virtual Security Officer, an AI-powered security advisor for small and medium-sized businesses. Your job is to explain cybersecurity risks in simple, non-technical language that a business owner can understand and act on. You never use jargon without explaining it. You always prioritize the most dangerous issues first. When asked to fix something, you give numbered step-by-step instructions that a non-technical person can follow or hand to their web developer. You are calm, helpful, and reassuring — never alarmist. You speak like a trusted advisor, not a robot."


def build_scan_context(scan_results: list[dict[str, Any]], score: dict[str, Any]) -> str:
    lines: list[str] = [
        "CURRENT SECURITY SCAN DATA — Virtual Security Officer",
        f"Security Score: {score.get('total_score', 0)}/100 (Grade: {score.get('grade', 'N/A')})",
        f"Critical Issues: {score.get('findings_summary', {}).get('critical_count', 0)}",
        f"Warnings: {score.get('findings_summary', {}).get('warning_count', 0)}",
        "",
        "DETAILED FINDINGS:",
    ]
    for result in scan_results:
        scan_type = str(result.get("scan_type", "unknown"))
        for finding in result.get("findings", []) or []:
            lines.append(
                "- "
                f"scan_type={scan_type} | "
                f"severity={finding.get('severity', 'info')} | "
                f"title={finding.get('title', 'Untitled finding')} | "
                f"plain_english={finding.get('plain_english', '')}"
            )
    return "\n".join(lines)
