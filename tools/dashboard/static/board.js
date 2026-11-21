// The answer board: the right-hand panel where the owner approves the team's work.
// Polls /api/state every 1.5 s (paused while the tab is hidden) and answers via POST /api/answer.

const POLL_MS = 1500;
const MAX_ROUNDS = 3;
const LABELS = {
  approve: "Approve", changes: "Request changes", accept: "Accept anyway",
  directions: "Give directions", cancel: "Cancel", answer: "Send answer",
};
const ICONS = { approve: "✓", changes: "✎", accept: "✓", directions: "✎", cancel: "✕", answer: "➤" };
const NEEDS_TEXT = {
  changes: "Type what should change first, then press Request changes.",
  directions: "Type your directions first, then press Give directions.",
  answer: "Type your answer first, then press Send answer.",
};
const BOX_LABEL = { changes: "Your changes:", directions: "Your directions:", answer: "Your answer:" };
const KEY_MSG = "Studio key missing — reopen the link printed by <code>python -m tools.dashboard</code>";
const TRACK = { story: "STORY", owner: "YOU", voice: "VOICE", design: "DESIGN", animator: "ANIMATE" };
const THING = { story: "script", voice: "voice-over", design: "storyboard", animator: "video" };
const STUCK_ROLE = { 1: "story", 2: "voice", 3: "design", 4: "animator" };
const CHIME_KEY = "studio.chime";
const KEY_STORE = "studio.key"; // sessionStorage: survives a reload in this tab only
const FETCH_TIMEOUT_MS = 10000;

// 16x16 pixel clapperboard drawn from rects (no emoji font needed).
const CLAPPER = (() => {
  const px = [];
  const put = (x, y, c) => px.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`);
  const W = "#f6efd9", D = "#2b2f3d", L = "#7fc7e8";
  for (let y = 1; y <= 4; y++) for (let x = 1; x <= 14; x++) put(x, y, ((x + y) >> 2) % 2 ? W : D); // arm
  for (let y = 6; y <= 7; y++) for (let x = 1; x <= 14; x++) put(x, y, ((x + y) >> 2) % 2 ? W : D); // slate top
  px.push(`<rect x="1" y="8" width="14" height="7" fill="${D}"/>`);
  px.push(`<rect x="3" y="10" width="10" height="1" fill="${L}"/><rect x="3" y="12" width="6" height="1" fill="${L}"/>`);
  return `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">${px.join("")}</svg>`;
})();

const S = {
  el: null, key: "", runs: [], run: null, userPicked: false, state: null, loaded: false,
  sent: {}, sending: false, msg: null, armed: null, armTimer: null, seen: new Set(), first: true,
  cache: {}, playing: null, audio: null, chime: true, lastReqId: null, timer: null, busy: false,
  offline: false, parts: {},
};

