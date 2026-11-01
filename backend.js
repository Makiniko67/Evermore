// Evermore 0.2 — Lumiverse Spindle backend
// Privacy-first: records only chat message events and notes in extension-scoped storage.

const PREFIX = "evermore/chats/";
const cleanId = (v) => String(v || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
const textOf = (v) => typeof v === "string" ? v : (v == null ? "" : String(v));

async function loadArchive(chatId, chatName = "") {
  const fallback = { chatId, chatName, messages: [], scenes: [], notes: [], characters: [], updatedAt: Date.now() };
  const archive = await spindle.storage.getJson(`${PREFIX}${cleanId(chatId)}.json`, { fallback });
  return { ...fallback, ...(archive || {}), chatId, chatName: chatName || archive?.chatName || "" };
}
async function saveArchive(archive) {
  archive.updatedAt = Date.now();
  await spindle.storage.setJson(`${PREFIX}${cleanId(archive.chatId)}.json`, archive, { indent: 2 });
}
function reply(userId, payload) {
  spindle.sendToFrontend(payload, userId);
}
function normalizeMessage(message, chatId) {
  const m = message || {};
  const raw = m.content ?? m.text ?? m.mes ?? "";
  return {
    id: String(m.id ?? m.message_id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    role: m.is_user || m.role === "user" ? "user" : (m.role || "assistant"),
    name: textOf(m.name || m.author || ""),
    content: textOf(raw).slice(0, 30000),
    timestamp: m.created_at || m.timestamp || Date.now(),
    chatId
  };
}

async function capture(chatId, message) {
  if (!chatId || !message) return;
  const archive = await loadArchive(chatId);
  const entry = normalizeMessage(message, chatId);
  const existing = archive.messages.findIndex(x => x.id === entry.id);
  if (existing >= 0) archive.messages[existing] = entry;
  else archive.messages.push(entry);
  archive.messages = archive.messages.slice(-800);
  await saveArchive(archive);
}

spindle.on("MESSAGE_SENT", async ({ chatId, message } = {}) => {
  try { await capture(chatId, message); }
  catch (error) { spindle.log.error(`[Evermore] capture failed: ${error?.message || error}`); }
});
spindle.on("MESSAGE_EDITED", async ({ chatId, message } = {}) => {
  try { await capture(chatId, message); }
  catch (error) { spindle.log.warn(`[Evermore] edit capture failed: ${error?.message || error}`); }
});
spindle.on("MESSAGE_DELETED", async ({ chatId, messageId } = {}) => {
  try {
    if (!chatId || !messageId) return;
    const archive = await loadArchive(chatId);
    archive.messages = archive.messages.filter(m => m.id !== String(messageId));
    await saveArchive(archive);
  } catch (error) { spindle.log.warn(`[Evermore] delete sync failed: ${error?.message || error}`); }
});

spindle.onFrontendMessage(async (payload, userId) => {
  const type = payload?.type;
  const requestId = payload?.requestId;
  try {
    if (type === "evermore:get-active") {
      const active = await spindle.chats.getActive();
      reply(userId, { type: "evermore:active-chat", requestId, chatId: active?.id || null, chatName: active?.name || "" });
      return;
    }
    if (type === "evermore:get-connections") {
      const list = await spindle.connections.list();
      reply(userId, { type: "evermore:connections", requestId, connections: (list || []).map(c => ({ id: c.id, name: c.name, provider: c.provider, model: c.model, active: !!c.is_default })) });
      return;
    }
    if (!payload?.chatId) throw new Error("Open a roleplay chat before using the story archive.");
    const archive = await loadArchive(payload.chatId, payload.chatName || "");
    if (type === "evermore:get") {
      reply(userId, { type: "evermore:archive", requestId, archive });
      return;
    }
    if (type === "evermore:save-note") {
      const n = payload.note || {};
      const note = { id: String(n.id || `note-${Date.now()}`), title: textOf(n.title || "Untitled note").slice(0, 140), body: textOf(n.body).slice(0, 16000), updatedAt: Date.now() };
      const i = archive.notes.findIndex(x => x.id === note.id);
      if (i >= 0) archive.notes[i] = note; else archive.notes.unshift(note);
      await saveArchive(archive);
      reply(userId, { type: "evermore:archive", requestId, archive });
      return;
    }
    if (type === "evermore:delete-note") {
      archive.notes = archive.notes.filter(n => n.id !== payload.noteId);
      await saveArchive(archive);
      reply(userId, { type: "evermore:archive", requestId, archive });
      return;
    }
    if (type === "evermore:delete-scene") {
      archive.scenes = archive.scenes.filter(s => s.id !== payload.sceneId);
      await saveArchive(archive);
      reply(userId, { type: "evermore:archive", requestId, archive });
      return;
    }
    if (type === "evermore:analyse") {
      const recent = archive.messages.slice(-30);
      if (!recent.length) throw new Error("No messages have been captured in this chat yet. Send a few roleplay messages, then try again.");
      const prompt = [
        "You are Evermore, a careful roleplay archivist. Create a faithful scene record from this excerpt.",
        "Return ONLY JSON with keys: title, location, characters (array of names), summary, events (array), importantDialogue (array), emotions (array), relationshipChanges (array), continuity (array), unresolved (array).",
        "Do not invent facts or silently convert guesses into canon. Keep uncertain details under continuity prefixed with 'Possible inference:'. Keep summary concise.",
        JSON.stringify(recent.map(m => ({ role: m.role, name: m.name, content: m.content })))
      ].join("\n\n");
      const result = payload.mode === "separate"
        ? await spindle.generate.raw({ connection_id: payload.connectionId, messages: [{ role: "user", content: prompt }], parameters: { temperature: 0.2, max_tokens: 1200 } })
        : await spindle.generate.quiet({ messages: [{ role: "user", content: prompt }], parameters: { temperature: 0.2, max_tokens: 1200 } });
      let parsed;
      try {
        const raw = textOf(result?.content).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
        parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
      } catch { throw new Error("The AI response could not be read as a scene record. Please try again."); }
      const scene = {
        id: `scene-${Date.now()}`, title: textOf(parsed.title || "Untitled scene"), location: textOf(parsed.location || "Unspecified location"),
        characters: Array.isArray(parsed.characters) ? parsed.characters.map(textOf) : [], summary: textOf(parsed.summary),
        events: Array.isArray(parsed.events) ? parsed.events.map(textOf) : [], importantDialogue: Array.isArray(parsed.importantDialogue) ? parsed.importantDialogue.map(textOf) : [],
        emotions: Array.isArray(parsed.emotions) ? parsed.emotions.map(textOf) : [], relationshipChanges: Array.isArray(parsed.relationshipChanges) ? parsed.relationshipChanges.map(textOf) : [],
        continuity: Array.isArray(parsed.continuity) ? parsed.continuity.map(textOf) : [], unresolved: Array.isArray(parsed.unresolved) ? parsed.unresolved.map(textOf) : [],
        createdAt: Date.now(), messageCount: recent.length, sourceMessageIds: recent.map(m => m.id)
      };
      archive.scenes.unshift(scene);
      const known = new Set(archive.characters.map(c => c.name.toLowerCase()));
      for (const name of scene.characters) if (name && !known.has(name.toLowerCase())) archive.characters.push({ name, firstSeenAt: Date.now(), appearances: 1 });
      await saveArchive(archive);
      reply(userId, { type: "evermore:archive", requestId, archive });
      return;
    }
  } catch (error) {
    reply(userId, { type: "evermore:error", requestId, error: error?.message || String(error) });
  }
});

spindle.log.info("[Evermore] Story Journal backend ready");
