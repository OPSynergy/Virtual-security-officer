export function severityClass(severity) {
  if (severity === "critical") return "border-l-red-500";
  if (severity === "warning") return "border-l-amber-500";
  return "border-l-emerald-500";
}

export function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function scoreColor(score) {
  if (score >= 80) return "rgb(16 185 129)";
  if (score >= 50) return "rgb(245 158 11)";
  return "rgb(239 68 68)";
}

export function formatDate(iso) {
  if (!iso) return "No scans yet";
  return new Date(iso).toLocaleString();
}

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2, pass: 3 };

/**
 * One row per (scan_type + title); if duplicates exist (e.g. across scan runs), keep the highest-severity copy.
 */
export function dedupeFindings(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return [];
  const byKey = new Map();
  for (const f of findings) {
    const key = `${String(f.scan_type ?? "").toLowerCase()}|${String(f.title ?? "").trim().toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, f);
      continue;
    }
    const ra = SEVERITY_RANK[String(prev.severity ?? "").toLowerCase()] ?? 9;
    const rb = SEVERITY_RANK[String(f.severity ?? "").toLowerCase()] ?? 9;
    if (rb < ra) {
      byKey.set(key, { ...f, id: prev.id });
    }
  }
  return Array.from(byKey.values());
}
