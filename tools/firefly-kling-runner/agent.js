// Runs in the Firefly page itself (MAIN world), so it can read the Spectrum
// components' properties (picker.value, switch.checked). It only acts on
// commands posted by bridge.js and answers with the result.
(() => {
  if (window.__lockedOutAgent) return;
  window.__lockedOutAgent = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const squash = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");   // letters and digits only: Firefly drops punctuation from result names

  // querySelectorAll that also searches inside every shadow root.
  function deepAll(sel, root = document, acc = []) {
    if (root.shadowRoot) deepAll(sel, root.shadowRoot, acc);
    root.querySelectorAll(sel).forEach((e) => acc.push(e));
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) deepAll(sel, el.shadowRoot, acc);
    return acc;
  }
  const one = (sel, root) => deepAll(sel, root)[0] || null;
  const tid = (id, root) => one(`[data-testid="${id}"]`, root);
  const visible = (el) => !!el && el.getBoundingClientRect().width > 0;

  async function waitFor(fn, timeout = 10000, step = 200) {
    const t = Date.now();
    while (Date.now() - t < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  async function ensureVideoTab() { return ensureTab("Video"); }
  async function ensureTab(label) {
    const group = tid("ugi-output-type-tabs");
    if (!group) throw new Error("Firefly prompt bar not found. Open firefly.adobe.com (or /image-generate, /video-generate).");
    const btn = deepAll("sp-action-button", group).find((b) => norm(b.textContent).startsWith(label));
    if (btn && !btn.selected) {
      btn.click();
      await sleep(1000);
    }
  }

  async function openSettings() {
    if (visible(tid("ugi-model-picker"))) return;
    tid("ugi-generative-settings-button").click();
    if (!(await waitFor(() => visible(tid("ugi-model-picker")), 8000))) throw new Error("Generative settings did not open");
    await sleep(300);
  }

  async function closeSettings() {
    if (visible(tid("ugi-model-picker"))) {
      tid("ugi-generative-settings-button").click();
      await sleep(500);
    }
  }

  async function choose(hostId, value) {
    const host = tid(hostId);
    if (!host) throw new Error(`${hostId} not found`);
    const picker = host.tagName === "SP-PICKER" ? host : one("sp-picker", host);
    return chooseIn(picker, host, hostId, value);
  }

  // The image Quality menu has no name of its own: it is the picker offering "extraHigh". Only GPT Image models show it.
  function qualityPicker() {
    return deepAll("sp-picker").find((p) => visible(p) && deepAll("sp-menu-item", p).some((i) => i.value === "extraHigh")) || null;
  }

  async function chooseIn(picker, host, hostId, value) {
    const items = deepAll("sp-menu-item", host);
    const item = items.find((i) => i.value === value) || items.find((i) => squash(i.value) === squash(value) || squash(i.textContent) === squash(value));
    if (!item) throw new Error(`${hostId}: option "${value}" not offered (offered: ${items.map((i) => norm(i.textContent) || i.value).join(", ")})`);
    if (picker.value === item.value) return;
    for (let attempt = 0; attempt < 2 && picker.value !== item.value; attempt++) {
      // Open the menu first so the click lands on a live item (a closed menu ignored it on 17 Nov 2026), then choose.
      if (!picker.open) { picker.click(); await sleep(500); }
      item.click();
      await waitFor(() => picker.value === item.value, 4000);
      if (picker.value !== item.value) { try { picker.value = item.value; picker.dispatchEvent(new Event("change", { bubbles: true, composed: true })); } catch (e) {} await sleep(800); }
    }
    if (picker.open) { picker.click(); await sleep(300); }
    if (picker.value !== item.value) throw new Error(`${hostId}: could not set "${value}"`);
    await sleep(500);
  }

  async function setSwitch(sw, on, name) {
    if (!sw) throw new Error(`${name} switch not found`);
    if (!!sw.checked !== on) {
      sw.click();
      await sleep(400);
    }
    if (!!sw.checked !== on) throw new Error(`${name} switch did not change`);
  }

  async function setDuration(sec) {
    const trig = tid("ugi-duration-single-slider-trigger");
    if (!trig) throw new Error("Duration control not found (is Kling 3.0 selected?)");
    trig.click();
    const inp = await waitFor(() => one('input[data-testid="duration-slider"]'), 5000);
    if (!inp) throw new Error("Duration slider not found");
    if (sec < Number(inp.min) || sec > Number(inp.max)) throw new Error(`Duration ${sec}s outside ${inp.min}-${inp.max}s`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(inp, String(sec));
    inp.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await sleep(600);
    const label = norm(trig.textContent);
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    await sleep(300);
    if (!label.startsWith(`${sec} `)) throw new Error(`Duration shows "${label}", wanted ${sec} seconds`);
  }

  async function clearPrompt(ed) {
    ed.focus();
    document.execCommand("selectAll");
    document.execCommand("delete");
    await sleep(200);
  }

  // Remove every image left in the prompt bar (first frame, last frame,
  // references) from the previous clip. Firefly keeps them after Generate.
  async function clearFrames() {
    for (let i = 0; i < 6; i++) {
      const tray = tid("ugi-asset-tray") || document;
      const removers = deepAll('[data-testid="ugi-collapsed-tray-tile-remove"]', tray);
      if (!removers.length && tid("keyframe-0-empty")) return;
      removers.forEach((b) => b.click());
      await sleep(800);
    }
    if (!tid("keyframe-0-empty")) throw new Error("Could not remove the previous first frame");
  }

  async function uploadFrame(buf, name) {
    await clearFrames();
    const slot = await waitFor(() => tid("keyframe-0-empty"), 8000);
    if (!slot) throw new Error("First-frame slot is not empty and could not be cleared");
    const inp = one('input[type="file"]', slot);
    const dt = new DataTransfer();
    dt.items.add(new File([buf], name, { type: "image/jpeg" }));
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    if (!(await waitFor(() => tid("keyframe-0-filled"), 30000))) throw new Error("First frame did not attach");
    // Give Firefly 5 seconds to finish taking the picture before the next step.
    await sleep(5000);
  }

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  async function setPrompt(text) {
    const ed = one('.ProseMirror[contenteditable="true"]', tid("ugi-prompt-input"));
    if (!ed) throw new Error("Prompt box not found");
    // Firefly's prompt box is a Tiptap editor. Setting its content through the
    // editor works even when the page does not have keyboard focus (for
    // example while the extension popup is open); typing does not.
    if (ed.editor && ed.editor.commands && ed.editor.commands.setContent) {
      const html = text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
      ed.editor.commands.setContent(html, true);
    } else {
      await clearPrompt(ed);
      document.execCommand("insertText", false, text);
    }
    await sleep(600);
    if (squash(ed.textContent) !== squash(text)) throw new Error("Prompt text did not match after filling");
  }

  async function fill(job, settings, buf) {
    await ensureVideoTab();
    const clear = tid("ugi-clear-all-button");
    if (clear) {
      clear.click();
      await sleep(1000);
    }
    await openSettings();
    await choose("ugi-model-picker", "kling@kling_v3");
    await sleep(800);
    await choose("ugi-aspect-ratio-picker", "16:9");
    await choose("ugi-resolution-picker", settings.resolution);
    await setSwitch(deepAll("sp-switch").find((s) => (s.getAttribute("aria-label") || norm(s.textContent)) === "Audio"), job.audio, "Audio");
    await setDuration(job.seconds);
    await closeSettings();
    await setSwitch(tid("ugi-multishot-enable-switch"), false, "Multi-shot");
    await uploadFrame(buf, `${job.id}.jpg`);
    await setPrompt(job.prompt);
    const bar = norm(tid("ugi-generative-settings-button").textContent).replace(/\s*Generative settings$/, "");
    if (!bar.includes("Kling 3.0") || !bar.includes("16:9") || !bar.includes(settings.resolution)) throw new Error(`Settings bar shows "${bar}"`);
    return { bar };
  }

  // ---------- image mode (mapped live 17 Nov 2026 on firefly.adobe.com) ----------
  // Same prompt bar as video: Image tab, model picker, aspect, resolution 1K/2K/4K, up to 16 references in the
  // asset tray (one multiple-file input), the Tiptap prompt, Generate. The cost indicator reads "Unlimited access"
  // for models the plan covers.
  async function addReferences(bufs) {
    if (!bufs.length) return 0;
    const inp = deepAll('input[type="file"]').find((i) => i.multiple) || one('input[type="file"]');
    if (!inp) throw new Error("Reference upload not found");
    const dt = new DataTransfer();
    bufs.forEach((b, n) => dt.items.add(new File([b.buf], b.name || `ref${n + 1}.jpg`, { type: /\.png$/i.test(b.name || "") ? "image/png" : "image/jpeg" })));
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    const count = () => deepAll('[data-testid="ugi-collapsed-tray-tile-remove"]', tid("ugi-asset-tray") || document).length;
    if (!(await waitFor(() => count() >= bufs.length, 60000, 500))) throw new Error(`Only ${count()} of ${bufs.length} references attached`);
    await sleep(2500);   // let Firefly finish taking them in
    return count();
  }
  async function fillImage(job, settings, bufs) {
    const clear = tid("ugi-clear-all-button");
    if (clear) { clear.click(); await sleep(1000); }
    await ensureTab("Image");
    await openSettings();
    await choose("ugi-model-picker", job.model || settings.imageModel);
    await sleep(800);
    await choose("ugi-aspect-ratio-picker", job.aspect || settings.imageAspect);
    await choose("ugi-resolution-picker", job.resolution || settings.imageResolution);
    const quality = job.quality || settings.imageQuality || "";
    let qualityNote = "";
    const qp = quality ? qualityPicker() : null;
    if (qp) { await chooseIn(qp, qp, "Quality", quality); qualityNote = norm((deepAll("sp-menu-item", qp).find((i) => i.value === qp.value) || {}).textContent) || qp.value; }
    else if (quality) qualityNote = "model has no quality setting";
    await closeSettings();
    const refs = await addReferences(bufs);
    await setPrompt(job.prompt);
    const bar = norm(tid("ugi-generative-settings-button").textContent).replace(/\s*Generative settings$/, "");
    const cost = norm((tid("generation-cost-indicator-v2-button") || {}).textContent);
    if (settings.unlimitedOnly && !/unlimited/i.test(cost)) throw new Error(`Firefly shows "${cost}" for this image, not Unlimited access. Nothing generated (untick "Unlimited models only" in Settings to allow it).`);
    return { bar, cost, refs, quality: qualityNote };
  }
  // A finished image's file: the picture in the results list whose alt text is the asset's own name.
  async function imageUrlForIndex(idx, name) {
    const v = assetsList();
    if (!v) return "";
    try { v.scrollToIndex(idx, "center"); } catch (e) {}
    const hit = await waitFor(() => {
      const imgs = deepAll("img").filter((i) => i.alt === name && /^https:/.test(i.src) && i.naturalWidth > 200);
      imgs.sort((a, b) => b.naturalWidth - a.naturalWidth);
      return imgs[0] || null;
    }, 8000, 300);
    return hit ? hit.src : "";
  }

  // ---------- finding finished videos ----------
  // Firefly's results list ("Generated assets") holds one entry per finished
  // generation, oldest first, newest at the bottom. Each entry has a name made
  // from the start of the prompt plus a number, and a creation time.
  function assetsList() {
    const v = deepAll("lit-virtualizer").find((x) => x.getAttribute("aria-label") === "Generated assets") || one("lit-virtualizer");
    return v;
  }
  // Entry names look like "The silver-haired man speaks ple 141025043 Ps3.ffgenvid":
  // the first 32 characters of the prompt, a number, then a file name.
  const namePrefix = (name) => (name || "").replace(/\s+\d{4,}(\s.*)?$/, "");

  function assets() {
    const v = assetsList();
    if (!v || !Array.isArray(v.items)) return [];
    return v.items.map((x, idx) => ({ idx, id: x.id, name: (x.item && x.item.name) || "", created: Number((x.item && x.item.created) || 0), video: !!(x.item && x.item.assetType === "video"), image: !!(x.item && x.item.assetType === "image") }));
  }

  function scrollFeedToBottom() {
    const v = assetsList();
    if (v) v.scrollTop = v.scrollHeight;
  }

  function cellInfo(c) {
    const p = tid("media-details-prompt", c);
    const v = one("video", c);
    const src = v ? v.currentSrc || v.src || "" : "";
    return { prompt: p ? norm(p.textContent) : "", src: src.startsWith("http") ? src : "", text: norm(c.textContent).slice(0, 400), rect: c.getBoundingClientRect() };
  }

  // Bring one list entry into view and read the video address from its cell.
  async function urlForIndex(idx, prompt) {
    const v = assetsList();
    if (!v) return "";
    try {
      v.scrollToIndex(idx, "center");
    } catch (e) {
      const el = v.element && v.element(idx);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
    }
    const want = squash(prompt).slice(0, 60);
    const box = v.getBoundingClientRect();
    const mid = box.top + box.height / 2;
    const hit = await waitFor(() => {
      const cells = deepAll("firefly-studio-media-list-cell")
        .map(cellInfo)
        .filter((i) => i.src && squash(i.prompt).startsWith(want));
      if (!cells.length) return null;
      cells.sort((a, b) => Math.abs(a.rect.top + a.rect.height / 2 - mid) - Math.abs(b.rect.top + b.rect.height / 2 - mid));
      return cells[0];
    }, 6000, 300);
    return hit ? hit.src : "";
  }

  // Ids of every finished entry right now, taken just before Generate.
  function snapshot() {
    return assets().map((a) => a.id);
  }

  // For each submitted clip, look for a new finished entry whose name matches
  // the start of its prompt and that was created after it was submitted.
  async function pollMany(items) {
    const list = assets();
    const used = new Set();
    const out = [];
    const sorted = [...items].sort((a, b) => (a.started || 0) - (b.started || 0));
    for (const it of sorted) {
      const p = squash(it.prompt);
      const snap = new Set(it.snap || []);
      const cands = list
        .filter((a) => (it.kind === "image" ? a.image : a.video) && !snap.has(a.id) && !used.has(a.id) && a.created >= (it.started || 0) - 60000)
        .filter((a) => {
          const n = squash(namePrefix(a.name));
          return n.length >= 10 && p.startsWith(n);
        })
        .sort((a, b) => a.created - b.created);
      let found = null;
      for (const c of cands) {
        const url = it.kind === "image" ? await imageUrlForIndex(c.idx, c.name) : await urlForIndex(c.idx, it.prompt);
        if (url) {
          found = { c, url };
          break;
        }
      }
      if (found) {
        used.add(found.c.id);
        out.push({ key: it.key, status: "done", url: found.url, assetId: found.c.id });
      } else {
        out.push({ key: it.key, status: "pending" });
      }
    }
    scrollFeedToBottom();
    return out;
  }

  // After Generate, look for signs Firefly started it: a new matching finished
  // entry, or a cell at the bottom of the feed with this prompt and no video yet.
  async function confirmStarted(prompt, snap) {
    const want = squash(prompt).slice(0, 60);
    const old = new Set(snap || []);
    const ok = await waitFor(() => {
      scrollFeedToBottom();
      const cells = deepAll("firefly-studio-media-list-cell").map(cellInfo);
      if (cells.some((i) => squash(i.prompt).startsWith(want) && !i.src)) return true;
      const p = squash(prompt);
      return assets().some((a) => !old.has(a.id) && p.startsWith(squash(namePrefix(a.name))));
    }, 30000, 1000);
    return !!ok;
  }

  async function generate() {
    const b = tid("ugi-generate-button");
    if (!b || b.disabled) throw new Error("Generate button is disabled");
    b.click();
    await sleep(3000);
    return true;
  }

  const ops = {
    ping: async () => "pong",
    fill: (a) => fill(a.job, a.settings, a.buf),
    fillImage: (a) => fillImage(a.job, a.settings, a.bufs || []),
    snapshot: async () => snapshot(),
    generate: () => generate(),
    pollMany: (a) => pollMany(a.items),
    confirmStarted: (a) => confirmStarted(a.prompt, a.snap),
  };

  window.addEventListener("message", async (e) => {
    if (e.source !== window || !e.data || e.data.__lo !== "cmd") return;
    const { id, op, args } = e.data;
    try {
      const r = await ops[op](args || {});
      window.postMessage({ __lo: "res", id, ok: true, r }, "*");
    } catch (err) {
      window.postMessage({ __lo: "res", id, ok: false, error: String((err && err.message) || err) }, "*");
    }
  });
})();
