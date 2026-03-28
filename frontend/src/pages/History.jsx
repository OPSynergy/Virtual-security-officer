import { Fragment, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useDashboard } from "../context/DashboardContext";
import { buildScanRuns, downloadHistoryCsv, downloadHistoryJson, parseScoreTime } from "../utils/historyRuns";
import { scoreColor } from "../utils/dashboardUtils";

export default function History() {
  const navigate = useNavigate();
  const {
    scoreHistory,
    displayScore,
    hasNumericScore,
    currentDomain,
    domainId,
    scanResultsRaw,
    loadingData,
    handleStartScan,
    isScanning,
    isDemoMode,
  } = useDashboard();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set());

  const runs = useMemo(
    () => buildScanRuns(scoreHistory, scanResultsRaw, currentDomain),
    [scoreHistory, scanResultsRaw, currentDomain]
  );

  const filteredRuns = useMemo(() => {
    let list = runs;
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    if (fromTs != null && !Number.isNaN(fromTs)) {
      list = list.filter((r) => {
        const t = parseScoreTime(r.scoreRow);
        return !Number.isNaN(t) && t >= fromTs;
      });
    }
    if (toTs != null && !Number.isNaN(toTs)) {
      list = list.filter((r) => {
        const t = parseScoreTime(r.scoreRow);
        return !Number.isNaN(t) && t <= toTs;
      });
    }
    if (statusFilter === "completed") {
      list = list.filter((r) => r.status === "Completed");
    }
    if (severityFilter === "critical") {
      list = list.filter((r) => (r.counts?.critical || 0) > 0);
    } else if (severityFilter === "warning") {
      list = list.filter((r) => (r.counts?.warning || 0) > 0);
    } else if (severityFilter === "info") {
      list = list.filter((r) => (r.counts?.info || 0) > 0);
    }
    return list;
  }, [runs, dateFrom, dateTo, severityFilter, statusFilter]);

  function toggleExpanded(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openInChat(run) {
    const t = run.timeLabel || "";
    const score = run.scoreRow?.total_score ?? "—";
    const prompt = `Virtual Security Officer: discuss the scan from ${t} for ${run.domainName} (score ${score}). Summarize risks and next steps.`;
    navigate("/chat", { state: { historyPrompt: prompt } });
  }

  const chartData = scoreHistory || [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">From date</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">To date</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="w-full sm:w-56">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Domain</label>
            <Input value={currentDomain || ""} placeholder="Run a scan on Home first" readOnly className="text-zinc-400" />
          </div>
          <div className="w-full sm:w-44">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Status</label>
            <select
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="w-full sm:w-44">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Finding severity</label>
            <select
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSeverityFilter("all");
                setStatusFilter("all");
              }}
            >
              Reset filters
            </Button>
            <Button type="button" variant="secondary" onClick={() => downloadHistoryCsv(filteredRuns)} disabled={!filteredRuns.length}>
              Export CSV
            </Button>
            <Button type="button" onClick={() => downloadHistoryJson(filteredRuns)} disabled={!filteredRuns.length}>
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security score trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[min(420px,70vh)] min-h-[280px]">
          {!chartData.length ? (
            <p className="text-sm text-zinc-500">No score history yet. Complete a scan to see trends.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#52525b" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#52525b" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "8px",
                    color: "#e4e4e7",
                  }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Line
                  type="monotone"
                  dataKey="total_score"
                  stroke={hasNumericScore ? scoreColor(displayScore) : "#71717a"}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#18181b", strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Scan history</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isScanning || isDemoMode || !currentDomain?.trim()}
              onClick={() => handleStartScan()}
              title={isDemoMode ? "Exit demo mode on Home to run a live scan" : ""}
            >
              {isScanning ? "Scanning…" : "Rerun scan"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingData && <p className="mb-3 text-sm text-zinc-500">Loading history…</p>}
          {!domainId && (
            <p className="text-sm text-zinc-500">Enter a domain and run a scan on Home to populate history.</p>
          )}
          {domainId && !filteredRuns.length && !loadingData && (
            <p className="text-sm text-zinc-500">No rows match the current filters.</p>
          )}
          {!!filteredRuns.length && (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2"> </th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Domain</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Δ vs prev</th>
                    <th className="px-3 py-2">Since prev</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => {
                    const key = String(run.key);
                    const isOpen = expanded.has(key);
                    const c = run.counts || {};
                    const topIssues = [];
                    for (const row of run.scanBatch || []) {
                      for (const f of row.raw_data?.findings || []) {
                        topIssues.push({ title: f.title, scan_type: row.scan_type });
                        if (topIssues.length >= 8) break;
                      }
                      if (topIssues.length >= 8) break;
                    }
                    return (
                      <Fragment key={key}>
                        <tr className="border-b border-zinc-800/80 hover:bg-zinc-900/40">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="rounded px-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                              onClick={() => toggleExpanded(key)}
                              aria-expanded={isOpen}
                            >
                              {isOpen ? "▼" : "▶"}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-zinc-200">{run.timeLabel}</td>
                          <td className="px-3 py-2 text-zinc-300">{run.domainName}</td>
                          <td className="px-3 py-2">
                            <Badge variant="success">{run.status}</Badge>
                          </td>
                          <td className="px-3 py-2 font-semibold text-zinc-100">{run.scoreRow?.total_score ?? "—"}</td>
                          <td className="px-3 py-2 text-zinc-300">{run.deltaLabel}</td>
                          <td className="px-3 py-2 text-zinc-400">{run.durationSincePrev}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => openInChat(run)}>
                                AI Chat
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="!px-2 !py-1 text-xs"
                                onClick={() => downloadHistoryCsv([run])}
                              >
                                Row CSV
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-zinc-800 bg-zinc-950/50">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Finding counts (this snapshot)</p>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="danger">{c.critical ?? 0} Critical</Badge>
                                    <Badge variant="warning">{c.warning ?? 0} Warnings</Badge>
                                    <Badge variant="default">{c.info ?? 0} Info</Badge>
                                    <Badge variant="success">{c.pass ?? 0} Passed</Badge>
                                  </div>
                                  {!run.scanBatch?.length && (
                                    <p className="mt-3 text-sm text-zinc-500">
                                      No scanner module rows stored for this snapshot window (older scores may predate saved results).
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Change vs previous snapshot</p>
                                  <ul className="space-y-1 text-sm text-zinc-400">
                                    <li>
                                      <span className="text-emerald-400/90">New: </span>
                                      {(run.newIssues || []).length
                                        ? (run.newIssues || []).map((x) => x.title).join("; ")
                                        : "—"}
                                    </li>
                                    <li>
                                      <span className="text-cyan-400/90">Resolved / gone: </span>
                                      {(run.fixedIssues || []).length
                                        ? (run.fixedIssues || []).map((x) => x.title).join("; ")
                                        : "—"}
                                    </li>
                                    <li>
                                      <span className="text-amber-400/90">Regressed: </span>
                                      {(run.regressed || []).length
                                        ? (run.regressed || []).map((x) => `${x.title} (${x.was} → ${x.severity})`).join("; ")
                                        : "—"}
                                    </li>
                                  </ul>
                                </div>
                              </div>
                              {!!run.scanBatch?.length && (
                                <div className="mt-4">
                                  <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Top issues in this run</p>
                                  <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
                                    {topIssues.map((item, idx) => (
                                      <li key={`${key}-issue-${idx}`}>
                                        <span className="font-medium text-zinc-100">{item.title}</span>
                                        <span className="text-zinc-500"> — {item.scan_type}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
