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
  precheck <sheet.md>         the pre-spend check; paid tools stay locked until it passes and the user says yes
  install | doctor | selftest | budget | sync
  hook                        the gate, called by Claude Code and Codex hooks (JSON on stdin)
Claude Code gets the gate, the skill and slash commands from the plugin in plugin/ (set up by install).
"""
import sys, os, json, re, time, shlex, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(HERE, "cards")
LOCAL = os.path.join(HERE, "local")            # this computer only: registered movie folders, session state
STATE = os.path.join(LOCAL, "state")
PROJECTS_FILE = os.path.join(LOCAL, "projects.json")
PROJECT_FILE_NAME = "BRAIN-PROJECT.md"
MARK = "<!-- drama-brain -->"
WINDOWS = os.name == "nt"


def _python():
    """How to call Python in a command that Claude, Codex or a person will run. On Windows it must work in cmd,
    PowerShell and Git Bash alike, so a bare `python` or `py -3` is preferred to a quoted path."""
    if not WINDOWS:
        return "/usr/bin/python3" if os.path.exists("/usr/bin/python3") else (sys.executable or "python3")
    same = lambda a, b: os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))
    w = shutil.which("python")
    if w and sys.executable and same(w, sys.executable):
        return "python"
    if shutil.which("py"):
        return "py -3"
    return '"%s"' % (sys.executable or "python").replace("\\", "/")


PY = _python()
ME = os.path.join(HERE, "brain.py").replace("\\", "/") if WINDOWS else os.path.join(HERE, "brain.py")
RUN = '%s "%s"' % (PY, ME)
SUBCOMMANDS = ("start", "card", "cards", "docs", "projects", "section", "find", "template", "lesson",
               "budget", "doctor", "help", "sync", "new-project", "add-project", "install", "selftest", "precheck")
for _s in (sys.stdout, sys.stderr):                              # Windows consoles are not UTF-8 by default
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


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


def marked_root(path):
    """The nearest folder at or above `path` that holds a BRAIN-PROJECT.md, so a movie folder is gated even before it
    is registered on this computer."""
    try:
        d = os.path.realpath(path)
        while True:
            if os.path.isfile(os.path.join(d, PROJECT_FILE_NAME)):
                return d
            up = os.path.dirname(d)
            if up == d:
                return None
            d = up
    except Exception:
        return None


def project_for(path):
    if not path:
        return None
    rp = os.path.normcase(os.path.realpath(path))
    best, best_len = None, -1
    for r in roots():
        rr = os.path.normcase(os.path.realpath(r))
        if (rp == rr or rp.startswith(rr + os.sep)) and len(rr) > best_len:
            best, best_len = r, len(rr)
    m = marked_root(path)
    if m and len(os.path.normcase(m)) > best_len:
        best = m
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
    if has_remote():
        cmd_sync([])                                             # so the other computer gets the lesson too


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
# The gate never fails a session: `hook` always exits 0 and catches its own errors. On macOS and Linux the command also
# swallows a missing drive or interpreter; on Windows it stays plain so cmd, PowerShell and Git Bash all accept it.
HOOK_CMD = ('%s hook' % RUN) if WINDOWS else ('%s hook 2>/dev/null || true' % RUN)
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


def unset_hooks(path):
    """Takes the brain's hooks out of a settings file (the plugin carries them instead). Other hooks stay."""
    cfg = load_json(path, None)
    if not cfg or not isinstance(cfg.get("hooks"), dict):
        return False
    mine = lambda g: any("brain.py" in h.get("command", "") and " hook" in h.get("command", "") for h in g.get("hooks", []))
    changed = False
    for event in list(cfg["hooks"]):
        groups = cfg["hooks"][event]
        keep = [g for g in groups if not mine(g)]
        if len(keep) != len(groups):
            changed = True
            if keep:
                cfg["hooks"][event] = keep
            else:
                del cfg["hooks"][event]
    if not changed:
        return False
    if not cfg["hooks"]:
        del cfg["hooks"]
    shutil.copy2(path, path + ".before-drama-brain-plugin")
    write(path, json.dumps(cfg, indent=2) + "\n")
    return True


# ---------------------------------------------------------------- the Claude Code plugins (in this folder)
# Two plugins, both read from this folder itself, so an edit here is live with no reinstall:
#   drama-brain-gate (plugin-gate/): the gate hooks. On for every Claude session, but the hook stays silent outside
#     movie folders, so it covers every movie folder, its subfolders and ones not registered yet.
#   drama-brain (plugin/): the skill and the slash commands. Off for the user and switched on only in each movie folder
#     (its .claude/settings.local.json), so coding and app sessions never see it.
# The hooks file and the skill link name this computer's paths, so `install` writes them and they are never synced.
MARKET = "drama-brain"
PLUGIN = os.path.join(HERE, "plugin")
PLUGIN_ID = "drama-brain@" + MARKET
GATE_PLUGIN = os.path.join(HERE, "plugin-gate")
GATE_ID = "drama-brain-gate@" + MARKET
PLUGIN_HOOKS = os.path.join(GATE_PLUGIN, "hooks", "hooks.json")
OLD_PLUGIN_HOOKS = os.path.join(PLUGIN, "hooks", "hooks.json")      # where the gate lived before 24 Nov 2026 evening
PLUGIN_SKILL = os.path.join(PLUGIN, "skills", "ai-microdrama-director")
GATE_EVENTS = (("SessionStart", None), ("UserPromptSubmit", None), ("PreToolUse", "*"))


def plugin_hooks():
    hooks = {}
    for event, matcher in GATE_EVENTS:
        g = {"hooks": [{"type": "command", "command": HOOK_CMD, "timeout": 15}]}
        if matcher:
            g["matcher"] = matcher
        hooks[event] = [g]
    return {"description": "The Drama Brain gate. Written by brain.py install for this computer.", "hooks": hooks}