// ---------- small helpers ----------
const str = (v, d = "") => (v === null || v === undefined ? d : String(v));
const esc = (v) => str(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fileUrl = (run, path) =>
  `/files/${encodeURIComponent(run)}/${str(path).split("/").map(encodeURIComponent).join("/")}`;
function fmtDur(s) {
  const n = Math.round(Number(s));
  if (!Number.isFinite(n)) return "?";
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
// escape, then show `ticks` as code (review files are markdown)
const inlineCode = (v) => esc(v).replace(/`([^`]+)`/g, "<code>$1</code>");
function setHTML(el, html) {
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
}
function store(get, value) {
  try {
    if (get) return localStorage.getItem(CHIME_KEY);
    localStorage.setItem(CHIME_KEY, value);
  } catch { /* storage blocked: keep the in-memory value */ }
  return null;
}

function roleFor(st) {
  const cp = str(st && st.request ? st.request.checkpoint : "");
  const m = /^stuck-gate-(\d)$/.exec(cp);
  if (m) return STUCK_ROLE[m[1]] || "story";
  if (cp.startsWith("gate-1")) return "story";
  if (cp === "gate-2") return "voice";
  if (cp === "final") return "animator";
  return THING[str(st && st.step)] ? str(st.step) : "story";
}
function nameOf(st, role) {
  const t = st && st.team && st.team[role];
  return t && t.name ? str(t.name) : "The team";
}

// cached text fetch of a run file; re-renders when it arrives
function runText(run, path, tag) {
  const k = `${tag}|${run}|${path}`;
  if (!(k in S.cache)) {
    S.cache[k] = undefined;
    fetch(fileUrl(run, path))
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((t) => { S.cache[k] = t; render(); });
  }
  return S.cache[k]; // undefined = loading, null = missing
}

function narrationLines(md, n) {
  const out = [];
  let scene = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^##\s*Scene\s+(\d+)/i.exec(line);
    if (h) scene = h[1];
    const m = /^\*\*Narration:\*\*\s*(.*)$/.exec(line.trim());
    if (m && m[1]) out.push({ scene, text: m[1] });
    if (out.length >= n) break;
  }
  return out;
}
function mustFixLines(md) {
  const out = [];
  let inside = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^##\s/.test(line)) { inside = /^##\s*Must-fix/i.test(line); continue; }
    const m = /^\s*[-*]\s+(.*)$/.exec(line);
    if (inside && m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

// ---------- sections ----------
function headerHTML(st) {
  let h = `<div class="brand"><span>▣ VIDEO AGENT STUDIO</span></div>`;
  if (S.runs.length > 1) {
    h += `<select id="run-picker" aria-label="Choose a video">` + S.runs.map((r) =>
      `<option value="${esc(r.run)}"${r.run === S.run ? " selected" : ""}>${esc(r.topic || r.run)} (${esc(stateWord(r.state))})</option>`
    ).join("") + `</select>`;
  }
  else if (st) {
    h += `<div class="topic" title="${esc(st.run)}">${esc(st.topic || st.run)}</div>`;
  }
  if (S.offline) {
    h += `<div class="msg err">Can't reach the studio server — is <code>python -m tools.dashboard</code> still running?</div>`;
  }
  return h;
}
function stateWord(s) {
  return ({ waiting_owner: "needs you", failed: "stuck", working: "working",
    reviewing: "in review", fixing: "fixing", done: "done", starting: "starting" })[str(s)] || str(s, "?");
}

function trackHTML(st) {
  if (!st || !Array.isArray(st.track) || !st.track.length) return "";
  return `<ol class="track" aria-label="Progress">` + st.track.map((t) => {
    const status = ["done", "active"].includes(str(t && t.status)) ? t.status : "pending";
    const step = str(t && t.step);
    const mark = step === "final" ? "" : status === "done" ? "✓ " : status === "active" ? "▶ " : "";
    const label = step === "final" ? CLAPPER : esc(TRACK[step] || step.toUpperCase());
    return `<li class="${status}" title="${esc(step)}: ${status}">${mark}${label}</li>`;
  }).join("") + `</ol>`;
}

function linksHTML(run, links) {
  const seen = new Set();
  const items = [];
  for (const l of links) {
    if (!l || !l.path || seen.has(str(l.path))) continue;
    seen.add(str(l.path));
    items.push(`<a href="${esc(fileUrl(run, l.path))}" target="_blank" rel="noopener">▸ ${esc(l.label || l.path)}</a>`);
  }
  return items.length ? `<div class="links">${items.join("")}</div>` : "";
}

