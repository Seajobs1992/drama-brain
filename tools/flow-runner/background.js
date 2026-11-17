// Background worker for the LOCKED OUT Flow runner.
// 1. Serves the clip list and start frames to the Flow tab.
// 2. Names the videos Flow downloads. Flow makes the 1080p upscale and then downloads it by itself;
//    just before the runner asks for it, it leaves an "expected download" here, and the next download
//    that comes from Flow is saved under that clip's name, e.g. LOCKED-OUT/EP04/flow-clips/4-02.mp4.
//    The result is written to storage (dlResults) for the page to collect.
const store = chrome.storage.local;
const EXPECT_FOR_MS = 15 * 60000;

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Types text with real key events and presses Enter, through Chrome's debugging channel. Flow saves a
// character's name only on a genuine Enter key, which page scripts cannot fake. Chrome shows a
// "started debugging this browser" bar for the second this takes.
function typeText(tabId, text, enter, send) {
  const target = { tabId };
  const cmd = (method, params) => new Promise((res, rej) =>
    chrome.debugger.sendCommand(target, method, params, (r) => (chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res(r))));
  chrome.debugger.attach(target, "1.3", async () => {
    if (chrome.runtime.lastError) { send({ ok: false, error: chrome.runtime.lastError.message }); return; }
    try {
      for (const ch of text) await cmd("Input.dispatchKeyEvent", { type: "char", text: ch });
      if (enter) {
        await cmd("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
        await cmd("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      }
      send({ ok: true });
    } catch (e) {
      send({ ok: false, error: e.message });
    } finally {
      chrome.debugger.detach(target, () => chrome.runtime.lastError);
    }
  });
}

// A genuine mouse click at viewport coordinates, through the debugging channel. Flow starts an IMAGE
// generation only from a real click on "Start generation" (a scripted click does nothing, 2026-11-16).
function clickAt(tabId, x, y, send) {
  const target = { tabId };
  const cmd = (method, params) => new Promise((res, rej) =>
    chrome.debugger.sendCommand(target, method, params, (r) => (chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res(r))));
  chrome.debugger.attach(target, "1.3", async () => {
    if (chrome.runtime.lastError) { send({ ok: false, error: chrome.runtime.lastError.message }); return; }
    try {
      await cmd("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await cmd("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      send({ ok: true });
    } catch (e) {
      send({ ok: false, error: e.message });
    } finally {
      chrome.debugger.detach(target, () => chrome.runtime.lastError);
    }
  });
}

chrome.runtime.onMessage.addListener((m, sender, send) => {
  if (m.type === "clickAt") {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) { send({ ok: false, error: "no tab" }); return false; }
    chrome.tabs.update(tabId, { active: true }, () => {
      void chrome.runtime.lastError;
      setTimeout(() => clickAt(tabId, m.x, m.y, send), 300);
    });
    return true;
  }
  if (m.type === "typeText") {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) { send({ ok: false, error: "no tab" }); return false; }
    // Key events only land in a tab that is showing, so bring the Flow tab forward first.
    chrome.tabs.update(tabId, { active: true }, () => {
      void chrome.runtime.lastError;
      setTimeout(() => typeText(tabId, m.text, !!m.enter, send), 400);
    });
    return true;
  }
  // All jobs in one list: uploads first, then images, then clips, each with a unique key per episode.
  if (m.type === "getJobs") {
    const get = (f) => fetch(chrome.runtime.getURL(`jobs/${f}`)).then((r) => (r.ok ? r.json() : []), () => []);
    Promise.all([get("assets.json"), get("images.json"), get("jobs.json")])
      .then(([assets, images, clips]) => {
        const jobs = [
          ...assets.map((j) => ({ ...j, type: "upload", key: `${j.episode}/up:${j.id}` })),
          ...images.map((j) => ({ ...j, type: "image", key: `${j.episode}/img:${j.id}` })),
          ...clips.map((j) => ({ ...j, type: "video", key: `${j.episode}/${j.id}` })),
        ];
        send({ ok: true, jobs });
      })
      .catch((e) => send({ ok: false, error: String(e) }));
    return true;
  }
  if (m.type === "getCast") {
    fetch(chrome.runtime.getURL("jobs/cast.json")).then((r) => r.json())
      .then((cast) => send({ ok: true, cast })).catch((e) => send({ ok: false, error: String(e) }));
    return true;
  }
  if (m.type === "getFrame") {
    fetch(chrome.runtime.getURL(/^(cast|assets)\//.test(m.frame) ? `jobs/${m.frame}` : `jobs/frames/${m.frame}`))
      .then((r) => { if (!r.ok) throw new Error(`frame ${m.frame} not found`); return r.arrayBuffer(); })
      .then((buf) => send({ ok: true, b64: toBase64(buf) })).catch((e) => send({ ok: false, error: String(e) }));
    return true;
  }
  // Writes a JSON report (statuses, rejections with Flow's words and the prompts, settings) next to the clips,
  // so a person or an LLM can write the fixes without opening the popup.
  if (m.type === "saveReport") {
    const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(m.report, null, 1));
    chrome.downloads.download({ url: dataUrl, filename: m.filename, conflictAction: "overwrite", saveAs: false }, (id) => {
      send(chrome.runtime.lastError || !id ? { ok: false, error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || "no download id" } : { ok: true });
    });
    return true;
  }
  if (m.type === "expectDownload") {
    store.get("dlResults").then(({ dlResults = {} }) => {
      delete dlResults[m.key];
      return store.set({ expect: { key: m.key, filename: m.filename, at: Date.now() }, dlResults });
    }).then(() => send({ ok: true }));
    return true;
  }
  if (m.type === "cancelExpect") {
    store.set({ expect: null }).then(() => send({ ok: true }));
    return true;
  }
  return false;
});

const fromFlow = (item) => /flow\.google\.com|googleusercontent\.com|googleapis\.com|^blob:https:\/\/flow|^data:/.test(
  [item.url, item.finalUrl, item.referrer].filter(Boolean).join(" "));

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  store.get(["expect", "dlMap"]).then(({ expect, dlMap = {} }) => {
    if (expect && !item.byExtensionId && fromFlow(item) && Date.now() - expect.at < EXPECT_FOR_MS) {
      dlMap[item.id] = expect.key;
      store.set({ expect: null, dlMap });
      // A name given without an extension (images) takes the one the file really has.
      let filename = expect.filename;
      if (!/\.[a-z0-9]{2,4}$/i.test(filename)) {
        const ext = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4", "application/zip": ".zip" }[item.mime]
          || (item.filename && item.filename.match(/\.[a-z0-9]{2,4}$/i) || [".bin"])[0];
        filename += ext;
      }
      suggest({ filename, conflictAction: "uniquify" });
    } else {
      suggest();
    }
  });
  return true; // suggest is called asynchronously
});

chrome.downloads.onChanged.addListener((d) => {
  if (!d.state || (d.state.current !== "complete" && d.state.current !== "interrupted")) return;
  store.get(["dlMap", "dlResults"]).then(({ dlMap = {}, dlResults = {} }) => {
    const key = dlMap[d.id];
    if (!key) return;
    delete dlMap[d.id];
    chrome.downloads.search({ id: d.id }, (r) => {
      const item = r && r[0];
      dlResults[key] = d.state.current === "complete"
        ? { ok: true, filename: item && item.filename }
        : { ok: false, error: (item && item.error) || "download interrupted" };
      store.set({ dlMap, dlResults });
    });
  });
});
