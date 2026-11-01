// Evermore 0.3.3 — Lumiverse Spindle backend
// Operator-scoped user routing, per-user archives, and rich-note image uploads.

const PREFIX = "evermore/chats/";
const SETTINGS_KEY = "evermore/settings.json";
const HOME_NOTES_ID = "__home_notebook__";
const cleanId = v => String(v || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
const textOf = v => typeof v === "string" ? v : (v == null ? "" : String(v));

function requireUserId(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Lumiverse did not provide a user ID for this request. Reload Evermore from the Extensions panel and try again.");
  }
  return userId;
}
function userStore(userId) {
  requireUserId(userId);
  if (!spindle.userStorage?.getJson || !spindle.userStorage?.setJson) {
    throw new Error("This Lumiverse version does not expose per-user extension storage. Update Lumiverse before using Evermore 0.3.3.");
  }
  return spindle.userStorage;
}
async function loadArchive(chatId, chatName = "", userId) {
  const store = userStore(userId);
  const fallback = { chatId, chatName, messages: [], scenes: [], notes: [], characters: [], updatedAt: Date.now() };
  const archive = await store.getJson(`${PREFIX}${cleanId(chatId)}.json`, { fallback, userId });
  return { ...fallback, ...(archive || {}), chatId, chatName: chatName || archive?.chatName || "" };
}
async function saveArchive(archive, userId) {
  const store = userStore(userId);
  archive.updatedAt = Date.now();
  await store.setJson(`${PREFIX}${cleanId(archive.chatId)}.json`, archive, { indent: 2, userId });
}
async function loadSettings(userId) {
  const store = userStore(userId);
  return await store.getJson(SETTINGS_KEY, { fallback: { connectionMode: "current", connectionId: "" }, userId }) || { connectionMode: "current", connectionId: "" };
}
async function saveSettings(settings, userId) {
  const store = userStore(userId);
  const next = {
    connectionMode: settings?.connectionMode === "separate" ? "separate" : "current",
    connectionId: textOf(settings?.connectionId).slice(0, 200),
    updatedAt: Date.now()
  };
  await store.setJson(SETTINGS_KEY, next, { indent: 2, userId });
  return next;
}
function reply(userId, payload) {
  if (typeof userId !== "string" || !userId.trim()) {
    spindle.log.error("[Evermore] response not sent because Lumiverse supplied no user ID; refusing to broadcast private archive data");
    return;
  }
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
    timestamp: m.created_at || m.timestamp || Date.now(), chatId
  };
}
async function capture(chatId, message, userId) {
  if (!chatId || !message) return;
  const archive = await loadArchive(chatId, "", userId);
  const entry = normalizeMessage(message, chatId);
  const existing = archive.messages.findIndex(x => x.id === entry.id);
  if (existing >= 0) archive.messages[existing] = entry;
  else archive.messages.push(entry);
  archive.messages = archive.messages.slice(-800);
  await saveArchive(archive, userId);
}

// Read the existing Lumiverse transcript on demand. Event capture alone only
// sees messages sent after Evermore was installed, which is not enough for a
// reliable first scene record in an older conversation.
async function syncChatMessages(chatId, archive, userId) {
  if (!spindle.chat || typeof spindle.chat.getMessages !== "function") {
    if (archive.messages.length) return archive.messages;
    throw new Error("This Lumiverse version does not expose chat history reading. Check that the chat_mutation permission is granted, then reload Evermore.");
  }
  let source;
  try {
    // `tail` keeps the request bounded; `light` avoids unrelated metadata.
    source = await spindle.chat.getMessages(chatId, { tail: 80, light: true, includeExtra: false });
  } catch (firstError) {
    // Older Lumiverse builds may not accept read options. Retry the documented
    // one-argument form before falling back to messages captured by events.
    try { source = await spindle.chat.getMessages(chatId); }
    catch (secondError) {
      if (archive.messages.length) return archive.messages;
      throw new Error(`Could not read this chat's history (${secondError?.message || firstError?.message || "permission or host API error"}). Check chat_mutation permission and reload Evermore.`);
    }
  }
  if (!Array.isArray(source)) {
    if (Array.isArray(source?.data)) source = source.data;
    else if (archive.messages.length) return archive.messages;
    else throw new Error("Lumiverse returned an unexpected chat-history response. Please reload Evermore and try again.");
  }
  const normalized = source
    .filter(m => m && !m.hidden && typeof (m.content ?? m.text ?? m.mes) === "string")
    .map(m => normalizeMessage(m, chatId))
    .filter(m => m.content.trim())
    .slice(-80);
  // If an older host returns no history but MESSAGE_SENT capture has entries,
  // retain those instead of replacing them with an empty list.
  archive.messages = normalized.length ? normalized : archive.messages;
  await saveArchive(archive, userId);
  return archive.messages;
}

