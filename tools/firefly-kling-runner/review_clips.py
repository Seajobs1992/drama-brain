#!/usr/bin/env python3
"""Check every clip of an episode against the clip list and its start frame.
Usage: review_clips.py EP02   -> writes production/EP02/clips/CLIPS-REVIEW.md and still strips for eyeballing.
Checks: missing clips, length vs script, sound track present, and whether the
first frame matches the approved start frame (catches crops and zooms)."""
import json, os, subprocess, sys, io
from PIL import Image, ImageChops, ImageStat
ROOT = "/Volumes/MAC/NEW DRAM"
ep = sys.argv[1] if len(sys.argv) > 1 else "EP02"
jobs = [j for j in json.load(open(f"{ROOT}/tools/firefly-kling-runner/jobs/jobs.json")) if j["episode"] == ep]
CL = f"{ROOT}/production/{ep}/clips"
STRIPS = f"{CL}/_review"
os.makedirs(STRIPS, exist_ok=True)

def probe(p, entries, stream=None):
    cmd = ["ffprobe", "-v", "error"] + (["-select_streams", stream] if stream else []) + ["-show_entries", entries, "-of", "csv=p=0", p]
    return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()

def first_frame(p):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    return Image.open(io.BytesIO(out)).convert("RGB")

def diff(a, b):
    a = a.convert("L").resize((96, 54)); b = b.convert("L").resize((96, 54))
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]

rows, problems = [], []
for j in jobs:
    cid = j["id"]
    takes = sorted(f for f in os.listdir(CL) if f.endswith(".mp4") and (f == f"{cid}.mp4" or f.startswith(f"{cid} take")))
    if not takes:
        rows.append(f"| {cid} | MISSING | | | | no video yet |")
        problems.append(f"- **{cid} ({j['title']})**: missing, no video downloaded.")
        continue
    start = Image.open(f"{ROOT}/production/{ep}/kling/start-frames/{cid.rstrip('abcdefg') if False else j['frame'].split('/')[1]}")
    for t in takes:
        p = f"{CL}/{t}"
        dur = float(probe(p, "format=duration") or 0)
        audio = probe(p, "stream=codec_name", "a") or "none"
        d = diff(first_frame(p), start)
        notes = []
        if abs(dur - j["seconds"]) > 1.1: notes.append(f"length {dur:.1f}s vs {j['seconds']}s planned")
        if audio == "none": notes.append("no sound track")
        if d > 6: notes.append(f"first frame differs from the start frame (score {d:.1f}): likely cropped, zoomed or wrong frame")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p, "-vf", "fps=1.5,scale=400:-1,tile=6x1", "-frames:v", "1", f"{STRIPS}/{t[:-4]}.jpg"])
        rows.append(f"| {cid} | {t} | {dur:.1f}s / {j['seconds']}s | {audio} | {d:.1f} | {'; '.join(notes) or 'ok'} |")
        if notes: problems.append(f"- **{cid} ({j['title']})**, {t}: {'; '.join(notes)}.")
md = [f"# LOCKED OUT {ep}: clip review", "", "Automatic checks: present, length, sound track, first frame against the approved start frame (score under 6 = same picture). Picture content (faces, hands, props, lip sync) is checked by eye separately; see the notes below the table.", "",
      "| Clip | File | Length | Sound | Frame score | Automatic result |", "|---|---|---|---|---|---|"] + rows + ["", "## Problems found automatically", ""] + (problems or ["None."]) + ["", "## Checked by eye", "", "(filled in after viewing the still strips in _review/)", ""]
open(f"{CL}/CLIPS-REVIEW.md", "w").write("\n".join(md) + "\n")
print("\n".join(problems) or "no automatic problems")
