const store = chrome.storage.local;
const $ = (id) => document.getElementById(id);
let jobs = [];
let selected = new Set();
let activeKey = null;
let overrides = {};

const key = (j) => `${j.episode}/${j.id}`;
const byKey = () => Object.fromEntries(jobs.map((j) => [key(j), j]));

async function init() {
  jobs = await fetch(chrome.runtime.getURL("jobs/jobs.json")).then((r) => r.json());
  const st = await store.get(["settings", "selected", "promptOverrides", "activeKey"]);
  const s = { resolution: "720p", audioMode: "all", timeoutMin: 15, maxActive: 5, ...(st.settings || {}) };
  $("res").value = s.resolution;
  $("timeout").value = String(s.timeoutMin);
  $("maxActive").value = String(s.maxActive);
  selected = new Set(st.selected || []);
  overrides = st.promptOverrides || {};
  activeKey = st.activeKey || [...selected][0] || key(jobs[0]);
  await render();
  showDetail(activeKey);
  renderLog();
}

async function render() {
  const { statuses = {}, current } = await store.get(["statuses", "current"]);
  const list = $("list");
  const scroll = list.scrollTop;
  list.innerHTML = "";
  let ep = "";
  for (const j of jobs) {
    if (j.episode !== ep) {
      ep = j.episode;
      const h = document.createElement("div");
      h.className = "ep";
      h.textContent = { EP01: "Episode 1: The Deep Room", EP02: "Episode 2: Scrap", EP03: "Episode 3: The Evaluator", EP04: "Episode 4: What a Lock Tells You", IMAGES: "Images" }[ep] || ep;
      list.appendChild(h);
    }
    const k = key(j);
    const row = document.createElement("div");
    row.className = "job" + (k === activeKey ? " active" : "");
    row.dataset.key = k;
    row.onclick = (e) => { if (e.target.tagName !== "INPUT") showDetail(k); };
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selected.has(k);
    cb.onchange = () => { cb.checked ? selected.add(k) : selected.delete(k); saveSel(); };
    const id = document.createElement("b");
    id.textContent = j.id;
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = j.type === "image" ? `${j.title} · image · ${(j.refs || []).length} ref(s)` : `${j.title} · ${j.seconds}s${j.dialogue ? " · dialogue" : ""}`;
    if (overrides[k]) {
      const e = document.createElement("span");
      e.className = "edited";
      e.textContent = "edited";
      t.appendChild(e);
    }
    const s = document.createElement("span");
    let status = statuses[k] || "";
    if (current && current.key === k && !status) status = current.phase;
    s.className = "st " + (status === "downloaded" ? "downloaded" : /^(error|failed)/.test(status) ? "err" : status ? "busy" : "");
    s.textContent = status;
    s.title = status;
    row.append(cb, id, t, s);
    list.appendChild(row);
  }
  list.scrollTop = scroll;
  updateCount();
}

function showDetail(k) {
  const j = byKey()[k];
  if (!j) return;
  activeKey = k;
  store.set({ activeKey: k });
  document.querySelectorAll(".job").forEach((r) => r.classList.toggle("active", r.dataset.key === k));
  const s = settings();
  $("dimg").src = chrome.runtime.getURL(`jobs/frames/${j.frame}`);
  $("did").textContent = `${j.id}  (${j.episode})`;
  $("dtitle").textContent = j.title;
  const audio = j.dialogue;  // sound only on dialogue clips
  $("dset").textContent = j.type === "image"
    ? `Image · ${j.model || s.imageModel || "GPT Image 2.6 Flare"} · ${j.aspect || s.imageAspect || "16:9"} · ${j.resolution || s.imageResolution || "2K"} · ${(j.refs || []).length} reference(s)${(s.unlimitedOnly ?? true) ? " · unlimited models only" : ""}`
    : `Kling 3.0 · 16:9 · ${s.resolution} · ${j.seconds} s · audio ${audio ? "on" : "off"} · multi-shot off`;
  $("dout").textContent = `Saves to Downloads/${j.output}`;
  $("dprompt").value = overrides[k] || j.prompt;
  $("dnote").textContent = overrides[k] ? "Edited: this version is sent" : "From the Kling script";
}

$("dsave").onclick = async () => {
  if (!activeKey) return;
  const j = byKey()[activeKey];
  const text = $("dprompt").value.trim();
  if (!text || text === j.prompt) delete overrides[activeKey];
  else overrides[activeKey] = text;
  await store.set({ promptOverrides: overrides });
  showDetail(activeKey);
  render();
};
$("drestore").onclick = async () => {
  if (!activeKey) return;
  delete overrides[activeKey];
  await store.set({ promptOverrides: overrides });
  showDetail(activeKey);
  render();
};

async function renderLog() {
  const { log = [] } = await store.get("log");
  const el = $("log");
  el.textContent = log.length ? log.join("\n") : "Nothing has run yet.";
  el.scrollTop = el.scrollHeight;
}

function updateCount() {
  const n = selected.size;
  $("count").textContent = n ? `${n} ticked` : "0 ticked: tick the clips to run";
  $("count").className = n ? "sub" : "sub zero";
  $("fill").disabled = $("run").disabled = $("regen").disabled = n === 0;
}

function saveSel() {
  store.set({ selected: [...selected] });
  updateCount();
}

