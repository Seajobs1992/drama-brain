// Runs in the extension's isolated world on the Flow tab.
// Works through the ticked jobs: uploads (masters, props, references into the project by name), images
// (frames and other stills made in Flow from named ingredients, 0 credits, renamed to their id) and clips
// (videos from a start frame plus the cast). Keeps up to "at once" generating, downloads finished items one
// at a time so each file gets its name, shows a banner on the page and writes a log the popup shows.
//
// How a finished tile is matched to its job: Flow lists the newest generation first; the runner tags each new
// tile with its job as soon as it appears, remembers the order it submitted jobs of each kind (runOrder), and
// after a rename finds the tile by its name. Do not make other videos or images in the project while it runs.
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = chrome.storage.local;
  const POLL_EVERY_MS = 15000;
  const DOWNLOAD_WAIT_MS = 12 * 60000; // the 1080p upscale is made on demand

  let bannerEl = null;
  function banner(text, kind = "info") {
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.style.cssText =
        "position:fixed;top:12px;right:12px;z-index:2147483647;max-width:440px;padding:10px 14px;border-radius:10px;" +
        "font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.4);cursor:pointer;white-space:pre-wrap";
      bannerEl.title = "Click to hide";
      bannerEl.onclick = () => (bannerEl.style.display = "none");
      document.documentElement.appendChild(bannerEl);
    }
    bannerEl.style.display = "block";
    bannerEl.style.background = kind === "error" ? "#b3261e" : kind === "ok" ? "#1e7a4f" : "#2b4fbf";
    bannerEl.textContent = `LOCKED OUT Flow runner\n${text}`;
  }

  function call(op, args = {}, timeoutMs = 240000) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMsg);
        reject(new Error(`${op} timed out (page script not answering; reload the Flow tab)`));
      }, timeoutMs);
      function onMsg(e) {
        if (e.source !== window || !e.data || e.data.__loflow !== "res" || e.data.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        e.data.ok ? resolve(e.data.r) : reject(new Error(e.data.error));
      }
      window.addEventListener("message", onMsg);
      window.postMessage({ __loflow: "cmd", id, op, args }, "*");
    });
  }

  async function bg(msg) {
    const r = await chrome.runtime.sendMessage(msg);
    if (!r || !r.ok) throw new Error((r && r.error) || `${msg.type} failed`);
    return r;
  }

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  async function log(msg, kind = "info") {
    banner(msg, kind);
    const { log = [] } = await store.get("log");
    log.push(`${new Date().toLocaleTimeString()}  ${msg}`);
    await store.set({ log: log.slice(-400) });
  }

  async function setStatus(key, s) {
    const { statuses = {} } = await store.get("statuses");
    statuses[key] = s;
    await store.set({ statuses });
  }

  const DEFAULTS = { model: "Omni 1.2 Flash", imageModel: "Nano Banana 2.1", thinking: "High", quality: "1080p", maxCredits: 30, maxImageCredits: 0,
    timeoutMin: 15, maxActive: 3, useCharacters: true, frameSource: "file", downloadImages: true };
  const finished = (s) => s === "downloaded" || s === "uploaded" || /^(in Flow|failed|error|rejected:)/.test(s || "");
  const REFUSAL_TRIES = 3; // Flow's refusals are not consistent (EP02 2-12 passed on its third try), and refusals cost nothing
  const kindOf = (job) => (job.type === "image" ? "image" : "video");
  let looping = false;

  async function loop() {
    if (looping) return;
    looping = true;
    try {
      const { jobs } = await bg({ type: "getJobs" });
      const byKey = Object.fromEntries(jobs.map((j) => [j.key, j]));
      {
        const s0 = await store.get(["submitted", "downloading"]);
        // Nothing left over from an earlier run: start counting tiles afresh.
        if (!(s0.submitted || []).length && !s0.downloading) await store.set({ runOrder: [] });
      }
      await log("Started.");
      let lastPoll = 0;
      let holdUntil = 0;
      let fillErrors = 0;

      while (true) {
        const st = await store.get(["running", "queue", "statuses", "settings", "mode", "promptOverrides", "submitted", "runOrder", "downloading", "dlResults", "useAlt", "rejections"]);
        let submitted = st.submitted || [];
        let downloading = st.downloading || null;
        if (!st.running) {
          const n = submitted.length;
          await log(n ? `Stopped. ${n} item(s) still in Flow; press Generate & download to collect them.` : "Stopped.");
          break;
        }
        const statuses = st.statuses || {};
        const runOrder = st.runOrder || [];
        const settings = { ...DEFAULTS, ...(st.settings || {}) };
        const overrides = st.promptOverrides || {};
        // The prompt that is sent: the person's edit, else the fix written after a rejection, else the script's.
        // After a policy refusal the prepared softer prompt (altPrompt) is used once.
        const useAlt = st.useAlt || {};
        const jobFor = (key) => { const j = byKey[key]; const base = overrides[key] || j.fixPrompt || j.prompt; const alt = useAlt[key] && j.altPrompt; return { ...j, prompt: alt || base, castPrompt: alt || overrides[key] || j.fixPrompt || j.castPrompt, usingAlt: !!alt }; };
        // Place of a job's tile among the tiles of its kind, counted from the newest.
        const posOf = (key) => { const same = runOrder.filter((r) => r.kind === kindOf(byKey[key])); let i = -1; same.forEach((r, n) => { if (r.key === key) i = n; }); return same.length - 1 - i; };
        const nameOf = (s) => (s.named ? byKey[s.key].id : undefined);
        const inFlight = new Set(submitted.map((s) => s.key));
        const pending = (st.queue || []).filter((k) => byKey[k] && !inFlight.has(k) && !finished(statuses[k]) && statuses[k] !== "filled, not generated");
        const drop = (key) => { submitted = submitted.filter((x) => x.key !== key); };

        // ---- 1. a download in progress: has the file arrived? ----
        if (downloading) {
          const res = (st.dlResults || {})[downloading.key];
          if (res) {
            if (res.ok) {
              await setStatus(downloading.key, "downloaded");
              await log(`${downloading.key}: saved ${res.filename || byKey[downloading.key].output}`, "ok");
            } else {
              await setStatus(downloading.key, `error: download failed (${res.error}); it is still in Flow`);
              await log(`${downloading.key}: download failed: ${res.error}`, "error");
            }
            drop(downloading.key);
            downloading = null;
          } else if (Date.now() - downloading.since > DOWNLOAD_WAIT_MS) {
            await bg({ type: "cancelExpect" }).catch(() => {});
            await setStatus(downloading.key, "error: the download never arrived; it is still in Flow");
            await log(`${downloading.key}: Flow did not send the download within ${DOWNLOAD_WAIT_MS / 60000} min`, "error");
            drop(downloading.key);
            downloading = null;
          }
          await store.set({ submitted, downloading });
        }

        // ---- 2. check the items that are generating ----
        const generating = submitted.filter((s) => !s.ready);
        if (generating.length && Date.now() - lastPoll > POLL_EVERY_MS) {
          lastPoll = Date.now();
          const results = await call("pollMany", { items: generating.map((s) => ({ key: s.key, pos: posOf(s.key), kind: kindOf(byKey[s.key]), name: nameOf(s) })) });
          for (const r of results) {
            const s = submitted.find((x) => x.key === r.key);
            if (!s) continue;
            if (r.status === "done") {
              s.ready = true;
              await setStatus(r.key, "finished, waiting to download");
              await log(`${r.key}: finished in Flow ("${r.title}")`);
            } else if (r.status === "failed" && r.policy) {
              // A policy refusal: record Flow's words; try the prepared softer prompt once; otherwise leave it for a fix.
              const rejections = st.rejections || {};
              const prev = rejections[r.key] || {};
              const tries = (prev.tries || 0) + 1;
              rejections[r.key] = { reason: r.reason, prompt: jobFor(r.key).prompt, at: new Date().toISOString(), triedAlt: !!(st.useAlt || {})[r.key], tries };
              await store.set({ rejections });
              drop(r.key);
              if (!(st.useAlt || {})[r.key] && tries < REFUSAL_TRIES) {
                await setStatus(r.key, `refused ${tries}x, trying again`);
                await log(`${r.key}: Flow refused it ("${r.reason}"), try ${tries} of ${REFUSAL_TRIES}. Sending the same prompt again (refusals are free).`, "error");
              } else if (byKey[r.key].altPrompt && !(st.useAlt || {})[r.key]) {
                await store.set({ useAlt: { ...(st.useAlt || {}), [r.key]: true } });
                await setStatus(r.key, "rejected once, trying the softer prompt");
                await log(`${r.key}: Flow refused the prompt ("${r.reason}"). Trying the softer version.`, "error");
                await store.set({ queue: [r.key, ...(st.queue || []).filter((k) => k !== r.key)] });
              } else {
                await setStatus(r.key, `rejected: ${r.reason}`);
                await log(`${r.key}: REJECTED by Flow: ${r.reason}. Edit the prompt (or add a fix in flow-fixes.json) and run it again.`, "error");
              }
            } else if (r.status === "failed") {
              // Any other failure (busy server, a glitch): press Flow's own Retry once, free of charge.
              if (!s.retried) {
                const ok = await call("retryTile", { key: r.key, pos: posOf(r.key), kind: kindOf(byKey[r.key]) }, 30000).catch(() => false);
                if (ok) { s.retried = true; s.started = Date.now(); await setStatus(r.key, "retrying after a Flow failure"); await log(`${r.key}: Flow failed ("${r.reason}"); pressed Retry.`); continue; }
              }
              await setStatus(r.key, `failed: ${r.reason}`);
              await log(`${r.key}: FAILED in Flow: ${r.reason}`, "error");
              drop(r.key);
            } else if (Date.now() - s.started > settings.timeoutMin * 60000) {
              await setStatus(r.key, `failed: nothing after ${settings.timeoutMin} min`);
              await log(`${r.key}: nothing after ${settings.timeoutMin} min, giving up on it`, "error");
              drop(r.key);
            } else if (r.progress) {
              await setStatus(r.key, `generating ${r.progress}`);
            }
          }
          await store.set({ submitted });
        }

        // ---- 3. a finished image gets its name; then a download starts (one at a time) ----
        const ready = submitted.find((s) => s.ready);
        if (!downloading && ready) {
          const job = byKey[ready.key];
          const kind = kindOf(job);
          try {
            if (kind === "image" && !ready.named) {
              const ok = await call("renameTile", { key: ready.key, pos: posOf(ready.key), kind, name: job.id, sent: ready.sent }, 60000).catch((e) => { throw new Error(`rename failed: ${e.message}`); });
              ready.named = true;
              await store.set({ submitted });
              await log(`${ready.key}: ${ok ? `named "${job.id}" in Flow` : `could not be renamed to "${job.id}" (left with Flow's title)`}`, ok ? "info" : "error");
              if (!settings.downloadImages) {
                await setStatus(ready.key, `in Flow as "${job.id}"`);
                drop(ready.key);
                await store.set({ submitted });
                continue;
              }
            }
            await bg({ type: "expectDownload", key: ready.key, filename: job.output });
            const got = await call("download", { key: ready.key, pos: posOf(ready.key), quality: settings.quality, kind, name: nameOf(ready), sent: ready.sent }, 120000);
            downloading = { key: ready.key, since: Date.now() };
            await store.set({ downloading });
            await setStatus(ready.key, `downloading (${got})`);
            await log(`${ready.key}: asked Flow for the ${got} download`);
          } catch (e) {
            await bg({ type: "cancelExpect" }).catch(() => {});
            await setStatus(ready.key, `error: ${e.message}; it is still in Flow`);
            await log(`${ready.key}: ${e.message}`, "error");
            drop(ready.key);
            await store.set({ submitted });
          }
          continue;
        }

        // ---- 4. fill and submit the next job ----
        const room = settings.maxActive === 0 || submitted.filter((s) => !s.ready).length < settings.maxActive;
        if (pending.length && room && Date.now() >= holdUntil) {
          const key = pending[0];
          const job = jobFor(key);
          const kind = kindOf(job);
          try {
            if (job.type === "upload") {
              await setStatus(key, "uploading");
              banner(`${key}: uploading ${job.name} into the project…`);
              const { b64 } = await bg({ type: "getFrame", frame: job.file });
              const r = await call("uploadAsset", { name: job.name, buf: b64ToBuf(b64) }, 180000);
              await setStatus(key, "uploaded");
              await log(`${key}: ${r.note ? `${job.name} was already in the project` : `${job.name} uploaded`}`, "ok");
              continue;
            }
            await setStatus(key, "filling");
            let r;
            if (job.type === "image") {
              banner(`${key}: filling Flow (image settings, ingredients, prompt)…`);
              r = await call("fillImage", { job, settings });
              await log(`${key}: filled. ${settings.imageModel}, ${job.aspect || "16:9"}, ${r.ingredients} ingredient(s), ${r.cost} credits`);
            } else {
              banner(`${key}: loading start frame…`);
              const { b64 } = await bg({ type: "getFrame", frame: job.frame });
              if (job.endFrame) job.endBuf = b64ToBuf((await bg({ type: "getFrame", frame: job.endFrame })).b64);
              banner(`${key}: filling Flow (settings, frame, cast, prompt)…`);
              r = await call("fill", { job, settings, buf: b64ToBuf(b64) });
              await log(`${key}: filled. ${settings.model}, ${r.length ? r.length + " s" : "fixed length"}, x1, ${r.cost} credits, frame: ${r.frameUsed}${r.cast.length ? ", cast: " + r.cast.join(", ") : ""}${job.usingAlt ? ", softer prompt" : overrides[key] ? ", edited prompt" : byKey[key].fixPrompt ? ", fixed prompt" : ""}`);
            }

            if (st.mode === "fill") {
              await setStatus(key, "filled, not generated");
              await store.set({ running: false });
              await log(`${key}: filled, NOT generated. Check Flow's prompt box, then press Generate & download.`, "ok");
              break;
            }

            const snap = await call("snapshot", { kind });
            // Record it before clicking, so a reload never clicks Start generation twice.
            submitted.push({ key, started: Date.now(), sent: r.sent || "" });
            runOrder.push({ key, kind });
            await store.set({ submitted, runOrder });
            await setStatus(key, "generating");
            // Start with a genuine click through the background (Flow ignores a scripted click for images);
            // if that channel is refused, fall back to the scripted click, which works for videos.
            const box = await call("startButtonBox", {}, 10000);
            const clicked = await bg({ type: "clickAt", x: box.x, y: box.y }).then(() => true, () => false);
            if (!clicked) await call("generate");
            const started = await call("confirmStarted", { key, prompt: job.prompt, snap, kind }, 60000);
            if (started) {
              await log(`${key}: submitted (${submitted.filter((s) => !s.ready).length} generating)`);
            } else {
              holdUntil = Date.now() + 60000;
              await log(`${key}: submitted, but Flow showed no new tile yet. Watching for it; pausing new submissions for 1 min.`);
            }
          } catch (err) {
            // One item's error does not stop the run (overnight runs must carry on); three in a row means something
            // is wrong with the page itself, and then new submissions stop.
            fillErrors += 1;
            await setStatus(key, `error: ${err.message}`);
            if (fillErrors >= 3) {
              await log(`${key}: ERROR ${err.message}. Three errors in a row: stopped submitting; items already in Flow will still be collected.`, "error");
              await store.set({ queue: (st.queue || []).filter((k) => k === key || inFlight.has(k)) });
            } else {
              await log(`${key}: ERROR ${err.message}. Moving on to the next item.`, "error");
            }
            await sleep(1500);
            continue;
          }
          fillErrors = 0;
          continue;
        }

        // ---- 5. finished? (read again: a refusal handled above may have put an item back) ----
        if (!pending.length && !submitted.length && !downloading) {
          const fresh = await store.get(["queue", "statuses"]);
          const fs = fresh.statuses || {};
          if ((fresh.queue || []).some((k) => byKey[k] && !finished(fs[k]) && fs[k] !== "filled, not generated")) continue;
          await log("All done.", "ok");
          await store.set({ running: false });
          break;
        }

        const saved = Object.values(statuses).filter((s) => s === "downloaded" || s === "uploaded" || (s || "").startsWith("in Flow")).length;
        const gen = submitted.filter((s) => !s.ready).length;
        banner(`${gen} generating, ${submitted.length - gen} waiting to download${downloading ? ` (downloading ${downloading.key.split("/")[1]})` : ""}, ${pending.length} still to submit.\nDone so far: ${saved}`);
        await sleep(4000);
      }
    } catch (err) {
      await log(`RUNNER ERROR: ${err.message}`, "error");
      await store.set({ running: false });
    } finally {
      looping = false;
    }
  }

  // Creates the ticked cast members as Flow characters, one after another. Free.
  let casting = false;
  async function createCharacters(names) {
    if (casting) return;
    casting = true;
    try {
      const { cast } = await bg({ type: "getCast" });
      for (const name of names) {
        const c = cast.find((x) => x.name === name);
        if (!c) continue;
        const { running } = await store.get("running");
        if (running === false) break;
        try {
          await log(`${name}: creating character in Flow (${c.picture ? "from the picture" : "from the description"}, ${c.voice ? "voice " + c.voice : "no voice yet"})…`);
          let r0;
          if (c.picture) {
            const { b64 } = await bg({ type: "getFrame", frame: c.picture });
            r0 = await call("characterStart", { character: c, buf: b64ToBuf(b64) }, 300000);
          } else {
            r0 = await call("characterDescribe", { character: c }, 60000);
            if (!r0.exists) {
              // Flow draws the portrait only from a genuine click on Start.
              await bg({ type: "clickAt", x: r0.box.x, y: r0.box.y });
              await setStatus(`cast:${name}`, "drawing the portrait");
              r0 = await call("characterAwaitPage", { character: c }, 200000);
            }
          }
          const { castStatus = {} } = await store.get("castStatus");
          if (r0.exists) {
            castStatus[name] = "in project already";
            const pid0 = (location.pathname.match(/project\/([0-9a-f-]{36})/) || [])[1] || "";
            const { projectCasts: pc0 = {} } = await store.get("projectCasts");
            pc0[pid0] = [...new Set([...(pc0[pid0] || []), name])];
            await store.set({ castStatus, projectCasts: pc0 });
            await log(`${name}: already in this project`, "ok");
            continue;
          }
          // The name needs a real Enter key: the background types it through Chrome's debugging channel.
          // Flow drops the focus from the name box for a moment after creation, so this is tried a few times.
          let typeNote = "";
          for (let attempt = 0; attempt < 4; attempt++) {
            await sleep(attempt ? 2500 : 500);
            await call("focusName", {}, 10000);
            const typed = await bg({ type: "typeText", text: c.name, enter: true }).then(() => true, (e) => { typeNote = e.message; return false; });
            if (!typed) break;
            if (await call("checkName", { name: c.name }, 10000)) { typeNote = ""; break; }
          }
          const r = await call("characterFinish", { character: c }, 120000);
          castStatus[name] = `created, ${r.voice}${r.named ? "" : `, NAME NOT SAVED${typeNote ? ` (${typeNote})` : ""}, rename it in Flow`}`;
          const pid = (location.pathname.match(/project\/([0-9a-f-]{36})/) || [])[1] || "";
          const { projectCasts = {} } = await store.get("projectCasts");
          if (r.named || r.listed) projectCasts[pid] = [...new Set([...(projectCasts[pid] || []), name])];
          await store.set({ castStatus, projectCasts });
          await log(`${name}: ${castStatus[name]}`, r.named === false ? "error" : "ok");
        } catch (e) {
          const { castStatus = {} } = await store.get("castStatus");
          castStatus[name] = `error: ${e.message}`;
          await store.set({ castStatus });
          await log(`${name}: ERROR ${e.message}`, "error");
        }
      }
      await log("Characters done.", "ok");
    } catch (e) {
      await log(`CHARACTERS ERROR: ${e.message}`, "error");
    } finally {
      casting = false;
      await store.set({ running: false });
    }
  }

  chrome.runtime.onMessage.addListener((m, _sender, send) => {
    if (m.type === "createCharacters") {
      call("ping", {}, 5000)
        .then(() => { createCharacters(m.names); send({ ok: true }); })
        .catch((e) => send({ ok: false, error: `Page not ready: ${e.message}` }));
      return true;
    }
    if (m.type === "listCharacters") {
      call("listCharacters", {}, 30000).then((names) => send({ ok: true, names })).catch((e) => send({ ok: false, error: e.message }));
      return true;
    }
    if (m.type === "start") {
      call("ping", {}, 5000)
        .then(() => { loop(); send({ ok: true }); })
        .catch((e) => send({ ok: false, error: `Page not ready: ${e.message}` }));
      return true;
    }
    return false;
  });
})();
