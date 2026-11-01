// Evermore 0.1 — floating widget UI
export function setup(ctx) {
  const widget = ctx.ui.createFloatWidget({
    width: 58, height: 58, initialPosition: { x: 24, y: 160 },
    snapToEdge: true, tooltip: "Open Evermore", chromeless: true
  });
  const root = widget.root;
  let expanded = false;
  let activeTab = "scenes";
  let archive = { chatId: null, messages: [], scenes: [], notes: [] };
  let pending = new Map();
  let requestCounter = 0;
  let chatId = null;

  const style = document.createElement("style");
  style.textContent = `
    .ev-shell{font-family:Inter,ui-sans-serif,system-ui;color:#f4eefa}
    .ev-fab{width:56px;height:56px;border:1px solid #bda5d9;border-radius:50%;background:linear-gradient(145deg,#9275b7,#49345f);color:#fff;font-size:25px;box-shadow:0 8px 28px #21142c88;cursor:pointer}
    .ev-panel{width:min(370px,calc(100vw - 28px));height:min(610px,calc(100vh - 36px));background:#211a2d;border:1px solid #715a83;border-radius:22px;overflow:hidden;box-shadow:0 18px 60px #100b18aa;display:flex;flex-direction:column}
    .ev-head{padding:16px 17px 12px;background:linear-gradient(135deg,#3b2b4b,#251d35);border-bottom:1px solid #594566}
    .ev-brand{font:600 25px Georgia,serif;color:#f4dff8;letter-spacing:.3px}.ev-sub{font-size:9px;letter-spacing:2px;color:#c5aed4;margin-top:3px}
    .ev-close{border:0;background:#4a3859;color:#f6e9ff;border-radius:50%;width:30px;height:30px;cursor:pointer}
    .ev-tabs{display:flex;gap:6px;padding:10px 12px;background:#2a2037}
    .ev-tab{flex:1;border:1px solid #5b476c;border-radius:12px;padding:8px 3px;background:transparent;color:#d4c3df;font-size:11px;cursor:pointer}
    .ev-tab.active{background:#59436e;color:#fff;border-color:#a58ab9}
    .ev-body{padding:14px;overflow:auto;flex:1}
    .ev-kicker{font-size:10px;letter-spacing:1.6px;color:#c3a9d3;text-transform:uppercase}
    .ev-card{background:#30253d;border:1px solid #51405f;border-radius:15px;padding:13px;margin:9px 0}
    .ev-title{font:600 17px Georgia,serif;color:#f1ddf6}.ev-muted{font-size:12px;color:#c1b1cd;line-height:1.5}
    .ev-btn{border:1px solid #9c7bb0;background:#6e527f;color:white;border-radius:12px;padding:9px 12px;cursor:pointer;font-size:12px}
    .ev-ghost{background:#382c47;border-color:#655271}
    .ev-input,.ev-area{width:100%;box-sizing:border-box;background:#1d1728;border:1px solid #665174;border-radius:11px;padding:10px;color:#f8effb;margin:7px 0;font:13px inherit}
    .ev-area{min-height:115px;resize:vertical}.ev-row{display:flex;gap:8px;align-items:center;justify-content:space-between}
    .ev-empty{text-align:center;padding:28px 12px;color:#c4b4d0}.ev-pill{font-size:10px;color:#e7d5ee;background:#4a3859;padding:4px 8px;border-radius:99px}
  `;
  root.appendChild(style);

  function req(type, extra={}) {
    const requestId = `ev-${++requestCounter}`;
    ctx.sendToBackend({ type, requestId, chatId, ...extra });
    return requestId;
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  let connections = [];
  function currentChat() { return chatId; }
  function render() {
    if (!expanded) {
      root.innerHTML = `<div class="ev-shell"><button class="ev-fab" aria-label="Open Evermore">✧</button></div>`;
      root.querySelector("button").onclick = () => { expanded = true; widget.setSize(390, 650); render(); };
      widget.setSize(58,58);
      return;
    }
    const content = activeTab === "scenes" ? scenesView()
      : activeTab === "notes" ? notesView()
      : activeTab === "characters" ? charactersView()
      : settingsView();
    root.innerHTML = `<div class="ev-shell"><section class="ev-panel">
      <header class="ev-head"><div class="ev-row"><div><div class="ev-brand">✧ Evermore</div><div class="ev-sub">YOUR PERSONAL STORY ARCHIVE</div></div><button class="ev-close" aria-label="Close">×</button></div></header>
      <nav class="ev-tabs">${tab("scenes","Scenes")}${tab("characters","Cast")}${tab("notes","Notes")}${tab("settings","Settings")}</nav>
      <main class="ev-body">${content}</main>
    </section></div>`;
    root.querySelector(".ev-close").onclick = () => { expanded = false; render(); };
    root.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { activeTab=b.dataset.tab; render(); });
    root.querySelector("#ev-analyse")?.addEventListener("click", () => {
      const mode = root.querySelector("#ev-mode")?.value || "current";
      req("evermore:analyse", { mode, connectionId: root.querySelector("#ev-connection")?.value || "" });
      toast("Analysing recent messages…");
    });
    root.querySelector("#ev-mode")?.addEventListener("change", e => {
      const picker = root.querySelector("#ev-connection-wrap");
      if (picker) picker.hidden = e.target.value !== "separate";
    });
    root.querySelector("#ev-new-note")?.addEventListener("click", () => editNote());
    root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
      const n = archive.notes.find(x => x.id === b.dataset.edit); if(n) editNote(n);
    });
    root.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => req("evermore:delete-note",{noteId:b.dataset.delete}));
    widget.setSize(390,650);
  }
  function tab(id,label){return `<button class="ev-tab ${activeTab===id?'active':''}" data-tab="${id}">${label}</button>`;}
  function toast(msg){const el=root.querySelector("#ev-toast");if(el)el.textContent=msg;}
  function scenesView(){
    const scenes=(archive.scenes||[]).map(s=>`<article class="ev-card"><div class="ev-row"><span class="ev-pill">${new Date(s.createdAt).toLocaleDateString()}</span><span class="ev-muted">${(s.characters||[]).length} characters</span></div><h3 class="ev-title">${esc(s.title||"Untitled scene")}</h3><p class="ev-muted">${esc(s.summary||"")}</p><div class="ev-kicker">${esc(s.location||"Location unknown")}</div></article>`).join("");
    return `<div class="ev-row"><div><div class="ev-kicker">The chronicle</div><h2 class="ev-title">Your story, preserved.</h2></div><span class="ev-pill">${(archive.scenes||[]).length} scenes</span></div>
      <article class="ev-card"><div class="ev-title">A little moment worth remembering?</div><p class="ev-muted">Evermore can turn your recent roleplay into a structured scene record.</p><label class="ev-muted">Analysis model</label><select id="ev-mode" class="ev-input"><option value="current">Use active Lumiverse connection</option><option value="separate">Choose another connection</option></select><div id="ev-connection-wrap" hidden><select id="ev-connection" class="ev-input">${connections.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.model||c.provider||"AI")}</option>`).join("")}</select></div><button class="ev-btn" id="ev-analyse">✧ Record recent scene</button></article>
      <div class="ev-kicker">Recently recorded</div>${scenes||`<div class="ev-empty">✧<p>No scenes recorded yet.</p><span class="ev-muted">Your story archive begins here.</span></div>`}<div id="ev-toast" class="ev-muted"></div>`;
  }
  function notesView(){
    return `<div class="ev-row"><div><div class="ev-kicker">Your private pages</div><h2 class="ev-title">Notebook</h2></div><button class="ev-btn" id="ev-new-note">＋ New</button></div>
      ${(archive.notes||[]).map(n=>`<article class="ev-card"><div class="ev-row"><h3 class="ev-title">${esc(n.title)}</h3><span><button class="ev-btn ev-ghost" data-edit="${esc(n.id)}">Edit</button> <button class="ev-btn ev-ghost" data-delete="${esc(n.id)}">×</button></span></div><p class="ev-muted">${esc(n.body)}</p></article>`).join("")||`<div class="ev-empty">♡<p>Your notebook is waiting.</p></div>`}`;
  }
  function charactersView(){
    const names=[...new Set((archive.scenes||[]).flatMap(s=>s.characters||[]))];
    return `<div class="ev-kicker">The people in your pages</div><h2 class="ev-title">Character gallery</h2>${names.map(n=>`<article class="ev-card"><div class="ev-title">${esc(n)}</div><div class="ev-muted">Appears in your recorded scenes</div></article>`).join("")||`<div class="ev-empty">No characters extracted yet. Record a scene to begin.</div>`}`;
  }
  function settingsView(){
    return `<div class="ev-kicker">Make it yours</div><h2 class="ev-title">Archive settings</h2><article class="ev-card"><p class="ev-muted">Evermore stores captured chat messages and notes in its private extension storage, separated by chat. Shared character records and cross-chat search are planned for a later build.</p><p class="ev-muted">AI analysis is started manually in this prototype. Automatic scene-boundary detection will be added after we validate event behaviour in your Lumiverse installation.</p></article>`;
  }
  function editNote(note={id:`note-${Date.now()}`,title:"",body:""}){
    root.querySelector(".ev-body").innerHTML=`<div class="ev-kicker">A page of your own</div><h2 class="ev-title">Edit note</h2><input id="ev-note-title" class="ev-input" placeholder="Give this note a title" value="${esc(note.title)}"/><textarea id="ev-note-body" class="ev-area" placeholder="Write down the details…">${esc(note.body)}</textarea><div class="ev-row"><button class="ev-btn ev-ghost" id="ev-cancel">Cancel</button><button class="ev-btn" id="ev-save">Save note</button></div>`;
    root.querySelector("#ev-cancel").onclick=()=>render();
    root.querySelector("#ev-save").onclick=()=>req("evermore:save-note",{note:{id:note.id,title:root.querySelector("#ev-note-title").value,body:root.querySelector("#ev-note-body").value}});
  }
  const unsub = ctx.onBackendMessage(payload => {
    if(payload?.type==="evermore:active-chat"){chatId=payload.chatId; if(chatId)req("evermore:get");}
    if(payload?.type==="evermore:connections"){connections=payload.connections||[];render();}
    if(payload?.type==="evermore:archive"){archive=payload.archive||archive;render();}
    if(payload?.type==="evermore:saved"){archive=payload.archive||archive;activeTab="notes";render();}
    if(payload?.type==="evermore:error"){toast(payload.error||"Something went wrong.");}
  });
  req("evermore:get-active");
  req("evermore:get-connections");
  render();
  return () => { unsub?.(); off?.(); widget.destroy(); style.remove(); };
}
