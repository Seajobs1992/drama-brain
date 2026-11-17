#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""Drama Brain: one shared rule book that Claude and Codex must pass through.

No dependencies; runs on Python 3.8+. Everything is relative to this folder, so the
folder can be copied to another computer and set up with:  python3 brain.py install

  start "<task>" [card ...]   core rules + the card(s) for the task (what an agent runs first)
  card <name> [...]           one or more cards ("project" = this movie's facts)
  cards | docs | projects     what exists
  section <doc> "<heading>"   one section of a document, not the whole file
  find "<words>"              search every registered document, card and lesson
  template character-sheet    the user's fixed prompts, word for word
  lesson "<text>" --card <n>  record a correction so it is not repeated
  new-project <dir> "<Name>"  register a new movie      add-project <dir>   register an existing one
  install | doctor | budget | sync
  hook                        the gate, called by Claude Code and Codex hooks (JSON on stdin)
"""
import sys, os, json, re, time, shlex, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(HERE, "cards")
LOCAL = os.path.join(HERE, "local")            # this computer only: registered movie folders, session state
STATE = os.path.join(LOCAL, "state")
PROJECTS_FILE = os.path.join(LOCAL, "projects.json")
PROJECT_FILE_NAME = "BRAIN-PROJECT.md"
MARK = "<!-- drama-brain -->"
PY = "/usr/bin/python3" if os.path.exists("/usr/bin/python3") else (sys.executable or "python3")
RUN = '%s "%s"' % (PY, os.path.join(HERE, "brain.py"))
SUBCOMMANDS = ("start", "card", "cards", "docs", "projects", "section", "find", "template", "lesson",
               "budget", "doctor", "help", "sync", "new-project", "add-project", "install")


def read(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def write(p, text):
    d = os.path.dirname(p)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    tmp = p + ".tmp%d" % os.getpid()
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, p)


def load_json(p, default):
    try:
        return json.loads(read(p))
    except Exception:
        return default


GATES = load_json(os.path.join(HERE, "gates.json"), {})
GENERAL_DOCS = load_json(os.path.join(HERE, "docs.json"), {})


# ---------------------------------------------------------------- cards
def front_matter(text):
    m = re.match(r"---\n(.*?)\n---\n?(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else ("", text)


def parse_card(path):
    head, body = front_matter(read(path))
    meta = {}
    for line in head.splitlines():
        if ":" in line and not line.startswith(" "):
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    name = meta.get("name") or os.path.splitext(os.path.basename(path))[0]
    split = lambda s: [x.strip() for x in s.split(",") if x.strip()]
    try:
        order = int(meta.get("order", "50"))
    except ValueError:
        order = 50
    return {"name": name, "title": meta.get("title", name), "keywords": [k.lower() for k in split(meta.get("keywords", ""))],
            "with": split(meta.get("with", "")), "order": order, "body": body.strip(), "path": path}


def all_cards():
    out = {}
    if os.path.isdir(CARDS):
        for f in sorted(os.listdir(CARDS)):
            if f.endswith(".md"):
                c = parse_card(os.path.join(CARDS, f))
                out[c["name"]] = c
    return out


def norm(s):
    return " " + re.sub(r"[^a-z0-9]+", " ", s.lower()).strip() + " "


def pick_cards(task, cards=None):
    """The (at most two) cards whose keywords the task mentions, best first. A keyword matches the start of a word."""
    cards = cards or all_cards()
    t = norm(task)
    scored = []
    for c in cards.values():
        n = sum(1 for k in c["keywords"] if norm(k).rstrip() in t)
        if n:
            scored.append((-n, c["order"], c["name"]))
    scored.sort()
    return [name for _, _, name in scored[: int(GATES.get("max_cards_per_task", 2))]]


def expand(names, cards, project):
    """Adds each card's `with` companions. "project" is this movie's own card and is dropped when no movie is active."""
    out = []
    for n in names:
        for x in [n] + (cards[n]["with"] if n in cards else []):
            if x == "project" and not project:
                continue
            if (x in cards or x == "project") and x not in out:
                out.append(x)
    return out


# ---------------------------------------------------------------- movies (projects)
def roots():
    return [r for r in load_json(PROJECTS_FILE, []) if isinstance(r, str)]


def load_project(root):
    p = os.path.join(root, PROJECT_FILE_NAME)
    if not os.path.isfile(p):
        return None
    head, body = front_matter(read(p))
    name, docs, in_docs = os.path.basename(root), {}, False
    for line in head.splitlines():
        if line.startswith("name:"):
            name = line.split(":", 1)[1].strip()
        elif line.startswith("docs:"):
            in_docs = True
        elif in_docs and line.startswith(" ") and ":" in line:
            k, v = line.strip().split(":", 1)
            path, _, about = v.partition("|")
            docs[k.strip()] = {"path": os.path.join(root, path.strip()), "about": about.strip(), "scope": name}
        elif line.strip():
            in_docs = False
    return {"root": root, "name": name, "docs": docs, "body": body.strip(), "file": p}


def project_for(path):
    if not path:
        return None
    rp = os.path.realpath(path)
    best = None
    for r in roots():
        rr = os.path.realpath(r)
        if (rp == rr or rp.startswith(rr + os.sep)) and (best is None or len(rr) > len(best)):
            best = r
    return load_project(best) if best else None


def active_project():
    """The movie this command is for: the folder it runs in, else the session's folder the gate just saw."""
    for p in (os.getcwd(), os.environ.get("CLAUDE_PROJECT_DIR"), os.environ.get("BRAIN_PROJECT")):
        proj = project_for(p)
        if proj:
            return proj
    cur = load_json(os.path.join(STATE, "current.json"), {})
    if cur.get("root") and time.time() - cur.get("time", 0) < 180:
        return load_project(cur["root"])
    return None


def docs_for(project):
    out = {}
    for k, v in GENERAL_DOCS.items():
        out[k] = {"path": os.path.join(HERE, v["path"]), "about": v.get("about", ""), "scope": "general", "source": v.get("source")}
    if project:
        out.update(project["docs"])
    return out


# ---------------------------------------------------------------- what an agent reads
def card_text(name, cards, project):
    if name == "project":
        if not project:
            return "== This movie ==\nNo registered movie folder here. Register one: %s new-project \"<folder>\" \"<Name>\"" % RUN
        names = ", ".join(sorted(project["docs"])) or "none listed"
        return "== This movie: %s ==\n%s\n\nThis movie's documents (use with `section` and `find`): %s" % (project["name"], project["body"], names)
    c = cards[name]
    return "== Card %s: %s ==\n%s" % (c["name"], c["title"], c["body"])


def cmd_start(args):
    cards = all_cards()
    project = active_project()
    task = args[0] if args else ""
    named = [a for a in args[1:] if a in cards or a == "project"]
    picked = expand(pick_cards(task, cards) + named, cards, project) or expand(["general"], cards, project)
    out = ["DRAMA BRAIN. Task: %s%s" % (task or "(none given)", "  |  Movie: " + project["name"] if project else ""), "",
           read(os.path.join(HERE, "CORE.md")).strip(), ""]
    for n in picked:
        out += [card_text(n, cards, project), ""]
    others = [n for n in sorted(cards, key=lambda n: cards[n]["order"]) if n not in picked and n != "general"]
    out.append("Loaded: %s. Other cards: %s." % (", ".join(picked), ", ".join(others)))
    out.append("When the task changes: %s card <name>   |   look up: find \"<words>\", section <doc> \"<heading>\", docs" % RUN)
    print("\n".join(out))


def cmd_card(args):
    cards = all_cards()
    project = active_project()
    names = [a for a in args if a in cards or a == "project"]
    unknown = [a for a in args if a not in names]
    if unknown or not names:
        print("Unknown card: %s. Cards: %s, project" % (", ".join(unknown) or "(none named)", ", ".join(sorted(cards))))
        if not names:
            return 1
    for n in names:
        print(card_text(n, cards, project) + "\n")


def cmd_cards(_):
    cards = all_cards()
    for n in sorted(cards, key=lambda n: cards[n]["order"]):
        print("%-11s %s" % (n, cards[n]["title"]))
    print("%-11s %s" % ("project", "this movie's own facts (from its %s)" % PROJECT_FILE_NAME))


def cmd_docs(_):
    project = active_project()
    docs = docs_for(project)
    for k in sorted(docs, key=lambda k: (docs[k]["scope"] != "general", k)):
        d = docs[k]
        print("%-18s [%s]%s %s" % (k, d["scope"], "" if os.path.exists(d["path"]) else " MISSING", d["about"]))
    if not project:
        print("(no movie active here, so only the general documents are listed)")


def cmd_projects(_):
    rs = roots()
    if not rs:
        print("No movies registered. %s new-project \"<folder>\" \"<Name>\"" % RUN)
    for r in rs:
        p = load_project(r)
        print("%-22s %s%s" % (p["name"] if p else "?", r, "" if p else "   (not reachable now, or its %s is missing)" % PROJECT_FILE_NAME))


def headings(lines):
    return [(i, len(m.group(1)), m.group(2).strip()) for i, l in enumerate(lines) for m in [re.match(r"(#{1,6})\s+(.*)", l)] if m]


def cmd_section(args):
    if len(args) < 2:
        print('Usage: section <doc> "<heading words>"   (documents: docs)')
        return 1
    docs = docs_for(active_project())
    if args[0] not in docs:
        print("Unknown document: %s. Known: %s" % (args[0], ", ".join(sorted(docs))))
        return 1
    path = docs[args[0]]["path"]
    if not os.path.exists(path):
        print("%s is not reachable now: %s" % (args[0], path))
        return 1
    lines = read(path).splitlines()
    hs = headings(lines)
    words = [w for w in norm(" ".join(args[1:])).split()]
    hits = [h for h in hs if all(w in norm(h[2]) for w in words)]
    if not hits:
        print('No heading in %s matches "%s". Headings:' % (args[0], " ".join(args[1:])))
        for _, lvl, title in hs[:80]:
            print("  " * (lvl - 1) + title)
        return 1
    i, lvl, title = hits[0]
    end = next((j for j, l2, _ in hs if j > i and l2 <= lvl), len(lines))
    text = "\n".join(lines[i:end]).strip()
    limit = int(GATES.get("section_char_limit", 8000))
    if len(text) > limit:
        subs = [t for j, l2, t in hs if i < j < end]
        text = text[:limit] + "\n[cut at %d characters; narrow it with a sub-heading: %s]" % (limit, "; ".join(subs[:20]))
    print("[%s > %s]\n%s" % (args[0], title, text))
    if len(hits) > 1:
        print("\n(other matching headings: %s)" % "; ".join(t for _, _, t in hits[1:8]))


def cmd_find(args):
    q = " ".join(args).strip()
    if not q:
        print('Usage: find "<words>"')
        return 1
    words = norm(q).split()
    project = active_project()
    sources = [("core", os.path.join(HERE, "CORE.md")), ("lessons", os.path.join(HERE, "lessons.md"))]
    sources += [("card " + n, c["path"]) for n, c in all_cards().items()]
    if project:
        sources.append(("project", project["file"]))
    sources += [(k, d["path"]) for k, d in docs_for(project).items()]

    def search(need_all):
        hits = []
        for name, path in sources:
            if not os.path.isfile(path):
                continue
            head, per = "", 0
            for line in read(path).splitlines():
                m = re.match(r"#{1,6}\s+(.*)", line)
                if m:
                    head = m.group(1).strip()
                n = norm(line)
                ok = all(w in n for w in words) if need_all else any(w in n for w in words if len(w) > 4)
                if ok and line.strip():
                    hits.append("%s > %s: %s" % (name, head or "(top)", line.strip()[:240]))
                    per += 1
                    if per >= 4:
                        break
        return hits

    hits = search(True) or search(False)
    if not hits:
        print('Nothing found for "%s" in %d documents. That is a real gap: tell the user, then add the rule (lesson).' % (q, len(sources)))
        return 0
    for h in hits[:20]:
        print(h)
    if len(hits) > 20:
        print("(%d more; narrow the words)" % (len(hits) - 20))
    print('\nRead a whole section: %s section <doc> "<heading>"' % RUN)


def cmd_template(args):
    d = os.path.join(HERE, "templates")
    names = sorted(os.path.splitext(f)[0] for f in os.listdir(d)) if os.path.isdir(d) else []
    if not args or args[0] not in names:
        print("Templates: %s" % ", ".join(names))
        return 1
    print(read(os.path.join(d, args[0] + ".txt")).rstrip())


def cmd_lesson(args):
    card = None
    if "--card" in args:
        i = args.index("--card")
        card = args[i + 1] if i + 1 < len(args) else None
        args = args[:i] + args[i + 2:]
    text = " ".join(args).strip()
    if not text:
        print('Usage: lesson "<what went wrong, and the rule>" --card <name>')
        return 1
    project = active_project()
    day = time.strftime("%Y-%m-%d")
    p = os.path.join(HERE, "lessons.md")
    old = read(p) if os.path.exists(p) else "# Lessons\n\nEvery correction the user had to make, newest last. Cards are updated from these.\n"
    write(p, old.rstrip() + "\n- %s [%s] (%s) %s\n" % (day, project["name"] if project else "general", card or "no card", text))
    cards = all_cards()
    if card in cards:
        raw = read(cards[card]["path"]).rstrip()
        if "## Learned the hard way" not in raw:
            raw += "\n\n## Learned the hard way"
        write(cards[card]["path"], raw + "\n- %s: %s\n" % (day, text))
        print("Recorded in lessons.md and on card %s. Keep the card short: %s budget" % (card, RUN))
    else:
        print("Recorded in lessons.md (no card named; add --card <name> so it is read at the right moment).")


def tokens(text):
    return int(len(text) / 4.0 + 0.5)


def cmd_budget(_):
    cards = all_cards()
    core = tokens(read(os.path.join(HERE, "CORE.md")))
    limit = int(GATES.get("card_token_limit", 600))
    print("core rules   about %4d tokens" % core)
    for n in sorted(cards, key=lambda n: cards[n]["order"]):
        t = tokens(cards[n]["body"])
        print("card %-9s about %4d tokens%s" % (n, t, "   TOO LONG: move detail into a document and point to its section" if t > limit else ""))
    for r in roots():
        p = load_project(r)
        if p:
            print("movie %-14s about %4d tokens" % (p["name"][:14], tokens(p["body"])))
    total = sum(os.path.getsize(d["path"]) for d in docs_for(None).values() if os.path.exists(d["path"]))
    print("A typical task loads core + two cards + the movie card: about 1,000 to 1,600 tokens.")
    print("The general documents behind them total about %d tokens, read only one section at a time." % (total // 4))


# ---------------------------------------------------------------- set-up on a computer
HOOK_CMD = '%s hook 2>/dev/null || true' % RUN
POINTER = MARK + """
## Drama Brain (required)

This folder is a movie project under the Drama Brain. Before any work here, run:

    %s start "<your task in a few words>"

It prints the core rules and the card for the task. Follow them. When the task changes, load the new card
(`card <name>`). Look things up with `find "<words>"` and `section <doc> "<heading>"` instead of opening whole
documents. This movie's own facts are in `BRAIN-PROJECT.md`. Tools are blocked by a hook until the brain is read.
""" + MARK


def set_hooks(path, kind):
    cfg = load_json(path, None)
    if cfg is None:
        if os.path.exists(path) and read(path).strip():
            return "%s: could not parse %s, left untouched" % (kind, path)
        cfg = {}
    hooks = cfg.setdefault("hooks", {})
    changed = False
    wanted = {"SessionStart": None, "UserPromptSubmit": None, "PreToolUse": "*"}
    for event, matcher in wanted.items():
        groups = hooks.setdefault(event, [])
        mine = [g for g in groups if any("brain.py" in h.get("command", "") and " hook" in h.get("command", "") for h in g.get("hooks", []))]
        entry = {"hooks": [{"type": "command", "command": HOOK_CMD, "timeout": 15}]}
        if matcher and kind == "claude":
            entry["matcher"] = matcher
        if mine:
            if mine[0] != entry:
                groups[groups.index(mine[0])] = entry
                changed = True
        else:
            groups.append(entry)
            changed = True
    if changed:
        if os.path.exists(path):
            shutil.copy2(path, path + ".before-drama-brain")
        write(path, json.dumps(cfg, indent=2) + "\n")
    return "%s: hooks %s in %s" % (kind, "written" if changed else "already set", path)


def set_pointer(root):
    done = []
    block = POINTER % RUN
    for fname in ("AGENTS.md", "CLAUDE.md"):
        p = os.path.join(root, fname)
        old = read(p) if os.path.exists(p) else ""
        if MARK in old:
            new = re.sub(re.escape(MARK) + r".*?" + re.escape(MARK), lambda _: block, old, flags=re.S)
        else:
            new = (old.rstrip() + "\n\n" if old.strip() else "") + block + "\n"
        if new != old:
            write(p, new)
            done.append(fname)
    return done


def cmd_install(_):
    home = os.path.expanduser("~")
    if not os.path.isdir(STATE):
        os.makedirs(STATE)
    print(set_hooks(os.path.join(home, ".claude", "settings.json"), "claude"))
    if os.path.isdir(os.path.join(home, ".codex")):
        print(set_hooks(os.path.join(home, ".codex", "hooks.json"), "codex"))
        print("codex: open Codex once and approve the new hooks when it asks (it will not run them until you do).")
    else:
        print("codex: no ~/.codex folder on this computer, skipped.")
    skill_src = os.path.join(HERE, "library", "skill")
    shared = os.path.join(home, ".agents", "skills", "ai-microdrama-director")
    if os.path.isdir(skill_src) and not os.path.exists(shared):
        shutil.copytree(skill_src, shared)
        print("skill: copied ai-microdrama-director to %s" % shared)
    link = os.path.join(home, ".claude", "skills", "ai-microdrama-director")
    if os.path.exists(shared) and not os.path.lexists(link):
        os.makedirs(os.path.dirname(link), exist_ok=True)
        os.symlink(shared, link)
        print("skill: linked for Claude at %s" % link)
    for r in roots():
        if os.path.isdir(r):
            d = set_pointer(r)
            print("movie %s: %s" % (r, "pointer written to " + ", ".join(d) if d else "pointer already in place"))
        else:
            print("movie %s: folder not reachable now" % r)
    if not roots():
        print("No movie registered yet on this computer: %s add-project \"<folder>\"" % RUN)
    print("Start a new Claude or Codex session for the hooks to load.")


def register(root):
    rs = roots()
    root = os.path.realpath(root)
    if root not in [os.path.realpath(r) for r in rs]:
        rs.append(root)
        write(PROJECTS_FILE, json.dumps(rs, indent=1) + "\n")
    return root


SKELETON = """---
name: %s
docs:
  locks: production/CONTINUITY-LOCKS.md | cast, prop ledger, scene geography (create this file)
  bible: 02-SERIES-BIBLE.md | premise, characters, episode map (create this file)
---
%s: one line on what this movie is.

Fill in as the user decides. This is the only place this movie's facts live.
- Format: (16:9 or 9:16, ask). Runtime: (ask).
- Cast and face authorities: none chosen yet. The user picks every face.
- Voices: none chosen yet. The user picks every voice.
- Generator and budget: (ask).
- Brand: watermark and end card (ask).
- Where things are: scripts, production/EPxx folders.
- Status: nothing made yet.
"""


def cmd_new_project(args):
    if not args:
        print('Usage: new-project "<folder>" "<Name>"')
        return 1
    root = os.path.realpath(os.path.expanduser(args[0]))
    name = args[1] if len(args) > 1 else os.path.basename(root)
    if not os.path.isdir(root):
        os.makedirs(root)
    p = os.path.join(root, PROJECT_FILE_NAME)
    if not os.path.exists(p):
        write(p, SKELETON % (name, name))
    register(root)
    set_pointer(root)
    print("Registered %s at %s. Fill in %s. Load card new-movie for the order of work." % (name, root, p))


def cmd_add_project(args):
    if not args:
        print('Usage: add-project "<folder>"   (the folder must hold a %s)' % PROJECT_FILE_NAME)
        return 1
    root = os.path.realpath(os.path.expanduser(args[0]))
    if not os.path.isfile(os.path.join(root, PROJECT_FILE_NAME)):
        print("No %s in %s. For a new movie use new-project." % (PROJECT_FILE_NAME, root))
        return 1
    register(root)
    set_pointer(root)
    print("Registered %s" % root)


def cmd_doctor(_):
    home = os.path.expanduser("~")
    ok = True

    def line(good, text):
        print(("ok    " if good else "FIX   ") + text)
        return good

    for kind, p in (("Claude", os.path.join(home, ".claude", "settings.json")), ("Codex", os.path.join(home, ".codex", "hooks.json"))):
        cfg = load_json(p, {})
        n = sum(1 for ev in ("SessionStart", "UserPromptSubmit", "PreToolUse") for g in cfg.get("hooks", {}).get(ev, [])
                if any(HOOK_CMD == h.get("command") for h in g.get("hooks", [])))
        ok &= line(n == 3, "%s hooks: %d of 3 point at this brain (%s)%s" % (kind, n, p, "" if n == 3 else "  -> run: install"))
    ok &= line(not os.path.exists(os.path.join(HERE, "OFF")), "gate is on (no OFF file)")
    for r in roots():
        p = load_project(r)
        ok &= line(p is not None, "movie %s%s" % (r, "" if p else ": not reachable now, or no " + PROJECT_FILE_NAME))
        if p:
            for k, d in sorted(p["docs"].items()):
                if not os.path.exists(d["path"]):
                    ok = line(False, "  %s document '%s' missing: %s" % (p["name"], k, d["path"]))
    for k, d in sorted(docs_for(None).items()):
        if not os.path.exists(d["path"]):
            ok = line(False, "general document '%s' missing: %s" % (k, d["path"]))
        elif d.get("source") and os.path.exists(d["source"]) and os.path.getmtime(d["source"]) > os.path.getmtime(d["path"]) + 1:
            line(False, "general document '%s' is older than its source %s (copy it again if the change is general)" % (k, d["source"]))
    cards = all_cards()
    limit = int(GATES.get("card_token_limit", 600))
    for n, c in cards.items():
        if tokens(c["body"]) > limit:
            ok = line(False, "card %s is about %d tokens (limit %d)" % (n, tokens(c["body"]), limit))
        for w in c["with"]:
            if w != "project" and w not in cards:
                ok = line(False, "card %s names a companion that does not exist: %s" % (n, w))
    line(True, "%d cards, %d general documents, %d movie(s)" % (len(cards), len(GENERAL_DOCS), len(roots())))
    err = os.path.join(LOCAL, "hook-errors.log")
    if os.path.exists(err) and os.path.getsize(err):
        line(False, "the gate logged errors: %s" % err)
    print("All good." if ok else "Something needs attention (lines marked FIX).")


def cmd_sync(_):
    def git(*a):
        return subprocess.run(["git", "-C", HERE] + list(a), capture_output=True, text=True)
    if not os.path.isdir(os.path.join(HERE, ".git")):
        print("The brain folder is not a git repository yet. Without one, copy the folder to the other computer by hand.")
        return 1
    git("add", "-A")
    c = git("commit", "-m", "brain update " + time.strftime("%Y-%m-%d %H:%M"))
    print("saved locally" if c.returncode == 0 else "nothing new to save")
    if not git("remote").stdout.strip():
        print("No online copy is connected, so nothing was sent. The folder can still be copied by hand.")
        return 0
    p = git("pull", "--rebase")
    print("pulled" if p.returncode == 0 else "pull failed:\n" + p.stderr.strip())
    if p.returncode == 0:
        s = git("push")
        print("pushed" if s.returncode == 0 else "push failed:\n" + s.stderr.strip())


# ---------------------------------------------------------------- the gate (Claude Code and Codex hooks)
def state_path(key):
    return os.path.join(STATE, re.sub(r"[^A-Za-z0-9_.-]", "_", key)[:150] + ".json")


def emit(obj):
    sys.stdout.write(json.dumps(obj))


def context(event, text):
    emit({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}})


def deny(reason):
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}})


