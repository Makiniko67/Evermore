// Evermore 0.3.4 — responsive dark-lavender story journal with rich manual notes.
export function setup(ctx) {
  const widget = ctx.ui.createFloatWidget({
    width: 60, height: 60, initialPosition: { x: 18, y: 170 },
    snapToEdge: true, tooltip: "Open Evermore · Story Journal", chromeless: true
  });
  const root = widget.root;
  root.style.cssText = "width:100%;height:100%;min-width:0;min-height:0;max-width:100%;max-height:100%;overflow:hidden;box-sizing:border-box;isolation:isolate;";

  let expanded = false;
  let editorExpanded = false;
  let activeTab = "scenes";
  let archive = { chatId: null, chatName: "", messages: [], scenes: [], notes: [], characters: [] };
  let chatId = null;
  let chatName = "";
  let connections = [];
  let activeConnectionId = "";
  let activeConnectionInfo = null;
  let connectionMode = "current";
  let selectedConnectionId = "";
  let editingNote = null;
  let noteDraftCache = null;
  let editorHeight = 340;
  let panelWidth = null;
  let panelHeight = null;
  let panelResizeDrag = null;
  let editorResizeDrag = null;
  let savedRange = null;
  let busy = false;
  let uploading = false;
  let toastMessage = "";
  let seq = 0;
  let autosaveTimer = null;
  let pendingImageRequest = null;
  let pendingUploadError = "";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const request = (type, extra = {}) => ctx.sendToBackend({ type, requestId: `evermore-${++seq}`, chatId, chatName, ...extra });
  const viewport = () => ({ width: Math.max(320, window.visualViewport?.width || window.innerWidth || 390), height: Math.max(480, window.visualViewport?.height || window.innerHeight || 800) });
  const resize = open => {
    if (!open) { widget.setSize(60, 60); return; }
    const v = viewport();
    const maxW = Math.max(300, v.width - 24);
    const maxH = Math.max(400, v.height - 24);
    if (panelWidth == null) panelWidth = Math.min(460, maxW);
    if (panelHeight == null) panelHeight = Math.min(780, maxH);
    if (editorExpanded) widget.setSize(maxW, maxH);
    else widget.setSize(Math.min(maxW, Math.max(300, panelWidth)), Math.min(maxH, Math.max(400, panelHeight)));
  };

  const css = `
  :host{display:block!important;width:100%!important;height:100%!important;overflow:hidden!important}
  .ev-root,.ev-root *{box-sizing:border-box}
  .ev-root{width:100%;height:100%;min-width:0;min-height:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#f5eef9;font-size:14px;line-height:1.45}
  .ev-launcher-wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .ev-launcher{width:58px;height:58px;border-radius:22px 22px 22px 8px;border:1px solid #d5b7e8;background:linear-gradient(145deg,#b89ad0 0%,#785b99 48%,#49345f 100%);color:#fff;font:30px Georgia,serif;box-shadow:0 8px 26px #12091f99,inset 0 1px #ffffff66;cursor:pointer;touch-action:manipulation}
  .ev-panel{position:relative;height:100%;width:100%;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid #9278a9;border-radius:24px;background:linear-gradient(160deg,#30243e 0%,#211a2e 54%,#1c1727 100%);box-shadow:0 18px 54px #100918c9,inset 0 1px #ffffff14}
  .ev-panel.ev-writing-mode{border-radius:18px}
  .ev-header{flex:none;padding:14px 16px 11px;background:linear-gradient(135deg,#59436d,#342643 72%);border-bottom:1px solid #705981}
  .ev-head-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .ev-brand{font:600 27px/1.1 Georgia,'Times New Roman',serif;letter-spacing:.2px;color:#fbeafa}
  .ev-brand small{font:normal 12px/1 system-ui;color:#e9cce9;margin-left:5px}
  .ev-tagline{margin-top:5px;color:#d8c0e2;font-size:9px;letter-spacing:2.1px;text-transform:uppercase}
  .ev-close{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid #a58ab6;background:#3c2d4c;color:#fff;font-size:21px;line-height:1;cursor:pointer}
  .ev-chatline{margin-top:8px;display:flex;align-items:center;gap:7px;color:#dfcde8;font-size:11px;min-width:0}
  .ev-dot{width:7px;height:7px;border-radius:50%;background:#c6a4d9;box-shadow:0 0 0 3px #c6a4d922;flex:none}
  .ev-chatname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ev-tabs{display:flex;flex:none;gap:6px;padding:9px 10px;background:#291f36;border-bottom:1px solid #594666;overflow-x:auto;scrollbar-width:none}
  .ev-tabs::-webkit-scrollbar{display:none}
  .ev-tab{flex:1 0 65px;min-width:0;border:1px solid #614d70;border-radius:12px;padding:8px 7px;background:#342740;color:#d8c7e2;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer;touch-action:manipulation}
  .ev-tab[aria-selected=true]{color:#fff;background:linear-gradient(135deg,#85669d,#604778);border-color:#c6a8d9;box-shadow:0 3px 12px #130b1d66}
  .ev-main{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 14px 20px;scrollbar-width:thin;scrollbar-color:#765b89 transparent;-webkit-overflow-scrolling:touch}
  .ev-main h2,.ev-main h3,.ev-main p{margin-top:0}
  .ev-kicker{font-size:9px;letter-spacing:2px;color:#c9abd8;text-transform:uppercase;font-weight:700}
  .ev-page-title{margin:4px 0 5px;font:600 25px/1.16 Georgia,'Times New Roman',serif;color:#f6e8f7}
  .ev-intro{color:#cdbed8;font-size:12px;line-height:1.55;margin:0 0 14px}
  .ev-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 16px}
  .ev-stat{padding:10px 9px;border:1px solid #584664;background:#30243c;border-radius:14px;min-width:0}
  .ev-stat strong{display:block;font:600 21px Georgia,serif;color:#f2d9f3}
  .ev-stat span{display:block;color:#c0aecb;font-size:10px;margin-top:2px}
  .ev-card{padding:13px;margin:10px 0;border:1px solid #5a4768;border-radius:16px;background:linear-gradient(145deg,#382b47,#2b2238);box-shadow:0 5px 15px #10091935;min-width:0}
  .ev-card-soft{background:#2b2238;border-color:#4e3e5d}
  .ev-row{display:flex;align-items:center;justify-content:space-between;gap:9px;min-width:0}
  .ev-card-title{margin:0;font:600 17px/1.25 Georgia,serif;color:#f3e3f5;overflow-wrap:anywhere}
  .ev-muted{color:#c7b8d2;font-size:12px;line-height:1.55}
  .ev-date,.ev-pill{display:inline-flex;align-items:center;border-radius:99px;background:#4a385b;color:#e9d8f0;padding:4px 8px;font-size:10px}
  .ev-section{margin:17px 0 7px;display:flex;align-items:center;justify-content:space-between;gap:8px}
  .ev-section-title{font:600 18px Georgia,serif;color:#f0ddf3;margin:0}
  .ev-btn{border:1px solid #bd9bcf;background:linear-gradient(135deg,#8e6ca7,#684d80);color:#fff;border-radius:12px;padding:9px 12px;font-size:12px;font-weight:650;cursor:pointer;touch-action:manipulation;min-height:38px}
  .ev-btn:disabled{opacity:.55;cursor:wait}
  .ev-btn-ghost{background:#3b2e49;border-color:#685475;color:#eadcf0}
  .ev-btn-danger{background:#593447;border-color:#96647b}
  .ev-select,.ev-input{display:block;width:100%;min-width:0;margin:7px 0 10px;border:1px solid #705b80;border-radius:12px;background:#201929;color:#f7effa;padding:10px 11px;font-family:inherit;font-size:13px;line-height:1.4;outline:none}
  .ev-select:focus,.ev-input:focus{border-color:#c5a2d9;box-shadow:0 0 0 3px #c5a2d922}
  .ev-label{display:block;color:#d9c8e2;font-size:11px;font-weight:650;margin:10px 0 4px}
  .ev-empty{padding:24px 14px;text-align:center;border:1px dashed #6b557b;border-radius:16px;background:#2a2035;color:#decce7}
  .ev-empty-mark{font:30px Georgia,serif;color:#c8a8d8}
  .ev-empty p{margin:7px 0 4px;font:600 17px Georgia,serif;color:#f2e3f5}
  .ev-list{margin:8px 0;padding-left:18px;color:#d7c8e0;font-size:12px;line-height:1.65}
  .ev-note-body{overflow-wrap:anywhere;color:#e0d4e8;font-size:13px;line-height:1.65;margin:9px 0 0;white-space:normal}
  .ev-note-body img{display:block;max-width:100%;height:auto;border-radius:10px;margin:10px auto}
  .ev-note-body blockquote,.ev-rich-editor blockquote{border-left:3px solid #b995d0;padding-left:10px;color:#d6c1e2;margin:8px 0}
  .ev-note-body h2,.ev-rich-editor h2{font:600 22px Georgia,serif;color:#f5e5f5}
  .ev-note-body h3,.ev-rich-editor h3{font:600 18px Georgia,serif;color:#f5e5f5}
  .ev-rule{height:1px;background:#5a4766;margin:13px 0}
  .ev-toast{min-height:19px;padding:5px 2px;color:#e3c9ed;font-size:11px}
  .ev-footer{flex:none;padding:8px 13px;border-top:1px solid #493957;background:#241b30;color:#a995b8;text-align:center;font-size:9px;letter-spacing:1.2px}
  .ev-note-actions{display:flex;gap:6px;flex-wrap:wrap}
  .ev-inline-label{color:#d8c2e3;font-size:10px}
  .ev-connection-current{padding:9px 10px;border:1px solid #594566;border-radius:12px;background:#2b2136;color:#e7d8ed;font-size:11px;margin:8px 0}
  .ev-connection-current strong{color:#fff}
  .ev-editor-shell{border:1px solid #755d85;border-radius:15px;background:#f8f3fb;color:#292132;overflow:hidden;display:flex;flex-direction:column;min-width:0}
  .ev-rich-editor-wrap{position:relative;width:100%;height:340px;min-height:180px;flex:none}
  .ev-editor-resize-grip{position:absolute;right:3px;bottom:3px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid #c4afcf;border-radius:9px;background:#fff;color:#725386;font-size:18px;font-weight:700;touch-action:none;user-select:none;cursor:nwse-resize;z-index:2}
  .ev-panel-resize-grip{position:absolute;right:2px;bottom:2px;width:25px;height:25px;display:flex;align-items:center;justify-content:center;border:1px solid #b99acb;border-radius:8px 0 18px 0;background:#49375b;color:#f5eafa;font-size:16px;line-height:1;touch-action:none;user-select:none;cursor:nwse-resize;z-index:8;opacity:.9}
  .ev-toolbar{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:8px;background:#e9deef;border-bottom:1px solid #cbb8d7}
  .ev-tool{min-width:34px;height:34px;padding:0 8px;border:1px solid #c4afcf;border-radius:9px;background:#fff;color:#46364f;font-size:12px;font-weight:700;cursor:pointer;touch-action:manipulation}
  .ev-tool:active{background:#d9c5e6}
  .ev-tool-select{height:34px;max-width:120px;border:1px solid #c4afcf;border-radius:9px;background:#fff;color:#46364f;padding:0 6px;font-size:11px}
  .ev-colour{width:35px;height:34px;padding:3px;border:1px solid #c4afcf;border-radius:9px;background:#fff}
  .ev-toolbar-label{font-size:10px;color:#4b3a53;padding-left:2px}
  .ev-rich-editor{width:100%;min-height:180px;height:100%;overflow:auto;resize:none;padding:15px 14px 36px;background:#fbf8fd;color:#2c2433;font:14px/1.65 Georgia,'Times New Roman',serif;outline:none;overflow-wrap:anywhere;touch-action:pan-y}
  .ev-rich-editor:empty:before{content:attr(data-placeholder);color:#9b8ca3;pointer-events:none}
  .ev-rich-editor img{max-width:100%;height:auto;display:block;margin:12px auto;border-radius:10px}
  .ev-editor-sizebar{display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:8px 10px;background:#efe7f3;border-top:1px solid #cbb8d7}
  .ev-editor-sizebar span{font-size:10px;color:#55465f}
  .ev-editor-footer{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-top:12px}
  .ev-editor-footer .ev-btn{flex:1 1 100px}
  .ev-writing-mode .ev-main{display:flex;flex-direction:column}
  .ev-writing-mode .ev-note-edit-card{flex:1;display:flex;flex-direction:column}
  .ev-writing-mode .ev-editor-shell{flex:1;min-height:0}
  .ev-writing-mode .ev-editor-shell{flex:1;min-height:0}
  .ev-writing-mode .ev-rich-editor-wrap{flex:1;min-height:320px;height:auto!important}
  .ev-writing-mode .ev-rich-editor{flex:1;min-height:320px;height:100%!important}
  .ev-writing-mode .ev-panel-resize-grip{display:none}
  @media(max-width:360px){.ev-header{padding:11px}.ev-main{padding:11px 9px 18px}.ev-page-title{font-size:22px}.ev-tabs{padding:7px}.ev-tab{flex-basis:60px;padding:8px 4px;font-size:10px}.ev-toolbar{gap:4px;padding:6px}.ev-tool{min-width:31px;height:32px}}
  @media(prefers-reduced-motion:no-preference){.ev-panel{animation:ev-in .18s ease-out}@keyframes ev-in{from{opacity:.7;transform:translateY(5px) scale(.99)}to{opacity:1;transform:none}}}
  `;

  function button(label, action, cls = "", disabled = false) {
    return `<button type="button" class="ev-btn ${cls}" data-action="${esc(action)}" ${disabled ? "disabled" : ""}>${label}</button>`;
  }
  function tab(id, label) { return `<button type="button" class="ev-tab" data-tab="${id}" aria-selected="${activeTab === id}">${label}</button>`; }
  function panelShell(page) {
    const writing = activeTab === "notes" && !!editingNote;
    return `<style>${css}</style><div class="ev-root"><section class="ev-panel ${writing && editorExpanded ? "ev-writing-mode" : ""}" aria-label="Evermore story journal">
      <header class="ev-header"><div class="ev-head-top"><div><div class="ev-brand">Evermore <small>✧</small></div><div class="ev-tagline">Your story, lovingly remembered</div></div><button type="button" class="ev-close" data-action="close" aria-label="Close journal">×</button></div>
      <div class="ev-chatline"><span class="ev-dot"></span><span class="ev-chatname">${chatId ? esc(chatName || "Current roleplay") : "No roleplay chat open"}</span></div></header>
      ${writing ? "" : `<nav class="ev-tabs" aria-label="Journal sections">${tab("scenes","✧ Scenes")}${tab("characters","♡ Cast")}${tab("notes","✎ Notes")}${tab("settings","⚙ Settings")}</nav>`}
      <main class="ev-main">${page}<div class="ev-toast" role="status" aria-live="polite">${esc(toastMessage)}</div></main>
      ${writing ? "" : `<footer class="ev-footer">A LITTLE ARCHIVE OF YOUR IMAGINED WORLDS</footer>`}
      <div class="ev-panel-resize-grip" role="button" tabindex="0" aria-label="Drag to resize Evermore" title="Drag to resize panel">◢</div>
    </section></div>`;
  }
  function render() {
    // Preserve a live note draft before any external state refresh rebuilds the panel.
    if (expanded && editingNote && root.querySelector("#ev-note-body")) stashDraftFromEditor();
    if (!expanded) {
      root.innerHTML = `<style>${css}</style><div class="ev-root"><div class="ev-launcher-wrap"><button class="ev-launcher" type="button" aria-label="Open Evermore" title="Open Evermore">✧</button></div></div>`;
      root.querySelector(".ev-launcher").addEventListener("click", openJournal);
      resize(false);
      return;
    }
    const page = activeTab === "scenes" ? scenesPage() : activeTab === "characters" ? charactersPage() : activeTab === "notes" ? notesPage() : settingsPage();
    root.innerHTML = panelShell(page);
    root.querySelector('[data-action="close"]')?.addEventListener("click", closeJournal);
    root.querySelectorAll("[data-tab]").forEach(el => el.addEventListener("click", () => {
      if (editingNote) saveDraftNow();
      activeTab = el.dataset.tab; editingNote = null; editorExpanded = false; render();
    }));
    root.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", () => handleAction(el.dataset.action, el)));
    root.querySelectorAll("[data-format]").forEach(el => el.addEventListener("mousedown", ev => ev.preventDefault()));
    root.querySelectorAll("[data-format]").forEach(el => el.addEventListener("click", () => formatEditor(el.dataset.format)));
    root.querySelectorAll("[data-tool]").forEach(el => el.addEventListener("mousedown", ev => ev.preventDefault()));
    root.querySelectorAll("[data-tool]").forEach(el => el.addEventListener("click", () => formatEditor(el.dataset.tool)));
    const editor = root.querySelector("#ev-note-body");
    if (editor) {
      editor.addEventListener("keyup", rememberSelection);
      editor.addEventListener("mouseup", rememberSelection);
      editor.addEventListener("touchend", rememberSelection, { passive: true });
      editor.addEventListener("input", () => { rememberSelection(); queueAutosave(); });
    }
    const title = root.querySelector("#ev-note-title");
    if (title) title.addEventListener("input", queueAutosave);
    const sizeSelect = root.querySelector("#ev-font-size");
    if (sizeSelect) {
      sizeSelect.addEventListener("pointerdown", rememberSelection);
      sizeSelect.addEventListener("mousedown", rememberSelection);
      sizeSelect.addEventListener("change", () => applyFontSize(sizeSelect.value));
    }
    root.querySelector(".ev-panel-resize-grip")?.addEventListener("pointerdown", startPanelResize);
    root.querySelector(".ev-editor-resize-grip")?.addEventListener("pointerdown", startEditorResize);
    const blockSelect = root.querySelector("#ev-block-style");
    blockSelect?.addEventListener("change", () => formatEditor(blockSelect.value));
    root.querySelector("#ev-text-colour")?.addEventListener("input", e => formatEditor("foreColor", e.target.value));
    root.querySelector("#ev-highlight-colour")?.addEventListener("input", e => formatEditor("hiliteColor", e.target.value));
    root.querySelector("#ev-image-file")?.addEventListener("change", handleImagePick);
    resize(true);
    if (editor) editor.style.height = "100%";
  }

  function plainToHtml(value) { return esc(value || "").replace(/\r?\n/g, "<br>"); }
  function sanitizeNoteHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    const allowed = new Set(["P","BR","H1","H2","H3","H4","UL","OL","LI","BLOCKQUOTE","STRONG","B","EM","I","U","S","SPAN","DIV","IMG"]);
    const cleanNode = node => {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || "");
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const tag = node.tagName;
      if (!allowed.has(tag)) {
        const frag = document.createDocumentFragment();
        Array.from(node.childNodes).forEach(child => frag.appendChild(cleanNode(child)));
        return frag;
      }
      const clean = document.createElement(tag.toLowerCase());
      if (tag === "IMG") {
        const src = node.getAttribute("src") || "";
        if (!src.startsWith("/api/v1/images/")) return document.createDocumentFragment();
        clean.setAttribute("src", src);
        clean.setAttribute("alt", (node.getAttribute("alt") || "Note image").slice(0, 160));
        const imageId = node.getAttribute("data-ev-image-id");
        if (imageId) clean.setAttribute("data-ev-image-id", imageId.slice(0, 120));
        return clean;
      }
      const style = node.getAttribute("style") || "";
      const safeStyles = [];
      const colour = style.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([\d.,% ]+\)|[a-z]{3,20})\s*(?:;|$)/i);
      const bg = style.match(/(?:^|;)\s*background-color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([\d.,% ]+\)|[a-z]{3,20})\s*(?:;|$)/i);
      const size = style.match(/(?:^|;)\s*font-size\s*:\s*(\d{1,2}(?:\.\d+)?(?:px|pt|em|rem|%))\s*(?:;|$)/i);
      const align = style.match(/(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)\s*(?:;|$)/i);
      if (colour) safeStyles.push(`color:${colour[1]}`);
      if (bg) safeStyles.push(`background-color:${bg[1]}`);
      if (size) safeStyles.push(`font-size:${size[1]}`);
      if (align) safeStyles.push(`text-align:${align[1]}`);
      if (safeStyles.length) clean.setAttribute("style", safeStyles.join(";"));
      Array.from(node.childNodes).forEach(child => clean.appendChild(cleanNode(child)));
      return clean;
    };
    const fragment = document.createDocumentFragment();
    Array.from(template.content.childNodes).forEach(child => fragment.appendChild(cleanNode(child)));
    const holder = document.createElement("div"); holder.appendChild(fragment);
    return holder.innerHTML;
  }
  function safeBodyHtml(note) {
    const source = note?.bodyHtml || plainToHtml(note?.body || "");
    return sanitizeNoteHtml(source);
  }
  function currentEditorHtml() {
    const editor = root.querySelector("#ev-note-body");
    return editor ? sanitizeNoteHtml(editor.innerHTML) : (editingNote?.draft?.bodyHtml || editingNote?.bodyHtml || "");
  }
  function stashDraftFromEditor() {
    if (!editingNote) return;
    const title = root.querySelector("#ev-note-title")?.value ?? editingNote.title ?? "";
    const bodyHtml = currentEditorHtml();
    const editor = root.querySelector("#ev-note-body");
    const body = editor?.innerText ?? editingNote.body ?? "";
    const fontSize = editor?.style.fontSize || editingNote.fontSize || "14px";
    editingNote.draft = { title, body, bodyHtml, fontSize };
    noteDraftCache = { ...editingNote };
  }
  function saveDraftNow() {
    clearTimeout(autosaveTimer);
    if (!editingNote) return;
    stashDraftFromEditor();
    const draft = editingNote?.draft;
    const isExisting = (archive.notes || []).some(note => note.id === editingNote.id);
    const hasContent = !!(draft?.title?.trim() || draft?.body?.trim() || /<img\b/i.test(draft?.bodyHtml || ""));
    if (draft && (isExisting || hasContent)) request("evermore:autosave-note", { note: { id: editingNote.id, title: draft.title || "Untitled note", body: draft.body || "", bodyHtml: draft.bodyHtml || "", fontSize: draft.fontSize || "14px" } });
  }
  function queueAutosave() {
    if (!editingNote) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveDraftNow, 1300);
  }
  function rememberSelection() {
    const editor = root.querySelector("#ev-note-body");
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    // Keep the last range inside the editor. Toolbar focus can collapse the
    // browser selection outside contenteditable on mobile, so don't overwrite it.
    if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
  }

  function startPanelResize(event) {
    if (editorExpanded) return;
    event.preventDefault(); event.stopPropagation();
    const v = viewport();
    panelResizeDrag = { x: event.clientX, y: event.clientY, width: panelWidth || Math.min(460, v.width - 24), height: panelHeight || Math.min(780, v.height - 24) };
    window.addEventListener("pointermove", movePanelResize, { passive: false });
    window.addEventListener("pointerup", stopPanelResize, { once: true });
    window.addEventListener("pointercancel", stopPanelResize, { once: true });
  }
  function movePanelResize(event) {
    if (!panelResizeDrag) return;
    event.preventDefault();
    const v = viewport();
    panelWidth = Math.max(300, Math.min(v.width - 24, panelResizeDrag.width + event.clientX - panelResizeDrag.x));
    panelHeight = Math.max(400, Math.min(v.height - 24, panelResizeDrag.height + event.clientY - panelResizeDrag.y));
    widget.setSize(panelWidth, panelHeight);
  }
  function stopPanelResize() {
    panelResizeDrag = null;
    window.removeEventListener("pointermove", movePanelResize);
    window.removeEventListener("pointerup", stopPanelResize);
    window.removeEventListener("pointercancel", stopPanelResize);
  }
  function startEditorResize(event) {
    if (editorExpanded) return;
    event.preventDefault(); event.stopPropagation();
    editorResizeDrag = { y: event.clientY, height: editorHeight };
    window.addEventListener("pointermove", moveEditorResize, { passive: false });
    window.addEventListener("pointerup", stopEditorResize, { once: true });
    window.addEventListener("pointercancel", stopEditorResize, { once: true });
  }
  function moveEditorResize(event) {
    if (!editorResizeDrag) return;
    event.preventDefault();
    editorHeight = Math.max(180, Math.min(1000, editorResizeDrag.height + event.clientY - editorResizeDrag.y));
    const wrap = root.querySelector(".ev-rich-editor-wrap");
    if (wrap) wrap.style.height = `${editorHeight}px`;
  }
  function stopEditorResize() {
    editorResizeDrag = null;
    window.removeEventListener("pointermove", moveEditorResize);
    window.removeEventListener("pointerup", stopEditorResize);
    window.removeEventListener("pointercancel", stopEditorResize);
  }
  function restoreSelection() {
    const editor = root.querySelector("#ev-note-body");
    if (!editor) return false;
    editor.focus();
    const selection = window.getSelection?.();
    if (!selection) return false;
    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges(); selection.addRange(savedRange); return true;
    }
    return false;
  }
  function formatEditor(command, value = null) {
    const editor = root.querySelector("#ev-note-body");
    if (!editor) return;
    restoreSelection();
    if (command === "h2" || command === "h3" || command === "p" || command === "blockquote") {
      document.execCommand("formatBlock", false, `<${command}>`);
    } else if (command === "foreColor" || command === "hiliteColor") {
      document.execCommand(command, false, value || "#805b99");
    } else if (command === "removeFormat") {
      document.execCommand("removeFormat", false, null);
    } else {
      document.execCommand(command, false, null);
    }
    rememberSelection(); queueAutosave();
  }
  function applyFontSize(size) {
    const editor = root.querySelector("#ev-note-body");
    if (!editor) return;
    const safeSize = /^\d{1,2}px$/.test(String(size)) ? String(size) : "14px";
    const saved = savedRange && editor.contains(savedRange.commonAncestorContainer) ? savedRange.cloneRange() : null;
    if (saved && !saved.collapsed) {
      const selection = window.getSelection?.();
      if (!selection) return;
      try {
        selection.removeAllRanges(); selection.addRange(saved);
        const range = selection.getRangeAt(0);
        const span = document.createElement("span"); span.style.fontSize = safeSize;
        span.appendChild(range.extractContents()); range.insertNode(span);
        const next = document.createRange(); next.selectNodeContents(span);
        selection.removeAllRanges(); selection.addRange(next); savedRange = next.cloneRange();
        say(`Selected text set to ${safeSize}.`);
      } catch {
        // If the browser cannot restore a partial selection, change the page's
        // default text size instead of making the control appear to do nothing.
        editor.style.fontSize = safeSize;
        say(`Writing text size set to ${safeSize}.`);
      }
    } else {
      // No text selected: make the size apply to the whole note and new typing.
      editor.style.fontSize = safeSize;
      say(`Writing text size set to ${safeSize}.`);
    }
    queueAutosave();
  }

  function connectionOptions() {
    return connections.map(c => `<option value="${esc(c.id)}" ${c.id === selectedConnectionId ? "selected" : ""}>${esc(c.name || "Connection")} · ${esc(c.provider || "AI")} / ${esc(c.model || "default")}</option>`).join("");
  }
  function connectionControls() {
    const currentName = activeConnectionInfo ? `${activeConnectionInfo.name || activeConnectionInfo.provider || "Active Lumiverse connection"}${activeConnectionInfo.model ? ` · ${activeConnectionInfo.model}` : ""}` : "Reading active connection…";
    return `<label class="ev-label" for="ev-connection-mode">AI connection for scene recording</label>
      <select class="ev-select" id="ev-connection-mode"><option value="current" ${connectionMode === "current" ? "selected" : ""}>Use current Lumiverse connection</option><option value="separate" ${connectionMode === "separate" ? "selected" : ""}>Choose another connection</option></select>
      <div class="ev-connection-current"><strong>Currently active:</strong> ${esc(currentName)}</div>
      ${connectionMode === "separate" ? `<label class="ev-label" for="ev-connection-choice">Choose connection</label><select class="ev-select" id="ev-connection-choice"><option value="">Select a connection…</option>${connectionOptions()}</select>` : ""}`;
  }
  function scenesPage() {
    const scenes = (archive.scenes || []).map(s => `<article class="ev-card"><div class="ev-row"><span class="ev-date">${new Date(s.createdAt || Date.now()).toLocaleDateString()}</span><span class="ev-inline-label">${(s.characters || []).length} ${((s.characters || []).length === 1) ? "character" : "characters"}</span></div><h3 class="ev-card-title" style="margin-top:9px">${esc(s.title || "Untitled scene")}</h3><div class="ev-kicker" style="margin-top:6px">${esc(s.location || "Unspecified location")}</div><p class="ev-muted" style="margin:9px 0 0">${esc(s.summary || "No summary available.")}</p>${listBlock("Story beats", s.events)}${listBlock("Unresolved threads", s.unresolved)}<div class="ev-rule"></div>${button("Delete scene", "delete-scene", "ev-btn-danger")}<span hidden data-scene-id="${esc(s.id)}"></span></article>`).join("");
    return `<div class="ev-kicker">The chronicle</div><h2 class="ev-page-title">Your story, preserved.</h2><p class="ev-intro">A quiet little place for the moments, twists and feelings you don't want to lose.</p>
      <div class="ev-stats"><div class="ev-stat"><strong>${(archive.scenes || []).length}</strong><span>Scenes</span></div><div class="ev-stat"><strong>${(archive.characters || []).length}</strong><span>Characters</span></div><div class="ev-stat"><strong>${(archive.notes || []).length}</strong><span>Notes</span></div></div>
      <section class="ev-card"><div class="ev-kicker">Preserve a moment</div><h3 class="ev-card-title" style="margin:5px 0">Record a scene</h3><p class="ev-muted">Evermore checks the currently open Lumiverse chat, reads its recent messages and drafts a structured scene note for you to review.</p>${connectionControls()}<button type="button" class="ev-btn" data-action="analyse" ${busy ? "disabled" : ""}>${busy ? "Preparing your scene…" : "✧ Record recent scene"}</button><div class="ev-inline-label" style="margin-top:8px">Your message archive is kept separately for each roleplay chat.</div></section>
      <div class="ev-section"><h3 class="ev-section-title">Recorded scenes</h3><span class="ev-pill">Latest first</span></div>${scenes || `<div class="ev-empty"><div class="ev-empty-mark">✧</div><p>Your first chapter is waiting.</p><span class="ev-muted">Send a few roleplay messages, then record your first scene.</span></div>`}`;
  }
  function listBlock(label, items) { return Array.isArray(items) && items.length ? `<div class="ev-kicker" style="margin-top:12px">${label}</div><ul class="ev-list">${items.slice(0,8).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""; }
  function charactersPage() {
    const chars = archive.characters || [];
    return `<div class="ev-kicker">The people in your pages</div><h2 class="ev-page-title">Character keepsakes</h2><p class="ev-intro">Names are added from recorded scenes. Evermore keeps this list within the current roleplay chat for now.</p>${chars.map(c => `<article class="ev-card"><div class="ev-row"><h3 class="ev-card-title">♡ ${esc(c.name)}</h3><span class="ev-pill">Character</span></div><div class="ev-muted" style="margin-top:6px">Appears in this chat's recorded story.</div></article>`).join("") || `<div class="ev-empty"><div class="ev-empty-mark">♡</div><p>No character cards yet.</p><span class="ev-muted">Record a scene to start collecting the cast.</span></div>`}`;
  }
  function notesPage() {
    if (!editingNote && noteDraftCache) editingNote = { ...noteDraftCache };
    if (editingNote) return noteEditor();
    const notes = (archive.notes || []).map(n => `<article class="ev-card"><div class="ev-row"><div style="min-width:0"><div class="ev-kicker">Notebook page</div><h3 class="ev-card-title">${esc(n.title || "Untitled note")}</h3></div><span class="ev-date">${new Date(n.updatedAt || Date.now()).toLocaleDateString()}</span></div><div class="ev-note-body" style="font-size:${esc(n.fontSize || "13px")}">${safeBodyHtml(n) || "<em>An empty page.</em>"}</div><div class="ev-rule"></div><div class="ev-note-actions">${button("Edit page", `edit:${n.id}`, "ev-btn-ghost")}${button("Delete", `delete-note:${n.id}`, "ev-btn-danger")}</div></article>`).join("");
    return `<div class="ev-row"><div><div class="ev-kicker">Little thoughts & details</div><h2 class="ev-page-title">Your notebook</h2></div>${button("＋ New page", "new-note")}</div><p class="ev-intro">${chatId ? "Pages saved for this roleplay chat." : "Your personal pages are available here, even when no roleplay chat is open."} Keep promises, lore, ideas and details you want to remember. Your pages save as you write.</p>${notes || `<div class="ev-empty"><div class="ev-empty-mark">✎</div><p>A fresh page, just for you.</p><span class="ev-muted">Create your first note whenever you're ready.</span></div>`}`;
  }
  function noteEditor() {
    const n = editingNote;
    const draft = n.draft || n;
    const html = sanitizeNoteHtml(draft.bodyHtml || plainToHtml(draft.body || ""));
    const initialFontSize = /^\d{1,2}px$/.test(String(draft.fontSize || n.fontSize || "")) ? (draft.fontSize || n.fontSize) : "14px";
    return `<div class="ev-kicker">Notebook · ${n.id.startsWith("note-") ? "New page" : "Edit page"}</div><div class="ev-row"><h2 class="ev-page-title">A page of your own</h2>${button(editorExpanded ? "↙ Restore" : "⤢ Expand", "expand-editor", "ev-btn-ghost")}</div>
      <label class="ev-label" for="ev-note-title">Page title</label><input id="ev-note-title" class="ev-input" maxlength="140" placeholder="Give this memory a name…" value="${esc(draft.title || "")}"/>
      <div class="ev-label">Your note</div>
      <div class="ev-editor-shell"><div class="ev-toolbar" aria-label="Text formatting">
        <button type="button" class="ev-tool" data-format="bold" title="Bold"><b>B</b></button><button type="button" class="ev-tool" data-format="italic" title="Italic"><i>I</i></button><button type="button" class="ev-tool" data-format="underline" title="Underline"><u>U</u></button><button type="button" class="ev-tool" data-format="removeFormat" title="Clear formatting">Tx</button>
        <select id="ev-block-style" class="ev-tool-select" aria-label="Text style"><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option></select>
        <select id="ev-font-size" class="ev-tool-select" aria-label="Text size"><option value="12px" ${initialFontSize === "12px" ? "selected" : ""}>12 px</option><option value="14px" ${initialFontSize === "14px" ? "selected" : ""}>14 px</option><option value="16px" ${initialFontSize === "16px" ? "selected" : ""}>16 px</option><option value="18px" ${initialFontSize === "18px" ? "selected" : ""}>18 px</option><option value="20px" ${initialFontSize === "20px" ? "selected" : ""}>20 px</option><option value="24px" ${initialFontSize === "24px" ? "selected" : ""}>24 px</option><option value="28px" ${initialFontSize === "28px" ? "selected" : ""}>28 px</option><option value="32px" ${initialFontSize === "32px" ? "selected" : ""}>32 px</option></select>
        <label class="ev-toolbar-label" for="ev-text-colour">Text</label><input id="ev-text-colour" class="ev-colour" type="color" value="#604477" aria-label="Text colour"/>
        <label class="ev-toolbar-label" for="ev-highlight-colour">Highlight</label><input id="ev-highlight-colour" class="ev-colour" type="color" value="#f4d8ef" aria-label="Highlight colour"/>
        <button type="button" class="ev-tool" data-format="insertUnorderedList" title="Bullet list">• List</button><button type="button" class="ev-tool" data-format="insertOrderedList" title="Numbered list">1. List</button>
        <button type="button" class="ev-tool" data-action="add-image" title="Insert photo">▧ Photo</button>
      </div>
      <div class="ev-rich-editor-wrap" style="height:${editorHeight}px"><div id="ev-note-body" class="ev-rich-editor" style="font-size:${initialFontSize}" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write the little details you want to keep…">${html}</div><div class="ev-editor-resize-grip" role="button" tabindex="0" aria-label="Drag to make the writing box taller or shorter" title="Drag to resize writing area">◢</div></div>
      <div class="ev-editor-sizebar"><span>Writing area · drag the lower corner or adjust its height</span><div>${button("−", "editor-smaller", "ev-btn-ghost")}${button("＋", "editor-larger", "ev-btn-ghost")}</div></div></div>
      <input id="ev-image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden />
      <div class="ev-editor-footer">${button("Close", "cancel-note", "ev-btn-ghost")}${button("Save page", "save-note")}</div><div class="ev-inline-label" style="margin-top:7px">Formatting, photos and text are saved automatically while you write.</div>`;
  }
  function settingsPage() {
    return `<div class="ev-kicker">A few details</div><h2 class="ev-page-title">Journal settings</h2><p class="ev-intro">Choose which Lumiverse AI connection Evermore uses for scene recording.</p>
      <article class="ev-card"><h3 class="ev-card-title">AI connection</h3>${connectionControls()}<p class="ev-muted">“Current Lumiverse connection” follows the profile you have active in Lumiverse. “Choose another connection” uses the specific profile selected below.</p></article>
      <article class="ev-card"><h3 class="ev-card-title">Current archive</h3><p class="ev-muted">${chatId ? `This journal is storing notes and captured messages for <strong>${esc(chatName || "the current chat")}</strong>.` : "Your personal notebook is available from the home screen. Scene archives are kept separately inside each roleplay chat."}</p><div class="ev-rule"></div><div class="ev-row"><span class="ev-muted">Captured messages</span><strong>${(archive.messages || []).length}</strong></div><div class="ev-row" style="margin-top:8px"><span class="ev-muted">Saved scenes</span><strong>${(archive.scenes || []).length}</strong></div><div class="ev-row" style="margin-top:8px"><span class="ev-muted">Notebook pages</span><strong>${(archive.notes || []).length}</strong></div></article>
      <article class="ev-card ev-card-soft"><h3 class="ev-card-title">Manual notes</h3><p class="ev-muted">Use headings, text sizes, colours, highlights, lists, quotes and imported photos. Expand the editor or resize its writing area while editing.</p></article>
      <article class="ev-card ev-card-soft"><h3 class="ev-card-title">Privacy & accuracy</h3><p class="ev-muted">Captured messages and notes stay in Lumiverse's private extension storage. Recording a scene sends the recent excerpt to the connection you choose. AI-generated summaries are drafts, not automatically verified canon.</p></article>
      <article class="ev-card ev-card-soft"><h3 class="ev-card-title">About this build</h3><p class="ev-muted">Evermore 0.3.4 preview. Automatic message capture and manual scene recording are included. Automatic scene-boundary detection, shared cross-chat character profiles and archive export are not included yet.</p></article>`;
  }

  async function refreshConnections() {
    try {
      const rows = await Promise.resolve(ctx.connections?.list?.() || []);
      const active = await Promise.resolve(ctx.connections?.getActive?.() || null);
      activeConnectionId = active?.activeProfileId || rows.find(c => c.active)?.id || "";
      activeConnectionInfo = rows.find(c => c.id === activeConnectionId) || (active ? { id: activeConnectionId, provider: active.provider, model: active.model, name: active.provider } : null);
      connections = rows.map(c => ({ ...c, active: c.id === activeConnectionId }));
      if (!selectedConnectionId && activeConnectionId) selectedConnectionId = activeConnectionId;
      if (expanded) render();
    } catch (error) {
      console.warn("[Evermore] Could not read Lumiverse connection profiles", error);
    }
  }
  async function persistConnectionSettings() {
    request("evermore:save-settings", { settings: { connectionMode, connectionId: selectedConnectionId } });
  }
  function handleChange(event) {
    const id = event.target?.id;
    if (id === "ev-connection-mode") {
      connectionMode = event.target.value === "separate" ? "separate" : "current";
      if (connectionMode === "separate" && !selectedConnectionId && activeConnectionId) selectedConnectionId = activeConnectionId;
      persistConnectionSettings(); render();
    } else if (id === "ev-connection-choice") {
      selectedConnectionId = event.target.value || "";
      persistConnectionSettings();
    }
  }
  function openJournal() {
    expanded = true; toastMessage = ""; resize(true); render();
    request("evermore:get-active"); request("evermore:get-settings");
    refreshConnections();
  }
  function closeJournal() {
    if (editingNote) saveDraftNow();
    expanded = false; editorExpanded = false; editingNote = null; render();
  }
  function say(message) {
    toastMessage = message;
    const el = root.querySelector(".ev-toast"); if (el) el.textContent = message;
  }
  async function handleAction(action, element) {
    if (action === "close") { closeJournal(); return; }
    if (action === "new-note") {
      editingNote = { id: `note-${Date.now()}`, title: "", body: "", bodyHtml: "", fontSize: "14px" }; noteDraftCache = null; activeTab = "notes"; editorExpanded = false; render(); return;
    }
    if (action.startsWith("edit:")) {
      const note = archive.notes.find(n => n.id === action.slice(5));
      if (note) { editingNote = { ...note }; noteDraftCache = null; editorExpanded = false; render(); }
      return;
    }
    if (action === "cancel-note") {
      saveDraftNow();
      editingNote = null; noteDraftCache = null; editorExpanded = false; render(); return;
    }
    if (action === "save-note") {
      if (!editingNote) return;
      clearTimeout(autosaveTimer); stashDraftFromEditor();
      const draft = editingNote.draft || editingNote;
      request("evermore:save-note", { note: { id: editingNote.id, title: draft.title?.trim() || "Untitled note", body: draft.body || "", bodyHtml: draft.bodyHtml || "", fontSize: draft.fontSize || "14px" } });
      say("Saving your page…"); editingNote = null; noteDraftCache = null; editorExpanded = false; return;
    }
    if (action.startsWith("delete-note:")) {
      if (window.confirm("Delete this notebook page?")) request("evermore:delete-note", { noteId: action.slice(12) });
      return;
    }
    if (action === "delete-scene") {
      const id = element.parentElement?.querySelector("[data-scene-id]")?.dataset.sceneId;
      if (id && window.confirm("Delete this scene record?")) request("evermore:delete-scene", { sceneId: id }); return;
    }
    if (action === "analyse") {
      if (busy) return;
      if (connectionMode === "separate" && !selectedConnectionId) { say("Choose a connection profile in Settings first."); return; }
      busy = true; say("Checking the open chat and reading its recent messages…"); render();
      request("evermore:analyse", { mode: connectionMode, connectionId: selectedConnectionId }); return;
    }
    if (action === "add-image") {
      rememberSelection(); root.querySelector("#ev-image-file")?.click(); return;
    }
    if (action === "expand-editor") {
      editorExpanded = !editorExpanded; resize(true); render(); return;
    }
    if (action === "editor-larger" || action === "editor-smaller") {
      editorHeight = Math.max(220, Math.min(900, editorHeight + (action === "editor-larger" ? 100 : -100)));
      const wrap = root.querySelector(".ev-rich-editor-wrap"); if (wrap) wrap.style.height = `${editorHeight}px`;
      return;
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith("image/")) return reject(new Error("Please choose an image file."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that photo."));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const img = new Image();
        img.onerror = () => resolve({ dataUrl, filename: file.name || "photo" });
        img.onload = () => {
          const maxSide = 1800; const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
          const g = canvas.getContext("2d");
          if (!g) return resolve({ dataUrl, filename: file.name || "photo" });
          g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height); g.drawImage(img, 0, 0, canvas.width, canvas.height);
          let optimized = canvas.toDataURL("image/jpeg", 0.82);
          if (optimized.length > 3_300_000) optimized = canvas.toDataURL("image/jpeg", 0.68);
          resolve({ dataUrl: optimized, filename: (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg" });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }
  async function handleImagePick(event) {
    const files = Array.from(event.target?.files || []); event.target.value = "";
    if (!files.length || uploading) return;
    const editor = root.querySelector("#ev-note-body"); if (!editor) return;
    rememberSelection(); uploading = true; say("Preparing photo…");
    try {
      for (const file of files.slice(0, 5)) {
        const item = await compressImage(file);
        if (item.dataUrl.length > 3_500_000) throw new Error("That photo is too large to upload. Try a smaller image.");
        const id = `evermore-image-${++seq}`; pendingImageRequest = id; pendingUploadError = "";
        request("evermore:upload-image", { requestId: id, dataUrl: item.dataUrl, filename: item.filename });
        // The backend response inserts each image before the next one is sent.
        await new Promise((resolve, reject) => {
          const started = Date.now();
          const check = () => {
            if (pendingImageRequest !== id) return pendingUploadError ? reject(new Error(pendingUploadError)) : resolve();
            if (Date.now() - started > 45000) return reject(new Error("Photo upload timed out. Please try again."));
            setTimeout(check, 250);
          };
          check();
        });
      }
      say("Photo added to your page."); queueAutosave();
    } catch (error) { say(error?.message || "Could not add that photo."); }
    finally { uploading = false; pendingImageRequest = null; }
  }
  function insertUploadedImage(image) {
    if (!image?.url || !String(image.url).startsWith("/api/v1/images/")) { say("The image uploaded, but Lumiverse returned an unsupported image address."); return; }
    const editor = root.querySelector("#ev-note-body"); if (!editor) return;
    restoreSelection();
    const img = document.createElement("img"); img.src = image.url; img.alt = image.filename || "Note photo";
    if (image.id) img.dataset.evImageId = image.id;
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(img);
      const after = document.createRange(); after.setStartAfter(img); after.collapse(true); selection.removeAllRanges(); selection.addRange(after); savedRange = after.cloneRange();
    } else { editor.appendChild(img); }
    editor.focus(); queueAutosave();
  }

  root.addEventListener("change", handleChange);
  document.addEventListener("selectionchange", rememberSelection);
  const unsubscribe = ctx.onBackendMessage(payload => {
    if (!payload?.type?.startsWith("evermore:")) return;
    if (payload.type === "evermore:active-chat") {
      const nextChatId = payload.chatId || null;
      const changed = chatId !== nextChatId;
      if (changed && editingNote) { saveDraftNow(); editingNote = null; noteDraftCache = null; editorExpanded = false; }
      chatId = nextChatId; chatName = payload.chatName || "";
      if (expanded && changed) { archive = { chatId, chatName, messages: [], scenes: [], notes: [], characters: [] }; render(); request("evermore:get"); }
      else if (expanded) { render(); request("evermore:get"); }
    } else if (payload.type === "evermore:settings") {
      connectionMode = payload.settings?.connectionMode === "separate" ? "separate" : "current";
      selectedConnectionId = payload.settings?.connectionId || selectedConnectionId || activeConnectionId;
      if (expanded) render();
    } else if (payload.type === "evermore:archive") {
      archive = payload.archive || archive; busy = false;
      if (payload.action === "analyse" && payload.chatId) { chatId = payload.chatId; chatName = archive.chatName || chatName; }
      if (expanded && !editingNote) render();
      else if (expanded) say("Page saved.");
    } else if (payload.type === "evermore:note-saved") {
      if (payload.chatId && payload.chatId !== chatId) return;
      if (payload.note) {
        const index = archive.notes.findIndex(n => n.id === payload.note.id);
        if (index >= 0) archive.notes[index] = payload.note; else archive.notes.unshift(payload.note);
      }
      if (expanded && !editingNote && activeTab === "notes") render();
      else if (expanded) say("Saved automatically.");
    } else if (payload.type === "evermore:image-uploaded") {
      insertUploadedImage(payload.image || {});
      if (payload.requestId === pendingImageRequest) pendingImageRequest = null;
    } else if (payload.type === "evermore:error") {
      busy = false;
      if (pendingImageRequest) {
        pendingUploadError = payload.error || "Image upload failed.";
        pendingImageRequest = null;
        if (editingNote) stashDraftFromEditor();
      }
      say(payload.error || "Something went wrong.");
      if (expanded) render();
    }
  });
  const unsubscribeConnection = ctx.connections?.subscribe?.(() => refreshConnections());
  const onViewportResize = () => { if (expanded) resize(true); };
  window.visualViewport?.addEventListener("resize", onViewportResize);
  request("evermore:get-active"); request("evermore:get-settings");
  refreshConnections(); render();

  return () => {
    clearTimeout(autosaveTimer);
    unsubscribe?.(); unsubscribeConnection?.();
    root.removeEventListener("change", handleChange);
    document.removeEventListener("selectionchange", rememberSelection);
    stopPanelResize(); stopEditorResize();
    window.visualViewport?.removeEventListener("resize", onViewportResize);
    widget.destroy();
  };
}
