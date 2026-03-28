import { useNavigate } from "react-router-dom";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs } from "../components/ui/tabs";
import { useDashboard } from "../context/DashboardContext";
import { severityClass } from "../utils/dashboardUtils";

export default function Alerts() {
  const navigate = useNavigate();
  const {
    crisisEvents,
    setCrisisEvents,
    handleRemediation,
    copyFinding,
    loadingData,
    activeTab,
    setActiveTab,
    filteredFindings,
    criticalCount,
    warningCount,
    passCount,
    handleFixAllCritical,
  } = useDashboard();

  return (
    <>
      {crisisEvents[0] && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/35 bg-red-950/50 px-4 py-3 text-red-100 shadow-lg shadow-red-950/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-lg font-bold text-red-300">
              !
            </span>
            <div>
              <p className="font-semibold text-red-50">Virtual Security Officer Crisis Alert</p>
              <p className="text-sm text-red-200/90">{crisisEvents[0].description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              onClick={() => {
                navigate("/chat");
                void handleRemediation(crisisEvents[0].finding);
              }}
            >
              View remediation guide
            </Button>
            <button
              className="rounded-lg px-2 py-1 text-sm text-red-300/80 hover:bg-red-900/50 hover:text-red-100"
              onClick={() => setCrisisEvents([])}
            >
              X
            </button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Findings</CardTitle>
          <Tabs tabs={["All", "Critical", "Warnings"]} activeTab={activeTab} onChange={setActiveTab} />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="danger">{criticalCount} Critical</Badge>
              <Badge variant="warning">{warningCount} Warnings</Badge>
              <Badge variant="success">{passCount} Passed</Badge>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                navigate("/chat");
                void handleFixAllCritical();
              }}
              disabled={!criticalCount}
            >
              Fix all critical issues
            </Button>
          </div>
          {loadingData && <p className="text-sm text-zinc-500">Loading findings...</p>}
          {!loadingData && filteredFindings.length === 0 && (
            <p className="text-sm text-zinc-500">No findings yet. Run a scan from Home.</p>
          )}
          {filteredFindings.map((finding, idx) => (
            <div
              key={finding.id}
              className={`animate-fade-in rounded-xl border border-zinc-700/80 border-l-4 bg-zinc-800/30 p-4 opacity-100 transition-all duration-500 ${severityClass(finding.severity)}`}
              style={{ transitionDelay: `${idx * 70}ms` }}
            >
              <div className="mb-1 flex items-center justify-between">
                <h4 className="font-semibold text-zinc-100">{finding.title}</h4>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    onClick={() => copyFinding(finding)}
                    title="Copy finding"
                  >
                    ⧉
                  </button>
                  <Badge variant={finding.severity === "critical" ? "danger" : finding.severity === "warning" ? "warning" : "success"}>
                    {finding.severity}
                  </Badge>
                </div>
              </div>
              <p className="mb-3 text-sm text-zinc-400">{finding.plain_english}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  navigate("/chat");
                  void handleRemediation(finding);
                }}
              >
                How to fix this →
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