def claude_cli():
    home = os.path.expanduser("~")
    for p in (shutil.which("claude"), os.path.join(home, ".local", "bin", "claude"), "/opt/homebrew/bin/claude",
              "/usr/local/bin/claude", os.path.join(home, ".claude", "local", "claude")):
        if p and os.path.exists(p):
            return p
    return None


def user_settings_path():
    return os.path.join(os.path.expanduser("~"), ".claude", "settings.json")


def user_enabled(pid):
    return load_json(user_settings_path(), {}).get("enabledPlugins", {}).get(pid)


def installed(pid):
    data = load_json(os.path.join(os.path.expanduser("~"), ".claude", "plugins", "installed_plugins.json"), {})
    return isinstance(data, dict) and pid in data.get("plugins", data)


def gate_enabled():
    """True when Claude Code has the gate plugin installed for this user and switched on."""
    return user_enabled(GATE_ID) is True and installed(GATE_ID)


def plugin_enabled():
    return gate_enabled()


def plugin_hooks_ok():
    cfg = load_json(PLUGIN_HOOKS, {}).get("hooks", {})
    return all(any(HOOK_CMD == h.get("command") for g in cfg.get(ev, []) for h in g.get("hooks", [])) for ev, _ in GATE_EVENTS)


def movie_settings(root):
    return os.path.join(root, ".claude", "settings.local.json")


def enabled_in(root):
    return load_json(movie_settings(root), {}).get("enabledPlugins", {}).get(PLUGIN_ID) is True


def enable_in(root):
    """Switches the skill plugin on for one movie folder only. True when it changed something."""
    if not os.path.isdir(root) or not os.path.isfile(os.path.join(PLUGIN, ".claude-plugin", "plugin.json")):
        return False
    p = movie_settings(root)
    cfg = load_json(p, None)
    if cfg is None:
        if os.path.exists(p) and read(p).strip():
            return False                                         # a file we cannot read: leave it alone
        cfg = {}
    if cfg.get("enabledPlugins", {}).get(PLUGIN_ID) is True:
        return False
    cfg.setdefault("enabledPlugins", {})[PLUGIN_ID] = True
    write(p, json.dumps(cfg, indent=2) + "\n")
    return True


def set_plugin():
    """Installs the gate plugin for every session and the skill plugin for movie folders only. Returns a report line,
    or None when it could not, so install falls back to hooks in settings.json."""
    home = os.path.expanduser("~")
    if not os.path.isfile(os.path.join(GATE_PLUGIN, ".claude-plugin", "plugin.json")):
        return None
    want = json.dumps(plugin_hooks(), indent=2) + "\n"
    if not os.path.exists(PLUGIN_HOOKS) or read(PLUGIN_HOOKS) != want:
        write(PLUGIN_HOOKS, want)
    shared = os.path.join(home, ".agents", "skills", "ai-microdrama-director")
    if os.path.isdir(shared) and not os.path.lexists(PLUGIN_SKILL):
        os.makedirs(os.path.dirname(PLUGIN_SKILL), exist_ok=True)
        try:
            os.symlink(shared, PLUGIN_SKILL)
        except OSError:                                          # Windows without the right to make links
            shutil.copytree(shared, PLUGIN_SKILL)
    cli = claude_cli()
    if not cli:
        print("plugin: the claude command was not found, so the plugins were not installed")
        return None
    run = lambda *a: subprocess.run([cli, "plugin"] + list(a), capture_output=True, text=True, stdin=subprocess.DEVNULL)
    run("marketplace", "add", HERE)
    run("marketplace", "update", MARKET)
    if not gate_enabled():
        r = run("install", GATE_ID, "--scope", "user")
        if not gate_enabled():
            run("enable", GATE_ID, "--scope", "user")
        if not gate_enabled():
            print("plugin: the gate plugin did not install: %s" % (r.stdout + r.stderr).strip()[:300])
            return None
    if os.path.exists(OLD_PLUGIN_HOOKS):
        os.remove(OLD_PLUGIN_HOOKS)                              # the gate now lives in the gate plugin only
    if not installed(PLUGIN_ID):
        run("install", PLUGIN_ID, "--scope", "user")
    if user_enabled(PLUGIN_ID) is not False:                     # off for the user: each movie folder switches it on
        run("disable", PLUGIN_ID, "--scope", "user")
        if user_enabled(PLUGIN_ID) is not False:
            cfg = load_json(user_settings_path(), {})
            cfg.setdefault("enabledPlugins", {})[PLUGIN_ID] = False
            write(user_settings_path(), json.dumps(cfg, indent=2) + "\n")
    out = ("claude: gate plugin %s on for every session (it acts only in movie folders); skill plugin %s on in movie "
           "folders only" % (GATE_ID, PLUGIN_ID))
    if unset_hooks(user_settings_path()):
        out += "; old gate hooks removed from settings.json (backup: settings.json.before-drama-brain-plugin)"
    old = os.path.join(home, ".claude", "skills", "ai-microdrama-director")
    if os.path.islink(old):
        os.remove(old)
        out += "; old skill link removed (the plugin carries the skill)"
    elif os.path.isdir(old):
        shutil.move(old, os.path.join(LOCAL, "old-claude-skill-copy-%d" % int(time.time())))
        out += "; old skill copy moved to local/ (the plugin carries the skill)"
    return out


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
    skill_src = os.path.join(HERE, "library", "skill")
    shared = os.path.join(home, ".agents", "skills", "ai-microdrama-director")
    is_master = any(os.path.realpath(m.get("from", "")) == os.path.realpath(shared)
                    for m in load_json(os.path.join(HERE, "mirrors.json"), []))
    if os.path.isdir(skill_src) and not os.path.exists(shared):
        shutil.copytree(skill_src, shared)
        print("skill: copied ai-microdrama-director to %s" % shared)
    elif os.path.isdir(skill_src) and not is_master:             # another computer: bring its copy up to date
        shutil.copytree(skill_src, shared, dirs_exist_ok=True)
        print("skill: updated ai-microdrama-director at %s" % shared)
    plugged = set_plugin()
    print(plugged or set_hooks(os.path.join(home, ".claude", "settings.json"), "claude"))
    if os.path.isdir(os.path.join(home, ".codex")):
        print(set_hooks(os.path.join(home, ".codex", "hooks.json"), "codex"))
        print("codex: open Codex once and approve the new hooks when it asks (it will not run them until you do).")
    else:
        print("codex: no ~/.codex folder on this computer, skipped.")
    link = os.path.join(home, ".claude", "skills", "ai-microdrama-director")
    if plugged:
        pass                                                     # Claude gets the skill from the plugin
    elif os.path.exists(shared) and not os.path.lexists(link):
        os.makedirs(os.path.dirname(link), exist_ok=True)
        try:
            os.symlink(shared, link)
            print("skill: linked for Claude at %s" % link)
        except OSError:                                          # Windows without the right to make links
            shutil.copytree(shared, link)
            print("skill: copied for Claude to %s" % link)
    elif os.path.isdir(link) and not os.path.islink(link) and not is_master:   # a copy, not a link: refresh it too
        shutil.copytree(shared, link, dirs_exist_ok=True)
        print("skill: updated Claude's copy at %s" % link)
    for r in roots():
        if os.path.isdir(r):
            d = set_pointer(r)
            on = plugged and load_project(r) and enable_in(r)
            print("movie %s: %s%s" % (r, "pointer written to " + ", ".join(d) if d else "pointer already in place",
                                     "; skill plugin switched on here" if on else ""))
        else:
            print("movie %s: folder not reachable now" % r)
    if not roots():
        print("No movie registered yet on this computer: %s add-project \"<folder>\"" % RUN)
    print("Start a new Claude or Codex session for the hooks to load.")


