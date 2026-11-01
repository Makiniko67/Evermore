// Evermore 0.1 — Lumiverse Spindle backend
// This starter records chat messages and supports archive/note RPC.
// AI scene analysis is intentionally opt-in and runs only after assistant replies.


const PREFIX = "evermore/";


function safeId(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
}
async function readJson(path, fallback) {
  try { return await spindle.storage.getJson(path, { fallback }); }
  catch { return fallback; }
}
async function writeJson(path, value) {
  await spindle.storage.setJson(path, value, { indent: 2 });
}
async function getArchive(chatId) {
  return await readJson(`${PREFIX}chats/${safeId(chatId)}.json`, {
    chatId, messages: [], scenes: [], notes: [], updatedAt: Date.now()
  });
}
async function saveArchive(archive) {
  archive.updatedAt = Date.now();
  await writeJson(`${PREFIX}chats/${safeId(archive.chatId)}.json`, archive);
}
function send(userId, payload) {
  spindle.sendToFrontend(payload, userId);
}

async function syncChatMessages(chatId) {
  try {
    const messages = await spindle.chat.getMessages(chatId);
    const archive = await getArchive(chatId);
    for (const msg of (messages || []).slice(-500)) {
      const id = String(msg.id ?? `${chatId}-${archive.messages.length}`);
      if (archive.messages.some(m => m.id === id)) continue;
      archive.messages.push({
        id,
        role: msg.role || (msg.is_user ? "user" : "assistant"),
        name: msg.name || "",
        content: String(msg.content || ""),
        timestamp: msg.created_at || Date.now()
      });
    }
    archive.messages = archive.messages.slice(-500);
    await saveArchive(archive);
  } catch (err) {
    spindle.log.warn(`[Evermore] chat sync unavailable: ${err?.message ?? err}`);
  }
}

spindle.on("CHARACTER_MESSAGE_RENDERED", async (payload) => {
  if (payload?.chatId) await syncChatMessages(payload.chatId);
});

spindle.on("MESSAGE_SENT", async (payload) => {
  try {
    const chatId = payload?.chatId;
    const msg = payload?.message;
    if (!chatId || !msg) return;
    const archive = await getArchive(chatId);
    const id = String(msg.id ?? `${Date.now()}-${archive.messages.length}`);
    if (!archive.messages.some((m) => m.id === id)) {
      archive.messages.push({
        id, role: msg.is_user ? "user" : "assistant",
        name: msg.name ?? "", content: String(msg.content ?? ""),
        timestamp: Date.now()
      });
      // Keep the raw event ledger bounded; scene summaries are stored separately.
      archive.messages = archive.messages.slice(-500);
      await saveArchive(archive);
    }
  } catch (err) {
    spindle.log.error(`[Evermore] message capture failed: ${err?.message ?? err}`);
  }
});

spindle.onFrontendMessage(async (payload, userId) => {
  try {
    if (payload?.type === "evermore:get-active") {
      const active = await spindle.chats.getActive();
      send(userId, { type: "evermore:active-chat", requestId: payload.requestId, chatId: active?.id || null, chatName: active?.name || "" });
    }
    if (payload?.type === "evermore:get-connections") {
      const connections = await spindle.connections.list();
      send(userId, { type: "evermore:connections", requestId: payload.requestId,
        connections: (connections || []).map((c) => ({ id: c.id, name: c.name, provider: c.provider, model: c.model, active: c.is_default })) });
    }
    if (payload?.type === "evermore:get") {
      const archive = await getArchive(payload.chatId);
      send(userId, { type: "evermore:archive", requestId: payload.requestId, archive });
    }
    if (payload?.type === "evermore:save-note") {
      const archive = await getArchive(payload.chatId);
      const note = {
        id: payload.note?.id || `note-${Date.now()}`,
        title: String(payload.note?.title || "Untitled note").slice(0, 160),
        body: String(payload.note?.body || "").slice(0, 12000),
        updatedAt: Date.now()
      };
      const index = archive.notes.findIndex((n) => n.id === note.id);
      if (index >= 0) archive.notes[index] = note;
      else archive.notes.unshift(note);
      await saveArchive(archive);
      send(userId, { type: "evermore:saved", requestId: payload.requestId, archive });
    }
    if (payload?.type === "evermore:delete-note") {
      const archive = await getArchive(payload.chatId);
      archive.notes = archive.notes.filter((n) => n.id !== payload.noteId);
      await saveArchive(archive);
      send(userId, { type: "evermore:archive", requestId: payload.requestId, archive });
    }
    if (payload?.type === "evermore:analyse") {
      const archive = await getArchive(payload.chatId);
      const recent = archive.messages.slice(-24);
      if (!recent.length) throw new Error("No captured messages yet.");
      const mode = payload.mode === "separate" ? "separate" : "current";
      let connectionId;
      if (mode === "separate") {
        connectionId = payload.connectionId;
        if (!connectionId) throw new Error("Choose a separate AI connection first.");
      }
      const prompt = [
        "You are Evermore, a careful roleplay archivist. Analyse the conversation excerpt.",
        "Return ONLY valid JSON with keys: title, location, characters (array), summary, events (array), emotions (array), continuity (array), unresolved (array).",
        "Do not invent facts. Distinguish explicit facts from inference. Keep the summary concise.",
        JSON.stringify(recent.map((m) => ({ role: m.role, name: m.name, content: m.content })))
      ].join("\n\n");
      const result = mode === "separate"
        ? await spindle.generate.raw({ connection_id: connectionId, messages: [{ role: "user", content: prompt }], parameters: { temperature: 0.2, max_tokens: 900 } })
        : await spindle.generate.quiet({ messages: [{ role: "user", content: prompt }], parameters: { temperature: 0.2, max_tokens: 900 } });
      let parsed;
      try {
        const raw = String(result.content || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        parsed = JSON.parse(raw);
      } catch { throw new Error("The AI response wasn't valid JSON. Try analysing again."); }
      const scene = { id: `scene-${Date.now()}`, ...parsed, createdAt: Date.now(), messageCount: recent.length };
      archive.scenes.unshift(scene);
      await saveArchive(archive);
      send(userId, { type: "evermore:archive", requestId: payload.requestId, archive });
    }
  } catch (err) {
    send(userId, { type: "evermore:error", requestId: payload?.requestId, error: err?.message ?? String(err) });
  }
});

spindle.log.info("[Evermore] backend ready");
