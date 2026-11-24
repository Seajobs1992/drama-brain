#!/usr/bin/env python3
"""Build jobs/jobs.json and jobs/files/ for the Pollo runner from a movie folder.

    python3 build_jobs.py "<movie folder>"

Reads every job list it finds, in this order:
    <movie>/pollo-jobs.json
    <movie>/production/<EPxx>/pollo-jobs.json   (EP01, EP02 ... in order)

Each job (a JSON list of these):
  Picture (GPT Image 2):
    {"id": "K1-01", "episode": "EP01", "type": "image",
     "prompt": "Edit Image 1. Keep ... Change only ...",
     "refs": ["production/EP01/frames/K1-01.jpg", "cast/cole.jpg"],      # optional, up to 16; order = Image 1, Image 2 ...
     "aspect": "9:16", "resolution": "2K", "quality": "Medium"}           # optional, these are the defaults
  Clip (MiniMax H3, 5 s, 768p):
    {"id": "1-04", "episode": "EP01", "type": "video", "mode": "frames",   # mode is required for clips
     "prompt": "...",
     "frame": "production/EP01/frames/K1-04.jpg",                        # start frame (Text/Image to Video)
     "end": "production/EP01/frames/K1-04e.jpg"}                          # optional end frame
    or reference mode (pictures attached with @, like Flow):
    {"id": "1-05", "episode": "EP01", "type": "video", "mode": "reference",
     "prompt": "...", "refs": ["production/EP01/frames/K1-05.jpg"], "aspect": "9:16"}

Paths are under the movie folder (or absolute). Results save to
    Downloads/<movie folder name>/<episode>/pollo/<id>.<png|jpg|mp4>   (+ <id>.json with Pollo's task ids)

Free only: the builder refuses settings that cost credits on the Unlimited plan (4K, High quality, clips that are
not 5 s at 768p). The extension checks again on the page and never presses Generate unless Pollo shows "Unlimited".
"""
import datetime, glob, hashlib, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 2:
    sys.exit('Run:  python3 build_jobs.py "<movie folder>"')
ROOT = os.path.abspath(os.path.expanduser(sys.argv[1]))
if not os.path.isdir(ROOT):
    sys.exit(f"No such folder: {ROOT}")
MOVIE = os.path.basename(ROOT.rstrip("/"))

