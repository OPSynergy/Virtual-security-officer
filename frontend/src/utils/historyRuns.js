/** @typedef {{ id?: string, total_score?: number, created_at?: string, date?: string, ssl_score?: number, email_score?: number, headers_score?: number, dns_score?: number, ports_score?: number }} ScoreRow */

/**
 * @param {ScoreRow | undefined} row
 */
export function parseScoreTime(row) {
  if (!row) return NaN;
  const raw = row.created_at || row.date;
  if (!raw) return NaN;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/**
 * @param {unknown[]} batch
 */
function countsFromBatch(batch) {
  let critical = 0;
  let warning = 0;
  let info = 0;
  let pass = 0;
  if (!Array.isArray(batch)) {
    return { critical, warning, info, pass, total: 0 };
  }
  for (const row of batch) {
    const findings = row?.raw_data?.findings;
    if (!Array.isArray(findings)) continue;
    for (const f of findings) {
      const s = String(f?.severity || "").toLowerCase();
      if (s === "critical") critical += 1;
      else if (s === "warning") warning += 1;
      else if (s === "pass") pass += 1;
      else info += 1;
    }
  }
  return { critical, warning, info, pass, total: critical + warning + info + pass };
}

/**
 * @param {Record<string, unknown>} f
 * @param {string} scanType
 */
function findingKey(f, scanType) {
  return `${scanType}::${String(f?.title || "")}`;
}

/**
 * @param {unknown[]} batch
 */
function extractFindings(batch) {
  const out = [];
  if (!Array.isArray(batch)) return out;
  for (const row of batch) {
    const st = String(row?.scan_type || "");
    const findings = row?.raw_data?.findings;
    if (!Array.isArray(findings)) continue;
    for (const f of findings) {
      out.push({
        key: findingKey(f, st),
        title: String(f?.title || "Finding"),
        severity: String(f?.severity || "info").toLowerCase(),
        scan_type: st,
      });
    }
  }
  return out;
}

/**
 * @param {unknown[]} prev
 * @param {unknown[]} curr
 */
function diffBatches(prev, curr) {
  const p = extractFindings(prev);
  const c = extractFindings(curr);
  const pk = new Set(p.map((x) => x.key));
  const ck = new Set(c.map((x) => x.key));
  const newIssues = c.filter((x) => !pk.has(x.key));
  const fixedIssues = p.filter((x) => !ck.has(x.key));
  const regressed = [];
  for (const cur of c) {
    const old = p.find((o) => o.key === cur.key);
    if (!old) continue;
    const rank = { critical: 0, warning: 1, info: 2, pass: 3 };
    const a = rank[old.severity] ?? 9;
    const b = rank[cur.severity] ?? 9;
    if (b < a) regressed.push({ ...cur, was: old.severity });
  }
  return { newIssues, fixedIssues, regressed };
}

function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/**
 * Build per-scan snapshots from score history + raw scan result rows.
 * Scans are attributed to a score row if their created_at falls in (prevScoreTime, scoreTime].
 *
 * @param {ScoreRow[]} scoreHistory
 * @param {unknown[]} scanResultsRaw
 * @param {string} domainName
 */
export function buildScanRuns(scoreHistory, scanResultsRaw, domainName) {
  const scores = [...(scoreHistory || [])]
    .map((s) => ({ ...s, _ts: parseScoreTime(s) }))
    .filter((s) => !Number.isNaN(s._ts))
    .sort((a, b) => a._ts - b._ts);

  const scans = [...(scanResultsRaw || [])]
    .map((s) => ({ ...s, _ts: parseScoreTime(s) }))
    .filter((s) => !Number.isNaN(s._ts))
    .sort((a, b) => a._ts - b._ts);

  /** @type {Array<Record<string, unknown>>} */
  const runsChrono = [];

  for (let i = 0; i < scores.length; i++) {
    const prevScore = i > 0 ? scores[i - 1] : null;
    const t0 = prevScore ? prevScore._ts : 0;
    const t1 = scores[i]._ts;
    let batch = scans.filter((s) => s._ts > t0 && s._ts <= t1);

    if (batch.length === 0 && i === scores.length - 1 && scans.length > 0) {
      batch = [...scans];
    }

    const prevBatch = i > 0 ? runsChrono[i - 1].scanBatch : [];
    const counts = countsFromBatch(batch);
    const prevNum = prevScore && typeof prevScore.total_score === "number" ? prevScore.total_score : null;
    const curNum = typeof scores[i].total_score === "number" ? scores[i].total_score : null;
    const delta = prevNum != null && curNum != null ? curNum - prevNum : null;

    let diff = { newIssues: [], fixedIssues: [], regressed: [] };
    if (batch.length && prevBatch.length) {
      diff = diffBatches(prevBatch, batch);
    }

    runsChrono.push({
      key: scores[i].id || `run-${scores[i]._ts}`,
      domainName: domainName || "—",
      scoreRow: scores[i],
      scanBatch: batch,
      counts,
      delta,
      deltaLabel: delta === null ? "—" : delta > 0 ? `+${delta}` : String(delta),
      timeLabel: new Date(scores[i]._ts).toLocaleString(),
      status: "Completed",
      durationSincePrev: prevScore ? formatDuration(scores[i]._ts - prevScore._ts) : "—",
      ...diff,
    });
  }

  return [...runsChrono].reverse();
}

/**
 * @param {Record<string, unknown>[]} runs
 */
export function downloadHistoryCsv(runs) {
  const headers = [
    "Timestamp",
    "Domain",
    "Status",
    "Score",
    "Delta",
    "Since prev",
    "Critical",
    "Warnings",
    "Info",
    "Pass",
  ];
  const lines = [headers.join(",")];
  for (const r of runs) {
    const c = r.counts || {};
    const row = [
      `"${String(r.timeLabel || "").replace(/"/g, '""')}"`,
      `"${String(r.domainName || "").replace(/"/g, '""')}"`,
      String(r.status || ""),
      r.scoreRow?.total_score ?? "",
      r.deltaLabel ?? "",
      `"${String(r.durationSincePrev || "").replace(/"/g, '""')}"`,
      c.critical ?? "",
      c.warning ?? "",
      c.info ?? "",
      c.pass ?? "",
    ];
    lines.push(row.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vso-scan-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {Record<string, unknown>[]} runs
 */
export function downloadHistoryJson(runs) {
  const payload = {
    exported_at: new Date().toISOString(),
    runs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vso-scan-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
