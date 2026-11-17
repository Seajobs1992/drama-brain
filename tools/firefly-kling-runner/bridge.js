// Runs in the extension's isolated world on the Firefly tab.
// Batch mode: fills and submits the ticked clips one after another without
// waiting for each video, keeps up to "at once" clips generating, and
// downloads each video as soon as Firefly finishes it. Shows a banner on the
// page and writes a log the popup can show.
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = chrome.storage.local;
  const POLL_EVERY_MS = 20000;

  // ---------- on-page status banner ----------
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
    bannerEl.textContent = `LOCKED OUT runner\n${text}`;
  }

  function call(op, args = {}, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMsg);
        reject(new Error(`${op} timed out (page script not answering; reload the Firefly tab)`));
      }, timeoutMs);
      function onMsg(e) {
        if (e.source !== window || !e.data || e.data.__lo !== "res" || e.data.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        e.data.ok ? resolve(e.data.r) : reject(new Error(e.data.error));
      }
      window.addEventListener("message", onMsg);
      window.postMessage({ __lo: "cmd", id, op, args }, "*");
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

  const finished = (s) => s === "downloaded" || (s || "").startsWith("failed") || (s || "").startsWith("error");
  let looping = false;

  async function loop() {
    if (looping) return;
    looping = true;
    try {
      const { jobs } = await bg({ type: "getJobs" });
      const byKey = Object.fromEntries(jobs.map((j) => [`${j.episode}/${j.id}`, j]));

      // Carry over a clip that the older one-at-a-time version left waiting.
      const legacy = await store.get(["current", "submitted"]);
      if (legacy.current) {
        const submitted = legacy.submitted || [];
        if (legacy.current.phase === "wait" && !submitted.some((s) => s.key === legacy.current.key)) {
          submitted.push({ key: legacy.current.key, snap: legacy.current.snap || [], started: legacy.current.started || Date.now() });
        }
        await store.set({ current: null, submitted });
      }

      await log("Started.");
      let lastPoll = 0;
      let holdUntil = 0;

      while (true) {
        const st = await store.get(["running", "queue", "statuses", "settings", "mode", "promptOverrides", "submitted"]);
        if (!st.running) {
          const n = (st.submitted || []).length;
          await log(n ? `Stopped. ${n} clip(s) still generating in Firefly; press Generate & download to collect them.` : "Stopped.");
          break;
        }
        const statuses = st.statuses || {};
        let submitted = st.submitted || [];
        const settings = { resolution: "720p", audioMode: "all", timeoutMin: 15, maxActive: 5,
          imageModel: "gpt-image@gpt-image-2.6-star-swirl", imageAspect: "16:9", imageResolution: "2K", imageQuality: "max", unlimitedOnly: true, ...(st.settings || {}) };
        const overrides = st.promptOverrides || {};
        const argsFor = (key) => {
          const job = byKey[key];
          return { ...job, prompt: overrides[key] || job.prompt, audio: job.dialogue  /* sound only on dialogue clips (creator, 16 Nov 2026) */ };
        };
        const inFlight = new Set(submitted.map((s) => s.key));
        const pending = (st.queue || []).filter((k) => byKey[k] && !inFlight.has(k) && !finished(statuses[k]) && statuses[k] !== "filled, not generated");
        // Firefly names each result after the first ~32 characters of its prompt, and that is how a result is matched to
        // its job. Two jobs in flight with the same opening could be confused, so such a job waits its turn.
        const opening = (k) => (argsFor(k).prompt || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 28);
        const busyOpenings = new Set(submitted.map((x) => opening(x.key)));
        const nextKey = pending.find((k) => !busyOpenings.has(opening(k)));

        // ---- 1. collect finished videos ----
        if (submitted.length && Date.now() - lastPoll > POLL_EVERY_MS) {
          lastPoll = Date.now();
          const items = submitted.map((s) => ({ key: s.key, prompt: argsFor(s.key).prompt, snap: s.snap, started: s.started, kind: byKey[s.key].type === "image" ? "image" : "video" }));
          const results = await call("pollMany", { items });
          for (const r of results) {
            const s = submitted.find((x) => x.key === r.key);
            if (r.status === "done") {
              try {
                const dl = await bg({ type: "download", url: r.url, filename: byKey[r.key].output });
                await setStatus(r.key, "downloaded");
                await log(`${r.key}: saved ${dl.filename || byKey[r.key].output}`, "ok");
              } catch (e) {
                await setStatus(r.key, `error: download failed (${e.message})`);
                await log(`${r.key}: download failed: ${e.message}`, "error");
              }
              submitted = submitted.filter((x) => x.key !== r.key);
            } else if (r.status === "failed") {
              await setStatus(r.key, `failed: ${r.reason}`);
              await log(`${r.key}: FAILED in Firefly: ${r.reason}`, "error");
              submitted = submitted.filter((x) => x.key !== r.key);
            } else if (Date.now() - s.started > settings.timeoutMin * 60000) {
              await setStatus(r.key, `failed: no video after ${settings.timeoutMin} min`);
              await log(`${r.key}: no video after ${settings.timeoutMin} min, giving up on it`, "error");
              submitted = submitted.filter((x) => x.key !== r.key);
            }
          }
          await store.set({ submitted });
        }

        // ---- 2. fill and submit the next clip ----
        const room = settings.maxActive === 0 || submitted.length < settings.maxActive;
        if (nextKey && room && Date.now() >= holdUntil) {
          const key = nextKey;
          const job = argsFor(key);
          try {
            await setStatus(key, "filling");
            if (job.type === "image") {
              banner(`${key}: loading ${(job.refs || []).length} reference picture(s)…\n${submitted.length} generating`);
              const bufs = [];
              for (const ref of job.refs || []) { const { b64 } = await bg({ type: "getFrame", frame: ref }); bufs.push({ buf: b64ToBuf(b64), name: ref.split("/").pop() }); }
              banner(`${key}: filling Firefly (image settings, references, prompt)…\n${submitted.length} generating`);
              const r = await call("fillImage", { job, settings, bufs });
              await log(`${key}: filled. ${r.bar}${r.quality ? `, quality ${r.quality}` : ""}, ${r.refs} reference(s), ${r.cost}`);
            } else {
            banner(`${key}: loading start frame…\n${submitted.length} generating`);
            const { b64 } = await bg({ type: "getFrame", frame: job.frame });
            banner(`${key}: filling Firefly (settings, frame, prompt)…\n${submitted.length} generating`);
            const r = await call("fill", { job, settings, buf: b64ToBuf(b64) });
            await log(`${key}: filled. ${r.bar} ${job.seconds}s, audio ${job.audio ? "on" : "off"}`);
            }

            if (st.mode === "fill") {
              await setStatus(key, "filled, not generated");
              await store.set({ running: false });
              await log(`${key}: filled, NOT generated. Check the prompt bar, then press Generate & download.`, "ok");
              break;
            }

            const snap = await call("snapshot");
            // Record it as submitted before clicking, so a reload never clicks Generate twice.
            submitted.push({ key, snap, started: Date.now() });
            await store.set({ submitted });
            await setStatus(key, "generating");
            await call("generate");
            const started = await call("confirmStarted", { prompt: job.prompt, snap }, 60000);
            if (started) {
              await log(`${key}: submitted (${submitted.length} generating)`);
            } else {
              // Keep watching for it rather than submitting it again (that could cost credits twice).
              holdUntil = Date.now() + 60000;
              await log(`${key}: submitted, but Firefly showed no sign of it yet. Watching for it; pausing new submissions for 1 min.`);
            }
          } catch (err) {
            await setStatus(key, `error: ${err.message}`);
            await log(`${key}: ERROR ${err.message}. Stopped submitting; clips already generating will still be collected.`, "error");
            await store.set({ queue: (st.queue || []).filter((k) => k === key || inFlight.has(k)) });
          }
          continue;
        }

        // ---- 3. finished? ----
        if (!pending.length && !submitted.length) {
          await log("All done.", "ok");
          await store.set({ running: false });
          break;
        }

        const waitMsg = Date.now() < holdUntil ? "waiting for Firefly to free a slot" : pending.length && !nextKey ? "waiting: the next job's prompt starts like one still generating" : pending.length ? `at the limit of ${settings.maxActive} at once` : "all submitted";
        banner(`${submitted.length} generating, ${pending.length} still to submit (${waitMsg}).\nSaved so far: ${Object.values(statuses).filter((s) => s === "downloaded").length}`);
        await sleep(5000);
      }
    } catch (err) {
      await log(`RUNNER ERROR: ${err.message}`, "error");
      await store.set({ running: false });
    } finally {
      looping = false;
    }
  }

  chrome.runtime.onMessage.addListener((m, _sender, send) => {
    if (m.type === "start") {
      call("ping", {}, 5000)
        .then(() => {
          loop();
          send({ ok: true });
        })
        .catch((e) => send({ ok: false, error: `Page not ready: ${e.message}` }));
      return true;
    }
    return false;
  });
})();
