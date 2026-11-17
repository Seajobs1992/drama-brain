// Runs inside the Flow page (MAIN world). It only acts on commands posted by bridge.js
// and answers with the result. Controls are found by their labels, as Flow shows them
// (mapped live on 16 November 2026):
//   settings: "Settings trigger" -> radios Video / Ingredients / Frames / 16:9 / 720p / x1,
//             "Select model family" menu, the Length slider (index 0 = 3 s), "Generating will use N credits"
//   start frame: pasted into the prompt box, where Flow turns it into an Ingredient chip
//   prompt: the ProseMirror box; "Start generation"; "Clear prompt"
//   results: flow-grid-tile-container tiles, newest first; flow-video-tile / flow-error-tile
//   download: tile "More options" -> Download -> "1080p Upscaled" (never the paid 4K)
(() => {
  if (window.__loFlowAgent) return;
  window.__loFlowAgent = true;
  // Version stamp, checked from outside after a reload so a run never uses stale code (17 Nov 2026: a reload
  // silently failed and 2-15 ran in the wrong mode).
  document.documentElement.dataset.loflowVersion = "2026-11-17j";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const visible = (el) => !!el && el.getBoundingClientRect().width > 0;
  const aria = (el) => el.getAttribute("aria-label") || "";

  async function waitFor(fn, timeout = 10000, step = 200) {
    const t = Date.now();
    while (Date.now() - t < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  const byAria = (name, root = document) =>
    [...root.querySelectorAll("button,[role=button]")].find((e) => visible(e) && aria(e) === name) || null;
  // Flow's buttons start with an icon name ("crop_16_9 16:9"), so match on the end of the text.
  const textIs = (el, name) => { const t = norm(el.innerText); return t === name || t.endsWith(" " + name); };
  const byText = (sel, name, root = document) => [...root.querySelectorAll(sel)].find((e) => visible(e) && textIs(e, name)) || null;
  const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].filter(visible);
  const settingsPanel = () => { const p = document.querySelector("flow-prompt-box-settings"); return visible(p) ? p : null; };
  const promptBox = () => document.querySelector(".ProseMirror");
  const ingredients = () => [...document.querySelectorAll("button")].filter((e) => visible(e) && aria(e) === "Ingredient");

  function pressEscape() {
    const t = document.activeElement || document.body;
    t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
  }
  async function clearBackdrops() {
    for (let i = 0; i < 4; i++) {
      const b = [...document.querySelectorAll(".cdk-overlay-backdrop.cdk-overlay-backdrop-showing")].pop();
      if (!b) return;
      b.click();
      await sleep(400);
    }
  }
  async function dismiss() {
    pressEscape();
    await sleep(300);
    await clearBackdrops();
  }

  function scrollTop() {
    document.querySelectorAll(".page-container").forEach((e) => (e.scrollTop = 0));
  }

  // ---------- settings ----------
  async function openSettings() {
    for (let i = 0; i < 3; i++) {
      if (settingsPanel()) return;
      const t = byAria("Settings trigger");
      if (!t) throw new Error('Flow\'s "Settings trigger" button not found. Is a Flow project open?');
      t.click();
      if (await waitFor(settingsPanel, 3000)) { await sleep(300); return; }
    }
    throw new Error("Flow's generation settings did not open");
  }
  async function closeSettings() {
    for (let i = 0; i < 3 && settingsPanel(); i++) {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      pressEscape();
      await sleep(400);
    }
    if (settingsPanel()) { const t = byAria("Settings trigger"); if (t) t.click(); await sleep(400); }
    await clearBackdrops();
  }
  async function pickRadio(name, optional = false) {
    const r = byText("[role=radio]", name, settingsPanel() || document);
    if (!r) { if (optional) return false; throw new Error(`Flow has no "${name}" option here`); }
    if (r.getAttribute("aria-checked") !== "true") {
      r.click();
      await waitFor(() => r.getAttribute("aria-checked") === "true", 3000);
      await sleep(300);
    }
    if (r.getAttribute("aria-checked") !== "true") throw new Error(`Could not select "${name}" in Flow's settings`);
    return true;
  }
  async function pickModel(name) {
    const btn = byAria("Select model family");
    if (!btn) throw new Error('Flow\'s "Select model family" button not found');
    const shown = norm(btn.innerText);
    const lower = /lower priority/i.test(name);
    if (shown.toLowerCase().includes(name.toLowerCase()) && lower === /lower priority/i.test(shown)) return;
    btn.click();
    const items = await waitFor(() => (menuItems().length ? menuItems() : null), 5000);
    if (!items) throw new Error("Flow's model menu did not open");
    const names = items.map((i) => norm(i.innerText));
    let idx = names.findIndex((n) => n === name);
    if (idx < 0) idx = names.findIndex((n) => n.startsWith(name) && /lower priority/i.test(n) === lower);
    if (idx < 0) { await dismiss(); throw new Error(`Model "${name}" is not offered. Flow offers: ${names.join(" | ")}`); }
    items[idx].click();
    await sleep(700);
    if (!settingsPanel()) await openSettings();
  }
  // The Length slider runs 0..12 for 3..15 s. Set it, then read the label back until it says the wanted length.
  async function setLength(sec) {
    const input = document.querySelector("mat-slider.duration-slider input[type=range]");
    if (!input) return null; // this model has a fixed length (Veo: 8 s)
    const readLen = () => { const m = (settingsPanel() || document).innerText.match(/Length\s+(\d+)\s*Sec/i); return m ? Number(m[1]) : null; };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const put = (v) => { setter.call(input, String(v)); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); };
    const min = Number(input.min || 0), max = Number(input.max || 12);
    let v = Math.min(max, Math.max(min, sec - 3));
    for (let i = 0; i < 4; i++) {
      put(v);
      await sleep(500);
      const got = readLen();
      if (got === sec || got === null) return got;
      v = Math.min(max, Math.max(min, v + (sec - got)));
    }
    const got = readLen();
    if (got < sec) throw new Error(`Flow's Length slider stops at ${got} s; the clip needs ${sec} s`);
    return got;
  }
  function readCost() {
    const m = norm((settingsPanel() || document.body).innerText).match(/Generating will use\s+([\d,]+)\s+credits?/i);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  }

  // ---------- composer ----------
  async function clearComposer() {
    const agent = byAria("Agent");
    if (agent && agent.getAttribute("aria-pressed") === "true") { agent.click(); await sleep(800); }
    const clear = byAria("Clear prompt");
    if (clear) { clear.click(); await sleep(800); }
    if (ingredients().length) throw new Error("Could not clear the previous clip's ingredients from Flow's prompt box");
    const pm = promptBox();
    if (!pm) throw new Error("Flow's prompt box not found. Open a Flow project.");
    if (norm(pm.innerText)) { pm.focus(); document.execCommand("selectAll"); document.execCommand("delete"); await sleep(300); }
  }
  async function pasteIngredient(buf, name) {
    const pm = promptBox();
    const before = ingredients().length;
    pm.focus();
    const dt = new DataTransfer();
    dt.items.add(new File([buf], name, { type: "image/jpeg" }));
    pm.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    if (!(await waitFor(() => ingredients().length > before, 15000)))
      throw new Error("Flow did not take the start frame as an ingredient");
    // The chip is busy while the picture uploads.
    if (!(await waitFor(() => ingredients().every((c) => c.getAttribute("aria-busy") !== "true"), 120000, 500)))
      throw new Error("The start frame upload did not finish in 2 minutes");
    await sleep(500);
  }
  async function typePrompt(text) {
    // Enter submits in Flow and "@" opens the asset picker, so the prompt goes in as one plain line.
    const flat = text.replace(/\s*\n+\s*/g, " ").replace(/@/g, "at ").trim();
    const pm = promptBox();
    pm.focus();
    document.execCommand("selectAll");
    document.execCommand("insertText", false, flat);
    await sleep(600);
    if (norm(pm.innerText) !== norm(flat)) throw new Error("The prompt did not go into Flow's prompt box exactly");
    return flat;
  }

  // ---------- project assets (uploads, generated images) by name ----------
  // Every picker (ingredients "+", Frames-mode Start/End) has a "Search assets" box and lists items as
  // "<name>" or "<name> Image|Video|Character". Searching by name and taking the exact match picks an item
  // already in the project, so nothing is uploaded twice (mapped live 2026-11-16).
  const pickerSearch = () => [...document.querySelectorAll(".cdk-overlay-container input, [role=dialog] input")].find((i) => visible(i) && /search/i.test(i.getAttribute("aria-label") || i.placeholder || ""));
  const optionName = (o) => norm(o.innerText).replace(/^[a-z_]+ /, "").replace(/ (Image|Video|Character|Avatar)$/, "");
  // "M12" and "M12.png" are the same thing: uploads keep their file extension, jobs name them without it.
  const stem = (s) => (s || "").replace(/\.(jpe?g|png|webp)$/i, "");
  const sameName = (a, b) => a === b || stem(a) === stem(b);
  async function pickFromOpenPicker(name, tab) {
    if (tab) {
      const t = [...document.querySelectorAll("[role=tab]")].find((e) => visible(e) && new RegExp(`${tab}\\s*$`).test(norm(e.innerText)));
      if (t && t.getAttribute("aria-selected") !== "true") { t.click(); await sleep(1000); }
    }
    const search = pickerSearch();
    if (search) { search.focus(); search.select(); document.execCommand("insertText", false, name); await sleep(1200); }
    // Flow's search can take several seconds to answer (17 Nov 2026: P4-Red-key.png was missed at 4 s), so wait up to 10 s.
    const option = await waitFor(() => [...document.querySelectorAll("[role=option]")].find((o) => visible(o) && sameName(optionName(o), name)) || null, 10000, 300);
    if (!option) return false;
    option.click();
    const add = await waitFor(() => [...document.querySelectorAll(".cdk-overlay-container button")].find((b) => visible(b) && norm(b.innerText) === "Add to prompt"), 800);
    if (add) add.click();
    await waitFor(() => !document.querySelector("[role=listbox]"), 5000);
    await sleep(400);
    return true;
  }
  // Adds a project item (upload, generated image, character) to the prompt box as an ingredient. False if absent.
  async function attachAssetByName(name, tab) {
    const before = ingredients().length;
    const opener = byAria("Add ingredients to the prompt box");
    if (!opener) throw new Error("Flow's ingredients button not found");
    opener.click();
    if (!(await waitFor(() => [...document.querySelectorAll("[role=tab]")].some(visible), 5000))) { await dismiss(); throw new Error("Flow's media picker did not open"); }
    const ok = await pickFromOpenPicker(name, tab);
    if (!ok) { await dismiss(); return false; }
    if (!(await waitFor(() => ingredients().length > before, 8000))) { await dismiss(); throw new Error(`Flow did not add "${name}" to the prompt box`); }
    await dismiss();
    return true;
  }
  // Frames mode: the Start / End buttons open a picker (Images, Uploads) that attaches on click.
  async function setFrame(which, name) {
    const opener = byAria(which) || byText("button", which);
    if (!opener) throw new Error(`Flow's "${which}" frame button not found (is Frames mode on?)`);
    opener.click();
    if (!(await waitFor(() => [...document.querySelectorAll("[role=tab]")].some(visible), 5000))) { await dismiss(); throw new Error(`Flow's ${which} frame picker did not open`); }
    const ok = await pickFromOpenPicker(name, null);
    if (!ok) { await dismiss(); throw new Error(`"${name}" is not in this Flow project, so it cannot be the ${which} frame`); }
    await dismiss();
  }
  // Uploads a file into the project under its own name. The "Add media -> Upload" menu opens a native file
  // dialog a script cannot feed (checked 2026-11-16), so the picture is pasted into the prompt box instead:
  // Flow uploads it under the file's name and shows it as an ingredient, which is then cleared away.
  // Is a picture with this name already in the project? Asked through the picker's search, which sees the whole
  // library; the grid shows only the ~16 tiles near the view, so looking there missed older uploads and the same
  // frame was uploaded again (17 Nov 2026).
  async function existsInProject(name) {
    const opener = byAria("Add ingredients to the prompt box");
    if (!opener) return false;
    opener.click();
    if (!(await waitFor(() => [...document.querySelectorAll("[role=tab]")].some(visible), 5000))) { await dismiss(); return false; }
    const t = [...document.querySelectorAll("[role=tab]")].find((e) => visible(e) && /Uploads\s*$/.test(norm(e.innerText)));
    if (t && t.getAttribute("aria-selected") !== "true") { t.click(); await sleep(900); }
    const search = pickerSearch();
    if (search) { search.focus(); search.select(); document.execCommand("insertText", false, name); }
    const hit = await waitFor(() => [...document.querySelectorAll("[role=option]")].find((o) => visible(o) && sameName(optionName(o), name)) || null, 8000, 300);
    await dismiss();
    return !!hit;
  }
  async function uploadAsset(name, buf) {
    scrollTop();
    const labelOf = (t) => t.getAttribute("aria-label") || "";
    const inProject = () => [...document.querySelectorAll("flow-grid-tile-container")].find((t) => labelOf(t) === name && t.querySelector("[data-media-id]")) || null;
    if (inProject() || (await existsInProject(name))) return { name, note: "already in this project" };
    await dismiss();
    await clearComposer();
    const pm = promptBox();
    pm.focus();
    const dt = new DataTransfer();
    dt.items.add(new File([buf], name, { type: /\.png$/i.test(name) ? "image/png" : "image/jpeg" }));
    pm.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    if (!(await waitFor(() => ingredients().length > 0, 15000))) throw new Error(`Flow did not take "${name}" from the paste`);
    const ready = await waitFor(() => (ingredients().every((c) => c.getAttribute("aria-busy") !== "true") ? inProject() : null), 180000, 1000);
    if (!ready) throw new Error(`Flow did not finish the upload "${name}" in 3 minutes`);
    const clear = byAria("Clear prompt");
    if (clear) clear.click();
    await sleep(600);
    return { name };
  }

  // ---------- characters ----------
  // A Flow picture is known by the id in its address (…/asb/<id>=s512-rw); the picker row and the chip share it.
  const thumbId = (src) => (src || "").split("/").pop().split("=")[0];
  const characterChips = () => [...document.querySelectorAll("flow-character-ingredient-chip img")].map((i) => thumbId(i.src));
  // The ingredients picker lists the project's characters under its Characters tab; clicking one adds it
  // to the prompt box as an Ingredient chip at once (no "Add to prompt" needed; mapped live 2026-11-16).
  // Tries up to three times from a clean picker: mid-run the list sometimes showed only some names, or none
  // (EP02 2-15, 16 Nov 2026), while a fresh picker listed all four.
  async function attachCharacter(name) {
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await attachCharacterOnce(name, attempt); } catch (e) { if (e.wrong) { await dismiss(); throw e; } last = e; await dismiss(); await sleep(1200); }
    }
    throw last;
  }
  async function attachCharacterOnce(name, attempt) {
    const before = ingredients().length;
    const opener = byAria("Add ingredients to the prompt box");
    if (!opener) throw new Error("Flow's ingredients button not found");
    opener.click();
    const tab = await waitFor(() => [...document.querySelectorAll("[role=tab]")].find((t) => visible(t) && /Characters\s*$/.test(norm(t.innerText))), 5000);
    if (!tab) { await dismiss(); throw new Error("Flow's media picker did not open"); }
    // Attempt 3 looks in the All tab, where characters are listed as "<name> Character".
    const useTab = attempt < 2 ? tab : [...document.querySelectorAll("[role=tab]")].find((t) => visible(t) && /All\s*$/.test(norm(t.innerText))) || tab;
    useTab.click();
    await sleep(1200);
    const search0 = pickerSearch();
    if (search0 && search0.value) { search0.focus(); search0.select(); document.execCommand("delete"); await sleep(900); }
    const options = () => [...document.querySelectorAll("[role=option]")].filter(visible);
    const match = () => options().find((o) => optionName(o) === name) || null;
    let option = await waitFor(match, 4000, 300);
    if (!option) {
      // The list shows only some names (seen 2026-11-16: two of four); the search box finds the rest.
      const search = pickerSearch();
      if (search) { search.focus(); search.select(); document.execCommand("insertText", false, name); }
      option = await waitFor(match, 5000, 300);
    }
    if (!option) {
      const have = options().map((o) => optionName(o));
      const sv = (pickerSearch() || {}).value || "";
      await dismiss();
      throw new Error(`"${name}" is not a character in this Flow project (the picker showed: ${have.join(", ") || "nothing"}${sv ? `, search "${sv}"` : ""}). Create the cast first (Characters section in the popup).`);
    }
    // Flow's list is multi-select and redraws its rows; "Add to prompt" adds whatever Flow has registered, which
    // right after a click can still be the first row (EP02, 16 Nov 2026: every clip got Pryce). So: note the
    // picture of the wanted row, click, wait until Flow shows that row picked, then add and check the chip.
    const want = thumbId((option.querySelector("img") || {}).src);
    option.click();
    const picked = await waitFor(() => { const o = match(); return o && (o.getAttribute("aria-selected") === "true" || o.classList.contains("asset-item-active")) ? o : null; }, 3000, 150);
    if (!picked) { const o = match(); if (o) o.click(); await sleep(800); }
    await sleep(500);
    const add = await waitFor(() => [...document.querySelectorAll(".cdk-overlay-container button")].find((b) => visible(b) && norm(b.innerText) === "Add to prompt"), 1500);
    if (add) add.click();
    if (!(await waitFor(() => ingredients().length > before, 8000))) { await dismiss(); throw new Error(`Flow did not add "${name}" to the prompt box`); }
    await sleep(400);
    const chips = characterChips();
    if (want && !chips.includes(want)) { const e = new Error(`WRONG_CHARACTER: asked for ${name}, Flow attached someone else`); e.wrong = true; throw e; }
    const s2 = pickerSearch(); if (s2 && s2.value) { s2.focus(); s2.select(); document.execCommand("delete"); }
    await dismiss();
    await sleep(400);
  }

  function projectNav(item) {
    const nav = document.querySelector('[aria-label="Project navigation"]');
    const b = nav && [...nav.querySelectorAll("button,a")].find((e) => new RegExp(`${item}\\s*$`).test(norm(e.innerText)));
    if (!b) throw new Error(`Flow's "${item}" menu item not found`);
    b.click();
  }
  const characterTiles = () => [...document.querySelectorAll("flow-grid-tile-container")].map((t) => t.getAttribute("aria-label") || "");

  // Creating a Flow character takes three steps, because the name only saves on a real keyboard Enter, which
  // only the extension's background can send: characterStart (upload the picture, land on the character page,
  // focus the name box) -> background types the name and presses Enter -> characterFinish (voice, personality,
  // Done). Free (no credits). Mapped live 2026-11-16 on /project/<id>/character/<id>.
  async function characterStart(c, buf) {
    if (!/\/project\//.test(location.pathname)) throw new Error("Open a Flow project first.");
    await dismiss();
    projectNav("Characters");
    await sleep(2500);
    if (characterTiles().includes(c.name)) { projectNav("All media"); await sleep(1200); return { name: c.name, exists: true }; }
    const fresh = byText("button", "New character");
    if (fresh) { fresh.click(); await sleep(2500); }
    const upload = [...document.querySelectorAll("button")].find((b) => visible(b) && textIs(b, "Upload"));
    if (!upload) throw new Error("Flow's character page has no Upload button");
    // Flow opens a file dialog through a hidden <input type=file>; hand it the picture instead.
    const file = new File([buf], `${c.name}.jpg`, { type: "image/jpeg" });
    const orig = HTMLInputElement.prototype.click;
    let fed = false;
    HTMLInputElement.prototype.click = function () {
      if (this.type === "file") {
        HTMLInputElement.prototype.click = orig;
        const dt = new DataTransfer(); dt.items.add(file); this.files = dt.files;
        this.dispatchEvent(new Event("change", { bubbles: true }));
        fed = true;
        return;
      }
      return orig.call(this);
    };
    upload.click();
    setTimeout(() => { if (HTMLInputElement.prototype.click !== orig) HTMLInputElement.prototype.click = orig; }, 10000);
    if (!(await waitFor(() => /\/character\/[0-9a-f-]{36}/.test(location.pathname), 120000, 1000)))
      throw new Error(fed ? "Flow did not finish making the character from the picture in 2 minutes" : "Flow never asked for the picture file");
    await sleep(3000);
    // Leave the name box focused and selected for the background's real keystrokes.
    const input = await waitFor(() => document.querySelector('input[aria-label="Character name"]'), 15000);
    if (!input) throw new Error("Character name box not found");
    input.focus(); input.select();
    return { name: c.name, url: location.href, exists: false };
  }

  // A character from a description only: on the New character page, type it into the prompt box and hand
  // back the Start button's place for a genuine click (Flow draws the portrait, ~20 s, 0 credits, and opens the
  // character page itself; mapped 2026-11-16). Then characterAwaitPage focuses the name box as characterStart does.
  async function characterDescribe(c) {
    if (!/\/project\//.test(location.pathname)) throw new Error("Open a Flow project first.");
    await dismiss();
    projectNav("Characters");
    await sleep(2500);
    if (characterTiles().includes(c.name)) { projectNav("All media"); await sleep(1200); return { name: c.name, exists: true }; }
    const fresh = byText("button", "New character");
    if (fresh) { fresh.click(); await sleep(2500); }
    const pm = await waitFor(promptBox, 10000);
    if (!pm) throw new Error("Flow's character description box not found");
    pm.focus();
    document.execCommand("selectAll");
    document.execCommand("insertText", false, c.describe.replace(/\s*\n+\s*/g, " ").trim());
    await sleep(800);
    return { name: c.name, exists: false, box: startButtonBox() };
  }
  async function characterAwaitPage(c) {
    if (!(await waitFor(() => /\/character\/[0-9a-f-]{36}/.test(location.pathname), 180000, 1000)))
      throw new Error("Flow did not open a character page within 3 minutes of drawing the portrait");
    await sleep(3000);
    const input = await waitFor(() => document.querySelector('input[aria-label="Character name"]'), 15000);
    if (!input) throw new Error("Character name box not found");
    input.focus(); input.select();
    return { name: c.name, url: location.href };
  }

  async function characterFinish(c) {
    if (!/\/character\/[0-9a-f-]{36}/.test(location.pathname)) throw new Error("Flow left the character page before it was finished");
    const url = location.href;
    await sleep(800);
    const named = (document.querySelector('input[aria-label="Editable text"]') || {}).value === c.name;

    // Voice (a Flow stock voice, by name).
    let voiceNote = "no voice asked for";
    if (c.voice) {
      const open = byAria("Select a voice") || byText("button", "Select a voice");
      if (!open) throw new Error('"Select a voice" button not found');
      open.click();
      // The voice window's entries are plain buttons (button.asset-item), not list options, and it can take
      // a while to fill (seen 2026-11-16).
      const VOICE_ITEMS = "button.asset-item, [role=option]";
      const dialog = await waitFor(() => { const d = document.querySelector("[role=dialog]"); return d && d.querySelector(VOICE_ITEMS) ? d : null; }, 30000, 500);
      if (!dialog) throw new Error("Flow's voice window did not open");
      // Find the voice through the window's search box (the list is long and virtual; scrolling it is unreliable).
      const findVoice = () => [...dialog.querySelectorAll(VOICE_ITEMS)].find((o) => visible(o) && new RegExp(`(^|\\s)${c.voice}(\\s|$)`, "i").test(norm(o.innerText))) || null;
      let option = findVoice();
      if (!option) {
        const search = dialog.querySelector('input[type=text], input[type=search], input:not([type]), [role=searchbox]');
        if (search) { search.focus(); search.select(); document.execCommand("insertText", false, c.voice); }
        option = await waitFor(findVoice, 6000, 300);
      }
      if (!option) {
        const have = [...dialog.querySelectorAll(VOICE_ITEMS)].map((o) => norm(o.innerText).replace(/^voice_selection /, "").split(" ")[0]);
        await dismiss();
        throw new Error(`Voice "${c.voice}" is not in Flow's list (${have.join(", ")}). Character "${c.name}" was made without a voice.`);
      }
      option.scrollIntoView({ block: "center" });
      option.click();
      await sleep(800);
      const add = await waitFor(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => visible(b) && norm(b.innerText) === "Add to character"), 5000);
      if (add) add.click();
      const ok = await waitFor(() => { const b = [...document.querySelectorAll("button")].find((b) => visible(b) && /voice_selection/.test(b.innerText) && new RegExp(c.voice, "i").test(b.innerText)); return b ? true : null; }, 8000);
      if (!document.querySelector("[role=dialog]") || ok) voiceNote = ok ? `voice ${c.voice}` : "voice not confirmed";
      else { await dismiss(); voiceNote = "voice not confirmed"; }
    }
    if (c.personality) {
      const ta = document.querySelector('textarea[aria-label="Character personality"]');
      if (ta) { ta.focus(); document.execCommand("insertText", false, c.personality); ta.dispatchEvent(new Event("change", { bubbles: true })); ta.blur(); await sleep(500); }
    }
    const done = [...document.querySelectorAll("button")].find((b) => visible(b) && /^Done( editing)?$/.test(norm(b.innerText)));
    if (!done) throw new Error('"Done" button not found on the character page');
    done.click();
    await waitFor(() => !/\/character\//.test(location.pathname), 15000, 500);
    await sleep(1500);
    // Flow drops the new character into the prompt box; leave it empty.
    const clear = byAria("Clear prompt"); if (clear) clear.click();
    projectNav("Characters");
    await sleep(2500);
    const listed = characterTiles().includes(c.name);
    projectNav("All media");
    await sleep(1500);
    return { name: c.name, url, named: named || listed, voice: voiceNote, listed };
  }

  async function fill(job, settings, buf) {
    for (let attempt = 0; ; attempt++) {
      try { return await fillOnce(job, settings, buf); }
      catch (e) { if (!e.wrong || attempt >= 2) throw e; await clearComposer(); await sleep(1500); }
    }
  }
  async function fillOnce(job, settings, buf) {
    if (!/\/project\//.test(location.pathname)) throw new Error("Open a Flow project first (flow.google.com/project/...).");
    scrollTop();
    await dismiss();
    await clearComposer();

    // Frames mode when the clip has an end frame, or when its fix asks for "mode": "frames" (start frame only):
    // Flow then starts from the exact picture instead of treating it as a loose reference, which keeps the set
    // (EP02 2-15 got a new shop in Ingredients mode, 17 Nov 2026). Frames mode allows no other ingredients,
    // so the cast is not attached and the prompt keeps its written voice tags.
    const framesMode = !!job.endFrame || job.mode === "frames";
    // In Frames mode the prompt box does not take a pasted picture (17 Nov 2026), so the frame(s) are uploaded
    // first, in Ingredients mode, and picked by name afterwards.
    if (framesMode) {
      await openSettings();
      await pickRadio("Video");
      await pickRadio("Ingredients");
      await closeSettings();
      await uploadAsset(job.frame.replace("/", "-"), buf);
      if (job.endFrame && job.endBuf) await uploadAsset(job.endFrame.replace("/", "-"), job.endBuf);
      await clearComposer();
    }
    await openSettings();
    await pickRadio("Video");
    await pickRadio(framesMode ? "Frames" : "Ingredients");
    await pickRadio("16:9");
    await pickModel(settings.model);
    await pickRadio("720p", true);
    const length = await setLength(job.seconds);
    await pickRadio("x1");
    await sleep(500);
    const cost = readCost();
    const bar = norm((byAria("Settings trigger") || {}).innerText || "");
    await closeSettings();
    if (cost === null) throw new Error("Could not read Flow's credit price for this clip");
    if (cost > settings.maxCredits) throw new Error(`Flow quotes ${cost} credits for this clip, above your limit of ${settings.maxCredits}. Nothing was generated.`);

    // The start frame. Uploaded once under its own name (EP04-4-02.jpg) and reused from the project after that.
    const frameName = job.frame.replace("/", "-");
    let frameUsed;
    if (framesMode) {
      await setFrame("Start", frameName);
      if (job.endFrame) {
        const endName = job.endFrame.replace("/", "-");
        await setFrame("End", endName);
        frameUsed = `start ${frameName}, end ${endName}`;
      } else frameUsed = `start frame ${frameName} (Frames mode)`;
    } else if (settings.frameSource === "flow" && (await attachAssetByName(job.id, "Images"))) {
      frameUsed = `Flow-made image "${job.id}"`;
    } else if (await attachAssetByName(frameName, "Uploads")) {
      frameUsed = `${frameName} (already in the project)`;
    } else {
      await pasteIngredient(buf, frameName);
      frameUsed = `${frameName} (uploaded now)`;
    }
    let cast = [];
    if (!framesMode) {
      if (ingredients().length !== 1) throw new Error(`Expected 1 ingredient, Flow shows ${ingredients().length}`);
      // Extra references from the clip's fix ("extra": ["P6-Wren-cup.png"]): props uploaded to the project by name,
      // so Flow draws the approved cup, key or bag instead of inventing one.
      const extra = job.extra || [];
      for (const name of extra) if (!(await attachAssetByName(name, "Uploads"))) throw new Error(`"${name}" is not in this Flow project; upload it first (Uploads step)`);
      // The clip's cast as Flow characters, so their voices speak. The prompt then drops the written voice tags.
      cast = settings.useCharacters ? job.cast || [] : [];
      for (const name of cast) await attachCharacter(name);
      const want = 1 + extra.length + cast.length;
      if (ingredients().length !== want) throw new Error(`Expected ${want} ingredients (frame + props + cast), Flow shows ${ingredients().length}`);
    }
    const sent = await typePrompt(cast.length ? job.castPrompt || job.prompt : job.prompt);
    const start = byAria("Start generation");
    if (!start || start.disabled) throw new Error('Flow\'s "Start generation" button is not ready');
    return { bar, cost, length, cast, extra: job.extra || [], frameUsed, characterChips: characterChips().length, sent };
  }

  // ---------- which tile is which ----------
  // Counting tiles from the newest slipped by one place on 16 Nov 2026 (four EP02 files got their neighbours'
  // clips). Before a tile is downloaded or renamed it is checked: "Reuse prompt" puts the prompt that made it into
  // the prompt box, which is compared with the prompt this job sent, then cleared.
  // The start AND the end of a prompt: clips made from one frame share their first words and differ only in the
  // spoken line near the end (17 Nov 2026: three Jonah lines from 4-03 looked alike at 70 characters).
  const promptKey = (t) => norm(t).toLowerCase().replace(/[^a-z0-9]/g, "");   // the whole prompt: clips from one frame differ only in the spoken line, mid-prompt (17 Nov 2026)
  async function promptOf(g) {
    g.el.scrollIntoView({ block: "center" });
    const box = g.el.getBoundingClientRect();
    const at = { bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"].forEach((t) => g.el.dispatchEvent(new MouseEvent(t, at)));
    await sleep(500);
    const btn = [...g.el.querySelectorAll("button")].find((b) => aria(b) === "Reuse prompt");
    if (!btn) return null;
    btn.click();
    await sleep(1500);
    const text = (promptBox() || {}).innerText || "";
    const clear = byAria("Clear prompt"); if (clear) { clear.click(); await sleep(500); }
    return text;
  }
  async function verified(g, sent) {
    if (!g || !sent) return g;
    const want = promptKey(sent);
    const p0 = await promptOf(g);
    if (p0 === null || promptKey(p0) === want) return g;
    // Not this one: try the tiles around it, newest first.
    const pc = document.querySelector(".page-container");
    const list = gens(g.kind || "video");
    const i = list.indexOf(g);
    for (const d of [-1, 1, -2, 2, -3, 3]) {
      const c = list[i + d];
      if (!c || !c.ready) continue;
      const p1 = await promptOf(c);
      if (p1 !== null && promptKey(p1) === want) return c;
    }
    return null;
  }

  // Finds the newest finished tile made from a given prompt anywhere in the grid (Reuse prompt on each, newest
  // first) and downloads it. Used to recover a clip whose download went missing, without guessing by place.
  // Looks only at the newest `maxTiles` finished tiles (default 45): a clip just made is near the top, and walking
  // a 200-tile project for a clip that failed took over ten minutes (17 Nov 2026).
  async function downloadByPrompt(key, sent, quality, kind = "video", maxTiles = 45) {
    const want = promptKey(sent);
    const pc = document.querySelector(".page-container");
    pc.scrollTop = 0; await sleep(500);
    const done = new Set();
    for (let step = 0; step < 80; step++) {
      for (const g of gens(kind)) {
        const r = g.el.getBoundingClientRect();
        const k = `${Math.round(r.top + pc.scrollTop)}:${Math.round(r.left)}`;
        if (done.has(k) || !g.ready) continue;
        if (done.size >= maxTiles) throw new Error(`not among the newest ${maxTiles} finished tiles`);
        done.add(k);
        const p = await promptOf(g);
        if (p !== null && promptKey(p) === want) return await downloadTile(g, quality, kind);
      }
      const top = pc.scrollTop; pc.scrollTop = top + pc.clientHeight * 0.6; await sleep(450);
      if (pc.scrollTop === top) break;
    }
    throw new Error("no finished tile in this project was made from that prompt");
  }

  // ---------- image jobs ----------
  // Image mode (mapped 2026-11-16): radios Image / 16:9 4:3 1:1 3:4 9:16 / Thinking level Low Medium High Extra
  // thorough / x1..x4; models 🍌 Nano Banana Pro, 2 Lite, 2.1; "Generating will use 0 credits".
  async function fillImage(job, settings) {
    if (!/\/project\//.test(location.pathname)) throw new Error("Open a Flow project first (flow.google.com/project/...).");
    scrollTop();
    await dismiss();
    await clearComposer();
    await openSettings();
    await pickRadio("Image");
    await pickRadio(job.aspect || "16:9");
    await pickModel(settings.imageModel || "Nano Banana 2.1");
    await pickRadio(job.thinking || settings.thinking || "High", true);
    await pickRadio("x1");
    await sleep(500);
    const cost = readCost();
    await closeSettings();
    if (cost === null) throw new Error("Could not read Flow's credit price for this image");
    if (cost > (settings.maxImageCredits ?? 0)) throw new Error(`Flow quotes ${cost} credits for this image, above the image limit of ${settings.maxImageCredits ?? 0}. Nothing was generated.`);
    const missing = [];
    for (const name of job.ingredients || []) {
      // Always from the "All" tab: the picker remembers its last tab, so after a character it would search Characters only (17 Nov 2026).
      const ok = (await attachAssetByName(name, "All")) || (await attachAssetByName(name, "Characters"));
      if (!ok) missing.push(name);
    }
    if (missing.length) throw new Error(`Not in this Flow project: ${missing.join(", ")}. Upload the assets / create the characters first.`);
    const sent = await typePrompt(job.prompt);
    const start = byAria("Start generation");
    if (!start || start.disabled) throw new Error('Flow\'s "Start generation" button is not ready');
    return { cost, ingredients: (job.ingredients || []).length, sent };
  }

  // Renames a tile: More options -> Rename puts the focus in an inline box; typed text + Enter saves it.
  async function renameTile(key, pos, kind, newName, sent) {
    scrollTop();
    await dismiss();
    const g0 = await locate(key, pos, kind);
    if (!g0) throw new Error("finished tile not found for renaming");
    const g = await verified(g0, sent);
    if (!g) throw new Error("the finished image at this place was made from another prompt; not renamed");
    g.el.scrollIntoView({ block: "center" });
    const box = g.el.getBoundingClientRect();
    const at = { bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"].forEach((t) => g.el.dispatchEvent(new MouseEvent(t, at)));
    await sleep(600);
    const more = [...g.el.querySelectorAll("button")].find((b) => aria(b) === "More options");
    if (!more) throw new Error("tile menu button not found");
    more.click();
    const rename = await waitFor(() => menuItems().find((i) => textIs(i, "Rename")), 5000);
    if (!rename) { await dismiss(); throw new Error("Flow's tile menu has no Rename item"); }
    // The inline rename box is a second "Editable text" input (the first is the project title) and takes the focus.
    const titleBox = document.querySelector('input[aria-label="Editable text"]');
    rename.click();
    const input = await waitFor(() => { const a = document.activeElement; return a && a.tagName === "INPUT" && a !== titleBox && !/search/i.test(a.getAttribute("aria-label") || a.placeholder || "") ? a : null; }, 5000);
    if (!input) {
      const a = document.activeElement;
      await dismiss();
      throw new Error(`Flow's rename box did not open (focus was on ${a ? a.tagName + "/" + (a.getAttribute("aria-label") || "") + "=" + String(a.value || "").slice(0, 20) : "nothing"})`);
    }
    input.select();
    document.execCommand("insertText", false, newName);
    for (const type of ["keydown", "keypress", "keyup"]) input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    const ok = await waitFor(() => (g.el.getAttribute("aria-label") || "") === newName, 5000, 300);
    if (!ok) { await dismiss(); return false; }
    g.el.dataset.loKey = key;
    await sleep(400);
    return true;
  }

  // Flow's wording for a refusal on policy grounds; retrying the same prompt never helps those.
  const POLICY = /polic|violat|prominent|safety|not allowed|guideline|harm|sensitive/i;

  // Presses Flow's own Retry on a failed tile (free; re-renders the same prompt). The fresh render appears as the
  // newest tile of its kind, so that one is tagged with the job.
  async function retryTile(key, pos, kind) {
    scrollTop();
    await dismiss();
    const g = await locate(key, pos, kind);
    if (!g || !g.error) throw new Error("failed tile not found for retrying");
    g.el.scrollIntoView({ block: "center" });
    const box = g.el.getBoundingClientRect();
    const at = { bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"].forEach((t) => g.el.dispatchEvent(new MouseEvent(t, at)));
    await sleep(600);
    const retry = [...g.el.querySelectorAll("button")].find((b) => visible(b) && (aria(b) === "Retry" || norm(b.innerText) === "Retry"));
    if (!retry) return false;
    retry.click();
    await sleep(1800);
    scrollTop();
    const top = gens(kind)[0];
    if (top && !top.error) top.el.dataset.loKey = key;
    return true;
  }

  // ---------- results ----------
  // Generated tiles of one kind ("video" or "image"), newest first. Uploads are image tiles too; they are told
  // apart by their file-name labels and left out, so an upload made for the next clip never shifts the count.
  const uploadLike = (label) => /\.(jpe?g|png|webp)$/i.test(label);
  // A generating image tile carries flow-pending-tile and "NN%", titled with the prompt; finished, it has a
  // data-media-id and one of Flow's own short titles (watched 2026-11-16: 10% at 4 s, done at 24 s).
  function gens(kind = "video") {
    const own = kind === "image" ? "flow-image-tile" : "flow-video-tile";
    return [...document.querySelectorAll("flow-grid-tile-container")]
      .filter((t) => t.querySelector(`${own}, flow-error-tile`))
      .map((t) => ({
        el: t,
        kind,
        label: t.getAttribute("aria-label") || "",
        error: !!t.querySelector("flow-error-tile, .error-message-text"),
        progress: (t.innerText.match(/\d+%/) || [])[0] || "",
        ready: kind === "image"
          ? !!t.querySelector("flow-image-tile [data-media-id]") && !/\d+%/.test(t.innerText)
          : !!t.querySelector('flow-video-tile img[alt="Generated video thumbnail"], flow-video-tile video'),
      }))
      .filter((g) => !(kind === "image" && uploadLike(g.label)));
  }
  // A job's tile: the one tagged with its key, else the one carrying its given name, else its place counted
  // from the newest of its kind. Only rendered tiles are seen here; locate() scrolls for the rest.
  function tileFor(key, pos, kind = "video", name) {
    const list = gens(kind);
    return (name && list.find((g) => g.label === name)) || list[pos] || null;   // tile tags are not trusted: Flow reuses tile elements
  }
  // Flow's grid is virtual: it renders only the tiles near the view (about 16). This walks down the grid, keeping
  // every tile's absolute place (its top + scroll), until it reaches the wanted one, and leaves it in view.
  async function locate(key, pos, kind = "video", name) {
    const pc = document.querySelector(".page-container");
    if (!pc) return tileFor(key, pos, kind, name);
    pc.scrollTop = 0; await sleep(500);
    const seen = new Map();
    for (let step = 0; step < 80; step++) {
      for (const g of gens(kind)) {
        if (name && g.label === name) { g.el.scrollIntoView({ block: "center" }); await sleep(300); return g; }
        const r = g.el.getBoundingClientRect();
        const k = `${Math.round(r.top + pc.scrollTop)}:${Math.round(r.left)}`;
        if (!seen.has(k)) seen.set(k, g.label);
      }
      const ordered = [...seen.keys()].sort((a, b) => { const [ay, ax] = a.split(":").map(Number), [by, bx] = b.split(":").map(Number); return ay - by || ax - bx; });
      if (!name && pos < ordered.length) {
        const [y, x] = ordered[pos].split(":").map(Number);
        const g = gens(kind).find((t) => { const r = t.el.getBoundingClientRect(); return Math.round(r.top + pc.scrollTop) === y && Math.round(r.left) === x; });
        if (g) { g.el.scrollIntoView({ block: "center" }); await sleep(300); return g; }
      }
      const top = pc.scrollTop; pc.scrollTop = top + pc.clientHeight * 0.6; await sleep(450);
      if (pc.scrollTop === top) break;
    }
    return null;
  }

  function snapshot(kind = "video") {
    scrollTop();
    const list = gens(kind);
    return { n: list.length, first: list[0] ? list[0].label : "", labels: list.slice(0, 40).map((g) => g.label) };
  }

  // Where the Start button is, for a genuine click from the background.
  function startButtonBox() {
    const b = byAria("Start generation");
    if (!b || b.disabled) throw new Error('"Start generation" is disabled');
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  async function generate() {
    const b = byAria("Start generation");
    if (!b || b.disabled) throw new Error('"Start generation" is disabled');
    b.click();
    await sleep(2000);
    return true;
  }

  // Flow first titles a new tile with the prompt itself, then with a short title of its own.
  async function confirmStarted(key, prompt, snap, kind = "video") {
    const want = norm(prompt.replace(/\s*\n+\s*/g, " ")).slice(0, 40).toLowerCase();
    const known = new Set(snap.labels || []);
    const ok = await waitFor(() => {
      scrollTop();
      const list = gens(kind);
      const top = list[0];
      if (!top) return null;
      // New: a label the snapshot did not have (Flow first titles a tile with the prompt), or simply one more tile.
      const isNew = (!known.has(top.label) && (top.label.toLowerCase().startsWith(want) || !!top.progress)) || list.length > snap.n
        || (top.label !== snap.first && top.label.toLowerCase().startsWith(want));
      return isNew ? top : null;
    }, 45000, 1000);
    if (ok) ok.el.dataset.loKey = key;
    return !!ok;
  }

  async function pollMany(items) {
    const out = [];
    for (const it of items) { const g = await locate(it.key, it.pos, it.kind, it.name); out.push(judge(it, g)); }
    scrollTop();
    return out;
  }
  function judge(it, g) {
    {
      if (!g) return { key: it.key, status: "pending", note: "tile not in view" };
      g.el.dataset.loKey = it.key;
      if (g.error) {
        const msg = g.el.querySelector(".error-message-text");
        const reason = norm(msg ? msg.innerText : g.el.innerText).replace(/^(error|warning|info)\s+/i, "").slice(0, 200) || "Flow could not make it";
        return { key: it.key, status: "failed", reason, policy: POLICY.test(reason) };
      }
      if (g.progress || !g.ready) return { key: it.key, status: "pending", progress: g.progress };
      return { key: it.key, status: "done", title: g.label };
    }
  }

  // Opens the tile's menu and asks Flow for the download. Flow makes the upscale and downloads it itself.
  async function download(key, pos, quality, kind = "video", name, sent) {
    scrollTop();
    await dismiss();
    const g0 = await locate(key, pos, kind, name);
    if (!g0 || !g0.ready) throw new Error("finished tile not found in Flow's grid");
    const g = name ? g0 : await verified(g0, sent);
    if (!g) throw new Error("the finished tile at this clip's place was made from another prompt, and none nearby matches; nothing was downloaded");
    return downloadTile(g, quality, kind);
  }
  // Opens one tile's menu and asks for the download. The tile must already be the right one: Flow's grid reuses its
  // tile elements as it scrolls, so a tile is never found again by a mark left on its element (17 Nov 2026: that sent
  // ten different EP03 clips to the same file).
  async function downloadTile(g, quality, kind = "video") {
    g.el.scrollIntoView({ block: "center" });
    const box = g.el.getBoundingClientRect();
    const at = { bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"].forEach((t) => g.el.dispatchEvent(new MouseEvent(t, at)));
    await sleep(600);
    const more = [...g.el.querySelectorAll("button")].find((b) => aria(b) === "More options");
    if (more) more.click();
    else g.el.dispatchEvent(new MouseEvent("contextmenu", { ...at, button: 2 }));
    const dl = await waitFor(() => menuItems().find((i) => textIs(i, "Download")), 6000);
    if (!dl) { await dismiss(); throw new Error("Flow's tile menu has no Download item"); }
    dl.click();
    const sizes = await waitFor(() => { const s = menuItems().filter((i) => /original size|upscaled/i.test(i.innerText)); return s.length ? s : null; }, kind === "image" ? 2500 : 6000);
    if (!sizes) {
      // Images download straight away with no size menu (seen 2026-11-16).
      if (kind === "image") { await sleep(600); await clearBackdrops(); return "image"; }
      await dismiss(); throw new Error("Flow's download sizes did not appear");
    }
    const usable = (i) => i.getAttribute("aria-disabled") !== "true" && !i.disabled;
    const up1080 = sizes.find((i) => /1080p/i.test(i.innerText) && /upscaled/i.test(i.innerText) && !/credit/i.test(i.innerText) && usable(i));
    const original = sizes.find((i) => /original size/i.test(i.innerText) && usable(i));
    const pick = quality === "1080p" && up1080 ? up1080 : original;
    if (!pick) { await dismiss(); throw new Error("No free download size is available for this clip"); }
    pick.click();
    await sleep(800);
    await clearBackdrops();
    return pick === up1080 ? "1080p upscaled" : "720p original";
  }

  const ops = {
    ping: async () => "pong",
    fill: (a) => fill(a.job, a.settings, a.buf),
    fillImage: (a) => fillImage(a.job, a.settings),
    uploadAsset: (a) => uploadAsset(a.name, a.buf),
    renameTile: (a) => renameTile(a.key, a.pos, a.kind, a.name, a.sent),
    snapshot: async (a) => snapshot(a && a.kind),
    startButtonBox: async () => startButtonBox(),
    generate: () => generate(),
    confirmStarted: (a) => confirmStarted(a.key, a.prompt, a.snap, a.kind),
    pollMany: async (a) => pollMany(a.items),
    download: (a) => download(a.key, a.pos, a.quality, a.kind, a.name, a.sent),
    downloadByPrompt: (a) => downloadByPrompt(a.key, a.sent, a.quality, a.kind),
    retryTile: (a) => retryTile(a.key, a.pos, a.kind),
    characterStart: (a) => characterStart(a.character, a.buf),
    characterDescribe: (a) => characterDescribe(a.character),
    characterAwaitPage: (a) => characterAwaitPage(a.character),
    // Flow re-renders the name box for a moment after the character is made and drops the focus, so the
    // bridge focuses it again right before each typing attempt and checks the title afterwards.
    focusName: async () => { const i = document.querySelector('input[aria-label="Character name"]'); if (!i) throw new Error("Character name box not found"); i.focus(); i.select(); return true; },
    checkName: async (a) => { await sleep(1200); return (document.querySelector('input[aria-label="Editable text"]') || {}).value === a.name; },
    characterFinish: (a) => characterFinish(a.character),
    listCharacters: async () => { await dismiss(); projectNav("Characters"); await sleep(2500); const names = characterTiles(); projectNav("All media"); await sleep(1200); return names; },
  };

  window.addEventListener("message", async (e) => {
    if (e.source !== window || !e.data || e.data.__loflow !== "cmd") return;
    const { id, op, args } = e.data;
    try {
      const r = await ops[op](args || {});
      window.postMessage({ __loflow: "res", id, ok: true, r }, "*");
    } catch (err) {
      window.postMessage({ __loflow: "res", id, ok: false, error: String((err && err.message) || err) }, "*");
    }
  });
})();
