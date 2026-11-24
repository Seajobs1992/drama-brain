// Background worker.
// 1. Serves the job list and the job pictures to the Pollo tab.
// 2. Saves each result into Downloads/<movie>/<episode>/pollo/<id>.<png|jpg|mp4>, plus <id>.json with Pollo's task ids.
//    A second take of the same job saves as "<id> (1).mp4"; nothing is overwritten.

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const wanted = new Map();

function download(url, filename) {
  return new Promise((resolve) => {
    wanted.set(url, filename);
    chrome.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false }, (id) => {
      if (chrome.runtime.lastError || !id) return resolve({ ok: false, error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "no download id" });
      const onChanged = (d) => {
        if (d.id !== id || !d.state) return;
        if (d.state.current === "complete") {
          chrome.downloads.onChanged.removeListener(onChanged);
          chrome.downloads.search({ id }, (r) => resolve({ ok: true, filename: r[0] && r[0].filename }));
        } else if (d.state.current === "interrupted") {
          chrome.downloads.onChanged.removeListener(onChanged);
          resolve({ ok: false, error: "download interrupted" });
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
    });
  });
}

chrome.runtime.onMessage.addListener((m, _sender, send) => {
  if (m.type === "getJobs") {
    fetch(chrome.runtime.getURL("jobs/jobs.json"), { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => send({ ok: true, ...data }))
      .catch((e) => send({ ok: false, error: `No job list (${e}). Run build_jobs.py, then reload the extension.` }));
    return true;
  }
  if (m.type === "getFile") {
    fetch(chrome.runtime.getURL(`jobs/files/${m.path}`), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`picture ${m.path} not found; run build_jobs.py again`); return r.arrayBuffer(); })
      .then((buf) => send({ ok: true, b64: toBase64(buf) }))
      .catch((e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m.type === "download") {
    // The extension comes from the result's address (png, jpg, mp4).
    const ext = ((m.url.split("?")[0].match(/\.(png|jpe?g|webp|mp4|mov)$/i) || [, m.kind === "video" ? "mp4" : "png"])[1]).toLowerCase().replace("jpeg", "jpg");
    const name = `${m.stem}.${ext}`;
    // First choice: the Saver tab writes into the folder the creator chose for this movie.
    const viaSaver = m.movie
      ? chrome.runtime.sendMessage({ target: "saver", type: "save", movie: m.movie, dirs: [m.episode], base: m.id, ext, url: m.url, record: m.record }).catch(() => null)
      : Promise.resolve(null);
    viaSaver.then((sv) => {
      if (sv && sv.ok) return send({ ok: true, filename: sv.filename, where: "folder" });
      const why = (sv && sv.error) || "the Saver tab is not open";
      // Fallback, so a result is never lost: Chrome's own download folder.
      return download(m.url, name).then(async (r) => {
        if (r.ok && m.record) {
          const data = "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(m.record, null, 1))));
          await download(data, `${m.stem}.json`);
        }
        send({ ...r, where: "chrome-downloads", why });
      });
    });
    return true;
  }
  return false;
});

// Name our own downloads ourselves: another runner in this Chrome may answer "default name" for downloads it did not start.
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (item.byExtensionId !== chrome.runtime.id) return false;
  const name = wanted.get(item.url) || wanted.get(item.finalUrl);
  if (!name) return false;
  wanted.delete(item.url);
  suggest({ filename: name, conflictAction: "uniquify" });
  return false;
});

// ---------- Auto-run (1.7.0): start a new build by itself ----------
// Every 30 s: if jobs.json carries a new build marked "autorun", and the popup switch "Start new builds by itself" is on,
// and a Pollo tab answers, and the Saver has a folder with access, and no run is going, then tick every job that is
// not saved and not failed (same as "Not saved") and start the same loop as Run ticked. All the runner's own guards
// stay (Unlimited only, charged means stop, byte checks). A build is started once; nothing is ever sent twice.
const store = chrome.storage.local;
const keyOf = (j) => `${j.episode}/${j.id}`;
const openStatus = (s) => (s || "") !== "saved" && (/^skipped|^error: Upload of/.test(s || "") || !/^(failed|error)/.test(s || ""));

async function bgLog(text) {
  const { log = [] } = await store.get("log");
  log.push(`${new Date().toLocaleTimeString()}  ${text}`);
  await store.set({ log: log.slice(-500) });
}
// A waiting line is logged once, not every 30 s.
async function autoWait(reason) {
  const { autoWaitMsg } = await store.get("autoWaitMsg");
  if (autoWaitMsg === reason) return;
  await store.set({ autoWaitMsg: reason });
  await bgLog(`Auto-run waiting: ${reason}`);
}
async function findPolloTab() {
  const tabs = await chrome.tabs.query({ url: "https://pollo.ai/*" });
  tabs.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
  for (const t of tabs) {
    try {
      const r = await chrome.tabs.sendMessage(t.id, { type: "ping" });
      if (r && r.ok) return t;
    } catch (e) { /* tab without the runner (opened before the extension was loaded) */ }
  }
  return null;
}

let autoBusy = false;
async function autoCheck() {
  if (autoBusy) return;
  autoBusy = true;
  try {
    const data = await fetch(chrome.runtime.getURL("jobs/jobs.json"), { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!data || !data.autorun) return;
    const build = data.buildId || data.built;
    const st = await store.get(["autoStart", "autoLastBuild", "running", "statuses"]);
    if (st.autoLastBuild === build) return;
    if (st.autoStart === false) { await store.set({ autoLastBuild: build }); return; } // switch off: this build is left to the creator
    if (st.running) return autoWait("a run is going; the new build starts when it ends.");
    const tab = await findPolloTab();
    if (!tab) return autoWait("open pollo.ai (signed in) in a tab, or reload the Pollo tab.");
    let sv = null;
    try { sv = await chrome.runtime.sendMessage({ target: "saver", type: "status", movie: data.movie }); } catch (e) { sv = null; }
    if (!sv) return autoWait("open the Saver tab (popup: Folder…).");
    if (!sv.folder) return autoWait(`choose the output folder for ${data.movie} in the Saver tab.`);
    if (sv.permission !== "granted") return autoWait("press Allow access in the Saver tab.");
    const statuses = st.statuses || {};
    const queue = (data.jobs || []).map(keyOf).filter((k) => openStatus(statuses[k]));
    if (!queue.length) {
      await store.set({ autoLastBuild: build, autoWaitMsg: "" });
      return bgLog(`Auto-run: build ${data.built} has nothing new to send (all saved or failed).`);
    }
    // Same as Run ticked with "Not saved" ticked.
    await store.set({ selected: queue, running: true, mode: "run", queue, autoWaitMsg: "" });
    let r = null;
    try { r = await chrome.tabs.sendMessage(tab.id, { type: "start" }); } catch (e) { r = null; }
    if (!r || !r.ok) {
      await store.set({ running: false });
      return autoWait("the Pollo tab did not answer; reload the Pollo tab.");
    }
    await store.set({ autoLastBuild: build });
    await bgLog(`Auto-run started: ${queue.length} job(s) from build ${data.built} (${data.movie}).`);
  } finally {
    autoBusy = false;
  }
}
chrome.alarms.get("autorun", (a) => { if (!a) chrome.alarms.create("autorun", { periodInMinutes: 0.5, delayInMinutes: 0.1 }); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "autorun") autoCheck(); });
