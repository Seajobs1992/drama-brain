// Popup for the LOCKED OUT Flow runner. Four steps (characters, uploads, frames, clips), one episode at a time.
// Talks to bridge.js on the Flow tab (start / createCharacters / listCharacters) and to background.js (getJobs, getCast).
const store = chrome.storage.local;
const $ = (id) => document.getElementById(id);
const DEFAULTS = { model: "Omni 1.2 Flash", imageModel: "Nano Banana 2.1", quality: "1080p", maxCredits: 30, timeoutMin: 15, maxActive: 3, useCharacters: true, frameSource: "file", downloadImages: true };
const TYPES = ["upload", "image", "video"];
const DONE = /^(downloaded|uploaded|in Flow|Flow clip)/;
const url = (p) => chrome.runtime.getURL(p);

let jobs = [], cast = [];
let selected = new Set();      // job keys
let castTicked = new Set();    // character names
let overrides = {};
let episode = "";
let tab = "video";
let active = { upload: null, image: null, video: null };
let lastState = {};
let projectId = "";   // the Flow project open in the tab; "in project" facts are kept per project

const byKey = () => Object.fromEntries(jobs.map((j) => [j.key, j]));
const epJobs = (type) => jobs.filter((j) => j.episode === episode && j.type === type);
const epTitle = (ep) => { const j = jobs.find((x) => x.episode === ep && x.episodeTitle); return `${ep.replace("EP0", "Episode ")}${j ? ": " + j.episodeTitle : ""}`; };
const epCast = () => { const names = new Set(jobs.filter((j) => j.episode === episode && j.type === "video").flatMap((j) => j.cast || [])); const inEp = cast.filter((c) => names.has(c.name)); return inEp.length ? inEp : cast; };
const thumbOf = (j) => j.type === "upload" ? url(`jobs/${j.file}`) : j.type === "image" ? url(`jobs/frames/${j.episode}/${j.id}.jpg`) : url(`jobs/frames/${j.frame}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

// ---------- start-up ----------
async function init() {
  jobs = (await chrome.runtime.sendMessage({ type: "getJobs" })).jobs || [];
  cast = (await chrome.runtime.sendMessage({ type: "getCast" })).cast || [];
  const st = await store.get(["settings", "selected", "castTicked", "promptOverrides", "episode", "tab", "active"]);
  const s = { ...DEFAULTS, ...(st.settings || {}) };
  $("model").value = s.model; $("imageModel").value = s.imageModel; $("quality").value = s.quality;
  $("maxCredits").value = String(s.maxCredits); $("maxActive").value = String(s.maxActive); $("timeout").value = String(s.timeoutMin);
  $("useChars").checked = s.useCharacters !== false; $("frameSource").value = s.frameSource || "file"; $("downloadImages").value = s.downloadImages === false ? "no" : "yes";
  selected = new Set(st.selected || []);
  overrides = st.promptOverrides || {};
  active = { ...active, ...(st.active || {}) };
  const eps = [...new Set(jobs.map((j) => j.episode))].sort();
  for (const ep of eps) { const o = document.createElement("option"); o.value = ep; o.textContent = epTitle(ep); $("episode").appendChild(o); }
  episode = eps.includes(st.episode) ? st.episode : eps[eps.length - 1];
  $("episode").value = episode;
  castTicked = new Set(st.castTicked || epCast().filter((c) => c.voice).map((c) => c.name));
  tab = st.tab || "video";
  showTab(tab);
  await whereAmI();
  await renderAll();
}

async function whereAmI() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  const ok = t && /^https:\/\/flow\.google\.com\/project\//.test(t.url || "");
  projectId = ok ? (t.url.match(/project\/([0-9a-f-]{36})/) || [])[1] || "" : "";
  lastState.flowOk = ok;
  lastState.flowTitle = ok ? ((t.title || "").replace(/^Google Flow\s*-\s*/, "") || "project open") : "";
  $("where").title = ok ? `Flow project: ${lastState.flowTitle}` : "";
  paintWhere();
}
function paintWhere() {
  const el = $("where");
  if (lastState.running) { el.className = "proj live"; $("whereText").textContent = "Running, see the Flow page"; return; }
  if (lastState.flowOk) { el.className = "proj ok"; $("whereText").textContent = lastState.flowTitle; }
  else if (lastState.flowOk === false) { el.className = "proj bad"; $("whereText").textContent = "Open your Flow project in this tab first"; }
}

// ---------- steps ----------
function showTab(name) {
  tab = name;
  document.querySelectorAll(".step").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("active", p.id === `pane-${name}`));
  store.set({ tab: name });
  if (name === "log") renderLog();
}
document.querySelectorAll(".step").forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
$("episode").onchange = async () => { episode = $("episode").value; await store.set({ episode }); renderAll(); };

// ---------- lists ----------
const castOf = (st) => (st.projectCasts || {})[projectId] || [];
async function renderAll() {
  const st = await store.get(["statuses", "castStatus", "projectCasts", "running", "rejections"]);
  lastState.running = !!st.running;
  lastState.statuses = st.statuses || {};
  lastState.rejections = st.rejections || {};
  renderCast({ castStatus: st.castStatus || {}, projectCast: castOf(st) });
  for (const type of TYPES) renderList(type, st.statuses || {});
  $("stop").disabled = !st.running;
  paintWhere();
  updateCounts(st.statuses || {}, castOf(st));
}

function pill(status, okRe = DONE) {
  const s = document.createElement("span");
  const cls = !status ? "none" : okRe.test(status) ? "done" : /^(error|failed)|NOT SAVED/.test(status) ? "err" : "busy";
  s.className = `pill ${cls}`;
  s.textContent = status; s.title = status;
  return s;
}
function thumb(src) {
  const im = document.createElement("img");
  im.className = "th"; im.src = src; im.alt = "";
  im.onerror = () => im.classList.add("ph");
  return im;
}

function renderCast(st) {
  const { castStatus = {}, projectCast = [] } = st;
  const el = $("list-cast");
  el.innerHTML = "";
  for (const c of epCast()) {
    const row = document.createElement("div");
    row.className = "row";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = castTicked.has(c.name);
    cb.onchange = () => { cb.checked ? castTicked.add(c.name) : castTicked.delete(c.name); store.set({ castTicked: [...castTicked] }); renderAll(); };
    const id = document.createElement("b"); id.textContent = c.name;
    const t = document.createElement("span"); t.className = "t";
    t.textContent = `${c.voice ? "voice " + c.voice : "no voice chosen yet"}, ${c.picture ? "from " + c.source.split("/").pop() : "from a description"}`;
    const status = castStatus[c.name] || (projectCast.includes(c.name) ? "in project" : "");
    row.append(cb, c.picture ? thumb(url(`jobs/${c.picture}`)) : thumb(""), id, t, pill(status, /created|in project/));
    row.onclick = (e) => { if (e.target !== cb) { cb.checked = !cb.checked; cb.onchange(); } };
    el.appendChild(row);
  }
  $("note-cast").innerHTML = projectCast.length
    ? `<b>In this project now:</b> ${projectCast.join(", ")}.<br>Characters belong to one Flow project; a new project needs them made again.`
    : `Not checked for this project yet. Press <b>What is in the project?</b> to see which characters already exist there. Characters belong to one Flow project; a new project needs them made again.`;
}

// What an image job needs that neither the cast nor this episode's upload list provides.
function missingFor(j) {
  const have = new Set([...cast.map((c) => c.name), ...jobs.filter((x) => x.type === "upload" && x.episode === j.episode).map((x) => x.id)]);
  return (j.ingredients || []).filter((n) => !have.has(n));
}
function rowText(j) {
  if (j.type === "upload") return `${j.name}, from ${j.source.split("/").pop()}`;
  if (j.type === "image") return `${j.title}, from ${(j.ingredients || []).join(", ")}`;
  return `${j.title}, ${j.seconds} s${j.dialogue ? ", dialogue" : ""}${(j.cast || []).length ? ", " + j.cast.join(" and ") : ""}`;
}

function renderList(type, statuses) {
  const el = $(`list-${type}`);
  const scroll = el.scrollTop;
  el.innerHTML = "";
  const list = epJobs(type);
  if (!list.length) { const r = document.createElement("div"); r.className = "row empty"; r.textContent = `Nothing in this step for ${episode}.`; el.appendChild(r); }
  for (const j of list) {
    const row = document.createElement("div");
    row.className = "row" + (active[type] === j.key ? " active" : "");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = selected.has(j.key);
    cb.onchange = () => { cb.checked ? selected.add(j.key) : selected.delete(j.key); store.set({ selected: [...selected] }); renderAll(); };
    const id = document.createElement("b"); id.textContent = j.id;
    const t = document.createElement("span"); t.className = "t"; t.textContent = rowText(j);
    if (overrides[j.key]) { const e = document.createElement("span"); e.className = "edited"; e.textContent = "edited"; t.appendChild(e); }
    const miss = type === "image" ? missingFor(j) : [];
    const have = type === "image" && miss.length ? `needs ${miss.join(", ")}` : type === "image" && j.hasFile ? "approved file" : type === "video" && j.hasFlow ? "Flow clip" : type === "video" && j.hasKling ? "Kling clip" : "";
    const p = pill(statuses[j.key] || have, type === "image" ? /^(downloaded|in Flow|approved)/ : DONE);
    if (!statuses[j.key] && have === "Kling clip") p.className = "pill have";
    if (!statuses[j.key] && miss.length) p.className = "pill busy";
    row.append(cb, thumb(thumbOf(j)), id, t, p);
    row.onclick = (e) => { if (e.target !== cb) showDetail(type, j.key); };
    el.appendChild(row);
  }
  el.scrollTop = scroll;
  if (!active[type] || !list.some((j) => j.key === active[type])) active[type] = list[0] ? list[0].key : null;
  showDetail(type, active[type], true);
}

function updateCounts(statuses, projectCast) {
  const n = (type) => epJobs(type).filter((j) => selected.has(j.key)).length;
  const done = (type) => epJobs(type).filter((j) => DONE.test(statuses[j.key] || "") || (type === "video" && j.hasFlow)).length;
  const total = (type) => epJobs(type).length;
  const castIn = epCast().filter((c) => projectCast.includes(c.name)).length;
  $("nCast").textContent = projectCast.length ? `${castIn}/${epCast().length} in project` : plural(castTicked.size, "ticked", "ticked");
  for (const type of TYPES) {
    const el = $(`n${type[0].toUpperCase() + type.slice(1)}`);
    if (type === "image") {
      const approved = epJobs("image").filter((j) => j.hasFile).length;
      const made = done("image");
      el.textContent = n("image") ? `${n("image")} ticked` : total("image") ? `${approved}/${total("image")} approved${made ? `, ${made} made in Flow` : ""}` : "none";
      el.closest(".step").classList.toggle("done", total("image") > 0 && approved + made >= total("image"));
      $("count-image").textContent = n("image") ? `${plural(n("image"), "frame")} ticked` : approved === total("image") && total("image") ? "every frame already has an approved file; use this step only to remake one in Flow" : approved ? `${approved} approved files, ${total("image") - approved} without one` : "";
      continue;
    }
    if (type === "video") {
      const flow = epJobs("video").filter((j) => j.hasFlow || DONE.test(statuses[j.key] || "")).length;
      const kling = epJobs("video").filter((j) => j.hasKling).length;
      el.textContent = n("video") ? `${n("video")} ticked` : `${flow}/${total("video")} in Flow${kling ? `, ${kling} Kling` : ""}`;
      el.closest(".step").classList.toggle("done", total("video") > 0 && flow === total("video"));
      continue;
    }
    el.textContent = total(type) ? (n(type) ? `${n(type)} ticked` : `${done(type)}/${total(type)} done`) : "none";
    el.closest(".step").classList.toggle("done", total(type) > 0 && done(type) === total(type));
  }
  $("nCast").closest(".step").classList.toggle("done", projectCast.length > 0 && castIn === epCast().length);
  $("run-cast").disabled = castTicked.size === 0;
  $("run-cast").textContent = castTicked.size ? `Create ${plural(castTicked.size, "character")}` : "Create ticked characters";
  $("run-upload").disabled = n("upload") === 0;
  $("run-upload").textContent = n("upload") ? `Upload ${plural(n("upload"), "picture")}` : "Upload ticked";
  $("run-image").disabled = $("check-image").disabled = n("image") === 0;
  $("run-image").textContent = n("image") ? `Make ${plural(n("image"), "frame")}` : "Make ticked frames";
  const s = settings();
  const vids = epJobs("video").filter((j) => selected.has(j.key));
  const secs = vids.reduce((a, j) => a + j.seconds, 0);
  const cost = s.model === "Omni 1.2 Flash" ? `about ${secs * 3} credits` : `price checked per clip, limit ${s.maxCredits}`;
  $("run-video").disabled = $("check-video").disabled = $("regen-video").disabled = vids.length === 0;
  $("run-video").textContent = vids.length ? `Animate ${plural(vids.length, "clip")}` : "Animate ticked clips";
  $("count-video").textContent = vids.length ? `${plural(vids.length, "clip")} ticked, ${secs} s` : "";
  $("note-video").textContent = vids.length ? cost : "";
}

// ---------- detail panels ----------
function showDetail(type, key, quiet) {
  const j = byKey()[key];
  const box = $(`detail-${type}`);
  if (!j) { box.innerHTML = `<div class="purpose" style="padding:0;margin:auto 0">Tick an item above to see what it uses and what it costs.</div>`; return; }
  active[type] = key;
  if (!quiet) { store.set({ active }); const list = epJobs(type); document.querySelectorAll(`#list-${type} .row`).forEach((r, i) => r.classList.toggle("active", !!list[i] && list[i].key === key)); }
  const s = settings();
  const facts = [];
  let prompt = null, note = "", draft = false;
  const status = (lastState.statuses || {})[key] || "";
  const rej = (lastState.rejections || {})[key];
  if (/^(rejected|failed|error)/.test(status)) facts.push(["Flow said", status.replace(/^(rejected|failed|error):\s*/, "")]);
  else if (rej && /^(downloaded|in Flow)/.test(status)) facts.push(["Earlier", `rejected once ("${rej.reason}"), then accepted`]);
  if (type === "upload") {
    facts.push(["Goes into Flow as", j.name], ["From", j.source], ["Used by", "frames that name it as an ingredient"]);
  } else if (type === "image") {
    const miss = missingFor(j);
    facts.push(["Now", j.hasFile ? `approved file ${j.id}.jpg exists; this would make a new version in Flow` : "no approved file yet"], ["Made from", (j.ingredients || []).join(", ") + (miss.length ? ` (${miss.join(", ")} not in this episode's uploads list yet, so Flow cannot use it)` : "")], ["Model", `${s.imageModel}, 16:9, one take, 0 credits`], ["Named in Flow", j.id], ["Saved as", s.downloadImages === false ? "kept in Flow only" : `flow-frames/${j.id}.jpg`]);
    if (j.line && j.line !== "none") facts.push(["Line in this shot", j.line]);
    prompt = overrides[key] || j.fixPrompt || j.prompt;
    draft = !overrides[key] && !j.fixPrompt;
    note = overrides[key] ? "Edited: this version is sent" : j.fixPrompt ? "Fixed prompt from flow-fixes.json" : "Draft from the shot plan: add the continuity details before running";
  } else {
    const useCast = s.useCharacters && (j.cast || []).length;
    facts.push(["Now", [j.hasFlow ? `Flow clip exists (flow-clips/${j.id}.mp4); running again makes another take` : "", j.hasKling ? `Kling take exists (clips/${j.id}.mp4)` : ""].filter(Boolean).join("; ") || "no clip yet"]);
    facts.push(["Start frame", s.frameSource === "flow" ? `"${j.id}" made in Flow if it exists, else the approved file` : `approved file ${j.frame.split("/").pop()}, uploaded once and reused`]);
    facts.push(["Characters", useCast ? j.cast.map((n) => { const c = cast.find((x) => x.name === n); return c && c.voice ? `${n} (voice ${c.voice})` : n; }).join(", ") : "none, the setting is off"]);
    facts.push(["Model", `${s.model}, 16:9, 720p, ${/^Veo/.test(s.model) ? "8 s fixed" : j.seconds + " s"}, one take`]);
    facts.push(["Cost", s.model === "Omni 1.2 Flash" ? `about ${j.seconds * 3} credits` : "Flow's price is checked before starting"]);
    facts.push(["Saved as", `flow-clips/${j.id}.mp4, ${s.quality}`]);
    prompt = overrides[key] || j.fixPrompt || (useCast ? j.castPrompt || j.prompt : j.prompt);
    note = overrides[key] ? "Edited: this version is sent" : j.fixPrompt ? "Fixed prompt from flow-fixes.json" : useCast ? "From the script; the written voice tags are left out because the characters' own voices speak" : "From the script, word for word";
    if (j.altPrompt) facts.push(["If Flow refuses", "a softer prompt from flow-fixes.json is tried once"]);
  }
  const edited = !!overrides[key];
  box.innerHTML = `<div class="dhead"><img src="${thumbOf(j)}" alt=""><div class="dmeta"><div class="ttl">${j.id} ${j.title}${edited ? `<button class="quiet tiny" id="restore-${type}">Use the script's prompt</button>` : ""}</div><div class="facts">${facts.map(([k, v]) => `<span class="k">${k}</span><span class="v${/Line|Characters|Start/.test(k) ? " wrap" : ""}">${v}</span>`).join("")}</div></div></div>` +
    (prompt !== null ? `<div class="plabel${draft ? " draft" : ""}" id="note-prompt-${type}">${note}</div><textarea id="prompt-${type}" spellcheck="false" title="Edits save by themselves"></textarea>` : "");
  box.querySelector("img").onerror = function () { this.style.visibility = "hidden"; };
  if (prompt !== null) {
    const ta = $(`prompt-${type}`);
    ta.value = prompt;
    // Edits save themselves a moment after typing stops; nothing to press.
    const base = j.fixPrompt || (type === "video" && s.useCharacters && (j.cast || []).length ? j.castPrompt || j.prompt : j.prompt);
    let timer = null;
    ta.oninput = () => { clearTimeout(timer); timer = setTimeout(async () => { const text = ta.value.trim(); if (!text || text === base) delete overrides[key]; else overrides[key] = text; await store.set({ promptOverrides: overrides }); const st = await store.get("statuses"); renderListOnly(type, st.statuses || {}); $(`note-prompt-${type}`).textContent = overrides[key] ? "Edited: this version is sent" : note; $(`note-prompt-${type}`).className = "plabel" + (overrides[key] || !draft ? "" : " draft"); }, 400); };
    if (edited) $(`restore-${type}`).onclick = async () => { delete overrides[key]; await store.set({ promptOverrides: overrides }); renderAll(); };
  }
}
// Re-draws a list's rows (edited marks, status) without touching the panel the person is typing in.
function renderListOnly(type, statuses) {
  const el = $(`list-${type}`);
  epJobs(type).forEach((j, i) => { const row = el.children[i]; if (!row) return; const t = row.querySelector(".t"); if (!t) return; t.textContent = rowText(j); if (overrides[j.key]) { const e = document.createElement("span"); e.className = "edited"; e.textContent = "edited"; t.appendChild(e); } });
}

