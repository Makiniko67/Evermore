// Evermore 0.2 — responsive, self-contained journal surface for Lumiverse Spindle.
export function setup(ctx) {
  const widget = ctx.ui.createFloatWidget({
    width: 60, height: 60, initialPosition: { x: 18, y: 170 },
    snapToEdge: true, tooltip: "Open Evermore · Story Journal", chromeless: true
  });
  const root = widget.root;
  root.style.cssText = "width:100%;height:100%;min-width:0;min-height:0;max-width:100%;max-height:100%;overflow:hidden;box-sizing:border-box;isolation:isolate;";

  let expanded = false;
  let activeTab = "scenes";
  let archive = { chatId: null, chatName: "", messages: [], scenes: [], notes: [], characters: [] };
  let chatId = null;
  let chatName = "";
  let connections = [];
  let editingNote = null;
  let noteDraftCache = null;
  let busy = false;
  let toastMessage = "";
  let seq = 0;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const request = (type, extra = {}) => ctx.sendToBackend({ type, requestId: `evermore-${++seq}`, chatId, chatName, ...extra });
  const viewport = () => ({
    width: Math.min(430, Math.max(310, (window.visualViewport?.width || window.innerWidth || 390) - 24)),
    height: Math.min(740, Math.max(440, (window.visualViewport?.height || window.innerHeight || 800) - 34))
  });
  const resize = open => {
    if (!open) { widget.setSize(60, 60); return; }
    const size = viewport();
    widget.setSize(size.width, size.height);
  };

  const css = `
  :host{display:block!important;width:100%!important;height:100%!important;overflow:hidden!important}
  .ev-root,.ev-root *{box-sizing:border-box}
  .ev-root{width:100%;height:100%;min-width:0;min-height:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#f5eef9;font-size:14px;line-height:1.45}
  .ev-launcher-wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .ev-launcher{width:58px;height:58px;border-radius:22px 22px 22px 8px;border:1px solid #d5b7e8;background:linear-gradient(145deg,#b89ad0 0%,#785b99 48%,#49345f 100%);color:#fff;font:30px Georgia,serif;box-shadow:0 8px 26px #12091f99, inset 0 1px #ffffff66;cursor:pointer;touch-action:manipulation}
  .ev-panel{height:100%;width:100%;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid #9278a9;border-radius:24px;background:linear-gradient(160deg,#30243e 0%,#211a2e 54%,#1c1727 100%);box-shadow:0 18px 54px #100918c9,inset 0 1px #ffffff14}
  .ev-header{flex:none;padding:15px 16px 12px;background:linear-gradient(135deg,#59436d,#342643 72%);border-bottom:1px solid #705981}
  .ev-head-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .ev-brand{font:600 27px/1.1 Georgia,'Times New Roman',serif;letter-spacing:.2px;color:#fbeafa}
  .ev-brand small{font:normal 12px/1 system-ui;color:#e9cce9;margin-left:5px}
  .ev-tagline{margin-top:5px;color:#d8c0e2;font-size:9px;letter-spacing:2.1px;text-transform:uppercase}
  .ev-close{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid #a58ab6;background:#3c2d4c;color:#fff;font-size:21px;line-height:1;cursor:pointer}
  .ev-chatline{margin-top:9px;display:flex;align-items:center;gap:7px;color:#dfcde8;font-size:11px;min-width:0}
  .ev-dot{width:7px;height:7px;border-radius:50%;background:#c6a4d9;box-shadow:0 0 0 3px #c6a4d922;flex:none}
  .ev-chatname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ev-tabs{display:flex;flex:none;gap:6px;padding:10px 10px 9px;background:#291f36;border-bottom:1px solid #594666;overflow-x:auto;scrollbar-width:none}
  .ev-tabs::-webkit-scrollbar{display:none}
  .ev-tab{flex:1 0 65px;min-width:0;border:1px solid #614d70;border-radius:12px;padding:8px 7px;background:#342740;color:#d8c7e2;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer;touch-action:manipulation}
  .ev-tab[aria-selected=true]{color:#fff;background:linear-gradient(135deg,#85669d,#604778);border-color:#c6a8d9;box-shadow:0 3px 12px #130b1d66}
  .ev-main{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:15px 14px 24px;scrollbar-width:thin;scrollbar-color:#765b89 transparent;-webkit-overflow-scrolling:touch}
  .ev-main h2,.ev-main h3,.ev-main p{margin-top:0}
  .ev-kicker{font-size:9px;letter-spacing:2px;color:#c9abd8;text-transform:uppercase;font-weight:700}
  .ev-page-title{margin:4px 0 5px;font:600 25px/1.16 Georgia,'Times New Roman',serif;color:#f6e8f7}
  .ev-intro{color:#cdbed8;font-size:12px;line-height:1.55;margin:0 0 14px}
  .ev-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 16px}
  .ev-stat{padding:10px 9px;border:1px solid #584664;background:#30243c;border-radius:14px;min-width:0}
  .ev-stat strong{display:block;font:600 21px Georgia,serif;color:#f2d9f3}
  .ev-stat span{display:block;color:#c0aecb;font-size:10px;margin-top:2px}
  .ev-card{padding:13px;margin:10px 0;border:1px solid #5a4768;border-radius:16px;background:linear-gradient(145deg,#382b47,#2b2238);box-shadow:0 5px 15px #10091935}
  .ev-card-soft{background:#2b2238;border-color:#4e3e5d}
  .ev-row{display:flex;align-items:center;justify-content:space-between;gap:9px;min-width:0}
  .ev-card-title{margin:0;font:600 17px/1.25 Georgia,serif;color:#f3e3f5;overflow-wrap:anywhere}
  .ev-muted{color:#c7b8d2;font-size:12px;line-height:1.55}
  .ev-date,.ev-pill{display:inline-flex;align-items:center;border-radius:99px;background:#4a385b;color:#e9d8f0;padding:4px 8px;font-size:10px}
  .ev-section{margin:17px 0 7px;display:flex;align-items:center;justify-content:space-between;gap:8px}
  .ev-section-title{font:600 18px Georgia,serif;color:#f0ddf3;margin:0}
  .ev-btn{border:1px solid #bd9bcf;background:linear-gradient(135deg,#8e6ca7,#684d80);color:#fff;border-radius:12px;padding:10px 13px;font-size:12px;font-weight:650;cursor:pointer;touch-action:manipulation;min-height:40px}
  .ev-btn:disabled{opacity:.55;cursor:wait}
  .ev-btn-ghost{background:#3b2e49;border-color:#685475;color:#eadcf0}
  .ev-btn-danger{background:#593447;border-color:#96647b}
  .ev-select,.ev-input,.ev-textarea{display:block;width:100%;min-width:0;margin:7px 0 10px;border:1px solid #705b80;border-radius:12px;background:#201929;color:#f7effa;padding:11px 12px;font-family:inherit;font-size:13px;line-height:1.4;outline:none}
  .ev-select:focus,.ev-input:focus,.ev-textarea:focus{border-color:#c5a2d9;box-shadow:0 0 0 3px #c5a2d922}
  .ev-textarea{min-height:160px;resize:vertical;line-height:1.6}
  .ev-label{display:block;color:#d9c8e2;font-size:11px;font-weight:650;margin:11px 0 4px}
  .ev-empty{padding:24px 14px;text-align:center;border:1px dashed #6b557b;border-radius:16px;background:#2a2035;color:#decce7}
  .ev-empty-mark{font:30px Georgia,serif;color:#c8a8d8}
  .ev-empty p{margin:7px 0 4px;font:600 17px Georgia,serif;color:#f2e3f5}
  .ev-list{margin:8px 0;padding-left:18px;color:#d7c8e0;font-size:12px;line-height:1.65}
  .ev-note-body{white-space:pre-wrap;overflow-wrap:anywhere;color:#d7c8e0;font-size:12px;line-height:1.6;margin:9px 0 0}
  .ev-rule{height:1px;background:#5a4766;margin:13px 0}
  .ev-toast{min-height:20px;padding:5px 2px;color:#e3c9ed;font-size:11px}
  .ev-footer{flex:none;padding:8px 13px;border-top:1px solid #493957;background:#241b30;color:#a995b8;text-align:center;font-size:9px;letter-spacing:1.2px}
  .ev-note-actions{display:flex;gap:6px;flex-wrap:wrap}
  .ev-inline-label{color:#d8c2e3;font-size:10px}
  @media(max-width:360px){.ev-header{padding:12px}.ev-main{padding:12px 10px 20px}.ev-page-title{font-size:22px}.ev-tabs{padding:8px}.ev-tab{flex-basis:61px;padding:8px 4px;font-size:10px}}
  @media(prefers-reduced-motion:no-preference){.ev-panel{animation:ev-in .18s ease-out}@keyframes ev-in{from{opacity:.7;transform:translateY(5px) scale(.99)}to{opacity:1;transform:none}}}
  `;

  function button(text, action, cls = "") { return `<button type="button" class="ev-btn ${cls}" data-action="${action}">${text}</button>`; }
  function render() {
    if (!expanded) {
      root.innerHTML = `<style>${css}</style><div class="ev-root"><div class="ev-launcher-wrap"><button class="ev-launcher" type="button" aria-label="Open Evermore" title="Open Evermore">✧</button></div></div>`;
      root.querySelector(".ev-launcher").addEventListener("click", openJournal);
      resize(false);
      return;
    }
    const page = activeTab === "scenes" ? scenesPage() : activeTab === "characters" ? charactersPage() : activeTab === "notes" ? notesPage() : settingsPage();
    root.innerHTML = `<style>${css}</style><div class="ev-root"><section class="ev-panel" aria-label="Evermore story journal">
      <header class="ev-header"><div class="ev-head-top"><div><div class="ev-brand">Evermore <small>✧</small></div><div class="ev-tagline">Your story, lovingly remembered</div></div><button type="button" class="ev-close" data-action="close" aria-label="Close journal">×</button></div>
      <div class="ev-chatline"><span class="ev-dot"></span><span class="ev-chatname">${chatId ? esc(chatName || "Current roleplay") : "No roleplay chat open"}</span></div></header>
      <nav class="ev-tabs" aria-label="Journal sections">${tab("scenes","✧ Scenes")}${tab("characters","♡ Cast")}${tab("notes","✎ Notes")}${tab("settings","⚙ Settings")}</nav>
      <main class="ev-main">${page}<div class="ev-toast" role="status" aria-live="polite">${esc(toastMessage)}</div></main>
      <footer class="ev-footer">A LITTLE ARCHIVE OF YOUR IMAGINED WORLDS</footer>
    </section></div>`;
    root.querySelector('[data-action="close"]')?.addEventListener("click", closeJournal);
    root.querySelectorAll("[data-tab]").forEach(el => el.addEventListener("click", () => { activeTab = el.dataset.tab; editingNote = null; render(); }));
    root.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", () => handleAction(el.dataset.action, el)));
    resize(true);
  }
  function tab(id, label) { return `<button type="button" class="ev-tab" data-tab="${id}" aria-selected="${activeTab === id}">${label}</button>`; }
  function openJournal() { expanded = true; toastMessage = ""; resize(true); render(); if (chatId) request("evermore:get"); }
  function closeJournal() { if (editingNote) { noteDraftCache = { ...editingNote, draft: { title: root.querySelector("#ev-note-title")?.value ?? editingNote.draft?.title ?? editingNote.title, body: root.querySelector("#ev-note-body")?.value ?? editingNote.draft?.body ?? editingNote.body } }; } expanded = false; editingNote = null; render(); }
  function say(message) { toastMessage = message; const el = root.querySelector(".ev-toast"); if (el) el.textContent = message; }
  function scenesPage() {
    const scenes = (archive.scenes || []).map(s => `<article class="ev-card"><div class="ev-row"><span class="ev-date">${new Date(s.createdAt || Date.now()).toLocaleDateString()}</span><span class="ev-inline-label">${(s.characters || []).length} ${((s.characters || []).length === 1) ? "character" : "characters"}</span></div><h3 class="ev-card-title" style="margin-top:9px">${esc(s.title || "Untitled scene")}</h3><div class="ev-kicker" style="margin-top:6px">${esc(s.location || "Unspecified location")}</div><p class="ev-muted" style="margin:9px 0 0">${esc(s.summary || "No summary available.")}</p>${listBlock("Story beats", s.events)}${listBlock("Unresolved threads", s.unresolved)}<div class="ev-rule"></div>${button("Delete scene", "delete-scene", "ev-btn-danger")}<span hidden data-scene-id="${esc(s.id)}"></span></article>`).join("");
    return `<div class="ev-kicker">The chronicle</div><h2 class="ev-page-title">Your story, preserved.</h2><p class="ev-intro">A quiet little place for the moments, twists and feelings you don't want to lose.</p>
      <div class="ev-stats"><div class="ev-stat"><strong>${(archive.scenes || []).length}</strong><span>Scenes</span></div><div class="ev-stat"><strong>${(archive.characters || []).length}</strong><span>Characters</span></div><div class="ev-stat"><strong>${(archive.notes || []).length}</strong><span>Notes</span></div></div>
      <section class="ev-card"><div class="ev-kicker">Preserve a moment</div><h3 class="ev-card-title" style="margin:5px 0">Record a scene</h3><p class="ev-muted">Evermore will read the recent messages captured in this chat and draft a structured scene note. You can review and edit the result later.</p><label class="ev-label" for="ev-mode">AI connection</label><select id="ev-mode" class="ev-select"><option value="current">Use active Lumiverse connection</option><option value="separate">Choose another connection</option></select><div id="ev-connection-wrap" hidden><label class="ev-label" for="ev-connection">Connection profile</label><select id="ev-connection" class="ev-select">${connections.map(c => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.model || c.provider || "AI")}</option>`).join("")}</select></div><button type="button" class="ev-btn" data-action="analyse" ${(!chatId || busy) ? "disabled" : ""}>${busy ? "Preparing your scene…" : "✧ Record recent scene"}</button><div class="ev-inline-label" style="margin-top:8px">Your message archive is kept separately for each roleplay chat.</div></section>
      <div class="ev-section"><h3 class="ev-section-title">Recorded scenes</h3><span class="ev-pill">${scenes ? "Latest first" : "New journal"}</span></div>${scenes || `<div class="ev-empty"><div class="ev-empty-mark">✧</div><p>Your first chapter is waiting.</p><span class="ev-muted">Send a few roleplay messages, then record your first scene.</span></div>`}`;
  }
  function listBlock(label, items) { return Array.isArray(items) && items.length ? `<div class="ev-kicker" style="margin-top:12px">${label}</div><ul class="ev-list">${items.slice(0,8).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""; }
  function charactersPage() {
    const chars = archive.characters || [];
    return `<div class="ev-kicker">The people in your pages</div><h2 class="ev-page-title">Character keepsakes</h2><p class="ev-intro">Names are added from recorded scenes. Evermore keeps this list within the current roleplay chat for now.</p>${chars.map(c => `<article class="ev-card"><div class="ev-row"><h3 class="ev-card-title">♡ ${esc(c.name)}</h3><span class="ev-pill">Character</span></div><div class="ev-muted" style="margin-top:6px">Appears in this chat's recorded story.</div></article>`).join("") || `<div class="ev-empty"><div class="ev-empty-mark">♡</div><p>No character cards yet.</p><span class="ev-muted">Record a scene to start collecting the cast.</span></div>`}`;
  }
  function notesPage() {
    if (!editingNote && noteDraftCache) editingNote = { ...noteDraftCache };
    if (editingNote) return noteEditor();
    const notes = (archive.notes || []).map(n => `<article class="ev-card"><div class="ev-row"><div style="min-width:0"><div class="ev-kicker">Notebook page</div><h3 class="ev-card-title">${esc(n.title || "Untitled note")}</h3></div><span class="ev-date">${new Date(n.updatedAt || Date.now()).toLocaleDateString()}</span></div><p class="ev-note-body">${esc(n.body || "An empty page.")}</p><div class="ev-rule"></div><div class="ev-note-actions">${button("Edit page", `edit:${esc(n.id)}`, "ev-btn-ghost")}${button("Delete", `delete-note:${esc(n.id)}`, "ev-btn-danger")}</div></article>`).join("");
    return `<div class="ev-row"><div><div class="ev-kicker">Little thoughts & details</div><h2 class="ev-page-title">Your notebook</h2></div>${button("＋ New page", "new-note")}</div><p class="ev-intro">Keep promises, lore, ideas and details you want to remember.</p>${notes || `<div class="ev-empty"><div class="ev-empty-mark">✎</div><p>A fresh page, just for you.</p><span class="ev-muted">Create your first note whenever you're ready.</span></div>`}`;
  }
  function noteEditor() {
    const n = editingNote;
    const draft = n.draft || n;
    return `<div class="ev-kicker">Notebook · ${n.id.startsWith("note-") ? "New page" : "Edit page"}</div><h2 class="ev-page-title">A page of your own</h2><label class="ev-label" for="ev-note-title">Page title</label><input id="ev-note-title" class="ev-input" maxlength="140" placeholder="Give this memory a name…" value="${esc(draft.title || "")}"/><label class="ev-label" for="ev-note-body">Your note</label><textarea id="ev-note-body" class="ev-textarea" placeholder="Write the little details you want to keep…">${esc(draft.body || "")}</textarea><div class="ev-row">${button("Cancel", "cancel-note", "ev-btn-ghost")}${button("Save page", "save-note")}</div>`;
  }
  function settingsPage() {
    return `<div class="ev-kicker">A few details</div><h2 class="ev-page-title">Journal settings</h2><p class="ev-intro">A gentle archive, with your stories kept in their own places.</p>
      <article class="ev-card"><h3 class="ev-card-title">Current archive</h3><p class="ev-muted">${chatId ? `This journal is storing notes and captured messages for <strong>${esc(chatName || "the current chat")}</strong>.` : "Open a roleplay chat to use its private journal."}</p><div class="ev-rule"></div><div class="ev-row"><span class="ev-muted">Captured messages</span><strong>${(archive.messages || []).length}</strong></div><div class="ev-row" style="margin-top:8px"><span class="ev-muted">Saved scenes</span><strong>${(archive.scenes || []).length}</strong></div><div class="ev-row" style="margin-top:8px"><span class="ev-muted">Notebook pages</span><strong>${(archive.notes || []).length}</strong></div></article>
      <article class="ev-card ev-card-soft"><h3 class="ev-card-title">Privacy & accuracy</h3><p class="ev-muted">Captured messages and notes stay in Lumiverse's private extension storage. Recording a scene sends the recent excerpt to the AI connection you select. AI-generated summaries are drafts, not automatically verified canon.</p></article>
      <article class="ev-card ev-card-soft"><h3 class="ev-card-title">About this build</h3><p class="ev-muted">Evermore 0.2 preview. Automatic message capture and manual scene recording are included. Automatic scene-boundary detection, cross-chat character sharing and archive export are not included yet.</p></article>`;
  }
  async function handleAction(action, element) {
    if (action === "close") { closeJournal(); return; }
    if (action === "new-note") { editingNote = { id: `note-${Date.now()}`, title: "", body: "" }; render(); return; }
    if (action.startsWith("edit:")) { const note = archive.notes.find(n => n.id === action.slice(5)); if (note) { editingNote = { ...note }; render(); } return; }
    if (action === "cancel-note") { editingNote = null; noteDraftCache = null; render(); return; }
    if (action === "save-note") {
      if (!editingNote) return;
      request("evermore:save-note", { note: { id: editingNote.id, title: root.querySelector("#ev-note-title")?.value?.trim() || "Untitled note", body: root.querySelector("#ev-note-body")?.value || "" } });
      editingNote = null; noteDraftCache = null; say("Saving your page…"); return;
    }
    if (action.startsWith("delete-note:")) { request("evermore:delete-note", { noteId: action.slice(12) }); say("Updating notebook…"); return; }
    if (action === "delete-scene") { const id = element.parentElement?.querySelector("[data-scene-id]")?.dataset.sceneId; if (id && window.confirm("Delete this scene record?")) request("evermore:delete-scene", { sceneId: id }); return; }
    if (action === "analyse") {
      if (!chatId || busy) return;
      const mode = root.querySelector("#ev-mode")?.value || "current";
      const connectionId = root.querySelector("#ev-connection")?.value || "";
      if (mode === "separate" && !connectionId) { say("Choose a connection profile first."); return; }
      busy = true; say("Reading the recent story…"); render();
      request("evermore:analyse", { mode, connectionId });
    }
  }

  const modeChange = event => {
    if (event.target?.id === "ev-mode") {
      const wrap = root.querySelector("#ev-connection-wrap");
      if (wrap) wrap.hidden = event.target.value !== "separate";
    }
  };
  root.addEventListener("change", modeChange);
  const unsubscribe = ctx.onBackendMessage(payload => {
    if (!payload?.type?.startsWith("evermore:")) return;
    if (payload.type === "evermore:active-chat") {
      chatId = payload.chatId; chatName = payload.chatName || "";
      if (expanded && chatId) request("evermore:get");
      if (expanded) render();
    } else if (payload.type === "evermore:connections") {
      connections = payload.connections || [];
      if (expanded) render();
    } else if (payload.type === "evermore:archive") {
      archive = payload.archive || archive; busy = false; editingNote = null;
      if (expanded) render();
    } else if (payload.type === "evermore:error") {
      busy = false; say(payload.error || "Something went wrong."); render();
    }
  });
  const onViewportResize = () => { if (expanded) resize(true); };
  window.visualViewport?.addEventListener("resize", onViewportResize);
  request("evermore:get-active");
  request("evermore:get-connections");
  render();

  return () => {
    unsubscribe?.();
    root.removeEventListener("change", modeChange);
    window.visualViewport?.removeEventListener("resize", onViewportResize);
    widget.destroy();
  };
}
