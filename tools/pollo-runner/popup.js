const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
let jobs = [];
let built = "";
let movie = "";
const keyOf = (j) => `${j.episode}/${j.id}`;

function msg(t) { $("msg").textContent = t || ""; }

async function polloTab() {
  const tabs = await chrome.tabs.query({ url: "https://pollo.ai/*" });
  if (!tabs.length) return null;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs.find((t) => active && t.id === active.id) || tabs[0];
}

async function render() {
  const st = await store.get(["queue", "statuses", "log", "settings", "selected"]);
  const statuses = st.statuses || {};
  const selected = new Set(st.selected || []);
  const list = $("list");
  list.innerHTML = "";
  let ep = null;
  for (const j of jobs) {
    if (j.episode !== ep) {
      ep = j.episode;
      const h = document.createElement("div");
      h.className = "ep";
      h.textContent = ep;
      list.appendChild(h);
    }
    const k = keyOf(j);
    const s = statuses[k] || "";
    const row = document.createElement("label");
    row.className = "job";
    row.innerHTML = `<input type="checkbox"><b></b><span class="kind"></span><span class="t"></span><span class="st"></span>`;
    const cb = row.querySelector("input");
    cb.checked = selected.has(k);
    cb.onchange = async () => {
      const cur = new Set((await store.get("selected")).selected || []);
      cb.checked ? cur.add(k) : cur.delete(k);
      await store.set({ selected: [...cur] });
      count();
    };
    row.querySelector("b").textContent = j.id;
    row.querySelector(".kind").textContent = j.type === "image" ? "image" : j.mode === "reference" ? "ref" : "clip";
    row.querySelector(".t").textContent = j.title || j.prompt;
    row.querySelector(".t").title = j.prompt;
    const stEl = row.querySelector(".st");
    stEl.textContent = s;
    stEl.title = s;
    stEl.className = "st" + (s === "saved" ? " saved" : /^(failed|error|skipped)/.test(s) ? " err" : s ? " busy" : "");
    list.appendChild(row);
  }
  const set = { maxActive: 1, gapSec: 30, timeoutMin: 40, ...(st.settings || {}) };
  $("maxActive").value = String(set.maxActive);
  $("gapSec").value = String(set.gapSec);
  $("timeoutMin").value = String(set.timeoutMin);
  $("autoStart").checked = (await store.get("autoStart")).autoStart !== false;
  $("log").textContent = (st.log || []).slice(-80).join("\n");
  $("log").scrollTop = 1e9;
  count();
}

async function count() {
  const n = ((await store.get("selected")).selected || []).filter((k) => jobs.some((j) => keyOf(j) === k)).length;
  $("count").textContent = `${n} ticked`;
}

async function saveSettings() {
  await store.set({ settings: { maxActive: Number($("maxActive").value), gapSec: Number($("gapSec").value), timeoutMin: Number($("timeoutMin").value) } });
}

async function tick(fn) {
  const { statuses = {} } = await store.get("statuses");
  await store.set({ selected: jobs.filter((j) => fn(j, statuses[keyOf(j)] || "")).map(keyOf) });
  render();
}

// ---------- output folder (Saver tab) ----------
async function saverStatus() {
  try { return await chrome.runtime.sendMessage({ target: "saver", type: "status", movie }); } catch (e) { return null; }
}
async function openSaver() {
  const st = await saverStatus();
  if (st && st.tabId) await chrome.tabs.update(st.tabId, { active: true });
  else await chrome.tabs.create({ url: chrome.runtime.getURL("saver.html"), pinned: true, active: true });
}
async function showFolder() {
  const st = await saverStatus();
  $("outFolder").textContent = !st ? "Saver tab not open" : !st.folder ? "not chosen yet" : st.permission === "granted" ? st.folder : `${st.folder} (needs your OK)`;
  return st;
}