// ---------- tick buttons ----------
document.querySelectorAll("[data-tick]").forEach((b) => (b.onclick = async () => {
  const [type, what] = b.dataset.tick.split("-");
  const st = await store.get(["statuses", "projectCasts"]);
  const statuses = st.statuses || {}, projectCast = castOf(st);
  if (type === "cast") {
    if (what === "none") castTicked.clear();
    else for (const c of epCast()) if (what === "all" || !projectCast.includes(c.name)) castTicked.add(c.name);
    await store.set({ castTicked: [...castTicked] });
  } else {
    for (const j of epJobs(type)) {
      if (what === "none") selected.delete(j.key);
      else if (what === "all") selected.add(j.key);
      else if (what === "todo") { if (!DONE.test(statuses[j.key] || "") && !(j.type === "video" && j.hasFlow) && !(j.type === "image" && j.hasFile)) selected.add(j.key); }
      else if (what === "dialogue") { if (j.dialogue) selected.add(j.key); }
      else if (what === "rejected") { if (/^rejected/.test(statuses[j.key] || "")) selected.add(j.key); }
    }
    await store.set({ selected: [...selected] });
  }
  renderAll();
}));

// ---------- settings ----------
function settings() {
  return { model: $("model").value, imageModel: $("imageModel").value, quality: $("quality").value, maxCredits: Number($("maxCredits").value), timeoutMin: Number($("timeout").value), maxActive: Number($("maxActive").value), useCharacters: $("useChars").checked, frameSource: $("frameSource").value, downloadImages: $("downloadImages").value !== "no" };
}
["model", "imageModel", "quality", "maxCredits", "timeout", "maxActive", "useChars", "frameSource", "downloadImages"].forEach((id) => ($(id).onchange = async () => { await store.set({ settings: settings() }); renderAll(); }));

