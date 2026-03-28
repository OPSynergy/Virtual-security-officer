import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import policemanIcon from "../assets/policeman.png";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useDashboard } from "../context/DashboardContext";
import { formatDate } from "../utils/dashboardUtils";

const ASSISTANT_MESSAGE = "Hi, I'm your AI Agent — How may I help you?";

export default function Home() {
  const {
    currentDomain,
    setCurrentDomain,
    domainId,
    isScanning,
    scanProgress,
    score,
    loadingData,
    error,
    hasNumericScore,
    animatedScore,
    grade,
    displayScore,
    lastScanTaskOutcome,
    isDemoMode,
    handleStartScan,
    scoreRing,
  } = useDashboard();

  const scanPhaseLabel = useMemo(() => {
    const p = scanProgress;
    if (!isScanning) return "";
    if (p < 18) return "Queuing scan…";
    if (p < 38) return "SSL & certificate checks…";
    if (p < 58) return "DNS & email security…";
    if (p < 78) return "HTTP headers & exposed ports…";
    return "Computing score & saving results…";
  }, [isScanning, scanProgress]);

  const showHeroScore = !isScanning && hasNumericScore;

  const [typedAssistant, setTypedAssistant] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timeoutId;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setTypedAssistant(ASSISTANT_MESSAGE.slice(0, i));
      if (i < ASSISTANT_MESSAGE.length) {
        timeoutId = window.setTimeout(tick, 42);
      }
    };
    timeoutId = window.setTimeout(tick, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>
      )}

      <div className="mx-auto mb-10 max-w-lg px-1">
        <h1 className="text-center text-3xl font-bold uppercase tracking-[0.12em] text-zinc-50 sm:text-4xl">
          Enter your domain
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">Scan your site for SSL, DNS, email, headers, and ports.</p>

        <Input
          className="mt-8 h-12 text-base"
          value={currentDomain}
          onChange={(e) => setCurrentDomain(e.target.value)}
          placeholder="example.com"
          disabled={isDemoMode}
          onKeyDown={(e) => e.key === "Enter" && !isScanning && handleStartScan()}
        />

        <Button
          className="mt-4 h-12 w-full rounded-lg text-base font-semibold"
          disabled={isScanning || isDemoMode || !currentDomain.trim()}
          onClick={() => handleStartScan()}
        >
          {isScanning ? "Scanning…" : "Scan now"}
        </Button>

        {isScanning && (
          <div className="mt-6 text-left">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span className="truncate">{scanPhaseLabel}</span>
              <span className="shrink-0 tabular-nums text-zinc-400">{Math.round(scanProgress)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-md bg-zinc-800 ring-1 ring-zinc-700/80">
              <div
                className="h-full rounded-md bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, scanProgress))}%` }}
              />
            </div>
          </div>
        )}

        {showHeroScore && (
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="relative h-52 w-52 shrink-0 rounded-full p-2 sm:h-56 sm:w-56" style={scoreRing}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-900 text-5xl font-bold tabular-nums text-zinc-50 shadow-inner shadow-black/40 sm:text-6xl">
                {animatedScore}
              </div>
            </div>
            <Badge
              variant={displayScore >= 80 ? "success" : displayScore >= 50 ? "warning" : "danger"}
              className="mt-5 text-sm"
            >
              Grade {grade}
            </Badge>
            <p className="mt-2 text-sm text-zinc-500">Last scanned: {formatDate(score?.created_at)}</p>
          </div>
        )}
      </div>

      {!isDemoMode &&
        domainId &&
        !isScanning &&
        !loadingData &&
        !score &&
        lastScanTaskOutcome === "FAILURE" && (
          <div className="mb-6 rounded-lg border border-amber-500/25 bg-amber-950/30 p-3 text-sm text-amber-200/90">
            The scan did not finish successfully. Ensure the Celery worker and Redis are running, then try again.
          </div>
        )}
      {!isDemoMode &&
        domainId &&
        !isScanning &&
        !loadingData &&
        !score &&
        lastScanTaskOutcome === "SUCCESS" && (
          <div className="mb-6 rounded-lg border border-amber-500/25 bg-amber-950/30 p-3 text-sm text-amber-200/90">
            The scan reported success but no score was found yet. Refresh or run the scan again.
          </div>
        )}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Security breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {[
              ["SSL", score?.ssl_score || 0, 25],
              ["Email", score?.email_score || 0, 20],
              ["Headers", score?.headers_score || 0, 20],
              ["DNS", score?.dns_score || 0, 20],
              ["Ports", score?.ports_score || 0, 15],
            ].map(([label, value, max]) => (
              <div key={label}>
                <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
                <div className="h-16 rounded-lg bg-zinc-800/80 p-1.5 ring-1 ring-zinc-700/50 sm:h-20 sm:p-2">
                  <div
                    className="rounded bg-gradient-to-t from-cyan-600 to-cyan-400"
                    style={{ height: `${Math.max(6, (Number(value) / Number(max)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-zinc-400 sm:text-xs">
                  {value}/{max}
                </p>
              </div>
            ))}
          </div>
          {!hasNumericScore && !isScanning && (
            <p className="mt-4 text-sm text-zinc-500">Run a scan to see category scores.</p>
          )}
        </CardContent>
      </Card>

      <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-[min(100vw-1.5rem,calc(100vw-2rem))] flex-row items-end gap-3 sm:bottom-6 sm:right-6">
        <div
          className="pointer-events-auto max-w-[min(18rem,calc(100vw-7rem))] rounded-2xl border border-zinc-700/80 bg-zinc-900/95 px-3.5 py-2.5 text-sm leading-snug text-zinc-200 shadow-xl shadow-black/40 ring-1 ring-zinc-800/80 backdrop-blur-sm"
          aria-live="polite"
        >
          <span>{typedAssistant}</span>
          {typedAssistant.length < ASSISTANT_MESSAGE.length && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cyan-400/90 align-middle" aria-hidden />
          )}
        </div>
        <Link
          to="/chat"
          className="pointer-events-auto animate-vso-mascot-bounce shrink-0 rounded-2xl border border-cyan-500/30 bg-zinc-900/90 p-1.5 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/20 transition hover:border-cyan-400/50 hover:ring-cyan-400/30"
          title="Open AI Chat"
          aria-label="Open AI Chat — Virtual Security Officer"
        >
          <img
            src={policemanIcon}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 select-none object-contain"
            draggable={false}
          />
        </Link>
      </div>
    </>
  );
}
