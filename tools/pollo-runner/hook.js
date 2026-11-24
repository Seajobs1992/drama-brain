// Runs inside the Pollo page itself (MAIN world), before Pollo's own code.
// It only listens: when Pollo's page sends a job (recipe.submit), it passes Pollo's answer (the task's record id)
// to the runner with window.postMessage. It changes nothing and sends nothing of its own.
// Why: when the page is already on its "create" view, Pollo does not change the address after Generate,
// so the runner could not see the new task id (24 Nov 2026, Reference to Video test).
(() => {
  if (window.__polloRunnerHook) return;
  window.__polloRunnerHook = true;
  const orig = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const p = orig.apply(this, arguments);
    if (/\/api\/trpc\/[^?]*recipe\.submit/.test(url)) {
      p.then((res) => res.clone().json())
        .then((j) => {
          const list = Array.isArray(j) ? j : [j];
          for (const item of list) {
            const d = item && item.result && item.result.data && item.result.data.json;
            if (d && d.id) window.postMessage({ __polloRunner: "submitted", id: d.id, status: d.status || "", requestLimit: !!d.requestLimit, at: Date.now() }, location.origin);
          }
          for (const item of list) {
            const e = item && item.error && item.error.json;
            if (e) window.postMessage({ __polloRunner: "submitError", message: String(e.message || "error").slice(0, 300), at: Date.now() }, location.origin);
          }
        })
        .catch(() => {});
    }
    return p;
  };

  // Reference to Video: put each picture's @ chip where the prompt says "Image N" (or "@N").
  // Pollo's own @ list opens only while the page has focus (not while the runner's popup has it), so the chips
  // are placed through Pollo's editor instead: the chips Pollo put at the start when the pictures were chosen
  // (in the order chosen) are copied to their places. Same result as typing @ by hand (checked 24 Nov 2026:
  // Pollo recorded "[@a.png] [@b.png] is the kitchen counter ... from [@b.png] ...").
  const vis = (el) => !!el && el.getBoundingClientRect().width > 0;
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__polloRunner !== "placeMentions") return;
    const reply = (x) => window.postMessage({ __polloRunner: "placed", reqId: e.data.reqId, ...x }, location.origin);
    try {
      const g = [...document.querySelectorAll('[data-testid="prompt-generate-btn"]')].find(vis);
      let c = g;
      while (c && !(c.querySelector('[data-testid="chat-child-category-select"]') && c.querySelector('[data-testid="chat-prompt-wrapper"]'))) c = c.parentElement;
      const ed = c && c.querySelector(".tiptap.ProseMirror");
      const editor = ed && ed.editor;
      if (!editor) return reply({ ok: false, error: "Pollo's editor not found" });
      const chips = [];
      (function walk(n) { if (n.type === "mediaChip") chips.push(n.attrs); (n.content || []).forEach(walk); })(editor.getJSON());
      const want = e.data.count;
      if (chips.length !== want) return reply({ ok: false, error: `Pollo shows ${chips.length} picture chip(s) after choosing ${want} picture(s)` });
      const parts = String(e.data.prompt).replace(/\s+/g, " ").trim().split(/(@\d+|\bImage \d+\b)/);
      const num = (p) => { const m = p.match(/^(?:@|Image )(\d+)$/); return m ? Number(m[1]) : 0; };
      const named = new Set(parts.map(num).filter(Boolean));
      for (const n of named) if (n > chips.length) return reply({ ok: false, error: `The prompt names Image ${n} but the job has ${chips.length} picture(s)` });
      const content = [];
      for (let i = 1; i <= chips.length; i++) if (!named.has(i)) { content.push({ type: "mediaChip", attrs: chips[i - 1] }); content.push({ type: "text", text: " " }); }
      for (const p of parts) {
        const n = num(p);
        if (n) content.push({ type: "mediaChip", attrs: chips[n - 1] });
        else if (p) content.push({ type: "text", text: p.replace(/@/g, " at ") });
      }
      editor.commands.setContent({ type: "doc", content: [{ type: "paragraph", content }] }, true);
      let placed = 0;
      (function walk(n) { if (n.type === "mediaChip") placed++; (n.content || []).forEach(walk); })(editor.getJSON());
      reply({ ok: true, chips: placed, expected: content.filter((x) => x.type === "mediaChip").length, text: editor.getText() });
    } catch (err) {
      reply({ ok: false, error: String(err && err.message || err) });
    }
  });
})();
