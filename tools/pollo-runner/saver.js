// The Saver tab: the creator chooses one output folder per movie (macOS folder window), and this page writes each
// result into it. Chrome extensions can otherwise only save inside Chrome's own download folder.
// The folder is remembered per movie (IndexedDB). Chrome asks again for access after a restart ("Allow access").
const $ = (id) => document.getElementById(id);
const DB = "pollo-runner", ST = "folders";
let movie = "";

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function getFolder(name) {
  const db = await idb();
  return new Promise((res) => {
    const t = db.transaction(ST).objectStore(ST).get(name);
    t.onsuccess = () => res(t.result || null);
    t.onerror = () => res(null);
  });
}
async function putFolder(name, handle) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(ST, "readwrite");
    t.objectStore(ST).put(handle, name);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function status(name) {
  const h = await getFolder(name);
  const tab = await chrome.tabs.getCurrent();
  if (!h) return { ok: true, folder: null, permission: "none", tabId: tab && tab.id };
  return { ok: true, folder: h.name, permission: await h.queryPermission({ mode: "readwrite" }), tabId: tab && tab.id };
}
function addLog(t) {
  $("log").textContent = `${new Date().toLocaleTimeString()}  ${t}\n` + $("log").textContent;
}

async function render() {
  $("movie").textContent = movie || "No job list (run build_jobs.py)";
  const s = await status(movie);
  $("folder").textContent = s.folder ? s.folder : "Not chosen yet";
  $("perm").innerHTML = !s.folder ? '<span class="warn">Choose a folder before running.</span>'
    : s.permission === "granted" ? '<span class="ok">Access allowed. Runs will save here.</span>'
    : '<span class="bad">Chrome needs your OK again: press Allow access.</span>';
  $("allow").style.display = s.folder && s.permission !== "granted" ? "" : "none";
}

$("choose").onclick = async () => {
  try {
    const h = await window.showDirectoryPicker({ id: "pollo-" + (movie || "x").replace(/[^A-Za-z0-9]/g, "").slice(0, 24), mode: "readwrite" });
    await putFolder(movie, h);
    addLog(`Folder for ${movie}: ${h.name}`);
  } catch (e) {
    if (e.name !== "AbortError") addLog(`Could not use that folder: ${e.message}`);
  }
  render();
};
$("allow").onclick = async () => {
  const h = await getFolder(movie);
  if (h) await h.requestPermission({ mode: "readwrite" });
  render();
};

async function freeName(dir, base, ext) {
  for (let i = 0; i < 200; i++) {
    const n = i ? `${base} (${i}).${ext}` : `${base}.${ext}`;
    try { await dir.getFileHandle(n); } catch (e) { return n; }
  }
  throw new Error("too many takes with the same name");
}
async function writeFile(dir, name, data) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}
async function save(m) {
  const h = await getFolder(m.movie);
  if (!h) return { ok: false, error: `no output folder chosen for ${m.movie}` };
  if ((await h.queryPermission({ mode: "readwrite" })) !== "granted") return { ok: false, error: "Chrome needs your OK for the output folder (Saver tab: Allow access)" };
  let dir = h;
  for (const part of m.dirs || []) dir = await dir.getDirectoryHandle(part, { create: true });
  const r = await fetch(m.url);
  if (!r.ok) return { ok: false, error: `Pollo answered ${r.status} for the result file` };
  const blob = await r.blob();
  const name = await freeName(dir, m.base, m.ext);
  await writeFile(dir, name, blob);
  if (m.record) await writeFile(dir, name.replace(/\.[^.]+$/, ".json"), JSON.stringify({ ...m.record, file: name }, null, 1));
  const shown = [h.name, ...(m.dirs || []), name].join("/");
  addLog(`saved ${shown} (${Math.round(blob.size / 1024)} KB)`);
  return { ok: true, filename: shown };
}

// Every new runner log line is also written to <output folder>/runner-log.txt (25 Nov 2026), so the log can be read
// from disk. Lines wait in memory while the folder has no access, and are written once access is allowed.
let logWaiting = [];
let logChain = Promise.resolve();
async function writeLogLines() {
  if (!logWaiting.length) return;
  const r = await chrome.runtime.sendMessage({ type: "getJobs" }).catch(() => null);
  const mv = (r && r.ok && r.movie) || movie;
  const h = mv && (await getFolder(mv));
  if (!h || (await h.queryPermission({ mode: "readwrite" })) !== "granted") return;
  const lines = logWaiting;
  logWaiting = [];
  const fh = await h.getFileHandle("runner-log.txt", { create: true });
  const size = (await fh.getFile()).size;
  const w = await fh.createWritable({ keepExistingData: true });
  await w.seek(size);
  await w.write(lines.join("\n") + "\n");
  await w.close();
}
function queueLog(lines) {
  const day = new Date().toLocaleDateString("en-CA");
  logWaiting.push(...lines.map((l) => `${day} ${l}`));
  logChain = logChain.then(writeLogLines).catch((e) => addLog(`Could not write runner-log.txt: ${e.message}`));
}
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local" || !ch.log) return;
  const now = ch.log.newValue || [], before = ch.log.oldValue || [];
  const last = before[before.length - 1];
  const from = last === undefined ? 0 : now.lastIndexOf(last) + 1;
  if (from > 0 || last === undefined) { if (now.length > from) queueLog(now.slice(from)); }
  else if (now.length) queueLog(now.slice(-1));
});
setInterval(() => { if (logWaiting.length) logChain = logChain.then(writeLogLines).catch(() => {}); }, 30000);

chrome.runtime.onMessage.addListener((m, _sender, send) => {
  if (!m || m.target !== "saver") return false;
  if (m.type === "status") { status(m.movie).then(send); return true; }
  if (m.type === "save") { save(m).then(send).catch((e) => send({ ok: false, error: String(e.message || e) })); return true; }
  return false;
});

(async () => {
  const r = await chrome.runtime.sendMessage({ type: "getJobs" });
  movie = (r && r.ok && r.movie) || "";
  $("built").textContent = r && r.ok ? `${(r.jobs || []).length} job(s), built ${r.built}` : "";
  render();
})();