function gate1Extras(st, req) {
  const sm = st.summary || {};
  let h = "";
  const reviewer = nameOf(st, "reviewer");
  if (st.summary) {
    const gate = str(sm.gate);
    const cls = gate === "PASS" ? "pass" : gate === "FIX" ? "fix" : "";
    if (gate) h += `<p class="body">${esc(reviewer)}: <span class="${cls}">${esc(gate)}</span>${sm.round ? ` · round ${esc(sm.round)}/${MAX_ROUNDS}` : ""}</p>`;
    h += `<div class="facts">${esc(sm.scenes)} scenes · ${esc(sm.words)} words · ~${fmtDur(sm.est_seconds)} min</div>`;
  }
  const md = runText(st.run, "01-script/script.md", req.id);
  h += `<div class="label">PREVIEW</div><div class="box">`;
  if (md === undefined) h += `<p>Loading the script…</p>`;
  else if (md === null) h += `<p>The script file could not be opened.</p>`;
  else {
    const lines = narrationLines(md, 2);
    h += lines.length ? lines.map((l) => `<p>Scene ${esc(l.scene || "?")} — ${esc(l.text)}</p>`).join("")
      : `<p>No narration found in the script.</p>`;
  }
  h += `</div>`;
  const links = [{ label: "Full script", path: "01-script/script.md" }];
  if (sm.round) links.push({ label: `${reviewer}'s review`, path: `review/gate-1-round-${sm.round}.md` });
  return { html: h, links };
}

function gate2Extras(st) {
  const v = st.voice;
  if (!v) return { html: `<p class="facts">The voice files are not ready yet.</p>`, links: [] };
  let h = `<div class="facts">${esc(v.voice || "?")} · speed ${esc(v.speed ?? "?")} · ${fmtDur(v.total_s)} min</div>`;
  const scenes = Array.isArray(v.scenes) ? v.scenes : [];
  h += `<div class="label">LISTEN</div><div class="plays">` + scenes.map((s) => {
    const src = fileUrl(st.run, s && s.path);
    const on = S.playing === src;
    return `<button class="btn play${on ? " playing" : ""}" data-act="play" data-src="${esc(src)}">${on ? "■ Stop" : `▶ Scene ${esc(s && s.id)}`}</button>`;
  }).join("") + `</div>`;
  return { html: h, links: [] };
}

function stuckExtras(st, req) {
  const n = /^stuck-gate-(\d)$/.exec(str(req.checkpoint))[1];
  const path = `review/gate-${n}-round-${str(st.round, MAX_ROUNDS)}.md`;
  const md = runText(st.run, path, req.id);
  const reviewer = nameOf(st, "reviewer");
  let h = `<p class="body">${esc(reviewer)}: still <span class="fix">FIX</span> after ${esc(st.round)} rounds.</p><div class="label">OPEN MUST-FIX ITEMS</div><div class="box">`;
  if (md === undefined) h += `<p>Loading ${esc(reviewer)}'s review…</p>`;
  else if (md === null) h += `<p>${esc(reviewer)}'s review file was not found.</p>`;
  else {
    const items = mustFixLines(md);
    h += items.length ? `<ul class="mustfix">${items.map((i) => `<li>${inlineCode(i)}</li>`).join("")}</ul>` : `<p>No must-fix items listed.</p>`;
  }
  h += `</div>`;
  return { html: h, links: md ? [{ label: `${reviewer}'s review`, path }] : [] };
}

function videoLinks(st) {
  const v = st.video;
  if (!v || !v.path) return [];
  const out = [{ label: "Watch the video", path: v.path }];
  if (v.credits) out.push({ label: "Credits", path: v.credits });
  return out;
}

