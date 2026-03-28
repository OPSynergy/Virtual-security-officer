import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { getRemediation, sendMessage } from "../api/chatApi";
import {
  getDemoResults,
  getRecentDomain,
  getScanResults,
  getScanStatus,
  getScore,
  getScoreHistory,
  startScan,
} from "../api/scanApi";
import { dedupeFindings, gradeFromScore, scoreColor } from "../utils/dashboardUtils";
import { useAuth } from "./AuthContext";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { isDemoMode, setDemoMode, authReady, session } = useAuth();
  const [currentDomain, setCurrentDomain] = useState("");
  const [domainId, setDomainId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [score, setScore] = useState(null);
  const [findings, setFindings] = useState([]);
  const [scanResultsRaw, setScanResultsRaw] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [crisisEvents, setCrisisEvents] = useState([]);
  const [activeTab, setActiveTab] = useState("All");
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [demoData, setDemoData] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [lastScanTaskOutcome, setLastScanTaskOutcome] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const scanStartRef = useRef(0);
  const scanPollInFlightRef = useRef(false);

  const severityRank = { critical: 0, warning: 1, info: 2, pass: 3 };
  const sortedFindings = useMemo(
    () => [...findings].sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)),
    [findings]
  );
  const filteredFindings = useMemo(() => {
    if (activeTab === "Critical") return sortedFindings.filter((f) => f.severity === "critical");
    if (activeTab === "Warnings") return sortedFindings.filter((f) => f.severity === "warning");
    return sortedFindings;
  }, [activeTab, sortedFindings]);

  const hasNumericScore = typeof score?.total_score === "number";
  const displayScore = hasNumericScore ? score.total_score : 0;
  const grade = hasNumericScore ? score?.grade || gradeFromScore(displayScore) : "—";
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const passCount = findings.filter((f) => f.severity === "pass").length;
  const showWelcomeCard = !domainId && !isScanning && !loadingData;
  const scoreRing = {
    background: hasNumericScore
      ? `conic-gradient(${scoreColor(animatedScore)} ${animatedScore}%, #3f3f46 ${animatedScore}% 100%)`
      : "#3f3f46",
  };

  useEffect(() => {
    if (!hasNumericScore) {
      setAnimatedScore(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 1500;
    const initial = 0;
    const target = displayScore;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(initial + (target - initial) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [displayScore, hasNumericScore]);

  async function refreshDomainData(targetDomainId, options = {}) {
    const { taskStatus } = options;
    setLoadingData(true);
    setError("");
    try {
      let scoreRes = await getScore(targetDomainId);
      if (scoreRes?.pending === true && taskStatus === "SUCCESS") {
        for (let i = 0; i < 8 && scoreRes?.pending === true; i++) {
          await new Promise((r) => setTimeout(r, 500));
          scoreRes = await getScore(targetDomainId);
        }
      }

      const [resultsRes, historyRes] = await Promise.all([
        getScanResults(targetDomainId),
        getScoreHistory(targetDomainId),
      ]);
      setScanResultsRaw(Array.isArray(resultsRes) ? resultsRes : []);

      const scoreReady =
        scoreRes && scoreRes.pending !== true && typeof scoreRes.total_score === "number";
      if (scoreReady) {
        setScore({
          ...scoreRes,
          grade: gradeFromScore(scoreRes.total_score),
        });
      } else {
        setScore(null);
      }

      setScoreHistory(
        historyRes
          .map((item) => ({
            ...item,
            date: new Date(item.created_at).toLocaleDateString(),
          }))
          .reverse()
      );

      const normalizedFindings = [];
      resultsRes.forEach((result) => {
        (result.raw_data?.findings || []).forEach((finding, idx) => {
          normalizedFindings.push({
            id: `${result.id}-${idx}`,
            scan_type: result.scan_type,
            severity: finding.severity || result.severity || "info",
            title: finding.title || "Virtual Security Officer finding",
            plain_english:
              finding.plain_english || "Virtual Security Officer identified a security issue requiring review.",
            description: finding.description || "",
          });
        });
      });
      const uniqueFindings = dedupeFindings(normalizedFindings);
      setFindings(uniqueFindings);

      const criticals = uniqueFindings.filter((f) => f.severity === "critical");
      setCrisisEvents(
        criticals.slice(0, 1).map((f) => ({
          id: f.id,
          description: `Virtual Security Officer crisis detected: ${f.title}`,
          finding: f,
        }))
      );
    } catch (err) {
      setError(err?.response?.data?.detail || "Virtual Security Officer failed to load scan data.");
    } finally {
      setLoadingData(false);
    }
  }

  async function loadDemoData() {
    setLoadingData(true);
    setError("");
    try {
      const demo = await getDemoResults();
      setDemoData(demo);
      setDomainId(demo.domain_id);
      setCurrentDomain(demo.domain_name);
      setScore(demo.score);
      setScanResultsRaw(Array.isArray(demo.results) ? demo.results : []);
      const hist = demo.history || [];
      setScoreHistory(
        [...hist]
          .map((item) => ({
            ...item,
            date: item.date || (item.created_at ? new Date(item.created_at).toLocaleDateString() : undefined),
          }))
          .reverse()
      );
      const normalizedFindings = [];
      (demo.results || []).forEach((result) => {
        (result.raw_data?.findings || []).forEach((finding, idx) => {
          normalizedFindings.push({
            id: `${result.id}-${idx}`,
            scan_type: result.scan_type,
            severity: finding.severity || result.severity || "info",
            title: finding.title || "Virtual Security Officer finding",
            plain_english:
              finding.plain_english || "Virtual Security Officer identified a security issue requiring review.",
            description: finding.description || "",
          });
        });
      });
      const uniqueFindings = dedupeFindings(normalizedFindings);
      setFindings(uniqueFindings);
      const critical = uniqueFindings.find((f) => f.severity === "critical");
      setCrisisEvents(
        critical
          ? [{ id: critical.id, description: `Virtual Security Officer crisis detected: ${critical.title}`, finding: critical }]
          : []
      );
      setChatMessages([]);
    } catch {
      setError("Virtual Security Officer could not load demo data.");
    } finally {
      setLoadingData(false);
    }
  }

  async function handleStartScan() {
    if (isDemoMode) return;
    if (!currentDomain.trim()) return;
    setError("");
    try {
      const res = await startScan(currentDomain.trim().toLowerCase());
      setDomainId(res.domain_id);
      setTaskId(res.task_id);
      setLastScanTaskOutcome(null);
      setIsScanning(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Virtual Security Officer could not start the scan.");
    }
  }

  useEffect(() => {
    if (!isScanning || !taskId || !domainId) {
      setScanProgress(0);
      return;
    }
    scanStartRef.current = Date.now();
    setScanProgress(5);

    const tick = async () => {
      if (scanPollInFlightRef.current) return;
      scanPollInFlightRef.current = true;
      const elapsed = Date.now() - scanStartRef.current;
      const timeBased = 5 + 90 * (1 - Math.exp(-elapsed / 18000));

      try {
        const statusRes = await getScanStatus(taskId);
        const st = statusRes?.status || "PENDING";
        let combined = timeBased;
        if (st === "PENDING") combined = Math.max(combined, 12);
        else if (st === "STARTED" || st === "RETRY") combined = Math.max(combined, 38);
        else if (st === "PROGRESS") combined = Math.max(combined, 55);

        if (st === "SUCCESS") {
          setScanProgress(100);
          setLastScanTaskOutcome(st);
          setIsScanning(false);
          await refreshDomainData(domainId, { taskStatus: st });
          setScanProgress(0);
          return;
        }
        if (st === "FAILURE") {
          setScanProgress(0);
          setLastScanTaskOutcome(st);
          setIsScanning(false);
          await refreshDomainData(domainId, { taskStatus: st });
          return;
        }

        setScanProgress(Math.min(95, combined));
      } catch {
        setIsScanning(false);
        setScanProgress(0);
      } finally {
        scanPollInFlightRef.current = false;
      }
    };

    tick();
    const timer = setInterval(() => {
      void tick();
    }, 600);
    return () => {
      clearInterval(timer);
    };
  }, [isScanning, taskId, domainId]);

  useEffect(() => {
    if (isDemoMode) {
      loadDemoData();
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (!authReady || isDemoMode || !session || domainId) return;
    let cancelled = false;
    async function restoreLastDomain() {
      try {
        const recent = await getRecentDomain();
        if (!recent?.domain_id || cancelled) return;
        setDomainId(recent.domain_id);
        setCurrentDomain(recent.domain_name || "");
        await refreshDomainData(recent.domain_id);
      } catch {
        // Ignore restore failures; user can still start scans manually.
      }
    }
    restoreLastDomain();
    return () => {
      cancelled = true;
    };
  }, [authReady, isDemoMode, session, domainId]);

  function buildDemoChatReply(userQuestion) {
    const contextText = [
      "Virtual Security Officer demo context:",
      `Domain: ${demoData?.domain_name || "demo-company.com"}`,
      `Score: ${demoData?.score?.total_score || 38}/100`,
      ...findings.slice(0, 3).map((f) => `- ${f.title}: ${f.plain_english}`),
      "",
      `User question: ${userQuestion}`,
    ].join("\n");
    return (
      `${contextText}\n\n` +
      "Top priority actions from Virtual Security Officer:\n" +
      "1. Close public database access on port 3306 and allow only private network paths.\n" +
      "2. Publish DMARC and tighten SPF by removing +all.\n" +
      "3. Restrict exposed admin and staging subdomains behind VPN or identity-aware access."
    );
  }

  async function handleSendMessage() {
    await sendChatMessage(chatInput.trim());
  }

  async function sendChatMessage(messageText) {
    if (!messageText || !domainId) return;
    const userMsg = { role: "user", content: messageText };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setIsChatStreaming(true);
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    try {
      if (isDemoMode) {
        const demoReply = buildDemoChatReply(userMsg.content);
        for (const token of demoReply.split(" ")) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          setChatMessages((prev) => {
            const cloned = [...prev];
            cloned[cloned.length - 1] = {
              ...cloned[cloned.length - 1],
              content: `${cloned[cloned.length - 1].content}${token} `,
            };
            return cloned;
          });
        }
        setIsChatStreaming(false);
        return;
      }
      await sendMessage(
        domainId,
        userMsg.content,
        updated.map((m) => ({ role: m.role, content: m.content })),
        (chunk) => {
          setChatMessages((prev) => {
            const cloned = [...prev];
            cloned[cloned.length - 1] = {
              ...cloned[cloned.length - 1],
              content: `${cloned[cloned.length - 1].content}${chunk}`,
            };
            return cloned;
          });
        }
      );
    } catch {
      setChatMessages((prev) => {
        const cloned = [...prev];
        cloned[cloned.length - 1] = {
          role: "assistant",
          content: "Virtual Security Officer could not answer right now. Please try again.",
        };
        return cloned;
      });
    } finally {
      setIsChatStreaming(false);
    }
  }

  async function handleQuickAction(message) {
    await sendChatMessage(message);
  }

  async function handleFixAllCritical() {
    await sendChatMessage(
      "As my Virtual Security Officer, give me a priority action plan to fix all my critical security issues"
    );
  }

  async function copyFinding(finding) {
    try {
      await navigator.clipboard.writeText(finding.plain_english);
    } catch {
      setError("Virtual Security Officer could not copy finding text.");
    }
  }

  async function handleRemediation(finding) {
    if (!domainId) return;
    setIsChatStreaming(true);
    try {
      if (isDemoMode) {
        const text = [
          `Virtual Security Officer remediation for "${finding.title}":`,
          "",
          "1. Assign this item to your web developer and set a target completion date this week.",
          "2. Implement the fix in staging first and verify business-critical pages still work.",
          "3. Deploy to production and run another Virtual Security Officer scan to confirm closure.",
          "",
          "Estimated time: 2-4 hours",
          "Difficulty: medium",
        ].join("\n");
        setChatMessages((prev) => [...prev, { role: "assistant", content: text }]);
        setIsChatStreaming(false);
        return;
      }
      const response = await getRemediation(domainId, finding.title, finding.scan_type);
      const text = [
        `Virtual Security Officer remediation for "${finding.title}":`,
        "",
        ...(response.steps || []).map((step, i) => `${i + 1}. ${step}`),
        "",
        `Estimated time: ${response.estimated_time}`,
        `Difficulty: ${response.difficulty}`,
      ].join("\n");
      setChatMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } catch (err) {
      let detail = "Virtual Security Officer could not load remediation guidance.";
      const d = err?.response?.data?.detail;
      if (typeof d === "string") detail = d;
      else if (Array.isArray(d) && d.length) detail = d.map((x) => x.msg || JSON.stringify(x)).join(" ");
      setChatMessages((prev) => [...prev, { role: "assistant", content: detail }]);
    } finally {
      setIsChatStreaming(false);
    }
  }

  const value = {
    currentDomain,
    setCurrentDomain,
    domainId,
    isScanning,
    scanProgress,
    taskId,
    score,
    findings,
    scanResultsRaw,
    scoreHistory,
    chatMessages,
    setChatMessages,
    crisisEvents,
    setCrisisEvents,
    activeTab,
    setActiveTab,
    isChatStreaming,
    chatInput,
    setChatInput,
    error,
    setError,
    loadingData,
    showDemoBanner,
    setShowDemoBanner,
    demoData,
    animatedScore,
    lastScanTaskOutcome,
    sortedFindings,
    filteredFindings,
    hasNumericScore,
    displayScore,
    grade,
    criticalCount,
    warningCount,
    passCount,
    showWelcomeCard,
    scoreRing,
    isDemoMode,
    setDemoMode,
    refreshDomainData,
    loadDemoData,
    handleStartScan,
    handleSendMessage,
    sendChatMessage,
    handleQuickAction,
    handleFixAllCritical,
    copyFinding,
    handleRemediation,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("Virtual Security Officer DashboardContext is not available.");
  }
  return ctx;
}
