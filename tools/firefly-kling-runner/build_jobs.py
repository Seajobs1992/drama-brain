#!/usr/bin/env python3
"""Rebuild jobs/jobs.json and jobs/frames/ from the Kling scripts.
Run from anywhere:  python3 "/Volumes/MAC/NEW DRAM/tools/firefly-kling-runner/build_jobs.py"
"""
import json, os, re, shutil
ROOT = "/Volumes/MAC/NEW DRAM"
HERE = os.path.dirname(os.path.abspath(__file__))
EPISODES = [("EP01", "production/EP01/EP01-KLING-ANIMATION-SCRIPT.md"), ("EP02", "production/EP02/EP02-KLING-ANIMATION-SCRIPT.md"), ("EP03", "production/EP03/EP03-KLING-ANIMATION-SCRIPT.md"), ("EP04", "production/EP04/EP04-KLING-ANIMATION-SCRIPT.md")]

out = []
for ep, rel in EPISODES:
    doc = open(os.path.join(ROOT, rel)).read()
    clips = re.split(r"\n## \d+\. (?:The c|C)lips", doc)[1].split("\n## ")[0]  # EP04 calls it "## 6. Clips"
    found = {}
    for m in re.finditer(r"^### (\S+)\. (.+?)\n(.*?)(?=^### |\Z)", clips, re.M | re.S):
        cid, title, body = m.group(1), m.group(2), m.group(3)
        h = re.search(r"Start `([^`]+)`\. (\d+) s\.(.*?)Audio (on|optional)", body, re.S)
        p = re.search(r"```\n(.*?)\n```", body, re.S)
        if not h or not p:
            print("skipped", ep, cid)
            continue
        found[cid] = {"id": cid, "episode": ep, "title": title.strip(), "frame": f"{ep}/{h.group(1)}",
                      "seconds": int(h.group(2)), "dialogue": h.group(4) == "on", "prompt": p.group(1).strip(),
                      "output": f"LOCKED-OUT/{ep}/clips/{cid}.mp4"}
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

# ---- image jobs (text to image, image to image) ----
# From image-jobs.json in this folder and from production/EPxx/firefly-images.json. Each entry:
#   {"id": "4-09-car", "episode": "EP04", "prompt": "...", "refs": ["production/EP01/kling/start-frames/1-28.jpg"],
#    "model": "GPT Image 2.6 Flare", "aspect": "16:9", "resolution": "2K", "quality": "Max", "title": "short label"}
# refs are paths under the movie folder (or absolute); none means text to image. model, aspect and resolution fall
# back to the extension's Settings. The result saves to Downloads/LOCKED-OUT/<episode>/firefly-images/<id>.<png|jpg>.
def image_sources():
    srcs = [os.path.join(HERE, "image-jobs.json")]
    for ep, _ in EPISODES:
        srcs.append(os.path.join(ROOT, "production", ep, "firefly-images.json"))
    for p in srcs:
        if os.path.exists(p):
            for item in json.load(open(p)):
                yield item
images, bad = [], []
for it in image_sources():
    if not it.get("id") or not it.get("prompt"):
        bad.append(str(it)[:60]); continue
    ep = it.get("episode", "IMAGES")
    refs = []
    for r in it.get("refs", []):
        src = r if os.path.isabs(r) else os.path.join(ROOT, r)
        if not os.path.exists(src):
            bad.append(f"{it['id']}: reference not found: {r}"); continue
        rel = f"refs/{ep}/{it['id']}-{len(refs) + 1}{os.path.splitext(src)[1].lower()}"
        os.makedirs(os.path.dirname(os.path.join(HERE, "jobs", "frames", rel)), exist_ok=True)
        shutil.copy2(src, os.path.join(HERE, "jobs", "frames", rel))
        refs.append(rel)
    images.append({"id": it["id"], "episode": ep, "type": "image", "title": it.get("title") or it["prompt"][:50], "prompt": it["prompt"].strip(),
                   "refs": refs, "model": it.get("model"), "aspect": it.get("aspect"), "resolution": it.get("resolution"), "quality": it.get("quality"),
                   "output": f"LOCKED-OUT/{ep}/firefly-images/{it['id']}.auto"})
out += images
print(f"{len(images)} image jobs" + (f"; skipped: {bad}" if bad else ""))
json.dump(out, open(os.path.join(HERE, "jobs", "jobs.json"), "w"), indent=1)
missing = [j["frame"] for j in out if j.get("type") != "image" and not os.path.exists(os.path.join(HERE, "jobs", "frames", j["frame"]))]
print(f"{len(out)} clips written; missing frames: {missing or 'none'}")