function mainHTML(st) {
  if (!S.loaded) return `<p class="meta">Connecting to the studio…</p>`;
  if (!st) {
    return `<div class="label">NOW</div><p class="idle">No video running. Start one with /make-video in Claude Code.</p>`;
  }
  const req = st.request;
  const ans = st.answered;
  const mine = req && S.sent[req.id];
  if (req && !mine) {
    const cp = str(req.checkpoint);
    let extra = { html: "", links: [] };
    if (cp.startsWith("gate-1")) extra = gate1Extras(st, req);
    else if (cp === "gate-2") extra = gate2Extras(st);
    else if (/^stuck-gate-\d$/.test(cp)) extra = stuckExtras(st, req);
    else if (cp === "final") extra = { html: "", links: videoLinks(st) };
    const links = [...(Array.isArray(req.links) ? req.links : []), ...extra.links];
    return `<h2 class="waiting">⚑ WAITING FOR YOU</h2>
      <div class="req-title">${esc(req.title || "A question from the team")}</div>
      ${req.body ? `<p class="body">${esc(req.body)}</p>` : ""}
      ${extra.html}${linksHTML(st.run, links)}`;
  }
  if (ans || mine) {
    const a = ans || mine;
    const who = nameOf(st, roleFor(st));
    const head = str(a.source) === "chat" ? "Answered in chat" : `Sent ✓ — ${esc(who)} is on it`;
    const said = LABELS[str(a.decision)] || str(a.decision);
    return `<h2 class="status ok">${head}</h2>
      <p class="body">Your answer: <b>${esc(said)}</b>${a.text ? ` — “${esc(a.text)}”` : ""}</p>
      <p class="meta">If Claude Code doesn’t continue within a minute, type anything in the chat (or run /make-video --resume).</p>`;
  }
  if (str(st.state) === "done" || str(st.step) === "done") {
    return `<h2 class="status ok">${CLAPPER} Done</h2>
      <p class="body">“${esc(st.topic || st.run)}” is finished.</p>${linksHTML(st.run, videoLinks(st))}`;
  }
  return `<div class="label">NOW</div><h2 class="status">${esc(nowText(st))}</h2>`;
}

function nowText(st) {
  const step = str(st.step);
  const who = nameOf(st, THING[step] ? step : "story");
  const thing = THING[step] || "work";
  const round = `round ${str(st.round, 1)}/${MAX_ROUNDS}`;
  switch (str(st.state)) {
    case "starting": return "Getting the run ready…";
    case "working": return `${who} is working on the ${thing}`;
    case "reviewing": return `${nameOf(st, "reviewer")} is checking the ${thing} (${round})`;
    case "fixing": return `${who} is fixing the ${thing} (${round})`;
    case "waiting_owner": case "failed": return "Waiting for your answer in Claude Code";
    default: return `${who}: ${str(st.state, "…")}`;
  }
}

function activityHTML(st) {
  const ev = st && Array.isArray(st.events) ? st.events.slice(-8) : [];
  if (!ev.length) return "";
  return `<div class="label">ACTIVITY</div><ul class="activity">` + ev.map((e) =>
    `<li class="k-${esc(e && e.kind)}"><time>${esc(e && e.time)}</time><span>${esc(e && e.text)}</span></li>`
  ).join("") + `</ul>`;
}

function controlsVisible(st) {
  const req = st && st.request;
  return !!(req && !st.answered && !S.sent[req.id]);
}

function renderControls(st) {
  const P = S.parts;
  const show = controlsVisible(st);
  P.controls.hidden = !show;
  if (!show) return;
  const req = st.request;
  if (S.lastReqId !== req.id) {
    S.lastReqId = req.id;
    P.reply.value = "";
    P.reply.classList.remove("need");
    S.msg = S.key ? null : { html: KEY_MSG, err: true };
    disarm();
  }
  const opts = (Array.isArray(req.options) ? req.options : []).map(str).filter((o) => LABELS[o]);
  setHTML(P.decisions, opts.map((o) =>
    `<button class="btn decision ${o}${S.armed === o ? " armed" : ""}" data-act="decide" data-decision="${o}"${S.sending ? " disabled" : ""}><span aria-hidden="true">${ICONS[o]}</span>${LABELS[o]}</button>`
  ).join(""));
  const need = opts.find((o) => BOX_LABEL[o]);
  P.label.textContent = need ? BOX_LABEL[need] : "Note (optional):";
  P.reply.placeholder = need ? `Needed for ${LABELS[need]} — e.g. “make scene 3 simpler for kids”` : "Optional note";
  P.reply.disabled = S.sending;
  setHTML(P.msg, S.msg ? `<span class="${S.msg.err ? "err" : ""}">${S.msg.html}</span>` : "");
  P.msg.className = "msg" + (S.msg && S.msg.err ? " err" : "");
}