def register(root):
    rs = roots()
    root = os.path.realpath(root)
    if os.path.normcase(root) not in [os.path.normcase(os.path.realpath(r)) for r in rs]:
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
    enable_in(root)
    print("Registered %s at %s. Fill in %s. Load card new-movie for the order of work." % (name, root, p))
    print("The project file lists a bible and a continuity file that do not exist yet. That is expected: they are "
          "written as the movie is developed (steps 2 and 4 on card new-movie).")


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
    enable_in(root)
    print("Registered %s" % root)


def cmd_doctor(_):
    home = os.path.expanduser("~")
    ok = True

    def line(good, text):
        print(("ok    " if good else "FIX   ") + text)
        return good

    plugin_on = plugin_enabled()
    for kind, p in (("Claude", os.path.join(home, ".claude", "settings.json")), ("Codex", os.path.join(home, ".codex", "hooks.json"))):
        cfg = load_json(p, {})
        n = sum(1 for ev in ("SessionStart", "UserPromptSubmit", "PreToolUse") for g in cfg.get("hooks", {}).get(ev, [])
                if any(HOOK_CMD == h.get("command") for h in g.get("hooks", [])))
        if kind == "Claude" and plugin_on:
            good = plugin_hooks_ok() and not os.path.exists(OLD_PLUGIN_HOOKS)
            ok &= line(good, "Claude gate: carried by the plugin %s, on for every session (%s)%s" % (GATE_ID, PLUGIN_HOOKS, "" if good else
                       "  -> run: install (plugin hooks file missing, out of date, or also in the old place)"))
            off = user_enabled(PLUGIN_ID) is False
            ok &= line(off, "Claude skill plugin %s: %s" % (PLUGIN_ID, "off outside movie folders" if off else
                       "on for every session, not only movies  -> run: install"))
            if os.path.lexists(os.path.join(home, ".claude", "skills", "ai-microdrama-director")):
                print("todo    the old skill link ~/.claude/skills/ai-microdrama-director is kept as a bridge for sessions opened "
                      "before the plugin. Once those sessions are restarted, run: install")
            if n:
                print("todo    the old gate hooks are still in %s as a bridge for Claude sessions opened before the plugin "
                      "(the gate acts once either way). Once those sessions are restarted, run: install" % p)
            skill_ok = os.path.isfile(os.path.join(PLUGIN_SKILL, "SKILL.md"))
            ok &= line(skill_ok, "Claude skill: ai-microdrama-director in the plugin%s" % ("" if skill_ok else "  -> run: install"))
            continue
        ok &= line(n == 3, "%s hooks: %d of 3 point at this brain (%s)%s" % (kind, n, p, "" if n == 3 else "  -> run: install"))
    ok &= line(not os.path.exists(os.path.join(HERE, "OFF")), "gate is on (no OFF file)")
    for r in roots():
        p = load_project(r)
        ok &= line(p is not None, "movie %s%s" % (r, "" if p else ": not reachable now, or no " + PROJECT_FILE_NAME))
        if p and plugin_on and not enabled_in(r):
            ok = line(False, "movie %s: the skill plugin is not switched on here  -> run: install" % r)
        if p:
            for k, d in sorted(p["docs"].items()):
                if not os.path.exists(d["path"]):
                    # A movie's own documents are written as the movie is made; a new movie has none yet.
                    print("todo    %s: '%s' is not written yet (%s). Normal for a new movie; card new-movie says when to write it."
                          % (p["name"], k, d["path"]))
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
    stale = mirrors(False)
    ok &= line(not stale, "tools carried in the brain match their working copies" if not stale else
               "tools changed since the brain last copied them (%s)  -> run: sync" % ", ".join(stale))
    if has_remote():
        g = lambda *a: subprocess.run(["git", "-C", HERE] + list(a), capture_output=True, text=True).stdout.strip()
        dirty = bool(g("status", "--porcelain"))
        ahead_behind = g("rev-list", "--left-right", "--count", "HEAD...@{u}").split()
        ahead, behind = (int(ahead_behind[0]), int(ahead_behind[1])) if len(ahead_behind) == 2 else (0, 0)
        ok &= line(not dirty and not ahead and not behind, "online copy: %s" % (
            "in step (as of the last check)" if not (dirty or ahead or behind) else
            "%s%s%s  -> run: sync" % ("changes here not saved; " if dirty else "", "%d to send; " % ahead if ahead else "",
                                      "%d to receive" % behind if behind else "")))
    else:
        line(True, "no online copy connected (copy the folder by hand to another computer)")
    err = os.path.join(LOCAL, "hook-errors.log")
    if os.path.exists(err) and os.path.getsize(err):
        line(False, "the gate logged errors: %s" % err)
    print("All good." if ok else "Something needs attention (lines marked FIX).")