async function start(mode) {
  msg("");
  if (mode === "run") {
    // Ask for the output folder before anything is sent (creator, 24 Nov 2026: the path depends on the project).
    const st = await saverStatus();
    if (!st || !st.folder || st.permission !== "granted") {
      await openSaver();
      return msg(!st || !st.folder ? `Choose the output folder for ${movie} in the Saver tab, then press Run ticked again.` : "Press Allow access in the Saver tab, then press Run ticked again.");
    }
  }
  const tab = await polloTab();
  if (!tab) return msg("Open pollo.ai (signed in) in a tab first.");
  const sel = ((await store.get("selected")).selected || []).filter((k) => jobs.some((j) => keyOf(j) === k));
  if (!sel.length) return msg("Tick at least one job.");
  await saveSettings();
  // Saved and failed jobs are skipped until "Redo ticked"; say so instead of finishing with nothing done.
  const { statuses = {} } = await store.get("statuses");
  const open = (k) => { const s = statuses[k] || ""; return s !== "saved" && (/^skipped|^retrying|^error: Upload of/.test(s) || !/^(failed|error)/.test(s)); };
  const order = jobs.map(keyOf).filter((k) => sel.includes(k) && (mode === "run" || open(k)));
  if (!order.length || !order.some(open)) return msg("Every ticked job is already saved or marked failed. Tick them and press Redo ticked to send them again.");
  await store.set({ running: true, mode, queue: mode === "fill" ? order.slice(0, 1) : order });
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: "start" });
    if (!r || !r.ok) throw new Error((r && r.error) || "no answer");
    await chrome.tabs.update(tab.id, { active: true });
    msg(mode === "fill" ? "Filling the first ticked job. Nothing will be sent." : `Running ${order.length} job(s). Keep the Pollo tab open.`);
  } catch (e) {
    await store.set({ running: false });
    msg(`The Pollo tab did not answer (${e.message}). Reload the Pollo tab and try again.`);
  }
}

$("folderBtn").onclick = () => openSaver();
$("autoStart").onchange = async () => {
  await store.set({ autoStart: $("autoStart").checked, autoWaitMsg: "" });
  msg($("autoStart").checked ? "New builds will start by themselves." : "New builds wait for Run ticked.");
};
$("fill").onclick = () => start("fill");
$("run").onclick = () => start("run");
$("stop").onclick = async () => { await store.set({ running: false }); msg("Stopping after the current step."); };
$("selPending").onclick = () => tick((j, s) => s !== "saved");
$("selImages").onclick = () => tick((j) => j.type === "image");
$("selVideos").onclick = () => tick((j) => j.type === "video");
$("selNone").onclick = () => tick(() => false);
$("redo").onclick = async () => {
  const sel = (await store.get("selected")).selected || [];
  const { statuses = {}, running } = await store.get(["statuses", "running"]);
  if (running) return msg("Stop the run first.");
  for (const k of sel) delete statuses[k];
  await store.set({ statuses });
  msg(`${sel.length} job(s) will be sent again on Run.`);
  render();
};
for (const id of ["maxActive", "gapSec", "timeoutMin"]) $(id).onchange = saveSettings;

chrome.storage.onChanged.addListener(() => render());

(async () => {
  $("ver").textContent = "v" + chrome.runtime.getManifest().version;
  const r = await chrome.runtime.sendMessage({ type: "getJobs" });
  if (!r || !r.ok) { msg((r && r.error) || "No job list."); return; }
  jobs = r.jobs || [];
  built = r.built || "";
  movie = r.movie || "";
  $("source").textContent = `${jobs.length} job(s) from ${movie || "?"}, built ${built}. Each file is named by its job id, in <folder>/<episode>/.`;
  showFolder();
  // Forget ticks for jobs that no longer exist.
  const keys = new Set(jobs.map(keyOf));
  const { selected = [] } = await store.get("selected");
  await store.set({ selected: selected.filter((k) => keys.has(k)) });
  render();
})();
