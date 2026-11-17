// Background worker.
// 1. Serves the clip list and start frames to the Firefly tab (the page's own
//    security rules can block the tab from reading extension files directly).
// 2. Saves finished videos into Downloads/<filename>, for example
//    Downloads/LOCKED-OUT/EP01/clips/1-29.mp4. A second take of the same clip
//    is saved as "1-29 (1).mp4" instead of overwriting.

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

chrome.runtime.onMessage.addListener((m, _sender, send) => {
  if (m.type === "getJobs") {
    fetch(chrome.runtime.getURL("jobs/jobs.json"))
      .then((r) => r.json())
      .then((jobs) => send({ ok: true, jobs }))
      .catch((e) => send({ ok: false, error: String(e) }));
    return true;
  }

  if (m.type === "getFrame") {
    fetch(chrome.runtime.getURL(`jobs/frames/${m.frame}`))
      .then((r) => {
        if (!r.ok) throw new Error(`frame ${m.frame} not found`);
        return r.arrayBuffer();
      })
      .then((buf) => send({ ok: true, b64: toBase64(buf) }))
      .catch((e) => send({ ok: false, error: String(e) }));
    return true;
  }

  if (m.type === "download") {
    wanted.set(m.url, m.filename);
    // An image job's file name ends in ".auto": the real extension comes from what Firefly sends (png, jpeg, webp).
    const start = (filename) => chrome.downloads.download({ url: m.url, filename, conflictAction: "uniquify", saveAs: false }, (id) => {
      if (chrome.runtime.lastError || !id) {
        send({ ok: false, error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "no download id" });
        return;
      }
      const onChanged = (d) => {
        if (d.id !== id || !d.state) return;
        if (d.state.current === "complete") {
          chrome.downloads.onChanged.removeListener(onChanged);
          chrome.downloads.search({ id }, (r) => send({ ok: true, filename: r[0] && r[0].filename }));
        } else if (d.state.current === "interrupted") {
          chrome.downloads.onChanged.removeListener(onChanged);
          send({ ok: false, error: "download interrupted" });
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
    });
    if (/\.auto$/.test(m.filename)) {
      fetch(m.url, { method: "HEAD" })
        .then((r) => r.headers.get("content-type") || "")
        .catch(() => "")
        .then((type) => {
          const ext = /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : /jpe?g/.test(type) ? "jpg" : "png";
          const name = m.filename.replace(/\.auto$/, "." + ext);
          wanted.set(m.url, name);
          start(name);
        });
    } else start(m.filename);
    return true;
  }

  return false;
});


// Name our own downloads ourselves. Another extension in this Chrome (the Flow runner) answers "default name" for
// downloads it did not start, and Chrome then used the server's random name instead of the one asked for (17 Nov 2026).
const wanted = new Map();
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (item.byExtensionId !== chrome.runtime.id) return false;
  const name = wanted.get(item.url) || wanted.get(item.finalUrl);
  if (!name) return false;
  wanted.delete(item.url);
  suggest({ filename: name, conflictAction: "uniquify" });
  return false;
});