def brain_call(command):
    """(subcommand, argument list) if this shell command runs brain.py, else None."""
    m = re.search(r"brain\.py[\"']?\s+([a-z-]+)\b(.*)", command, re.S)
    if not m or m.group(1) not in SUBCOMMANDS:
        return None
    rest = m.group(2).split("\n")[0]
    try:
        toks = shlex.split(rest)
    except ValueError:
        toks = rest.replace('"', " ").replace("'", " ").split()
    args = []
    for t in toks:
        if t in ("|", ";", "&&", "||", ">", ">>", "2>&1", "&"):
            break
        args.append(t)
    return m.group(1), args


def hook_main():
    ev = json.loads(sys.stdin.read() or "{}")
    if os.path.exists(os.path.join(HERE, "OFF")):
        return
    event = ev.get("hook_event_name", "")
    sid = str(ev.get("session_id") or "nosession")
    key = sid + ("--" + str(ev["agent_id"]) if ev.get("agent_id") else "")
    st = load_json(state_path(key), None)
    project = project_for(ev.get("cwd")) or project_for(os.environ.get("CLAUDE_PROJECT_DIR"))
    if project is None and st is not None and st.get("root"):
        project = load_project(st["root"])                      # the session moved to another folder; still this movie
    if project is None and ev.get("agent_id"):
        parent = load_json(state_path(sid), None)
        if parent and parent.get("root"):
            project = load_project(parent["root"])
    if project is None:
        return                                                   # not a movie folder: the brain stays out of the way
    if st is None:
        st = {"loaded": {}, "pending": [], "root": project["root"], "created": time.time()}
    cards = all_cards()

    def save():
        st["updated"] = time.time()
        write(state_path(key), json.dumps(st))

    if event == "SessionStart":
        if ev.get("source") in ("compact", "clear"):
            st["loaded"], st["pending"] = {}, []
        save()
        try:                                                     # tidy: forget sessions older than two weeks
            for f in os.listdir(STATE):
                p = os.path.join(STATE, f)
                if time.time() - os.path.getmtime(p) > 14 * 86400:
                    os.remove(p)
        except OSError:
            pass
        again = "Your context was compacted, so the rules you had loaded are gone. " if ev.get("source") == "compact" else ""
        context(event, "[Drama Brain] %sThis folder is the movie \"%s\", and its rules are enforced. Before any tool that changes or "
                       "generates anything, run:\n  %s start \"<your task in a few words>\"\nIt prints the core rules and the card for "
                       "the task (about 1,000 tokens). Tools stay blocked until you do. When the task changes, load the new card: "
                       "%s card <name>." % (again, project["name"], RUN, RUN))
        return

    if event == "UserPromptSubmit":
        need = [c for c in expand(pick_cards(ev.get("prompt") or "", cards), cards, project) if c not in st["loaded"]]
        if not need:
            return
        st["pending"] = [c for c in dict.fromkeys(st.get("pending", []) + need) if c not in st["loaded"]]
        save()
        if st["loaded"]:
            context(event, "[Drama Brain] This request needs card(s) you have not loaded: %s. Before acting run: %s card %s"
                    % (", ".join(need), RUN, " ".join(need)))
        else:
            context(event, "[Drama Brain] Before acting on this run: %s start \"<the task in a few words>\" %s"
                    % (RUN, " ".join(need)))
        return

    if event != "PreToolUse":
        return
    tool = str(ev.get("tool_name", ""))
    tin = ev.get("tool_input") if isinstance(ev.get("tool_input"), dict) else {}
    command = tin.get("command", "")
    if isinstance(command, list):
        command = " ".join(str(c) for c in command)
    command = str(command or "")

    call = brain_call(command) if command else None
    if call:
        sub, args = call
        got = []
        if sub == "start":
            named = [a for a in args[1:] if a in cards or a == "project"]
            got = expand(pick_cards(args[0] if args else "", cards) + named, cards, project) or expand(["general"], cards, project)
        elif sub == "card":
            got = [a for a in args if a in cards or a == "project"]
        for c in got:
            st["loaded"][c] = time.time()
        st["pending"] = [c for c in st.get("pending", []) if c not in st["loaded"]]
        save()
        write(os.path.join(STATE, "current.json"), json.dumps({"root": project["root"], "key": key, "time": time.time()}))
        return                                                   # the brain's own commands always run

    if re.search(GATES.get("free_tools", "^$"), tool):
        return
    if not st["loaded"]:
        save()
        return deny("Drama Brain: this is the movie \"%s\" and you have not read its rules in this session. Run this first, then "
                    "retry:  %s start \"<your task in a few words>\"" % (project["name"], RUN))
    pending = [c for c in st.get("pending", []) if c not in st["loaded"]]
    if pending:
        return deny("Drama Brain: the user's request needs card(s) you have not loaded: %s. Run:  %s card %s   then retry."
                    % (", ".join(pending), RUN, " ".join(pending)))
    for rule in GATES.get("spend", []):
        hit = (rule.get("tool") and re.search(rule["tool"], tool)) or (rule.get("bash") and command and re.search(rule["bash"], command))
        if hit:
            missing = [c for c in rule.get("cards", []) if c not in st["loaded"]]
            if missing:
                return deny("Drama Brain: this spends credits or generates media. Load the card(s) first: %s card %s   then retry."
                            % (RUN, " ".join(missing)))


def main(argv):
    if not argv or argv[0] in ("help", "-h", "--help"):
        print(__doc__.strip())
        return 0
    cmd, args = argv[0], argv[1:]
    if cmd == "hook":
        try:
            hook_main()
        except Exception as e:                                   # never break a session because the gate itself failed
            try:
                with open(os.path.join(LOCAL, "hook-errors.log"), "a") as f:
                    f.write("%s %r\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), e))
            except Exception:
                pass
        return 0
    table = {"start": cmd_start, "card": cmd_card, "cards": cmd_cards, "docs": cmd_docs, "projects": cmd_projects,
             "section": cmd_section, "find": cmd_find, "template": cmd_template, "lesson": cmd_lesson, "budget": cmd_budget,
             "doctor": cmd_doctor, "sync": cmd_sync, "install": cmd_install, "new-project": cmd_new_project,
             "add-project": cmd_add_project}
    if cmd not in table:
        print("Unknown command: %s\n\n%s" % (cmd, __doc__.strip()))
        return 1
    return table[cmd](args) or 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
