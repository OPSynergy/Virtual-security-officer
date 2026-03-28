from typing import Any


CATEGORY_WEIGHTS = {
    "ssl": 25,
    "email": 20,
    "headers": 20,
    "dns": 20,
    "ports": 15,
}


def score_to_grade(score: int) -> str:
    """
    Virtual Security Officer — converts numeric score to letter grade.
    A: 90+, B: 75+, C: 60+, D: 45+, F: below 45
    """
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 45:
        return "D"
    return "F"


def _normalize_category(scan_type: str) -> str:
    if scan_type == "spf_dkim":
        return "email"
    return scan_type


def calculate_score(scan_results: list[dict[str, Any]]) -> dict[str, Any]:
    category_scores = {
        "ssl": float(CATEGORY_WEIGHTS["ssl"]),
        "email": float(CATEGORY_WEIGHTS["email"]),
        "headers": float(CATEGORY_WEIGHTS["headers"]),
        "dns": float(CATEGORY_WEIGHTS["dns"]),
        "ports": float(CATEGORY_WEIGHTS["ports"]),
    }
    summary = {"critical_count": 0, "warning_count": 0, "info_count": 0}

    for result in scan_results:
        category = _normalize_category(str(result.get("scan_type", "")))
        if category not in category_scores:
            continue
        findings = result.get("findings", []) or []
        for finding in findings:
            sev = str(finding.get("severity", "info")).lower()
            if sev == "critical":
                summary["critical_count"] += 1
                category_scores[category] = 0.0
            elif sev == "warning":
                summary["warning_count"] += 1
                category_scores[category] = max(0.0, category_scores[category] * 0.5)
            elif sev == "info":
                summary["info_count"] += 1

    final_scores = {k: int(round(v)) for k, v in category_scores.items()}
    total_score = sum(final_scores.values())
    return {
        "total_score": total_score,
        "ssl_score": final_scores["ssl"],
        "email_score": final_scores["email"],
        "headers_score": final_scores["headers"],
        "dns_score": final_scores["dns"],
        "ports_score": final_scores["ports"],
        "grade": score_to_grade(total_score),
        "findings_summary": summary,
    }