function settings() {
  return { resolution: $("res").value, timeoutMin: Number($("timeout").value), maxActive: Number($("maxActive").value) };
}

async function fireflyTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/firefly\.adobe\.com\/video-generate/.test(tab.url || "")) {
    throw new Error("Open firefly.adobe.com/video-generate in this tab first.");
  }
  return tab;
}

async function start(mode, onlyKeys) {
  $("msg").textContent = "";
  try {
    // Keep an unsaved edit in the prompt box from being lost.
    if (activeKey && $("dprompt").value.trim() !== (overrides[activeKey] || byKey()[activeKey].prompt)) {
      throw new Error(`You changed the prompt for ${byKey()[activeKey].id} without saving. Press "Save prompt edit" or "Restore script prompt" first.`);
    }
    const tab = await fireflyTab();
    const queue = onlyKeys || jobs.map(key).filter((k) => selected.has(k));
    if (!queue.length) throw new Error("Tick at least one clip.");
    const { statuses = {}, submitted = [] } = await store.get(["statuses", "submitted"]);
    const inFlight = new Set(submitted.map((s) => s.key));
    // Clear old errors so they are retried; keep finished downloads and clips still generating.
    for (const k of queue) if (statuses[k] && statuses[k] !== "downloaded" && !inFlight.has(k)) delete statuses[k];
    await store.set({ queue, statuses, settings: settings(), mode, running: true });
    const r = await chrome.tabs.sendMessage(tab.id, { type: "start" });
    if (!r || !r.ok) throw new Error((r && r.error) || "No answer from the page. Reload the Firefly tab.");
    $("msg").textContent = mode === "fill" ? "Filling the first ticked clip. Nothing will be generated. Watch the banner on the Firefly page." : `Running ${queue.length} clip(s). You can close this popup; the banner on the page shows progress.`;
  } catch (e) {
    await store.set({ running: false });
    $("msg").textContent = /Receiving end does not exist|Could not establish connection/.test(e.message)
      ? "The Firefly tab has the old version. Reload the Firefly tab, then press the button again."
      : e.message;
  }
}

$("fill").onclick = () => start("fill");
$("run").onclick = () => {
  const n = selected.size;
  if (confirm(`Generate ${n} clip(s) in Firefly? This uses your Firefly credits.`)) start("run");
};
// Regenerate: forget that a clip was downloaded (or failed), then run it again.
// Firefly makes a new take; Chrome saves it next to the old one, e.g. "2-04 (1).mp4".
async function clearForRegen(keys) {
  const { statuses = {}, submitted = [] } = await store.get(["statuses", "submitted"]);
  for (const k of keys) delete statuses[k];
  await store.set({ statuses, current: null, submitted: submitted.filter((s) => !keys.includes(s.key)) });
  await render();
}
$("regen").onclick = async () => {
  const keys = jobs.map(key).filter((k) => selected.has(k));
  if (!keys.length) return;
  const names = keys.map((k) => k.split("/")[1]).join(", ");
  if (!confirm(`Regenerate ${keys.length} clip(s) in Firefly: ${names}?\nEarlier takes are kept. This uses your Firefly credits.`)) return;
  await clearForRegen(keys);
  start("run", keys);
};
$("dregen").onclick = async () => {
  if (!activeKey) return;
  const j = byKey()[activeKey];
  if ($("dprompt").value.trim() !== (overrides[activeKey] || j.prompt)) {
    $("msg").textContent = `You changed the prompt for ${j.id} without saving. Press "Save prompt edit" or "Restore script prompt" first.`;
    return;
  }
  if (!confirm(`Regenerate ${j.id} (${j.title}) in Firefly with the prompt shown below?\nThe earlier take is kept. This uses your Firefly credits.`)) return;
  await clearForRegen([activeKey]);
  start("run", [activeKey]);
};
$("stop").onclick = async () => {
  await store.set({ running: false });
  $("msg").textContent = "Stopped submitting. Clips already generating keep going in Firefly; press Generate & download later to collect them.";
};
$("reset").onclick = async () => {
  const { statuses = {}, submitted = [] } = await store.get(["statuses", "submitted"]);
  for (const k of selected) delete statuses[k];
  await store.set({ statuses, current: null, submitted: submitted.filter((s) => !selected.has(s.key)) });
  render();
};
const tickWhere = (fn) => { jobs.filter(fn).forEach((j) => selected.add(key(j))); saveSel(); render(); };
$("selEP01").onclick = () => tickWhere((j) => j.episode === "EP01");
$("selEP02").onclick = () => tickWhere((j) => j.episode === "EP02");
$("selEP03").onclick = () => tickWhere((j) => j.episode === "EP03");
$("selEP04").onclick = () => tickWhere((j) => j.episode === "EP04");
$("selNone").onclick = () => { selected.clear(); saveSel(); render(); };
$("selImages").onclick = () => tickWhere((j) => j.type === "image");
$("selPending").onclick = async () => {
  const { statuses = {} } = await store.get("statuses");
  selected = new Set(jobs.map(key).filter((k) => statuses[k] !== "downloaded"));
  saveSel();
  render();
};
["res", "timeout", "maxActive"].forEach((id) => ($(id).onchange = () => { store.set({ settings: settings() }); if (activeKey) showDetail(activeKey); }));

chrome.storage.onChanged.addListener((c) => {
  if (c.log) renderLog();
  if (c.statuses || c.current) render();
});

init();
