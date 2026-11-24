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
    fetch(chrome.runtime.getURL("jobs/jobs.json"))
      .then((r) => r.json())
      .then((data) => send({ ok: true, ...data }))
      .catch((e) => send({ ok: false, error: `No job list (${e}). Run build_jobs.py, then reload the extension.` }));
    return true;
  }
  if (m.type === "getFile") {
    fetch(chrome.runtime.getURL(`jobs/files/${m.path}`))
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
