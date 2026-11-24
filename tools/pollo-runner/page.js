// Pollo page operations: everything that touches the pollo.ai page.
// No chrome.* calls here, so the same file can be pasted into a plain pollo.ai tab for testing.
// Mapped live on 24 Nov 2026 (signed-in Ultra account, desktop layout).
//
// Free-only rule: nothing is ever submitted unless Pollo's own price label next to Generate reads "Unlimited".
(() => {
  if (globalThis.PolloPage && globalThis.PolloPage.VERSION) return;
  const P = {};
  P.VERSION = "1.6.0";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const squash = (s) => (s || "").replace(/\s+/g, "");
  const vis = (el) => !!el && el.getBoundingClientRect().width > 0;
  // Pollo's dialog wrappers can measure 0 x 0 while their contents show, so a dialog counts as shown if anything in it has size.
  const shown = (el) => !!el && (vis(el) || [...el.querySelectorAll("*")].some((c) => c.getBoundingClientRect().width > 0));
  async function waitFor(fn, timeout = 10000, step = 250) {
    const t = Date.now();
    while (Date.now() - t < timeout) {
      let v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      await sleep(step);
    }
    return null;
  }
  // Pollo's menus open on pointer events, not on a bare click().
  function press(el) {
    const o = { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: "mouse", button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.click();
  }
  const escape = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  const leaf = (root, text) => [...root.querySelectorAll("*")].find((e) => e.childElementCount === 0 && norm(e.textContent) === text);

  // ---------- the composer (prompt bar) ----------
  function composer() {
    const g = [...document.querySelectorAll('[data-testid="prompt-generate-btn"]')].find(vis);
    if (!g) return null;
    let c = g;
    // The bar is the smallest box holding the mode menu and the pictures area (the "+" and frame slots sit above it).
    while (c && !(c.querySelector('[data-testid="chat-child-category-select"]') && c.querySelector('[data-testid="chat-prompt-wrapper"]'))) c = c.parentElement;
    return c;
  }
  function need() {
    const c = composer();
    if (!c) throw new Error("Pollo prompt bar not found. Open pollo.ai/image or pollo.ai/video and sign in.");
    return c;
  }
  const categoryBtn = () => need().querySelector('[data-testid="chat-child-category-select"]');
  const category = () => categoryBtn().getAttribute("data-value") || "";
  const editor = () => need().querySelector(".tiptap.ProseMirror, [contenteditable=true][role=textbox]");
  const footer = () => need().querySelector('[data-testid="chat-footer-fields"]');
  const footerText = () => squash((footer() || {}).textContent || "");
  P.cost = () => norm((need().querySelector('[data-slot="credit-cost-value"]') || {}).textContent || "");
  function modelBtn() {
    const bs = [...need().querySelectorAll("button")].filter(vis);
    const i = bs.indexOf(categoryBtn());
    return bs.slice(i + 1).find((b) => !b.getAttribute("data-testid") && !b.getAttribute("aria-label") && norm(b.textContent) && norm(b.textContent) !== "Unlimited") || null;
  }
  P.model = () => norm((modelBtn() || {}).textContent || "");
  P.state = () => ({ category: category(), model: P.model(), bar: footerText(), cost: P.cost(), unlimited: (unlimitedSwitch() || {}).getAttribute?.("aria-checked") === "true", prompt: norm((editor() || {}).innerText || "") });

  // Small tips Pollo shows once ("Got it"). Only that exact label is clicked.
  P.dismissTips = async () => {
    for (const b of [...document.querySelectorAll("button")].filter((b) => vis(b) && norm(b.textContent) === "Got it")) { b.click(); await sleep(400); }
  };

  // ---------- page and mode ----------
  const KIND_OF = (cat) => (/video/.test(cat) ? "video" : /image/.test(cat) ? "image" : "");
  P.goTo = async (kind) => {
    const ok = () => { const c = composer(); return c && KIND_OF(category()) === kind; };
    if (ok()) return;
    const link = document.querySelector(`a[href="/${kind}"]`);
    if (!link) throw new Error(`No "${kind}" link on the page`);
    link.click();   // a Next.js link: the page changes without a reload, so the runner keeps going
    if (!(await waitFor(ok, 20000))) throw new Error(`The ${kind} prompt bar did not open`);
    await sleep(1500);
  };

  const MODES = {
    image: { value: "text-image-to-image", text: "Text/Image to Image" },
    frames: { value: "text-image-to-video", text: "Text/Image to Video" },
    reference: { value: "reference-to-video", text: "Reference to Video" },
  };
  P.setMode = async (mode) => {
    const m = MODES[mode];
    if (!m) throw new Error(`Unknown mode ${mode}`);
    if (category() === m.value) return;
    press(categoryBtn());
    const menu = await waitFor(() => [...document.querySelectorAll("[role=menu]")].find(shown), 5000);
    if (!menu) throw new Error("The mode menu did not open");
    const items = [...menu.querySelectorAll("[role=menuitem], [role=menuitemradio]")];
    const it = items.find((i) => i.getAttribute("data-value") === m.value) || items.find((i) => norm(i.textContent).startsWith(m.text));
    if (!it) { escape(); throw new Error(`Mode "${m.text}" not offered (offered: ${items.map((i) => norm(i.textContent)).join(", ")})`); }
    press(it);
    if (!(await waitFor(() => category() === m.value, 8000))) throw new Error(`Could not switch to "${m.text}"`);
    await sleep(1000);
  };

  P.setModel = async (name) => {
    if (P.model() === name) return;
    const b = modelBtn();
    if (!b) throw new Error("Model button not found");
    if (b.getAttribute("aria-expanded") !== "true") press(b);
    // The model button names its own list (aria-controls): a sheet headed "Select model" in a narrow window,
    // a drop-down with Search and "Recently used" in a wide one. Only that list is searched, never the page's
    // model gallery (a gallery card opens a model page instead, 24 Nov 2026).
    const listOf = () => {
      const id = b.getAttribute("aria-controls");
      const el = id && document.getElementById(id);
      if (el && norm(el.innerText).includes(name)) return el;
      return [...document.querySelectorAll("[role=dialog]")].find((d) => shown(d) && /Select model|Recently used/.test(d.innerText) && d.innerText.includes(name)) || null;
    };
    const dlg = await waitFor(listOf, 6000);
    if (!dlg) { escape(); throw new Error(`The model list did not open or has no "${name}"`); }
    const l = leaf(dlg, name);
    if (!l) { escape(); throw new Error(`Model "${name}" is not in Pollo's list`); }
    let row = l;
    for (let i = 0; i < 6 && row && !/credits|Unlimited/.test(row.textContent); i++) row = row.parentElement;
    press(row || l);
    if (!(await waitFor(() => P.model() === name, 6000))) { escape(); throw new Error(`Could not choose model "${name}" (shows "${P.model()}")`); }
    await sleep(800);
  };

  // ---------- Unlimited switch and settings ----------
  function unlimitedSwitch() {
    const c = composer();
    return c ? [...c.querySelectorAll('[role=switch][data-slot="switch-root"], [role=switch]')].find(vis) || null : null;
  }
  P.setUnlimited = async () => {
    const sw = unlimitedSwitch();
    if (!sw) throw new Error("No Unlimited switch for this model. It would cost credits, so nothing was done.");
    if (sw.getAttribute("aria-checked") !== "true") { press(sw); await waitFor(() => sw.getAttribute("aria-checked") === "true", 4000); }
    if (sw.getAttribute("aria-checked") !== "true") throw new Error("Could not turn on Unlimited");
    await sleep(600);
  };

  const panel = () => [...document.querySelectorAll("[role=dialog]")].find((d) => shown(d) && /Output Number/.test(d.innerText));
  async function openPanel() {
    if (panel()) return panel();
    // A stray list (the @ list, a tip) can swallow the first press, so try twice.
    let p = null;
    for (let i = 0; i < 2 && !p; i++) {
      escape();
      await sleep(300);
      if (footer().getAttribute("aria-expanded") === "true") { press(footer()); await sleep(500); }
      press(footer());
      p = await waitFor(panel, 4000);
    }
    if (!p) throw new Error("The settings panel did not open");
    await sleep(300);
    return p;
  }
  async function closePanel() {
    if (!panel()) return;
    escape();
    if (!(await waitFor(() => !panel(), 2000))) { press(footer()); await waitFor(() => !panel(), 2000); }
  }
  function section(name) {
    const p = panel();
    const head = leaf(p, name);
    if (!head) return null;
    let s = head;
    while (s && s.parentElement && !(norm(s.parentElement.innerText).startsWith(name) && norm(s.parentElement.innerText) !== name)) s = s.parentElement;
    return s && s.parentElement;
  }
  async function pick(sec, label) {
    const sc = section(sec);
    if (!sc) throw new Error(`Setting "${sec}" not shown for this model`);
    const el = [...sc.querySelectorAll("*")].find((e) => norm(e.textContent) === label);
    if (!el) throw new Error(`${sec}: "${label}" not offered (offered: ${norm(sc.innerText).replace(sec, "").trim()})`);
    press(el);
    await sleep(450);
  }
  // Which options carry Pollo's own "unlimited" badge in the open panel.
  function freeOptions() {
    const p = panel();
    return p ? [...p.querySelectorAll('[data-testid="unlimited-badge"]')].map((b) => norm(b.parentElement && b.parentElement.parentElement ? b.parentElement.parentElement.textContent : b.parentElement.textContent)) : [];
  }
  P.setSettings = async (s) => {
    await openPanel();
    try {
      if (s.aspect && section("Aspect Ratio")) await pick("Aspect Ratio", s.aspect);
      if (s.resolution) await pick("Resolution", s.resolution);
      if (s.quality && section("Quality")) await pick("Quality", s.quality);
      await pick("Output Number", "1");
      const free = freeOptions();
      return { free };
    } finally {
      await closePanel();
    }
  };

  // ---------- pictures: Pollo's library dialog (Uploads, Creations ...) ----------
  // Every "+" and the Start / End frame slots open the same library. A file is uploaded once under its own name
  // (the job builder puts a content hash in the name) and picked by that name afterwards.
  const libDialog = () => [...document.querySelectorAll("[role=dialog]")].find((d) => shown(d) && /Upload Media/.test(d.innerText));
  const selectBtn = (d) => [...d.querySelectorAll("button")].find((b) => /^Select/.test(norm(b.textContent)));
  const selCount = (d) => { const m = norm((selectBtn(d) || {}).textContent || "").match(/\((\d+)\//); return m ? Number(m[1]) : 0; };
  // Pollo keeps only the first 25 characters of an upload's name (before the extension).
  const cut = (n) => { const m = String(n).match(/^(.*?)(\.[a-z0-9]+)?$/i); return m[1].slice(0, 25) + (m[2] || ""); };
  const tile = (d, name) => [...d.querySelectorAll("img")].find((i) => (i.alt === name || i.alt === cut(name)) && /^https:/.test(i.src));
  // Close the library without choosing anything. Escape does not close it (checked 24 Nov 2026); its Close button does,
  // after about 2 seconds.
  async function closeLibrary() {
    for (let i = 0; i < 3 && libDialog(); i++) {
      escape();
      const d = libDialog();
      const x = d && [...d.querySelectorAll('button[aria-label="Close" i]')].find(vis);
      if (x) press(x);
      await waitFor(() => !libDialog(), 5000, 250);
    }
    if (libDialog()) throw new Error("Pollo's picture library would not close");
  }
  P.closeLibrary = closeLibrary;
  async function openLibrary(opener) {
    press(opener);
    const d = await waitFor(libDialog, 8000);
    if (!d) throw new Error("Pollo's picture library did not open");
    const up = [...d.querySelectorAll("button")].find((b) => norm(b.textContent) === "Uploads");
    if (up) { press(up); await sleep(800); }
    if (selCount(libDialog() || d)) throw new Error("The library already had pictures ticked; nothing was changed");
    return libDialog() || d;
  }
  // A first upload of a new file can stall in Pollo (24 Nov 2026: a 6 MB PNG and a 0.7 MB JPG each sat over 2 minutes).
  // So each upload gets 3 tries: wait, then close and reopen the library (the file may have landed but the list
  // did not refresh), then upload it again. A second copy of the same file is harmless: the bytes are checked later.
  P.uploadWaits = [120000, 90000, 90000];
  P.note = () => {};
  P.chooseInLibrary = (...a) => chooseInLibrary(...a); // used by the free upload test
  async function chooseInLibrary(opener, files) {
    let d = await openLibrary(opener);
    const D = () => libDialog() || d;
    const ready = (name) => { const t = tile(D(), name); return t && t.complete; };
    try {
      for (const f of files) {
        let ok = !!ready(f.name);
        for (let a = 0; !ok && a < P.uploadWaits.length; a++) {
          if (a) {
            P.note(`Upload of ${f.name} is slow; reopening the library (try ${a + 1} of ${P.uploadWaits.length})`);
            await closeLibrary();
            d = await openLibrary(opener);
            if (await waitFor(() => ready(f.name), 10000, 500)) { ok = true; break; }
          }
          const inp = D().querySelector('input[type="file"]');
          if (!inp) throw new Error("The library has no upload box");
          const dt = new DataTransfer();
          dt.items.add(new File([f.buf], f.name, { type: f.type || "image/jpeg" }));
          inp.files = dt.files;
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          ok = !!(await waitFor(() => ready(f.name), P.uploadWaits[a], 500));
        }
        if (!ok) throw new Error(`Upload of ${f.name} did not finish after ${P.uploadWaits.length} tries (about ${Math.round(P.uploadWaits.reduce((x, y) => x + y, 0) / 60000)} min)`);
        await sleep(800);
      }
      for (let i = 0; i < files.length; i++) {
        tile(D(), files[i].name).click();
        if (!(await waitFor(() => selCount(D()) === i + 1, 4000))) throw new Error(`Could not tick ${files[i].name} in the library`);
      }
      selectBtn(D()).click();
      if (!(await waitFor(() => !libDialog(), 8000))) throw new Error("The library did not close after Select");
      await sleep(1200);
    } catch (e) {
      await closeLibrary().catch(() => {});
      throw e;
    }
  }

  P.clear = async () => {
    for (let i = 0; i < 20; i++) {
      const x = [...need().querySelectorAll('[data-testid="chat-attachments"] button[aria-label="Remove reference" i]')][0] ||
        [...need().querySelectorAll('[data-image-card] .i-cus--pol-close, [data-testid="chat-attachments"] .i-cus--pol-close')].map((s) => s.parentElement)[0];
      if (!x) break;
      press(x);
      await sleep(600);
    }
    const ed = editor();
    if (ed && norm(ed.innerText)) { ed.focus(); document.execCommand("selectAll"); document.execCommand("delete"); await sleep(400); }
    if (need().querySelectorAll('[data-image-card], [data-testid="ref-chip"]').length) throw new Error("Could not remove the previous job's pictures from the prompt bar");
    if (ed && norm(ed.innerText)) throw new Error("Could not clear the previous prompt");
  };

  // The "+" / "Add Reference" opener (image page and Reference to Video).
  const refOpener = () => {
    const att = need().querySelector('[data-testid="chat-attachments"]');
    // Pollo writes this label as "Add Reference" or "Add reference" depending on the state, hence the "i".
    return (att && ([...att.querySelectorAll('button[aria-label="Add Reference" i], [data-testid="upload-card-asset-picker"]')].find(vis))) || [...need().querySelectorAll('button[aria-label="Add Reference" i]')].find(vis) || null;
  };
  const framePickers = () => [...need().querySelectorAll('[data-testid="chat-frame-pair"] [data-testid="upload-card-asset-picker"]')].filter(vis);

  P.typePrompt = async (text) => {
    // One line: Enter would send, and "@" opens Pollo's mention list.
    const flat = norm(String(text).replace(/@/g, " at "));
    const ed = editor();
    if (!ed) throw new Error("Prompt box not found");
    ed.focus();
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    document.execCommand("insertText", false, (norm(ed.innerText) ? " " : "") + flat);
    await sleep(700);
    if (!norm(ed.innerText).endsWith(flat)) throw new Error("The prompt did not go into Pollo's prompt box exactly");
    return flat;
  };

  // ---------- Reference to Video: pictures named in the prompt with @ ----------
  // In Reference to Video Pollo labels each @ chip with the picture's file name, not "Image 1". So every "Image N"
  // (or "@N") in the prompt is replaced, right there, by the @ chip of the job's N-th picture, picked from Pollo's
  // @ list by name. Pictures the prompt never names are put first, in order, so every attached picture is used.
  const caretEnd = (ed) => {
    ed.focus();
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  };
  const chipCount = () => (editor() || document.createElement("div")).querySelectorAll("[data-media-chip]").length;
  async function mention(name) {
    const ed = editor();
    caretEnd(ed);
    const before = chipCount();
    if (!/\s$/.test(ed.innerText.replace(/\n$/, "")) && norm(ed.innerText)) document.execCommand("insertText", false, " ");
    document.execCommand("insertText", false, "@");
    const want = (i) => { const a = (i.querySelector("img") || {}).alt; return a === name || a === cut(name); };
    const item = await waitFor(() => [...document.querySelectorAll('[data-testid="asset-item-upload"]')].find((i) => vis(i) && want(i)), 6000);
    if (!item) {
      document.execCommand("delete");
      throw new Error(`Pollo's @ list did not offer ${name}`);
    }
    press(item);
    if (!(await waitFor(() => chipCount() === before + 1, 4000))) throw new Error(`The @ chip for ${name} did not appear`);
    await sleep(300);
  }
  // Preferred: hook.js places the chips through Pollo's editor (works with the page in the background).
  const placed = [];
  window.addEventListener("message", (e) => { if (e.source === window && e.data && e.data.__polloRunner === "placed") placed.push(e.data); });
  async function placeViaHook(text, count) {
    const reqId = Math.random().toString(36).slice(2);
    window.postMessage({ __polloRunner: "placeMentions", reqId, prompt: String(text), count }, location.origin);
    return waitFor(() => placed.find((x) => x.reqId === reqId), 5000, 100);
  }
  P.typeWithMentions = async (text, names) => {
    const viaHook = await placeViaHook(text, names.length);
    if (viaHook) {
      if (!viaHook.ok) throw new Error(viaHook.error);
      await sleep(600);
      if (chipCount() !== viaHook.expected) throw new Error(`${chipCount()} @ pictures in the prompt, expected ${viaHook.expected}`);
      return { typed: norm(String(text)), chips: viaHook.expected };
    }
    // Fallback without hook.js: type @ and pick from Pollo's list (needs the Pollo tab to have focus).
    const ed = editor();
    if (!ed) throw new Error("Prompt box not found");
    // Pollo puts the chosen pictures at the start of the prompt; take them out (the pictures stay attached).
    ed.focus();
    document.execCommand("selectAll");
    document.execCommand("delete");
    await sleep(400);
    if (chipCount()) throw new Error("Could not clear the prompt before placing the @ pictures");
    const flat = norm(String(text));
    const parts = flat.split(/(@\d+|\bImage \d+\b)/);
    const num = (p) => { const m = p.match(/^(?:@|Image )(\d+)$/); return m ? Number(m[1]) : 0; };
    const named = new Set(parts.map(num).filter(Boolean));
    for (const n of named) if (n > names.length) throw new Error(`The prompt names Image ${n} but the job has ${names.length} picture(s)`);
    let chips = 0;
    for (let i = 1; i <= names.length; i++) if (!named.has(i)) { await mention(names[i - 1]); chips++; }
    for (const p of parts) {
      const n = num(p);
      if (n) { await mention(names[n - 1]); chips++; continue; }
      if (!p) continue;
      caretEnd(ed);
      document.execCommand("insertText", false, p.replace(/@/g, " at "));
    }
    await sleep(600);
    const tail = norm(parts.filter((p) => !num(p)).pop() || "").replace(/@/g, " at ");
    if (chipCount() !== chips) throw new Error(`${chipCount()} @ pictures in the prompt, expected ${chips}`);
    if (tail && !norm(ed.innerText).endsWith(norm(tail))) throw new Error("The prompt did not go into Pollo's prompt box exactly");
    return { typed: flat, chips };
  };

  // ---------- one job ----------
  // job: {type: "image"|"video", mode: "frames"|"reference"|"text", model, aspect, resolution, quality, seconds, prompt}
  // files: {refs: [{name, buf, type}], frame: {..}|null, end: {..}|null}
  P.fill = async (job, files) => {
    escape();                 // close any list left open (the @ list, a menu)
    await sleep(300);
    await P.dismissTips();
    await P.goTo(job.type);
    await P.setMode(job.type === "image" ? "image" : job.mode === "reference" ? "reference" : "frames");
    await P.setModel(job.model);
    await P.clear();
    await P.setUnlimited();
    const hasFrame = job.type === "video" && !!files.frame;
    const set = await P.setSettings({ aspect: hasFrame ? null : job.aspect, resolution: job.resolution, quality: job.type === "image" ? job.quality : null });
    if (job.type === "video" && job.seconds && job.seconds !== 5) throw new Error(`Only 5 s clips are free on H3; this job asks ${job.seconds} s`);
    if (job.type === "video" && job.mode !== "reference") {
      if (files.frame) {
        const p = framePickers();
        if (!p.length) throw new Error("Start frame slot not found");
        await chooseInLibrary(p[0], [files.frame]);
      }
      if (files.end) {
        const p = framePickers();
        if (!p.length) throw new Error("End frame slot not found");
        await chooseInLibrary(p[p.length - 1], [files.end]);
      }
    } else if (files.refs && files.refs.length) {
      const o = refOpener();
      if (!o) throw new Error("The add-reference button was not found");
      await chooseInLibrary(o, files.refs);
    }
    let typed, wantChips;
    if (job.type === "video" && job.mode === "reference") {
      const r = await P.typeWithMentions(job.prompt, files.refs.map((f) => f.name));
      typed = r.typed;
      wantChips = r.chips;
    } else {
      typed = await P.typePrompt(job.prompt);
      wantChips = job.type === "image" ? files.refs.length : 0;
    }
    const st = P.state();
    const cards = need().querySelectorAll("[data-image-card]").length;
    const refs = need().querySelectorAll('[data-testid="ref-chip"]').length;
    const chips = chipCount();
    return { ...st, typed, cards, refs, chips, wantChips, free: set.free };
  };

  // ---------- proof that the right pictures are in the right places ----------
  // Pollo keeps the exact bytes of an upload (checked 24 Nov 2026), so every attached picture is downloaded again
  // and its SHA-1 compared with the job's own file. Then each @ chip in the prompt must point at the right one.
  // Any difference and the job is not sent.
  const sha1 = async (buf) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", buf))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const urlOf = (el) => (el.getAttribute("data-reference-url") || el.getAttribute("src") || "").split("?")[0];
  function attachedPictures(job) {
    const c = need();
    if (job.type === "video" && job.mode === "reference") return [...c.querySelectorAll('[data-testid="ref-chip"]')].map(urlOf);
    if (job.type === "video") return [...c.querySelectorAll('[data-testid="chat-frame-pair"] [data-image-card] img')].map(urlOf);
    return [...c.querySelectorAll('[data-testid="chat-attachments"] [data-image-card] img, [data-image-card] img')].map(urlOf).filter((u, i, a) => a.indexOf(u) === i);
  }
  // The order of pictures the prompt's @ chips must show: unnamed pictures first, then each "Image N" / "@N" in turn.
  function chipOrder(prompt, n) {
    const parts = norm(String(prompt)).split(/(@\d+|\bImage \d+\b)/);
    const num = (p) => { const m = p.match(/^(?:@|Image )(\d+)$/); return m ? Number(m[1]) : 0; };
    const named = parts.map(num).filter(Boolean);
    const out = [];
    for (let i = 1; i <= n; i++) if (!named.includes(i)) out.push(i);
    return out.concat(named);
  }
  P.verifyPictures = async (job, files) => {
    const want = job.type === "video" && job.mode !== "reference" ? [files.frame, files.end].filter(Boolean) : files.refs || [];
    const roles = job.type === "video" && job.mode !== "reference" ? ["start frame", "end frame"] : want.map((_, i) => `Image ${i + 1}`);
    const got = attachedPictures(job);
    if (got.length !== want.length) throw new Error(`Not sent: Pollo shows ${got.length} picture(s), the job has ${want.length}`);
    for (let i = 0; i < want.length; i++) {
      const r = await fetch(got[i]);
      if (!r.ok) throw new Error(`Not sent: could not read back the ${roles[i]} from Pollo (${r.status})`);
      const [a, b] = await Promise.all([sha1(await r.arrayBuffer()), sha1(want[i].buf)]);
      if (a !== b) throw new Error(`Not sent: the ${roles[i]} in Pollo is not ${want[i].name}`);
    }
    // @ chips in the prompt
    const chips = [...(editor() || document.createElement("div")).querySelectorAll("[data-media-chip]")].map((e) => (e.getAttribute("data-src") || "").split("?")[0]);
    let order = [];
    if (job.type === "image") order = want.map((_, i) => i + 1);
    else if (job.mode === "reference") order = chipOrder(job.prompt, want.length);
    if (chips.length !== order.length) throw new Error(`Not sent: ${chips.length} @ picture(s) in the prompt, expected ${order.length}`);
    for (let k = 0; k < order.length; k++) if (chips[k] !== got[order[k] - 1]) throw new Error(`Not sent: @ picture ${k + 1} in the prompt is not Image ${order[k]}`);
    return { pictures: want.length, chips: chips.length };
  };

  // What the prompt bar must show before Generate is pressed. Throws, so nothing is sent, if anything is off.
  P.check = (job, want) => {
    const st = P.state();
    const problems = [];
    if (st.cost !== "Unlimited") problems.push(`price shows "${st.cost}", not Unlimited`);
    if (st.model !== job.model) problems.push(`model is "${st.model}"`);
    const bar = st.bar;
    if (job.type === "image") {
      for (const v of [job.aspect, job.resolution, job.quality, "1"]) if (v && !bar.split("/").includes(v)) problems.push(`settings show ${bar}, want ${v}`);
    } else {
      for (const v of ["5s", job.resolution, "1"]) if (v && !bar.split("/").includes(v)) problems.push(`settings show ${bar}, want ${v}`);
    }
    const chips = (editor() || document.createElement("div")).querySelectorAll("[data-media-chip]").length;
    if (want && want.chips != null && want.chips !== chips) problems.push(`${chips} picture(s) in the prompt, want ${want.chips}`);
    const cards = need().querySelectorAll("[data-image-card]").length;
    if (want && want.cards != null && want.cards !== cards) problems.push(`${cards} frame(s) attached, want ${want.cards}`);
    const refs = need().querySelectorAll('[data-testid="ref-chip"]').length;
    if (want && want.refs != null && want.refs !== refs) problems.push(`${refs} reference picture(s) attached, want ${want.refs}`);
    if (job.type === "video" && job.mode === "reference" && cards) problems.push("a Start/End frame is attached in Reference mode");
    if (job.type === "video" && job.mode === "frames" && refs) problems.push("reference pictures are attached in Frames mode");
    if (problems.length) throw new Error("Not sent: " + problems.join("; "));
    return st;
  };

  const currentVideoId = () => new URLSearchParams(location.search).get("videoId");
  // Pollo's answer to a submit, passed on by hook.js (see there). Kept here so P.submit can read it.
  const submits = [];
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data && (e.data.__polloRunner === "submitted" || e.data.__polloRunner === "submitError")) submits.push(e.data);
  });
  async function recordToVideo(recordId) {
    const r = await fetch(location.origin + "/api/trpc/generation.queryRecordDetail?input=" + encodeURIComponent(JSON.stringify({ json: { id: recordId } })), { credentials: "include" });
    const d = ((((await r.json()) || {}).result || {}).data || {}).json;
    return d && d.videoId ? d.videoId : null;
  }
  // Presses Generate once and returns Pollo's id for the new result. Never presses twice.
  P.submit = async (job) => {
    P.check(job);
    const before = currentVideoId();
    const t0 = Date.now();
    const g = [...document.querySelectorAll('[data-testid="prompt-generate-btn"]')].find(vis);
    if (!g || g.disabled) throw new Error("Generate button not ready");
    g.click();
    // Pollo's own answer (record id, through hook.js) or, failing that, a new videoId in the address.
    const got = await waitFor(() => {
      const m = submits.find((x) => x.at >= t0);
      if (m) return m;
      const v = currentVideoId();
      return v && v !== before ? { videoId: v } : null;
    }, 45000, 400);
    if (!got) {
      const toast = [...document.querySelectorAll("[data-sonner-toast], [role=alert]")].map((t) => norm(t.innerText)).filter(Boolean).join(" | ");
      throw new Error("Pollo showed no sign of the job in 45 s (it may still have started: look in Pollo's history before sending it again)" + (toast ? `: ${toast}` : ""));
    }
    if (got.__polloRunner === "submitError") throw new Error(`Pollo refused the job: ${got.message}`);
    if (got.requestLimit) throw new Error("Pollo says the request limit is reached; try later");
    if (got.videoId) return got.videoId;
    let vid = null;
    for (let i = 0; i < 4 && !vid; i++) {
      vid = await recordToVideo(got.id).catch(() => null);
      if (!vid) await sleep(3000);
    }
    if (!vid) throw new Error(`Pollo took the job (record ${got.id}) but its task id could not be read; look in Pollo's history`);
    return vid;
  };

  // Reads a result the same way the page does. Returns {status, url, credit, recordId, failMsg, mediaType}.
  P.status = async (videoId) => {
    const r = await fetch(location.origin + "/api/trpc/video.getVideoDetail?input=" + encodeURIComponent(JSON.stringify({ json: { videoId } })), { credentials: "include" });
    if (!r.ok) throw new Error(`Pollo answered ${r.status} for ${videoId}`);
    const j = ((await r.json()).result || {}).data;
    const d = j && j.json;
    if (!d) throw new Error(`No details for ${videoId}`);
    const rec = d.generateRecord || {};
    const st = String(d.status || rec.status || "");
    return {
      videoId,
      status: st === "succeed" ? "done" : /fail|error|reject|cancel/i.test(st) ? "failed" : "waiting",
      raw: st,
      url: d.mediaUrl || d.videoUrlNoWatermark || d.videoUrl || null,
      credit: Number(rec.credit || 0),
      creditType: rec.creditType || "",
      recordId: rec.id || null,
      model: rec.videoModelLabel || "",
      failMsg: d.failMsg || rec.failMsg || "",
      mediaType: d.mediaType || "",
    };
  };

  P.waitInfo = async (recordId) => {
    try {
      const r = await fetch(location.origin + "/api/trpc/generationPolling.fetchRecordsStatus?input=" + encodeURIComponent(JSON.stringify({ json: { recordIds: [recordId] } })), { credentials: "include" });
      const w = ((((await r.json()).result || {}).data || {}).json || [])[0];
      return w && w.waiting ? `queue ${w.waiting.waitingIndex} of ${w.waiting.waitingCount}` : "";
    } catch (e) { return ""; }
  };

  globalThis.PolloPage = P;
})();