spindle.on("MESSAGE_SENT", async ({ chatId, message } = {}, userId) => {
  try { await capture(chatId, message, userId); }
  catch (error) { spindle.log.error(`[Evermore] capture failed: ${error?.message || error}`); }
});
spindle.on("MESSAGE_EDITED", async ({ chatId, message } = {}, userId) => {
  try { await capture(chatId, message, userId); }
  catch (error) { spindle.log.warn(`[Evermore] edit capture failed: ${error?.message || error}`); }
});
spindle.on("MESSAGE_DELETED", async ({ chatId, messageId } = {}, userId) => {
  try {
    if (!chatId || !messageId) return;
    const archive = await loadArchive(chatId, "", userId);
    archive.messages = archive.messages.filter(m => m.id !== String(messageId));
    await saveArchive(archive, userId);
  } catch (error) { spindle.log.warn(`[Evermore] delete sync failed: ${error?.message || error}`); }
});

spindle.onFrontendMessage(async (payload, userId) => {
  const type = payload?.type;
  const requestId = payload?.requestId;
  try {
    requireUserId(userId);
    if (type === "evermore:get-active") {
      const active = await spindle.chats.getActive(userId);
      reply(userId, { type: "evermore:active-chat", requestId, chatId: active?.id || null, chatName: active?.name || "" });
      return;
    }
    if (type === "evermore:get-settings") {
      reply(userId, { type: "evermore:settings", requestId, settings: await loadSettings(userId) });
      return;
    }
    if (type === "evermore:save-settings") {
      const settings = await saveSettings(payload.settings || {}, userId);
      reply(userId, { type: "evermore:settings", requestId, settings });
      return;
    }
    const hasChat = typeof payload?.chatId === "string" && payload.chatId.length > 0;
    const noteActions = new Set(["evermore:get", "evermore:save-note", "evermore:autosave-note", "evermore:delete-note", "evermore:upload-image"]);
    if (!hasChat && !noteActions.has(type) && type !== "evermore:analyse") throw new Error("Open a roleplay chat before recording a scene.");
    // Manual notebook pages also work from Lumiverse's home screen. They are
    // kept in a dedicated personal archive rather than being discarded or
    // blocked when there is no active roleplay chat.
    const archiveId = hasChat ? payload.chatId : HOME_NOTES_ID;
    const archive = await loadArchive(archiveId, hasChat ? (payload.chatName || "") : "Personal notebook", userId);

    if (type === "evermore:get") {
      reply(userId, { type: "evermore:archive", requestId, archive, scope: hasChat ? "chat" : "home" });
      return;
    }
    if (type === "evermore:autosave-note" || type === "evermore:save-note") {
      const n = payload.note || {};
      const note = {
        id: String(n.id || `note-${Date.now()}`),
        title: textOf(n.title || "Untitled note").slice(0, 140),
        body: textOf(n.body).slice(0, 60000),
        bodyHtml: textOf(n.bodyHtml).slice(0, 120000),
        fontSize: /^\d{1,2}px$/.test(textOf(n.fontSize)) ? textOf(n.fontSize) : "14px",
        updatedAt: Date.now()
      };
      const i = archive.notes.findIndex(x => x.id === note.id);
      if (i >= 0) archive.notes[i] = note; else archive.notes.unshift(note);
      await saveArchive(archive, userId);
      if (type === "evermore:autosave-note") {
        reply(userId, { type: "evermore:note-saved", requestId, chatId: payload.chatId, note });
      } else {
        reply(userId, { type: "evermore:archive", requestId, archive });
      }
      return;
    }
    if (type === "evermore:upload-image") {
      if (!spindle.images?.uploadFromDataUrl) throw new Error("This Lumiverse host does not support image uploads through the Spindle Images API.");
      const dataUrl = textOf(payload.dataUrl);
      if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(dataUrl)) throw new Error("Please choose a supported image file (PNG, JPG, WEBP or GIF).");
      if (dataUrl.length > 3_500_000) throw new Error("That image is still too large. Please resize it or choose a smaller photo.");
      const image = await spindle.images.uploadFromDataUrl(dataUrl, {
        originalFilename: textOf(payload.filename || "evermore-image.jpg").slice(0, 180),
        ...(hasChat ? { owner_chat_id: payload.chatId } : {}),
        userId
      });
      reply(userId, { type: "evermore:image-uploaded", requestId, image: { id: image?.id, url: image?.url, filename: image?.original_filename || payload.filename || "Image" } });
      return;
    }
    if (type === "evermore:delete-note") {
      archive.notes = archive.notes.filter(n => n.id !== payload.noteId);
      await saveArchive(archive, userId);
      reply(userId, { type: "evermore:archive", requestId, archive });
      return;
    }
    if (type === "evermore:delete-scene") {
      archive.scenes = archive.scenes.filter(s => s.id !== payload.sceneId);
      await saveArchive(archive, userId);
      reply(userId, { type: "evermore:archive", requestId, archive });
      return;
    }
    if (type === "evermore:analyse") {
      // Resolve the active chat at click time. A floating widget can remain
      // mounted while the user switches roleplay chats, so its cached chatId
      // must never decide which conversation is recorded.
      const activeChat = await spindle.chats.getActive(userId);
      const targetChatId = activeChat?.id || null;
      if (!targetChatId) throw new Error("No active roleplay chat was found. Open the conversation first, then try Record recent scene again.");
      const targetChatName = activeChat?.name || payload.chatName || "";
      const sceneArchive = await loadArchive(targetChatId, targetChatName, userId);
      const recent = (await syncChatMessages(targetChatId, sceneArchive, userId)).slice(-30);
      if (!recent.length) throw new Error("No readable roleplay messages were found in this chat. Send a few messages and try again.");

      const prompt = [
        "You are Evermore, a careful roleplay archivist. Create a faithful scene record from this excerpt.",
        "Return one valid JSON object only, with no markdown fences or commentary.",
        "Use these keys: title (string), location (string), characters (array of names), summary (string), events (array of strings), importantDialogue (array of strings), emotions (array of strings), relationshipChanges (array of strings), continuity (array of strings), unresolved (array of strings).",
        "Do not invent facts or silently convert guesses into canon. Put uncertain details under continuity prefixed with 'Possible inference:'. Keep summary concise. Use empty strings or arrays when unknown.",
        JSON.stringify(recent.map(m => ({ role: m.role, name: m.name, content: m.content })))
      ].join("\n\n");

      let result;
      try {
        if (payload.mode === "separate") {
          if (!payload.connectionId) throw new Error("Choose a saved Lumiverse connection in Evermore Settings first.");
          const profile = await spindle.connections?.get?.(payload.connectionId, userId);
          if (spindle.connections?.get && !profile) throw new Error("That saved connection could not be found. Choose another connection in Settings.");
          result = await spindle.generate.raw({ connection_id: payload.connectionId, messages: [{ role: "user", content: prompt }], parameters: { temperature: 0.2, max_tokens: 1600 }, userId });
        } else {
          // quiet() is Lumiverse's documented route to the currently active profile.
          result = await spindle.generate.quiet({ messages: [{ role: "user", content: prompt }], parameters: { temperature: 0.2, max_tokens: 1600 }, userId });
        }
      } catch (generationError) {
        throw new Error(`AI generation failed: ${generationError?.message || generationError}`);
      }

      const rawContent = textOf(result?.content).trim();
      if (!rawContent) throw new Error("The AI connection returned an empty response. Check that the selected connection is working, then try again.");
      let parsed;
      try {
        const unfenced = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const startJson = unfenced.indexOf("{");
        const endJson = unfenced.lastIndexOf("}");
        if (startJson < 0 || endJson <= startJson) throw new Error("No JSON object found");
        parsed = JSON.parse(unfenced.slice(startJson, endJson + 1));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The response was not a JSON object");
      } catch (parseError) {
        throw new Error(`The AI replied, but its scene record was not valid JSON. Try again or choose another connection. (${parseError?.message || "parse error"})`);
      }
      const asTextArray = value => Array.isArray(value) ? value.map(textOf).filter(Boolean) : [];
      const scene = {
        id: `scene-${Date.now()}`, title: textOf(parsed.title || "Untitled scene"), location: textOf(parsed.location || "Unspecified location"),
        characters: asTextArray(parsed.characters), summary: textOf(parsed.summary),
        events: asTextArray(parsed.events), importantDialogue: asTextArray(parsed.importantDialogue),
        emotions: asTextArray(parsed.emotions), relationshipChanges: asTextArray(parsed.relationshipChanges),
        continuity: asTextArray(parsed.continuity), unresolved: asTextArray(parsed.unresolved),
        createdAt: Date.now(), messageCount: recent.length, sourceMessageIds: recent.map(m => m.id)
      };
      sceneArchive.scenes.unshift(scene);
      const known = new Set(sceneArchive.characters.map(c => textOf(c.name).toLowerCase()));
      for (const name of scene.characters) if (name && !known.has(name.toLowerCase())) sceneArchive.characters.push({ name, firstSeenAt: Date.now(), appearances: 1 });
      await saveArchive(sceneArchive, userId);
      reply(userId, { type: "evermore:archive", requestId, chatId: targetChatId, archive: sceneArchive, action: "analyse" });
      return;
    }
  } catch (error) {
    reply(userId, { type: "evermore:error", requestId, error: error?.message || String(error) });
  }
});

spindle.log.info("[Evermore] Story Journal 0.3.3 ready");