// ---------- running things ----------
async function flowTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!t || !/^https:\/\/flow\.google\.com\/project\//.test(t.url || "")) throw new Error("Open your LOCKED OUT project in Flow (flow.google.com/project/…) in this tab, then try again.");
  return t;
}
function say(text) { $("msg").textContent = text; }
function unsavedEdit() { return false; } // edits save themselves
async function start(mode, type, keys) {
  say("");
  try {
    const t = await flowTab();
    if (!keys.length) throw new Error("Tick at least one item in this step.");
    const { statuses = {}, submitted = [] } = await store.get(["statuses", "submitted"]);
    const inFlight = new Set(submitted.map((s) => s.key));
    for (const k of keys) if (statuses[k] && !DONE.test(statuses[k]) && !inFlight.has(k)) delete statuses[k];
    await store.set({ queue: keys, statuses, settings: settings(), mode, running: true });
    const r = await chrome.tabs.sendMessage(t.id, { type: "start" });
    if (!r || !r.ok) throw new Error((r && r.error) || "No answer from the Flow page. Reload the Flow tab and try again.");
    say(mode === "fill" ? "Filling the first ticked item in Flow without generating. Look at Flow's prompt box, then come back and press the run button." : `Running ${plural(keys.length, "item")}. Keep the Flow tab in front; the banner on the page shows progress.`);
    renderAll();
  } catch (e) {
    await store.set({ running: false });
    say(/Receiving end does not exist|Could not establish connection/.test(e.message) ? "The Flow tab has an old copy of the extension. Reload the Flow tab, then try again." : e.message);
    renderAll();
  }
}
const ticked = (type) => epJobs(type).filter((j) => selected.has(j.key)).map((j) => j.key);