def mirrors(apply):
    """Tools whose working copy lives elsewhere on this computer (mirrors.json). Returns the files that differ;
    with apply=True it copies them in. Top-level files only, minus the excluded names."""
    changed = []
    for m in load_json(os.path.join(HERE, "mirrors.json"), []):
        src, dst = m.get("from", ""), os.path.join(HERE, m.get("to", ""))
        if not os.path.isdir(src):
            continue                                             # the master is on another computer or drive
        skip = set(m.get("exclude", []))
        for f in sorted(os.listdir(src)):
            s, d = os.path.join(src, f), os.path.join(dst, f)
            if f in skip or f.startswith(".") or not os.path.isfile(s):
                continue
            same = os.path.exists(d) and open(s, "rb").read() == open(d, "rb").read()
            if not same:
                changed.append(os.path.join(m.get("to", ""), f))
                if apply:
                    os.makedirs(dst, exist_ok=True)
                    shutil.copy2(s, d)
    return changed


def has_remote():
    if not os.path.isdir(os.path.join(HERE, ".git")):
        return False
    try:
        return bool(subprocess.run(["git", "-C", HERE, "remote"], capture_output=True, text=True).stdout.strip())
    except OSError:
        return False


def refresh_skill():
    """On a computer that is not the skill's master, copy any changed skill file from library/skill into the installed
    skill (~/.agents/skills and Claude's copy when it is not a link), so a fetched update reaches Claude."""
    home = os.path.expanduser("~")
    src = os.path.join(HERE, "library", "skill")
    shared = os.path.join(home, ".agents", "skills", "ai-microdrama-director")
    link = os.path.join(home, ".claude", "skills", "ai-microdrama-director")
    if not os.path.isdir(src) or any(os.path.realpath(m.get("from", "")) == os.path.realpath(shared)
                                     for m in load_json(os.path.join(HERE, "mirrors.json"), [])):
        return
    targets = [t for t in (shared, link, PLUGIN_SKILL) if os.path.isdir(t) and not os.path.islink(t)]
    for root, _, files in os.walk(src):
        for f in files:
            s = os.path.join(root, f)
            rel = os.path.relpath(s, src)
            for t in targets:
                d = os.path.join(t, rel)
                try:
                    if not (os.path.exists(d) and open(s, "rb").read() == open(d, "rb").read()):
                        os.makedirs(os.path.dirname(d), exist_ok=True)
                        shutil.copy2(s, d)
                except OSError:
                    pass


