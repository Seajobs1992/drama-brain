// The run loop, in the Pollo tab (extension side). Uses page.js (PolloPage) for everything on the page.
// One job at a time by default, with a pause between submissions, so the account is not hammered.
// Every result is saved as soon as Pollo finishes it. State lives in chrome.storage, so a page reload resumes the run
// and never submits a job twice.
(() => {
  const P = globalThis.PolloPage;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = chrome.storage.local;
  const POLL_EVERY_MS = 20000;

  let bannerEl = null;
  function banner(text, kind = "info") {
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.style.cssText = "position:fixed;bottom:14px;right:14px;z-index:2147483647;max-width:420px;padding:10px 14px;border-radius:10px;" +
        "font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.4);cursor:pointer;white-space:pre-wrap";
      bannerEl.title = "Click to hide";
      bannerEl.onclick = () => (bannerEl.style.display = "none");
      document.documentElement.appendChild(bannerEl);
    }
    bannerEl.style.display = "block";
    bannerEl.style.background = kind === "error" ? "#b3261e" : kind === "ok" ? "#1e7a4f" : "#2b4fbf";
    bannerEl.textContent = `Pollo runner\n${text}`;
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
    await store.set({ log: log.slice(-500) });
  }
  async function setStatus(key, s) {
    const { statuses = {} } = await store.get("statuses");
    statuses[key] = s;
    await store.set({ statuses });
  }
  async function saveRecord(key, rec) {
    const { records = {} } = await store.get("records");
    records[key] = { ...(records[key] || {}), ...rec };
    await store.set({ records });
  }
  // "skipped" (and an upload error from 1.5.x) means nothing was sent: the next Run tries the job again.
  const notSent = (s) => /^skipped|^retrying|^error: Upload of/.test(s || "");
  const finished = (s) => !notSent(s) && (s === "saved" || (s || "").startsWith("failed") || (s || "").startsWith("error"));
  const SKIP_STOP = 3; // this many jobs in a row skipped: reload the Pollo tab once, then stop the run if it happens again
  const MAX_RELOADS = 8; // page reloads per run, at most
  // Per-run state, kept across page reloads (reset when a run is started: Run ticked or auto-run).
  const freshRun = () => ({ skipped: [], streak: 0, streakReloaded: false, reloadRetried: [], reloads: 0 });
  const getRun = async () => ({ ...freshRun(), ...((await store.get("runState")).runState || {}) });
  const putRun = (rs) => store.set({ runState: rs });
  // Reload the Pollo tab; the run resumes by itself after the reload (same tab, same owner token).
  async function reloadTab(rs, why) {
    rs.reloads++;
    await putRun(rs);
    await log(why);
    setTimeout(() => location.reload(), 800);
  }
  const typeOf = (f) => (/\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg");
  async function loadFile(f) {
    if (!f) return null;
    const { b64 } = await bg({ type: "getFile", path: f.path });
    return { name: f.name, buf: b64ToBuf(b64), type: typeOf(f.name) };
  }

  // A run belongs to one Pollo tab. Its token lives in the tab's sessionStorage (kept across reloads of that tab),
  // so a second Pollo tab never picks up the same queue and nothing is sent twice.
  const TOKEN = sessionStorage.getItem("polloRunnerTab") || Math.random().toString(36).slice(2);
  sessionStorage.setItem("polloRunnerTab", TOKEN);

  let looping = false;
  async function loop() {
    if (looping) return;
    looping = true;
    try {
      const data = await bg({ type: "getJobs" });
      const jobs = data.jobs || [];
      const byKey = Object.fromEntries(jobs.map((j) => [`${j.episode}/${j.id}`, j]));
      await log(`Started (page code ${P.VERSION}, jobs built ${data.built || "?"}).`);
      let lastPoll = 0;
      let lastSubmit = 0;
      let holdUntil = 0;
      P.note = (t) => { log(t); };

      while (true) {
        const st = await store.get(["running", "queue", "statuses", "settings", "mode", "submitted", "owner"]);
        if (st.owner && st.owner !== TOKEN) { banner("Another Pollo tab is running the jobs; this tab stays out."); break; }
        const settings = { maxActive: 1, gapSec: 30, timeoutMin: 40, ...(st.settings || {}) };
        let submitted = st.submitted || [];
        const statuses = st.statuses || {};
        if (!st.running) {
          await log(submitted.length ? `Stopped. ${submitted.length} job(s) still generating in Pollo; press Run to collect them.` : "Stopped.");
          break;
        }
        const inFlight = new Set(submitted.map((s) => s.key));
        const rsNow = await getRun();
        const pending = (st.queue || []).filter((k) => byKey[k] && !inFlight.has(k) && !rsNow.skipped.includes(k) && !finished(statuses[k]) && (st.mode !== "fill" || statuses[k] !== "filled, not sent"));

        // ---- 1. collect finished results ----
        if (submitted.length && Date.now() - lastPoll > POLL_EVERY_MS) {
          lastPoll = Date.now();
          for (const s of [...submitted]) {
            const job = byKey[s.key];
            if (!s.videoId || !job) continue;
            let r;
            try { r = await P.status(s.videoId); } catch (e) { await log(`${s.key}: could not read its status (${e.message}); will try again`); continue; }
            if (r.credit > 0) {
              await store.set({ running: false });
              await saveRecord(s.key, { credit: r.credit });
              await log(`${s.key}: Pollo CHARGED ${r.credit} credits (${r.creditType}). Run stopped. Check the plan before running again.`, "error");
            }
            if (r.status === "done" && r.url) {
              try {
                const record = { job: s.key, videoId: s.videoId, recordId: r.recordId, model: r.model, credit: r.credit, creditType: r.creditType, submitted: new Date(s.started).toISOString(), saved: new Date().toISOString(), url: r.url, prompt: job.prompt, settings: s.bar };
                const dl = await bg({ type: "download", url: r.url, stem: job.output, kind: job.type, record, movie: data.movie, episode: job.episode, id: job.id });
                await setStatus(s.key, "saved");
                await saveRecord(s.key, { ...record, file: dl.filename });
                await log(`${s.key}: saved ${dl.filename || job.output} (task ${s.videoId}, ${r.credit} credits)`, "ok");
                if (dl.where === "chrome-downloads") await log(`${s.key}: NOTE saved in Chrome's download folder, not the chosen folder (${dl.why}).`, "error");
              } catch (e) {
                await setStatus(s.key, `error: download failed (${e.message})`);
                await log(`${s.key}: download failed: ${e.message}`, "error");
              }
              submitted = submitted.filter((x) => x.key !== s.key);
            } else if (r.status === "failed") {
              await setStatus(s.key, `failed: ${r.failMsg || r.raw}`);
              await saveRecord(s.key, { videoId: s.videoId, recordId: r.recordId, failed: r.failMsg || r.raw });
              await log(`${s.key}: FAILED in Pollo: ${r.failMsg || r.raw} (task ${s.videoId}). Not retried.`, "error");
              submitted = submitted.filter((x) => x.key !== s.key);
            } else if (Date.now() - s.started > settings.timeoutMin * 60000) {
              await setStatus(s.key, `failed: nothing after ${settings.timeoutMin} min (task ${s.videoId})`);
              await log(`${s.key}: nothing after ${settings.timeoutMin} min, stopped watching it (task ${s.videoId} may still finish in Pollo)`, "error");
              submitted = submitted.filter((x) => x.key !== s.key);
            } else {
              const q = r.recordId ? await P.waitInfo(r.recordId) : "";
              await setStatus(s.key, `generating${q ? `, ${q}` : ""}`);
            }
          }
          await store.set({ submitted });
          const again = await store.get("running");
          if (!again.running) continue;
        }

        // ---- 2. fill and send the next job ----
        const room = submitted.length < settings.maxActive;
        const gapOk = Date.now() - lastSubmit > settings.gapSec * 1000;
        const nextKey = pending[0];
        if (nextKey && room && gapOk && Date.now() >= holdUntil) {
          const key = nextKey;
          const job = byKey[key];
          let clicked = false;
          try {
            await setStatus(key, "filling");
            banner(`${key}: loading pictures…\n${submitted.length} generating`);
            const files = {
              refs: await Promise.all((job.refs || []).map(loadFile)),
              frame: await loadFile(job.frame),
              end: await loadFile(job.end),
            };
            banner(`${key}: filling Pollo (${job.type === "image" ? "image" : "video"})…\n${submitted.length} generating`);
            const r = await P.fill(job, files);
            const want = job.type === "image" ? { chips: (job.refs || []).length }
              : job.mode === "reference" ? { chips: r.wantChips, refs: (job.refs || []).length }
              : { cards: (job.frame ? 1 : 0) + (job.end ? 1 : 0), chips: 0 };
            P.check(job, want);
            const proof = await P.verifyPictures(job, files);
            await log(`${key}: pictures checked byte for byte (${proof.pictures} picture(s), ${proof.chips} @ in the prompt).`);
            await log(`${key}: filled. ${r.model}, ${r.bar}, price ${r.cost}, ${job.type === "image" ? `${want.chips} reference(s)` : job.mode === "reference" ? `${want.refs} reference(s), ${want.chips} @ in the prompt` : `${want.cards} frame(s) (start${job.end ? " + end" : ""})`}`);

            if (st.mode === "fill") {
              await setStatus(key, "filled, not sent");
              await store.set({ running: false });
              await log(`${key}: filled, NOT sent. Check the prompt bar in Pollo.`, "ok");
              break;
            }

            // Recorded before pressing Generate, so a reload never sends it twice.
            const entry = { key, videoId: null, started: Date.now(), bar: r.bar };
            submitted.push(entry);
            await store.set({ submitted });
            await setStatus(key, "sending");
            clicked = true;
            const videoId = await P.submit(job);
            entry.videoId = videoId;
            await store.set({ submitted });
            lastSubmit = Date.now();
            await setStatus(key, "generating");
            await saveRecord(key, { videoId, submitted: new Date().toISOString() });
            { const rs = await getRun(); rs.streak = 0; rs.streakReloaded = false; await putRun(rs); }
            await log(`${key}: sent, task ${videoId} (${submitted.length} generating)`);
            // First check straight away: if Pollo charged anything, stop before the next job.
            await sleep(5000);
            const first = await P.status(videoId).catch(() => null);
            if (first && first.credit > 0) {
              await store.set({ running: false });
              await log(`${key}: Pollo CHARGED ${first.credit} credits. Run stopped.`, "error");
            }
          } catch (err) {
            submitted = submitted.filter((x) => !(x.key === key && !x.videoId));
            if (!clicked && st.mode !== "fill") {
              // Nothing was sent for this job (it failed while filling or checking).
              await store.set({ submitted });
              await P.closeLibrary().catch(() => {});
              const rs = await getRun();
              // Library trouble: reload the Pollo tab and try this job once more before skipping it.
              if (err.reloadable && !rs.reloadRetried.includes(key) && rs.reloads < MAX_RELOADS) {
                rs.reloadRetried.push(key);
                await setStatus(key, `retrying after a page reload (${err.message})`);
                await reloadTab(rs, `${key}: ${err.message}. Not sent. Reloading the Pollo tab and trying this job once more.`);
                return;
              }
              rs.skipped.push(key);
              rs.streak++;
              await putRun(rs);
              await setStatus(key, `skipped: ${err.message} (not sent; Run tries it again)`);
              if (rs.streak >= SKIP_STOP) {
                if (!rs.streakReloaded && rs.reloads < MAX_RELOADS) {
                  rs.streak = 0;
                  rs.streakReloaded = true;
                  await reloadTab(rs, `${key}: ${err.message}. Not sent; skipped. ${SKIP_STOP} jobs in a row could not be filled: reloading the Pollo tab and carrying on.`);
                  return;
                }
                await store.set({ running: false });
                await log(`${key}: ${err.message}. ${SKIP_STOP} jobs in a row could not be filled, even after reloading the Pollo tab, so the run stopped. Jobs already sent will be collected when you press Run again.`, "error");
              } else {
                await log(`${key}: ${err.message}. Not sent; skipped, carrying on with the others (Run tries it again later).`, "error");
              }
              continue;
            }
            await store.set({ submitted, running: false });
            await setStatus(key, `error: ${err.message}`);
            await log(`${key}: ${err.message}. Run stopped; jobs already sent will be collected when you press Run again.`, "error");
          }
          continue;
        }

        // ---- 3. done? ----
        if (!pending.length && !submitted.length) {
          const sk = rsNow.skipped;
          await log(sk.length ? `All done, except ${sk.length} skipped (not sent): ${sk.join(", ")}. Press Run to try them again.` : "All done.", sk.length ? "error" : "ok");
          await store.set({ running: false });
          break;
        }
        const why = !room ? `at the limit of ${settings.maxActive} at once` : !gapOk ? "short pause between jobs" : pending.length ? "" : "all sent";
        banner(`${submitted.length} generating, ${pending.length} still to send${why ? ` (${why})` : ""}.\nSaved so far: ${Object.values(statuses).filter((s) => s === "saved").length}`);
        await sleep(4000);
      }
    } catch (err) {
      await log(`RUNNER ERROR: ${err.message}`, "error");
      await store.set({ running: false });
    } finally {
      looping = false;
    }
  }

  // A job recorded as "sending" with no task id means the page went away mid-click. It is not sent again;
  // it is marked so the creator can look in Pollo's history first.
  async function reconcile() {
    const { submitted = [] } = await store.get("submitted");
    const lost = submitted.filter((s) => !s.videoId);
    if (!lost.length) return;
    for (const s of lost) await setStatus(s.key, "error: page reloaded while sending; check Pollo's history before running it again");
    await store.set({ submitted: submitted.filter((s) => s.videoId) });
  }

  chrome.runtime.onMessage.addListener((m, _sender, send) => {
    if (m.type === "ping") { send({ ok: true, version: P.VERSION, url: location.href }); return false; }
    if (m.type === "start") { store.set({ owner: TOKEN, runState: freshRun() }).then(reconcile).then(() => { loop(); send({ ok: true }); }); return true; }
    return false;
  });

  // Resume after a reload.
  store.get(["running", "owner"]).then((s) => { if (s.running && s.owner === TOKEN) reconcile().then(() => setTimeout(loop, 4000)); });
})();
