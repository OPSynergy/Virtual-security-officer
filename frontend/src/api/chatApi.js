import client from "./client";

export async function sendMessage(domainId, message, history, onChunk) {
  const response = await fetch("/api/chat/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: localStorage.getItem("vsoToken") || "",
    },
    body: JSON.stringify({
      domain_id: domainId,
      message,
      conversation_history: history,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Virtual Security Officer chat stream failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      if (!event.startsWith("data: ")) continue;
      const payloadText = event.slice(6).trim();
      if (!payloadText) continue;
      const payload = JSON.parse(payloadText);
      if (payload.done) return;
      if (payload.content) onChunk(payload.content);
    }
  }
}

export async function getRemediation(domainId, findingTitle, findingType) {
  const response = await client.post("/chat/remediate", {
    domain_id: domainId,
    finding_title: findingTitle,
    finding_type: findingType,
  });
  return response.data;
}

/** Past chats stored in project-root vso.db (SQLite) via backend. */
export async function listSavedChats() {
  const { data } = await client.get("/chat/chats");
  return data;
}

export async function saveChatToDb(domainName, messages) {
  const { data } = await client.post("/chat/chats", {
    domain_name: domainName || null,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return data;
}

export async function deleteSavedChat(chatId) {
  await client.delete(`/chat/chats/${chatId}`);
}

export async function getSavedChatMessages(chatId) {
  const { data } = await client.get(`/chat/chats/${chatId}/messages`);
  return data.messages;
}