def quiet_pull():
    """At most every six hours, fetch the other computer's changes in the background. Fast-forward only, so it can
    never leave the folder half merged; if both computers changed things, `sync` sorts it out."""
    try:
        refresh_skill()                                          # applies whatever the last fetch brought
    except Exception:
        pass
    stamp = os.path.join(LOCAL, "last-pull")
    if not has_remote() or (os.path.exists(stamp) and time.time() - os.path.getmtime(stamp) < 6 * 3600):
        return
    write(stamp, time.strftime("%Y-%m-%d %H:%M:%S"))
    detach = {"creationflags": 0x00000008 | 0x00000200} if WINDOWS else {"start_new_session": True}
    subprocess.Popen(["git", "-C", HERE, "pull", "--ff-only", "-q"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, **detach)


def cmd_sync(_):
    def git(*a):
        return subprocess.run(["git", "-C", HERE] + list(a), capture_output=True, text=True)
    if not os.path.isdir(os.path.join(HERE, ".git")):
        print("The brain folder is not a git repository yet. Without one, copy the folder to the other computer by hand.")
        return 1
    got = mirrors(True)
    if got:
        print("tools refreshed from their working copies: %s" % ", ".join(got))
    git("add", "-A")
    c = git("commit", "-m", "brain update " + time.strftime("%Y-%m-%d %H:%M"))
    print("saved locally" if c.returncode == 0 else "nothing new to save")
    if not git("remote").stdout.strip():
        print("No online copy is connected, so nothing was sent. The folder can still be copied by hand.")
        return 0
    p = git("pull", "--rebase")
    if p.returncode != 0:                                        # the background fetch may be mid-way: once more
        time.sleep(3)
        p = git("pull", "--rebase")
    print("pulled" if p.returncode == 0 else "pull failed:\n" + p.stderr.strip())
    if p.returncode == 0:
        s = git("push")
        print("pushed" if s.returncode == 0 else "push failed:\n" + s.stderr.strip())


def cmd_selftest(_):
    """Proves on THIS computer that the gate works, by running the exact hook command Claude and Codex will run
    against a throwaway movie folder. Changes nothing permanent."""
    import tempfile
    tmp = os.path.realpath(tempfile.mkdtemp(prefix="brain-selftest-"))
    write(os.path.join(tmp, PROJECT_FILE_NAME), SKELETON % ("Self Test", "Self Test"))
    before = roots()
    write(PROJECTS_FILE, json.dumps(before + [tmp]))
    sid, other = "selftest-%d" % os.getpid(), "selftest-other-%d" % os.getpid()
    home = os.path.expanduser("~")
    passed = []

    def fire(ev, session=sid):
        p = subprocess.run(HOOK_CMD, shell=True, input=json.dumps(dict(ev, session_id=session)).encode("utf-8"),
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=home)
        return p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")

    def check(name, good, shown=""):
        passed.append(bool(good))
        print(("pass  " if good else "FAIL  ") + name + ("" if good else "   -> " + shown.strip()[:300]))

    tool = lambda cmd, cwd=tmp: {"hook_event_name": "PreToolUse", "cwd": cwd, "tool_name": "Bash", "tool_input": {"command": cmd}}
    try:
        c, o, e = fire({"hook_event_name": "SessionStart", "cwd": tmp, "source": "startup"})
        check("the hook command runs, and a session gets the notice", c == 0 and "Drama Brain" in o, "exit %s %s %s" % (c, o, e))
        c, o, e = fire(tool("echo hi"))
        check("a command is blocked before the brain is read", '"deny"' in o, "exit %s %s %s" % (c, o, e))
        c1, o1, e1 = fire(dict(tool("echo twice"), tool_use_id="selftest-twice"))
        c2, o2, e2 = fire(dict(tool("echo twice"), tool_use_id="selftest-twice"))
        check("a hook wired twice acts once (one deny, the copy stays silent)", '"deny"' in o1 and not o2.strip(), o1 + o2 + e1 + e2)
        c, o, e = fire(tool(RUN + ' start "self test"'))
        check("the brain's own command is let through", c == 0 and "deny" not in o, o + e)
        c, o, e = fire(tool("echo hi"))
        check("the same command is allowed after reading", c == 0 and "deny" not in o, o + e)
        c, o, e = fire({"hook_event_name": "PreToolUse", "cwd": tmp, "tool_name": "mcp__pollo__generate_image", "tool_input": {}})
        check("a paid tool is blocked without the credits card", '"deny"' in o, o + e)
        c, o, e = fire(tool("echo hi", home), other)
        check("folders that are not movies are left alone", c == 0 and not o.strip(), o + e)
        # the pre-spend lock
        paid = {"hook_event_name": "PreToolUse", "cwd": tmp, "tool_name": "mcp__pollo__generate_video", "tool_input": {"brand": "x", "model": "y", "input": {"duration": 5, "refs": [{"url": "a"}, {"url": "b"}]}}}
        fire(tool(RUN + ' start "generate credits" credits'))
        tick = "checked: " + ", ".join(GATES.get("precheck_ticks", []))
        bad, good = os.path.join(tmp, "bad.md"), os.path.join(tmp, "good.md")
        write(bad, "## Job a\nmode: i2v\nfirst: K1\nseconds: 3\n%s\n## Job b\nmode: i2v\nfirst: K1\nseconds: 5\n%s\n" % (tick, tick))
        write(good, "## Job a\nmode: i2v\nfirst: K1\nseconds: 5\n%s\n" % tick)
        pre = lambda f: subprocess.run(RUN + ' precheck "%s"' % f, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=tmp)
        p = pre(bad)
        check("precheck refuses two clips on the same first frame", p.returncode == 1 and b"merge them" in p.stdout, p.stdout.decode("utf-8", "replace"))
        c, o, e = fire(paid)
        check("a paid call is blocked without an approved sheet", '"deny"' in o, o + e)
        p = pre(good)
        check("precheck refuses a sheet with no staging map", p.returncode == 1 and b"no staging map" in p.stdout,
              p.stdout.decode("utf-8", "replace"))
        quiet = os.path.join(tmp, "quiet.md")
        write(quiet, "staging-map: not needed, an insert of a hand, nobody talks\n" + read(good))
        p = pre(quiet)
        check("precheck accepts 'staging-map: not needed, <reason>'", p.returncode == 0, p.stdout.decode("utf-8", "replace"))
        write(os.path.join(tmp, "EP01-STAGING-MAPS.png"), "map")
        p = pre(good)
        check("precheck passes a clean sheet beside a staging map", p.returncode == 0, p.stdout.decode("utf-8", "replace"))
        c, o, e = fire(paid)
        check("a paid call is still blocked before the user's yes", '"deny"' in o, o + e)
        fire({"hook_event_name": "UserPromptSubmit", "cwd": tmp, "prompt": "Yes make it"})
        c, o, e = fire(dict(paid, tool_use_id="selftest-call-1"))
        check("the user's yes unlocks the approved job", c == 0 and "deny" not in o, o + e)
        c, o, e = fire(dict(paid, tool_use_id="selftest-call-1"))
        check("the same call seen twice is counted once", c == 0 and "deny" not in o, o + e)
        c, o, e = fire(dict(paid, tool_use_id="selftest-call-2"))
        check("a call beyond the approved jobs is blocked", '"deny"' in o, o + e)
        nested = os.path.join(tmp, "unregistered-movie", "episodes")
        os.makedirs(nested)
        write(os.path.join(tmp, "unregistered-movie", PROJECT_FILE_NAME), SKELETON % ("Self Test Two", "Self Test Two"))
        c, o, e = fire(tool("echo hi", nested), "selftest-marked-%d" % os.getpid())
        check("a folder with BRAIN-PROJECT.md is gated even when not registered", '"deny"' in o and "Self Test Two" in o, o + e)
        p = subprocess.run(RUN + ' start "write a script"', shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=tmp)
        out = p.stdout.decode("utf-8", "replace")
        check("start prints the core rules and a card", "Core rules" in out and "== Card" in out, out[:200] + p.stderr.decode("utf-8", "replace"))
    finally:
        write(PROJECTS_FILE, json.dumps(before, indent=1) + "\n")
        for s in (sid, other, "selftest-marked-%d" % os.getpid()):
            if os.path.exists(state_path(s)):
                os.remove(state_path(s))
        sp = spend_path({"name": "Self Test"})
        if os.path.exists(sp):
            os.remove(sp)
        shutil.rmtree(tmp, ignore_errors=True)
    print("Self-test: %d of %d passed. Hook command on this computer: %s" % (sum(passed), len(passed), HOOK_CMD))
    return 0 if all(passed) else 1


# ---------------------------------------------------------------- the pre-spend lock
# Nothing paid runs without: (1) the skill read in full this session, (2) a pre-spend sheet that passes `precheck`
# (duplicates, exact script words, every check ticked), (3) the user's own "yes" typed after the quote, and then
# (4) no more generation calls than the sheet's jobs. The sheet format is in `precheck` with no file.
SHEET_HELP = """Pre-spend sheet (markdown). One block per job:

  rate: 6                      credits a second (top of the file, optional, default 6)
  ## Job 2a
  mode: i2v                    i2v | ref | t2v | image
  first: K5                    first frame or keyframe id (ref: the keyframe ref)
  end: K5e                     end frame, or blank
  seconds: 6                   or  credits: 12  for an image
  lines: none                  or the exact script lines in double quotes
  checked: <ticks>             every tick in gates.json precheck_ticks, comma separated
  same-first: <reason>         only if two i2v jobs truly need the same first frame

A *STAGING-MAP* file must be in the sheet's folder or the two above it (card frames). Only a sheet where nobody talks
may say instead, on its own line:  staging-map: not needed, <reason>

Then: brain.py precheck <sheet.md>. Show the user the quote it prints and wait for their own yes."""


def spend_path(project):
    return os.path.join(STATE, "spend-" + re.sub(r"[^A-Za-z0-9]", "_", project["name"])[:60] + ".json")


class spend_lock(object):
    """One gate at a time reads and counts a movie's spend file (hooks can fire side by side)."""
    def __init__(self, project):
        self.path = spend_path(project) + ".lock"

    def __enter__(self):
        os.makedirs(STATE, exist_ok=True)
        for _ in range(100):                                     # up to about 5 seconds
            try:
                os.mkdir(self.path)
                self.held = True
                return self
            except FileExistsError:
                try:
                    if time.time() - os.path.getmtime(self.path) > 30:   # left behind by a crash
                        os.rmdir(self.path)
                        continue
                except OSError:
                    pass
                time.sleep(0.05)
        self.held = False
        return self

    def __exit__(self, *_):
        if self.held:
            try:
                os.rmdir(self.path)
            except OSError:
                pass


def script_text(project):
    for k in GATES.get("script_docs", ["wan-script", "screenplay"]):
        d = project["docs"].get(k)
        if d and os.path.isfile(d["path"]):
            return read(d["path"])
    return None


def squash(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip().lower()


def parse_sheet(text):
    rate = 6.0
    m = re.search(r"^rate:\s*([\d.]+)", text, re.M)
    if m:
        rate = float(m.group(1))
    jobs = []
    for block in re.split(r"^##\s+", text, flags=re.M)[1:]:
        head, _, body = block.partition("\n")
        job = {"id": re.sub(r"^job\s+", "", head.strip(), flags=re.I)}
        for line in body.splitlines():
            k, sep, v = line.partition(":")
            if sep and re.fullmatch(r"[a-z-]+", k.strip().lower()):
                job[k.strip().lower()] = v.strip()
        jobs.append(job)
    return rate, jobs


def staging_map_for(sheet):
    """The first file named *STAGING-MAP* in the sheet's folder or the two folders above it, else None."""
    d = os.path.dirname(os.path.abspath(sheet))
    for _ in range(3):
        try:
            for f in sorted(os.listdir(d)):
                if "staging-map" in f.lower() and os.path.isfile(os.path.join(d, f)):
                    return os.path.join(d, f)
        except OSError:
            pass
        d = os.path.dirname(d)
    return None


def cmd_precheck(args):
    if not args:
        print(SHEET_HELP)
        return 1
    project = active_project()
    if not project:
        print("precheck: not inside a registered movie folder.")
        return 1
    path = os.path.abspath(args[0])
    if not os.path.isfile(path):
        print("precheck: no such file: " + path)
        return 1
    rate, jobs = parse_sheet(read(path))
    ticks = [t.lower() for t in GATES.get("precheck_ticks", [])]
    script = script_text(project)
    errors, total, seconds = [], 0.0, 0.0
    if not jobs:
        errors.append("no '## Job' blocks found")
    if not staging_map_for(path) and not re.search(r"^staging-map:\s*not needed\s*,\s*\S", read(path), re.M | re.I):
        errors.append("no staging map: put the scene's *STAGING-MAP* file (top-view floor plan, 180-degree line, cameras W, A "
                      "and B) in this sheet's folder or the two folders above it, or, only if nobody talks, write a line "
                      "'staging-map: not needed, <reason>' (card frames)")
    firsts = {}
    for j in jobs:
        jid = j["id"]
        mode = j.get("mode", "").lower()
        if mode not in ("i2v", "ref", "t2v", "image"):
            errors.append("%s: mode must be i2v, ref, t2v or image" % jid)
        if mode != "t2v" and not j.get("first"):
            errors.append("%s: no first frame / keyframe named" % jid)
        if j.get("credits"):
            try:
                total += float(j["credits"])
            except ValueError:
                errors.append("%s: credits is not a number" % jid)
        elif j.get("seconds"):
            try:
                s = float(j["seconds"]); seconds += s; total += s * rate
            except ValueError:
                errors.append("%s: seconds is not a number" % jid)
        else:
            errors.append("%s: give seconds or credits" % jid)
        got = [t.strip().lower() for t in j.get("checked", "").split(",") if t.strip()]
        miss = [t for t in ticks if t not in got]
        if miss:
            errors.append("%s: not ticked: %s" % (jid, ", ".join(miss)))
        lines = re.findall(r'"([^"]+)"', j.get("lines", "").replace("“", '"').replace("”", '"'))
        if lines and script is None:
            errors.append("%s: cannot find the script to check the words (gates.json script_docs)" % jid)
        for ln in lines:
            if script is not None and squash(ln) not in squash(script):
                errors.append('%s: line is not word for word in the script: "%s"' % (jid, ln))
        key = (j.get("first", "").lower(), j.get("end", "").lower())
        if mode == "i2v" and key[0]:
            firsts.setdefault(key[0], []).append(j)
        if key[0] and key[1] and any(o is not j and (o.get("first", "").lower(), o.get("end", "").lower()) == key for o in jobs):
            errors.append("%s: same first AND end frame as another job: the same picture paid twice" % jid)
    for f, js in firsts.items():
        if len(js) > 1 and not all(x.get("same-first") for x in js):
            errors.append("jobs %s all start on %s: merge them into one clip, or give each a same-first: reason"
                          % (", ".join(x["id"] for x in js), f))
    print("PRE-SPEND CHECK: %s" % path)
    for j in jobs:
        cost = j.get("credits") or ("%s s" % j.get("seconds", "?"))
        print("  %-8s %-6s %-10s %s" % (j["id"], j.get("mode", "?"), (j.get("first", "") + (" > " + j["end"] if j.get("end") else ""))[:24], cost))
    if errors:
        print("\nFAILED. Fix these, then run precheck again. Nothing may be spent:")
        for e in errors:
            print("  - " + e)
        write(spend_path(project), json.dumps({"status": "failed", "sheet": path, "time": time.time()}))
        return 1
    state = {"status": "checked", "sheet": path, "jobs": [j["id"] for j in jobs], "job_count": len(jobs),
             "seconds": seconds, "total": round(total), "rate": rate, "used_calls": 0, "used_seconds": 0.0,
             "time": time.time()}
    write(spend_path(project), json.dumps(state))
    print("\nPASSED. %d jobs, %g s, %d credits. Show the user this quote and the balance, then STOP and wait." % (len(jobs), seconds, round(total)))
    print("Paid tools stay locked until the user types their own yes after this check.")
    return 0


def spend_cost(tin, rate):
    """(calls, seconds) one paid tool call will use, read from its input."""
    items = None
    for k in ("items", "tasks", "requests", "generations", "jobs"):      # a batch tool: one generation per entry
        v = tin.get(k)
        if isinstance(v, list) and v and all(isinstance(x, dict) for x in v):
            items = v
            break
    items = items or [tin]
    secs = 0.0
    for it in items:
        n = it.get("numOutputs") or (it.get("input") or {}).get("numOutputs") if isinstance(it.get("input"), dict) else it.get("numOutputs")
        for d in (it, it.get("input") if isinstance(it.get("input"), dict) else {}):
            got = False
            for k in ("duration", "seconds", "length"):
                try:
                    secs += float(d.get(k)) * max(1, int(n or 1)); got = True; break
                except (TypeError, ValueError):
                    continue
            if got:
                break
    calls = sum(max(1, int((it.get("numOutputs") or 1))) for it in items)
    return calls, secs


YES = re.compile(r"^\W*(yes|yeah|yea|yep|go|go ahead|ok|okay|approved?|make (it|them)|do it|proceed|generate( it| them)?|run (it|them|both|all)( all)?)\b", re.I)
# Refuse only a real hold-off ("wait", "not yet", "don't generate"). Conditions such as "no drift, no mistakes"
# go with a yes and must not cancel it (23 Nov 2026: the user's "Yes but it must no drift" was misread as a no).
NO = re.compile(r"^\W*(yes|yeah|ok|okay|run (it|them|both|all))\s*\?|^\W*(yes\W+)?(wait|stop|hold on|hold off|cancel|not yet)\b|\b(not yet|don'?t (do|run|generate|spend|make|start)( it| them| yet)?)\b", re.I)


# ---------------------------------------------------------------- the gate (Claude Code and Codex hooks)
def state_path(key):
    return os.path.join(STATE, re.sub(r"[^A-Za-z0-9_.-]", "_", key)[:150] + ".json")


def emit(obj):
    sys.stdout.write(json.dumps(obj))


def context(event, text):
    emit({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}})


def deny(reason):
    emit({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}})