$("run-upload").onclick = () => start("run", "upload", ticked("upload"));
$("check-image").onclick = () => start("fill", "image", ticked("image"));
$("run-image").onclick = () => { const n = ticked("image").length; if (confirm(`Make ${plural(n, "frame")} in Flow? 0 credits. Each is named after its frame in Flow and saved to flow-frames.`)) start("run", "image", ticked("image")); };
$("check-video").onclick = () => start("fill", "video", ticked("video"));
$("run-video").onclick = () => {
  const keys = ticked("video"); const s = settings();
  const secs = keys.reduce((a, k) => a + byKey()[k].seconds, 0);
  const est = s.model === "Omni 1.2 Flash" ? `About ${secs * 3} credits.` : `Flow's price is checked per clip (limit ${s.maxCredits}).`;
  if (confirm(`Animate ${plural(keys.length, "clip")} in Flow with ${s.model}, one take each? ${est}`)) start("run", "video", keys);
};
$("regen-video").onclick = async () => {
  const keys = ticked("video");
  if (!confirm(`Make another take of ${plural(keys.length, "clip")}? Earlier takes are kept; the new one saves as "4-02 (1).mp4". This uses credits.`)) return;
  const { statuses = {}, submitted = [] } = await store.get(["statuses", "submitted"]);
  for (const k of keys) delete statuses[k];
  await store.set({ statuses, submitted: submitted.filter((s) => !keys.includes(s.key)) });
  start("run", "video", keys);
};
$("run-cast").onclick = async () => {
  say("");
  const names = epCast().map((c) => c.name).filter((n) => castTicked.has(n));
  if (!confirm(`Create ${plural(names.length, "character")} in the open Flow project: ${names.join(", ")}? Free. Keep the Flow tab in front.`)) return;
  try {
    const t = await flowTab();
    await store.set({ running: true });
    const r = await chrome.tabs.sendMessage(t.id, { type: "createCharacters", names });
    if (!r || !r.ok) throw new Error((r && r.error) || "No answer from the Flow page. Reload the Flow tab and try again.");
    say("Creating the characters. Keep the Flow tab in front; the banner on the page shows progress.");
    renderAll();
  } catch (e) { await store.set({ running: false }); say(e.message); renderAll(); }
};
$("castCheck").onclick = async () => {
  say("");
  try {
    const t = await flowTab();
    const r = await chrome.tabs.sendMessage(t.id, { type: "listCharacters" });
    if (!r || !r.ok) throw new Error((r && r.error) || "No answer from the Flow page. Reload the Flow tab and try again.");
    const { projectCasts = {} } = await store.get("projectCasts");
    projectCasts[projectId] = r.names;
    await store.set({ projectCasts, castStatus: {} });
    renderAll();
  } catch (e) { say(e.message); }
};
$("stop").onclick = async () => { await store.set({ running: false }); say("Stopping after the current step. Items already generating in Flow keep going; press the run button later to collect them."); renderAll(); };
$("resetTicked").onclick = async () => {
  const { statuses = {}, submitted = [] } = await store.get(["statuses", "submitted"]);
  for (const k of selected) delete statuses[k];
  await store.set({ statuses, submitted: submitted.filter((s) => !selected.has(s.key)) });
  renderAll();
};
$("clearLog").onclick = async () => { await store.set({ log: [] }); renderLog(); };
$("saveReport").onclick = async () => {
  say("");
  const st = await store.get(["statuses", "rejections", "settings", "promptOverrides", "log"]);
  const mine = jobs.filter((j) => j.episode === episode);
  const report = {
    episode, savedAt: new Date().toISOString(), flowProject: lastState.flowTitle || "", settings: { ...DEFAULTS, ...(st.settings || {}) },
    items: mine.map((j) => ({ key: j.key, type: j.type, id: j.id, title: j.title, status: (st.statuses || {})[j.key] || (j.type === "video" && j.hasFlow ? "Flow clip on disk" : j.type === "video" && j.hasKling ? "Kling clip on disk" : j.type === "image" && j.hasFile ? "approved file on disk" : ""),
      promptSent: (st.promptOverrides || {})[j.key] || j.fixPrompt || j.prompt, rejection: (st.rejections || {})[j.key] || null })),
    rejected: mine.filter((j) => (st.rejections || {})[j.key]).map((j) => ({ key: j.key, id: j.id, reason: st.rejections[j.key].reason, promptRefused: st.rejections[j.key].prompt, fixGoesIn: `production/${episode}/flow-fixes.json under "${j.type === "image" ? "frame " + j.id : j.id}"` })),
    log: (st.log || []).slice(-150),
  };
  const r = await chrome.runtime.sendMessage({ type: "saveReport", report, filename: `LOCKED-OUT/${episode}/flow-report.json` });
  say(r && r.ok ? `Saved Downloads/LOCKED-OUT/${episode}/flow-report.json (${report.rejected.length} rejected). move_clips.sh moves it into the project.` : `Could not save the report: ${r && r.error}`);
};

async function renderLog() {
  const { log = [] } = await store.get("log");
  const el = $("log");
  el.textContent = log.length ? log.join("\n") : "Nothing has run yet.";
  el.scrollTop = el.scrollHeight;
}

chrome.storage.onChanged.addListener((c) => {
  if (c.log && tab === "log") renderLog();
  if (c.statuses || c.castStatus || c.running || c.projectCast) renderAll();
});

init();