FREE = {
    "image": {"models": ["GPT Image 2"], "resolution": ["1K", "2K"], "quality": ["Low", "Medium"]},
    "video": {"models": ["MiniMax H3"], "resolution": ["768p"], "seconds": [5]},
}
ASPECTS = {"image": ["1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "21:9", "4:5", "5:4", "Auto"],
           "video": ["Auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]}

def sources():
    srcs = [os.path.join(ROOT, "pollo-jobs.json")]
    srcs += sorted(glob.glob(os.path.join(ROOT, "production", "*", "pollo-jobs.json")))
    return [s for s in srcs if os.path.isfile(s)]

def safe(s):
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(s)).strip("-") or "x"

files_dir = os.path.join(HERE, "jobs", "files")
if os.path.isdir(files_dir):
    shutil.rmtree(files_dir)
os.makedirs(files_dir, exist_ok=True)

def take(job, role, n, path):
    """Copy one picture into jobs/files and give it a unique upload name (content hash), so Pollo's library
    can reuse an earlier upload of the same picture and never confuses two versions."""
    src = path if os.path.isabs(path) else os.path.join(ROOT, path)
    if not os.path.isfile(src):
        raise ValueError(f"{role} not found: {path}")
    ext = os.path.splitext(src)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise ValueError(f"{role} must be jpg, png or webp: {path}")
    digest = hashlib.sha1(open(src, "rb").read()).hexdigest()[:8]
    ep = safe(job["episode"])
    rel = f"{ep}/{safe(job['id'])}-{role}{n}{ext}"
    os.makedirs(os.path.join(files_dir, ep), exist_ok=True)
    shutil.copy2(src, os.path.join(files_dir, rel))
    # Pollo cuts upload names to 25 characters before the extension, so the name is the hash plus a short stem.
    stem = safe(os.path.splitext(os.path.basename(src))[0])[:16]
    return {"path": rel, "name": f"{digest}-{stem}{ext}"}

out, problems, seen = [], [], set()
for src in sources():
    try:
        items = json.load(open(src))
    except Exception as e:
        problems.append(f"{src}: not valid JSON ({e})")
        continue
    for it in items:
        try:
            jid, ep = it.get("id"), it.get("episode") or "IMAGES"
            if not jid or not it.get("prompt"):
                raise ValueError("needs an id and a prompt")
            key = f"{ep}/{jid}"
            if key in seen:
                raise ValueError("id used twice")
            seen.add(key)
            kind = it.get("type") or ("video" if it.get("frame") else "image")
            if kind not in FREE:
                raise ValueError(f'type must be "image" or "video", not {kind!r}')
            free = FREE[kind]
            job = {"id": jid, "episode": ep, "type": kind, "title": it.get("title") or it["prompt"][:60],
                   "prompt": " ".join(it["prompt"].split()), "model": it.get("model") or free["models"][0]}
            if job["model"] not in free["models"]:
                raise ValueError(f"model {job['model']!r} is not on the free list {free['models']}")
            if kind == "image":
                job["aspect"] = it.get("aspect") or "9:16"
                job["resolution"] = it.get("resolution") or "2K"
                job["quality"] = it.get("quality") or "Medium"
                if job["resolution"] not in free["resolution"]:
                    raise ValueError(f"resolution {job['resolution']} costs credits (free: {free['resolution']})")
                if job["quality"] not in free["quality"]:
                    raise ValueError(f"quality {job['quality']} costs credits (free: {free['quality']})")
                refs = it.get("refs") or []
                if len(refs) > 16:
                    raise ValueError("Pollo takes at most 16 reference pictures")
                job["refs"] = [take(job, "ref", i + 1, r) for i, r in enumerate(refs)]
            else:
                # The mode changes the result (frames = exact first/last picture; reference = pictures as loose
                # references via @), so every clip must name it. No guessing.
                job["mode"] = it.get("mode")
                if job["mode"] not in ("frames", "reference"):
                    raise ValueError('clips need "mode": "frames" (Start/End frame, Image to Video) or "reference" (Reference to Video, pictures with @)')
                job["aspect"] = it.get("aspect") or "9:16"
                job["resolution"] = it.get("resolution") or "768p"
                job["seconds"] = int(it.get("seconds") or 5)
                if job["resolution"] not in free["resolution"] or job["seconds"] not in free["seconds"]:
                    raise ValueError(f"{job['seconds']} s at {job['resolution']} costs credits (free: 5 s at 768p)")
                if job["mode"] == "frames":
                    if not it.get("frame"):
                        raise ValueError('mode "frames" needs a "frame" (start frame)')
                    job["frame"] = take(job, "start", "", it["frame"])
                    job["end"] = take(job, "end", "", it["end"]) if it.get("end") else None
                    job["refs"] = []
                elif job["mode"] == "reference":
                    refs = it.get("refs") or []
                    if not refs:
                        raise ValueError('mode "reference" needs "refs"')
                    job["refs"] = [take(job, "ref", i + 1, r) for i, r in enumerate(refs)]
                    job["frame"] = job["end"] = None
                else:
                    raise ValueError('mode must be "frames" or "reference"')
            if job["aspect"] not in ASPECTS[kind]:
                raise ValueError(f"aspect {job['aspect']} not offered ({ASPECTS[kind]})")
            job["output"] = f"{safe(MOVIE)}/{safe(ep)}/pollo/{safe(jid)}"
            out.append(job)
        except ValueError as e:
            problems.append(f"{os.path.relpath(src, ROOT)} {it.get('id', '?')}: {e}")

data = {"movie": MOVIE, "outRoot": safe(MOVIE), "built": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "jobs": out}
json.dump(data, open(os.path.join(HERE, "jobs", "jobs.json"), "w"), indent=1)
n_img = sum(1 for j in out if j["type"] == "image")
print(f"{len(out)} jobs written ({n_img} pictures, {len(out) - n_img} clips) from {len(sources())} file(s) in {MOVIE}.")
if problems:
    print("SKIPPED (fix and run again):")
    for p in problems:
        print("  - " + p)
print("Now press the reload arrow on Pollo Runner in chrome://extensions, then reload the Pollo tab.")
