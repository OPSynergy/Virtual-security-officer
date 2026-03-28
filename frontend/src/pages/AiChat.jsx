import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  deleteSavedChat,
  getSavedChatMessages,
  listSavedChats,
  saveChatToDb,
} from "../api/chatApi";
import ChatMarkdown from "../components/ChatMarkdown";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { useDashboard } from "../context/DashboardContext";

const PAST_CHATS_STORAGE_KEY = "vso-past-chats-v1";

const QUICK_CHIPS = ["What's my biggest risk?", "How do I fix my email security?", "Explain my score", "What should I do first?"];

function loadPastChatsLocal() {
  try {
    const raw = localStorage.getItem(PAST_CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePastChatsListLocal(list) {
  localStorage.setItem(PAST_CHATS_STORAGE_KEY, JSON.stringify(list.slice(0, 25)));
}

function previewFromMessages(messages) {
  const first = messages.find((m) => m.role === "user");
  const text = (first?.content || "").trim() || "Saved conversation";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export default function AiChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isDemoMode } = useAuth();
  const {
    chatMessages,
    setChatMessages,
    isChatStreaming,
    chatInput,
    setChatInput,
    handleSendMessage,
    handleQuickAction,
    domainId,
    currentDomain,
  } = useDashboard();

  const [pastOpen, setPastOpen] = useState(false);
  const [pastList, setPastList] = useState([]);
  const [pastSource, setPastSource] = useState("local");

  const useServerPast = Boolean(session && !isDemoMode);

  const refreshPastList = useCallback(async () => {
    if (useServerPast) {
      try {
        const rows = await listSavedChats();
        setPastSource("server");
        setPastList(
          rows.map((r) => ({
            id: r.id,
            preview: r.preview,
            savedAt: r.created_at,
            domainLabel: r.domain_name?.trim() || "Your domain",
            source: "server",
          }))
        );
        return;
      } catch {
        /* fall through */
      }
    }
    setPastSource("local");
    setPastList(loadPastChatsLocal());
  }, [useServerPast]);

  useEffect(() => {
    refreshPastList();
  }, [refreshPastList]);

  useEffect(() => {
    const prompt = location.state?.historyPrompt;
    if (typeof prompt === "string" && prompt.trim()) {
      setChatInput(prompt);
    }
  }, [location.state, setChatInput]);

  useEffect(() => {
    if (!location.state?.openPastChats) return;
    setPastOpen(true);
    const next = { ...(location.state || {}) };
    delete next.openPastChats;
    navigate(".", { replace: true, state: Object.keys(next).length ? next : null });
  }, [location.state, navigate]);

  useEffect(() => {
    if (pastOpen) refreshPastList();
  }, [pastOpen, refreshPastList]);

  async function handleSaveCurrentChat() {
    if (!chatMessages.length || isChatStreaming) return;
    const payload = chatMessages.map((m) => ({ role: m.role, content: m.content }));

    if (useServerPast) {
      try {
        await saveChatToDb(currentDomain?.trim() || null, payload);
        await refreshPastList();
        return;
      } catch {
        /* fallback to local */
      }
    }

    const entry = {
      id: Date.now(),
      savedAt: new Date().toISOString(),
      domainLabel: currentDomain?.trim() || "Your domain",
      preview: previewFromMessages(chatMessages),
      messages: payload,
      source: "local",
    };
    const next = [entry, ...loadPastChatsLocal()].slice(0, 25);
    savePastChatsListLocal(next);
    setPastSource("local");
    setPastList(next);
  }

  async function handleLoadPast(entry) {
    if (entry.source === "server") {
      try {
        const msgs = await getSavedChatMessages(entry.id);
        setChatMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
      } catch {
        return;
      }
    } else {
      setChatMessages(entry.messages.map((m) => ({ role: m.role, content: m.content })));
    }
    setPastOpen(false);
  }

  async function handleRemovePast(entry, e) {
    e.stopPropagation();
    if (entry.source === "server") {
      try {
        await deleteSavedChat(entry.id);
        await refreshPastList();
      } catch {
        /* ignore */
      }
    } else {
      const next = loadPastChatsLocal().filter((x) => x.id !== entry.id);
      savePastChatsListLocal(next);
      setPastList(next);
    }
  }

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>Virtual Security Officer AI Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-[min(560px,calc(100vh-12rem))] flex-col">
        <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-3">
          {chatMessages.length === 0 && (
            <p className="text-sm text-zinc-500">Ask your Virtual Security Officer about your latest findings.</p>
          )}
          {chatMessages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`max-w-[85%] rounded-xl p-3 ${
                msg.role === "user"
                  ? "ml-auto border border-cyan-500/30 bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-900/20"
                  : "border border-zinc-700 bg-zinc-800/80 text-zinc-200"
              }`}
            >
              <ChatMarkdown variant={msg.role === "user" ? "user" : "assistant"}>{msg.content}</ChatMarkdown>
            </div>
          ))}
          {isChatStreaming && (
            <div className="inline-flex gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400/80" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400/80 [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400/80 [animation-delay:240ms]" />
            </div>
          )}
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="rounded-full border border-zinc-600 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-cyan-500/40 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => handleQuickAction(chip)}
              disabled={isChatStreaming || !domainId}
            >
              {chip}
            </button>
          ))}
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              pastOpen
                ? "border-cyan-400/60 bg-cyan-950/50 text-cyan-100"
                : "border-cyan-700/50 bg-cyan-950/30 text-cyan-200/90 hover:border-cyan-500/50 hover:bg-cyan-950/40"
            }`}
            onClick={() => setPastOpen((v) => !v)}
          >
            Past chats
          </button>
        </div>
        {pastOpen && (
          <div className="mb-3 rounded-xl border border-zinc-700/90 bg-zinc-900/90 p-3 shadow-inner">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-400">
                {pastSource === "server" ? "Saved in vso.db (per signed-in user)" : "Saved on this device (demo / offline)"}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="h-8 text-xs"
                onClick={() => void handleSaveCurrentChat()}
                disabled={!chatMessages.length || isChatStreaming}
              >
                Save current chat
              </Button>
            </div>
            {pastList.length === 0 ? (
              <p className="text-xs text-zinc-500">No saved chats yet. Have a conversation, then use “Save current chat”.</p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                {pastList.map((entry) => (
                  <li key={`${entry.source}-${entry.id}`}>
                    <div className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2 transition hover:border-zinc-600">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-xs"
                        onClick={() => void handleLoadPast(entry)}
                      >
                        <span className="line-clamp-2 font-medium text-zinc-200">{entry.preview}</span>
                        <span className="mt-0.5 block text-[10px] text-zinc-500">
                          {entry.domainLabel || "Domain"} ·{" "}
                          {entry.savedAt
                            ? new Date(entry.savedAt).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded px-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        onClick={(e) => void handleRemovePast(entry, e)}
                        aria-label="Remove saved chat"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask your Virtual Security Officer..."
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <Button onClick={handleSendMessage} disabled={isChatStreaming || !domainId}>
            Send
          </Button>
        </div>
        <div className="mt-3 flex justify-end">
          <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] text-zinc-500">
            Powered by Google Gemini
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