// ---------- public render ----------
/** The latest /api/state the board shows (null when there is no run); the studio map reads it. */
export function getBoardState() {
  return S.state;
}

export function renderBoard(state) {
  S.state = state || null;
  render();
}

function render() {
  const st = S.state;
  const P = S.parts;
  if (!P.header) return;
  setHTML(P.header, headerHTML(st));
  setHTML(P.track, trackHTML(st));
  setHTML(P.main, mainHTML(st));
  renderControls(st);
  setHTML(P.activity, activityHTML(st));
  setHTML(P.footer, `<button class="chime" data-act="chime" aria-pressed="${S.chime}" title="Soft chime and a browser notification when the team needs you">♪ Chime: ${S.chime ? "on" : "off"}</button>`);
  if (S.loaded) S.el.dataset.ready = "1";
}

// ---------- actions ----------
function setMsg(html, err) { S.msg = html ? { html, err: !!err } : null; render(); }
function disarm() { clearTimeout(S.armTimer); S.armed = null; }

async function decide(decision) {
  const st = S.state;
  const req = st && st.request;
  if (!req || S.sending) return;
  const text = S.parts.reply.value.trim();
  if (NEEDS_TEXT[decision] && !text) {
    S.parts.reply.classList.add("need");
    S.parts.reply.focus();
    return setMsg(NEEDS_TEXT[decision], true);
  }
  S.parts.reply.classList.remove("need");
  if (decision === "cancel" && S.armed !== "cancel") {
    disarm();
    S.armed = "cancel";
    S.armTimer = setTimeout(() => { if (S.armed === "cancel") { S.armed = null; setMsg(null); } }, 8000);
    return setMsg("Click Cancel again to stop this video — or wait and nothing happens.", false);
  }
  disarm();
  if (!S.key) return setMsg(KEY_MSG, true);
  S.sending = true;
  setMsg(null);
  let msg = null;
  try {
    const r = await fetchT("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Studio-Key": S.key },
      body: JSON.stringify({ run: str(st.run), id: str(req.id), decision, text }),
    });
    let body = {};
    try { body = await r.json(); } catch { /* non-JSON error body */ }
    if (r.ok) S.sent[req.id] = { decision, text, source: "board" };
    else if (r.status === 409 && body.error === "already answered") msg = "Already answered";
    else if (r.status === 409) msg = "This request is no longer open";
    else if (r.status === 403) msg = KEY_MSG;
    else msg = `The studio refused that answer (${esc(body.error || r.status)}).`;
  } catch {
    msg = "Couldn't reach the studio server — is <code>python -m tools.dashboard</code> still running?";
  }
  S.sending = false;
  setMsg(msg, true);
  tick();
}

async function copyReply() {
  const text = S.parts.reply.value.trim() || "approve";
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const t = document.createElement("textarea");
    t.value = text; document.body.appendChild(t); t.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    t.remove();
  }
  setMsg(ok ? `Copied ✓ “${esc(text)}” — paste it into Claude Code.` : "Couldn't copy — select the text and copy it by hand.", !ok);
}

function play(src) {
  if (!S.audio) {
    S.audio = new Audio();
    S.audio.addEventListener("ended", () => { S.playing = null; render(); });
    S.audio.addEventListener("error", () => { S.playing = null; render(); });
  }
  if (S.playing === src) { S.audio.pause(); S.playing = null; }
  else { S.audio.src = src; S.audio.play().catch(() => { S.playing = null; render(); }); S.playing = src; }
  render();
}

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.15);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + i * 0.16); o.stop(t0 + i * 0.16 + 0.16);
    });
  } catch { /* no audio available */ }
}
function announce(st) {
  const req = st && st.request;
  if (!req || S.seen.has(req.id)) return;
  S.seen.add(req.id);
  if (S.first || !S.chime) return;
  beep();
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Studio: waiting for you", { body: str(req.title) });
    }
  } catch { /* notifications unavailable */ }
}
function toggleChime() {
  S.chime = !S.chime;
  store(false, S.chime ? "on" : "off");
  if (S.chime) {
    beep();
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* ignore */ }
  }
  render();
}