def seen_before(ev, event, sid):
    """True when this same event was already handled a moment ago. The gate can be wired twice for a while (the plugin,
    and the old settings hooks kept for sessions opened before it), and each event must act once: one notice, one deny,
    one count. The first copy to claim the event does the work; the other stays silent."""
    import hashlib
    if event == "PreToolUse":
        what = ev.get("tool_use_id")
    elif event == "UserPromptSubmit":
        what = ev.get("prompt")
    elif event == "SessionStart":
        what = ev.get("source") or "start"
    else:
        what = None
    if not what:
        return False
    key = hashlib.sha1(("%s|%s|%s|%s" % (sid, ev.get("agent_id") or "", event, what)).encode("utf-8", "replace")).hexdigest()
    d = os.path.join(STATE, "seen")
    p = os.path.join(d, key)
    try:
        os.makedirs(d, exist_ok=True)
        for _ in range(2):
            try:
                os.close(os.open(p, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
                return False                                     # first to claim it
            except FileExistsError:
                if time.time() - os.path.getmtime(p) < 10:
                    return True                                  # the other copy, a moment ago
                os.remove(p)                                     # an old claim: the same words sent again later
    except OSError:
        pass
    return False


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
    raw = sys.stdin.buffer.read().decode("utf-8", "replace") if hasattr(sys.stdin, "buffer") else sys.stdin.read()
    ev = json.loads(raw.lstrip("﻿").strip() or "{}")
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
    if seen_before(ev, event, sid):
        return                                                   # another copy of this hook already handled this event
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
                if os.path.isfile(p) and time.time() - os.path.getmtime(p) > 14 * 86400:
                    os.remove(p)
            dup = os.path.join(STATE, "seen")
            for f in (os.listdir(dup) if os.path.isdir(dup) else []):
                if time.time() - os.path.getmtime(os.path.join(dup, f)) > 3600:
                    os.remove(os.path.join(dup, f))
        except OSError:
            pass
        try:
            quiet_pull()
        except Exception:
            pass
        try:                                                     # next session here gets the skill and commands too
            if gate_enabled():
                enable_in(project["root"])
        except Exception:
            pass
        again = "Your context was compacted, so the rules you had loaded are gone. " if ev.get("source") == "compact" else ""
        context(event, "[Drama Brain] %sThis folder is the movie \"%s\", and its rules are enforced. Before any tool that changes or "
                       "generates anything, run:\n  %s start \"<your task in a few words>\"\nIt prints the core rules and the card for "
                       "the task (about 1,000 tokens). Tools stay blocked until you do. When the task changes, load the new card: "
                       "%s card <name>." % (again, project["name"], RUN, RUN))
        return

    if event == "UserPromptSubmit":
        sp = load_json(spend_path(project), {})
        prompt = (ev.get("prompt") or "").strip()
        if sp.get("status") == "checked" and YES.search(prompt) and not NO.search(prompt[:200]):
            sp.update(status="approved", approved_quote=prompt[:200], approved_time=time.time())
            write(spend_path(project), json.dumps(sp))
            context(event, "[Drama Brain] The user approved the pre-spend sheet %s: %d jobs, %d credits. Paid calls are unlocked "
                           "for exactly those jobs, one take each." % (os.path.basename(sp["sheet"]), sp["job_count"], sp["total"]))
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

    skill_docs = {os.path.basename(v["path"]): k for k, v in GENERAL_DOCS.items() if v["path"].startswith("library/skill/")}
    read_skill = None
    if tool == "Skill" and "ai-microdrama-director" in str(tin.get("skill", "")):
        read_skill = "skill"
    elif tool == "Read" and not tin.get("offset") and not tin.get("limit"):
        fp = str(tin.get("file_path", "")).replace("\\", "/")
        if "/library/skill/" in fp or "/ai-microdrama-director/" in fp:
            read_skill = skill_docs.get(os.path.basename(fp))
    if read_skill:
        st.setdefault("skill_read", {})[read_skill] = time.time()
        save()

    call = brain_call(command) if command else None
    if call and call[0] == "precheck":
        need_skill = [d for d in GATES.get("precheck_skill", []) if d not in st.get("skill_read", {})]
        if need_skill:
            paths = ", ".join(os.path.join(HERE, GENERAL_DOCS[d]["path"]).replace("\\", "/") for d in need_skill if d in GENERAL_DOCS)
            return deny("Drama Brain: read the skill in full (Read tool, whole file, no offset or limit) before the pre-spend check. "
                        "Not read yet in this session: %s" % paths)
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
            if rule.get("cards_only"):
                return                                           # free work (Firefly stills): the card is enough
            with spend_lock(project):
                sp = load_json(spend_path(project), {})
                tuid = str(ev.get("tool_use_id") or "")
                if tuid and tuid in sp.get("counted", []):
                    return                                       # the same call seen twice (two copies of the hook): count once
                if sp.get("status") != "approved":
                    return deny("Drama Brain: no approved pre-spend sheet (state: %s). Write the sheet, run %s precheck <sheet.md>, "
                                "show the user the quote, and wait for their own yes. Format: %s precheck"
                                % (sp.get("status", "none"), RUN, RUN))
                calls, secs = spend_cost(tin, sp.get("rate", 6))
                if sp["used_calls"] + calls > sp["job_count"]:
                    return deny("Drama Brain: the approved sheet allows %d generation(s); %d used. This call would go over. "
                                "Any retake or extra job needs a new sheet and a new yes." % (sp["job_count"], sp["used_calls"]))
                if sp.get("seconds") and sp["used_seconds"] + secs > sp["seconds"] + 0.01:
                    return deny("Drama Brain: the approved sheet allows %g seconds; %g used; this call asks for %g." %
                                (sp["seconds"], sp["used_seconds"], secs))
                sp["used_calls"] += calls
                sp["used_seconds"] += secs
                if tuid:
                    sp["counted"] = (sp.get("counted", []) + [tuid])[-100:]
                if sp["used_calls"] >= sp["job_count"]:
                    sp["status"] = "spent"
                write(spend_path(project), json.dumps(sp))
            return


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
             "doctor": cmd_doctor, "sync": cmd_sync, "precheck": cmd_precheck, "install": cmd_install, "selftest": cmd_selftest,
             "new-project": cmd_new_project,
             "add-project": cmd_add_project}
    if cmd not in table:
        print("Unknown command: %s\n\n%s" % (cmd, __doc__.strip()))
        return 1
    return table[cmd](args) or 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
