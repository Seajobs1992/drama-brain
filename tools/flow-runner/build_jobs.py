#!/usr/bin/env python3
"""Rebuild jobs/jobs.json and jobs/frames/ for the Flow runner from the episode scripts.
Run:  python3 build_jobs.py ["<movie folder>"]
The movie folder is the one that holds production/EPxx. Without an argument it uses the MOVIE_DIR
environment variable, then the LOCKED OUT folder on the Mac it was written on.
Clips save to LOCKED-OUT/<EP>/flow-clips/<id>.mp4 (kept apart from the Kling takes in clips/).
"""
import json, os, re, shutil, sys
ROOT = os.path.abspath(os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MOVIE_DIR", "/Volumes/MAC/NEW DRAM")))
if not os.path.isdir(os.path.join(ROOT, "production")):
    sys.exit(f'No "production" folder in {ROOT}. Run:  python3 build_jobs.py "<movie folder>"')
HERE = os.path.dirname(os.path.abspath(__file__))
EPISODES = [(f"EP0{n}", f"production/EP0{n}/EP0{n}-KLING-ANIMATION-SCRIPT.md") for n in (1, 2, 3, 4)]

out = []
for ep, rel in EPISODES:
    doc = open(os.path.join(ROOT, rel)).read()
    title = re.search(r"^# .*?Episode \d+: (.+?)\.", doc, re.M)
    clips = re.split(r"\n## \d+\. (?:The c|C)lips", doc)[1].split("\n## ")[0]
    # Voice tags per character (the "Voices" table), so a clip that carries Flow characters can drop them:
    # the character's Flow voice speaks, and a written voice description would fight it.
    vsec = re.search(r"\n## \d+\. Voices?\b.*?\n(.*?)(?=\n## )", doc, re.S)
    tags = dict(re.findall(r"^\| ([A-Z][\w ]*?) \| ([^|]+?) \|$", vsec.group(1), re.M)) if vsec else {}
    tags.pop("Character", None)
    found = {}
    for m in re.finditer(r"^### (\S+)\. (.+?)\n(.*?)(?=^### |\Z)", clips, re.M | re.S):
        cid, name, body = m.group(1), m.group(2), m.group(3)
        h = re.search(r"Start `([^`]+)`\. (\d+) s\.(.*?)Audio (on|optional)", body, re.S)
        p = re.search(r"```\n(.*?)\n```", body, re.S)
        if not h or not p:
            print("skipped", ep, cid)
            continue
        bind = re.search(r"Bind: ([^.]+)\.", body)
        cast = [c.strip() for c in bind.group(1).split(",")] if bind else []
        prompt = p.group(1).strip()
        cast_prompt = prompt
        for who in cast:
            if who in tags:
                cast_prompt = cast_prompt.replace(", " + tags[who] + "]", "]")
        # Lines written differently from the table ("[Wren, the girl, small, clear, matter-of-fact voice]"): keep the name,
        # the position and any delivery note ("almost a whisper"); drop the parts that describe the voice itself.
        def strip_voice(m):
            parts = [x.strip() for x in m.group(1).split(",")]
            who = parts[0]
            if who not in cast or len(parts) < 3:
                return m.group(0)
            words = set(re.findall(r"[\w'-]+", tags.get(who, "").lower()))
            keep = [x for x in parts[2:] if "voice" not in x.lower() and not set(re.findall(r"[\w'-]+", x.lower())) <= words]
            return "[" + ", ".join(parts[:2] + keep) + "]:"
        cast_prompt = re.sub(r"\[([A-Z][^\]\n]*)\]:", strip_voice, cast_prompt)
        has_kling = os.path.exists(os.path.join(ROOT, "production", ep, "clips", cid + ".mp4"))
        has_flow = os.path.exists(os.path.join(ROOT, "production", ep, "flow-clips", cid + ".mp4"))
        found[cid] = {"id": cid, "episode": ep, "episodeTitle": title.group(1) if title else "", "title": name.strip(), "hasKling": has_kling, "hasFlow": has_flow,
                      "frame": f"{ep}/{h.group(1)}", "seconds": int(h.group(2)), "dialogue": h.group(4) == "on",
                      "prompt": prompt, "cast": cast, "castPrompt": cast_prompt, "output": f"LOCKED-OUT/{ep}/flow-clips/{cid}.mp4"}
    # Fixes after Flow rejections: production/EPxx/flow-fixes.json, {"4-10": {"prompt": "...", "alt": "..."}, "frame 4-10": {...}}
    # "prompt" replaces the script's prompt for the run; "alt" is a softer version tried once after a policy refusal.
    fixes_path = os.path.join(ROOT, "production", ep, "flow-fixes.json")
    fixes = json.load(open(fixes_path)) if os.path.exists(fixes_path) else {}
    for cid, job in found.items():
        fx = fixes.get(cid) or {}
        if fx.get("prompt"): job["fixPrompt"] = fx["prompt"].strip()
        if fx.get("alt"): job["altPrompt"] = fx["alt"].strip()
        if fx.get("seconds"): job["seconds"] = int(fx["seconds"])
        if "cast" in fx: job["cast"] = list(fx["cast"])
        if fx.get("frame"): job["frame"] = f"{ep}/{fx['frame']}"
        if fx.get("mode"): job["mode"] = fx["mode"]
        if fx.get("extra"): job["extra"] = list(fx["extra"])
    order = [m.group(1) for m in re.finditer(r"^\| \d+ \| (\S+) \| \S+\.jpg \|", doc, re.M)]
    for cid in order:
        if cid in found:
            out.append(found.pop(cid))
    out += list(found.values())
    dst = os.path.join(HERE, "jobs", "frames", ep)
    os.makedirs(dst, exist_ok=True)
    src = os.path.join(ROOT, "production", ep, "kling", "start-frames")
    for f in sorted(os.listdir(src)):
        shutil.copy2(os.path.join(src, f), os.path.join(dst, f))

json.dump(out, open(os.path.join(HERE, "jobs", "jobs.json"), "w"), indent=1)

# The cast: approved reference picture + Flow voice (creator's picks, 16 November 2026; Customer and Bibi still open).
# A character with no picture yet can carry a description instead ("describe": "..."); Flow then draws the portrait.
CAST = [
    ("Jonah", "EP01/kling/elements/Jonah/I1-Jonah-portrait-v6.jpg", "Schedar"),
    ("Wren", "EP01/kling/elements/Wren/Wren-option-A.jpg", "Leda"),
    ("Nora", "EP03/kling/elements/Nora.jpg", "Kore"),
    ("Vivienne", "EP01/kling/elements/Vivienne/Vivienne-option-D.jpg", "Gacrux"),
    ("Pryce", "EP01/kling/elements/Pryce/Pryce-option-B.jpg", "Umbriel"),
    ("Customer", "EP01/kling/elements/Customer/C1-Customer-v1.jpg", ""),   # voice not chosen yet (Zubenelgenubi was suggested)
    ("Bibi", "EP03/kling/elements/Bibi.jpg", ""),
]
cdir = os.path.join(HERE, "jobs", "cast"); os.makedirs(cdir, exist_ok=True)
cast = []
for entry in CAST:
    name, rel, voice = entry[:3]
    if rel.startswith("describe:"):
        cast.append({"name": name, "picture": None, "describe": rel[len("describe:"):].strip(), "voice": voice, "source": "description"})
        continue
    shutil.copy2(os.path.join(ROOT, "production", rel), os.path.join(cdir, name + ".jpg"))
    cast.append({"name": name, "picture": f"cast/{name}.jpg", "voice": voice, "source": rel})
json.dump(cast, open(os.path.join(HERE, "jobs", "cast.json"), "w"), indent=1)
print(f"{len(cast)} cast members written")

# Project assets to upload once per Flow project, by name: the selected masters, references and props
# (versions from each episode's GENERATION-LOG). Image jobs name them as ingredients.
ASSETS = {
    "EP02": [
        ("P4-Red-key", "production/EP02/references/P4-Red-key-v1.png"),
        ("P6-Wren-cup", "production/EP02/references/P6-Wren-cup-v1.png"),
        ("P1-Vivienne-handbag", "production/EP01/references/P1-Vivienne-handbag-v1.png"),
        ("M3-kiosk-street", "production/EP01/masters/M3-kiosk-dawn-v3.png"),
        ("A8-arch-kiosk", "production/EP01/references/A8-Arch-kiosk-empty-v3.png"),
        ("2-15-street-v3", "production/EP02/frames/2-15-v3-flow.jpg"),
        ("EP01-1-28-car", "production/EP01/kling/start-frames/1-28.jpg"),
        ("2-15-street-v4", "production/EP02/frames/2-15-v4-flow.jpg"),
    ],
    "EP04": [
        ("M12", "production/EP04/masters/M12-workshop-predawn-v3.png"),
        ("M13", "production/EP04/masters/M13-landing-v4.png"),
        ("M14", "production/EP04/masters/M14-workshop-later-v2.png"),
        ("A12", "production/EP04/references/A12-flat-landing-day-v2.png"),
        ("C2-Surveyor", "production/EP04/references/C2-Surveyor-v1.png"),
        ("P12-Wren-door-key", "production/EP04/references/P12-Wren-door-key-v1.png"),
        ("P13-Surveyor-tape", "production/EP04/references/P13-Surveyor-tape-v1.png"),
        ("Deck", "production/EP01/references/Deck-option-D.png"),
    ],
}
adir = os.path.join(HERE, "jobs", "assets"); os.makedirs(adir, exist_ok=True)
assets = []
for ep, items in ASSETS.items():
    for name, rel in items:
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print("asset missing:", rel); continue
        fname = name + os.path.splitext(rel)[1].lower()
        shutil.copy2(src, os.path.join(adir, fname))
        assets.append({"id": name, "episode": ep, "type": "upload", "title": "upload " + os.path.basename(rel), "name": fname, "file": f"assets/{fname}", "source": rel})
json.dump(assets, open(os.path.join(HERE, "jobs", "assets.json"), "w"), indent=1)
print(f"{len(assets)} assets written")

# Image jobs: one per frame in each episode's shot-plan Frames table (id | sec | master | description | dialogue).
# The prompt is a DRAFT built from the description; the creator edits or approves it in the popup before running.
CAST_NAMES = ["Jonah", "Wren", "Nora", "Vivienne", "Pryce", "Customer", "Bibi"]
REF_NAMES = {"Deck": "Deck", "Surveyor": "C2-Surveyor", "P12": "P12-Wren-door-key", "P13": "P13-Surveyor-tape"}
images = []
for ep, _ in EPISODES:
    plan = os.path.join(ROOT, "production", ep, f"{ep}-SHOT-PLAN.md")
    if not os.path.exists(plan): continue
    doc = open(plan).read()
    sec = re.search(r"\n## Frames\s*\n(.*?)(?=\n## |\Z)", doc, re.S)
    if not sec: continue
    for m in re.finditer(r"^\| (\d+-\d+[a-z]?) \| (\d+) \| (\S+) \| (.+?) \| (.+?) \|$", sec.group(1), re.M):
        fid, _sec, master, desc, line = m.groups()
        ingredients = [master]
        ingredients += [n for n in CAST_NAMES if re.search(r"\b" + n + r"\b", desc) or line.upper().startswith(n.upper() + ":")]
        ingredients += [v for k, v in REF_NAMES.items() if re.search(r"\b" + k + r"\b", desc) and v not in ingredients]
        prompt = (f"Film still, 16:9, photoreal, same set, light and costumes as the master image. {desc.rstrip('.')}. "
                  f"Natural skin texture, no text, no subtitles, no watermark.")
        has_file = os.path.exists(os.path.join(ROOT, "production", ep, "kling", "start-frames", fid + ".jpg"))
        fixes_path = os.path.join(ROOT, "production", ep, "flow-fixes.json")
        fixes = json.load(open(fixes_path)) if os.path.exists(fixes_path) else {}
        fx = fixes.get("frame " + fid) or {}
        img = {"id": fid, "episode": ep, "type": "image", "title": desc[:60], "aspect": "16:9", "ingredients": ingredients, "hasFile": has_file,
               "prompt": prompt, "line": line, "output": f"LOCKED-OUT/{ep}/flow-frames/{fid}"}
        if fx.get("prompt"): img["fixPrompt"] = fx["prompt"].strip()
        if fx.get("alt"): img["altPrompt"] = fx["alt"].strip()
        if fx.get("ingredients"): img["ingredients"] = list(fx["ingredients"])
        images.append(img)
# Extra image jobs that are not shot-plan frames (thumbnails, posters): flow-fixes.json keys "image <id>" with
# "prompt", "ingredients" and "aspect" ("16:9" or "9:16"). Same runner, same 0-credit image model.
for ep, _ in EPISODES:
    fixes_path = os.path.join(ROOT, "production", ep, "flow-fixes.json")
    fixes = json.load(open(fixes_path)) if os.path.exists(fixes_path) else {}
    for k, fx in fixes.items():
        if not k.startswith("image ") or not fx.get("prompt"): continue
        iid = k[len("image "):]
        images.append({"id": iid, "episode": ep, "type": "image", "title": fx.get("title", iid), "aspect": fx.get("aspect", "16:9"),
                       "ingredients": list(fx.get("ingredients", [])), "hasFile": False, "prompt": fx["prompt"].strip(),
                       "fixPrompt": fx["prompt"].strip(), "line": "none", "output": f"LOCKED-OUT/{ep}/flow-frames/{iid}"})
json.dump(images, open(os.path.join(HERE, "jobs", "images.json"), "w"), indent=1)
print(f"{len(images)} image jobs written (draft prompts)")
missing = [j["frame"] for j in out if not os.path.exists(os.path.join(HERE, "jobs", "frames", j["frame"]))]
print(f"{len(out)} clips written; missing frames: {missing or 'none'}")