// ---------- polling ----------
// fetch that gives up after FETCH_TIMEOUT_MS so a hung server can't stall polling
async function fetchT(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const body = await r.text(); // read inside the timeout too
    return { ok: r.ok, status: r.status, json: async () => JSON.parse(body) };
  } finally {
    clearTimeout(t);
  }
}

// runs arrive newest first. Follow the newest run that needs the owner (an open,
// unanswered request), else the most recent run -- but never override a run the
// owner picked by hand in the run picker during this page session.
function pickRun(runs) {
  const cur = runs.find((r) => r.run === S.run);
  if (cur && S.userPicked) return;
  S.userPicked = false;
  if (cur && cur.needs_you) return;
  S.run = (runs.find((r) => r.needs_you) || runs[0] || { run: null }).run;
}

async function tick() {
  clearTimeout(S.timer);
  if (document.hidden || S.busy) return;
  S.busy = true;
  try {
    const rr = await fetchT("/api/runs");
    const data = rr.ok ? await rr.json() : [];
    S.runs = (Array.isArray(data) ? data : []).filter((r) => r && r.run !== null && r.run !== undefined)
      .map((r) => ({ run: str(r.run), topic: str(r.topic), step: str(r.step), state: str(r.state),
        needs_you: r.needs_you === true }));
    pickRun(S.runs);
    let st = null;
    if (S.run) {
      const r = await fetchT("/api/state?run=" + encodeURIComponent(S.run));
      st = r.ok ? await r.json() : null;
      if (st && typeof st !== "object") st = null;
    }
    S.offline = false;
    S.loaded = true;
    announce(st);
    S.first = false;
    renderBoard(st);
  } catch {
    S.offline = true;
    render();
  } finally {
    S.busy = false;
    if (!document.hidden) S.timer = setTimeout(tick, POLL_MS);
  }
}

// ---------- start ----------
export function startBoard(el) {
  S.el = el;
  const url = new URL(location.href);
  S.key = url.searchParams.get("key") || "";
  try {
    if (S.key) sessionStorage.setItem(KEY_STORE, S.key);
    else S.key = sessionStorage.getItem(KEY_STORE) || "";
  } catch { /* storage blocked: memory only */ }
  if (url.searchParams.has("key")) {
    url.searchParams.delete("key");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  S.chime = store(true) !== "off";
  el.innerHTML = `<section data-part="header"></section><section data-part="track"></section>
    <section data-part="main"></section>
    <section data-part="controls" hidden>
      <div class="decisions" data-part="decisions"></div>
      <div class="msg" data-part="msg" role="status"></div>
      <div id="reply-wrap"><label for="reply" data-part="label"></label>
        <textarea id="reply" placeholder="Type here… e.g. “make scene 3 simpler for kids”"></textarea></div>
      <div class="copy-row"><button class="btn copy" data-act="copy"><span aria-hidden="true">⧉</span>Copy reply</button>
        <span class="meta">paste it in Claude Code instead</span></div>
    </section>
    <section data-part="activity"></section>
    <section class="footer" data-part="footer"></section>`;
  for (const n of el.querySelectorAll("[data-part]")) S.parts[n.dataset.part] = n;
  S.parts.reply = el.querySelector("#reply");
  S.parts.reply.addEventListener("input", () => S.parts.reply.classList.remove("need"));
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === "decide") decide(b.dataset.decision);
    else if (act === "copy") copyReply();
    else if (act === "play") play(b.dataset.src);
    else if (act === "chime") toggleChime();
  });
  el.addEventListener("change", (e) => {
    if (e.target.id !== "run-picker") return;
    S.run = e.target.value;
    S.userPicked = true;
    S.state = null;
    S.loaded = false;
    render();
    tick();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  render();
  tick();
}
