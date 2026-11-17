# LOCKED OUT Firefly runner

A Chrome extension that runs the LOCKED OUT Kling clips in Adobe Firefly for you. For each clip it:

1. selects **Video**, **Kling 3.0**, **16:9**, your resolution, the clip's **duration** (3 to 15 s), **Audio**, and turns **Multi-shot off**;
2. attaches the clip's approved **start frame** as the First frame;
3. types the clip's **prompt** exactly as written in the Kling scripts;
4. clicks **Generate**;
5. waits until the new video appears in the Firefly feed with the same prompt;
6. downloads it to `Downloads/LOCKED-OUT/EP01/clips/1-29.mp4` (Episode 2 goes to `EP02/clips`), then moves on to the next clip.

It holds 68 clips: 41 for Episode 1 and 27 for Episode 2, in edit order, built from `production/EP01/EP01-KLING-ANIMATION-SCRIPT.md` and `production/EP02/EP02-KLING-ANIMATION-SCRIPT.md`.

## Install (once)

1. In Chrome open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this folder: `/Volumes/MAC/NEW DRAM/tools/firefly-kling-runner`.
4. Pin "LOCKED OUT Firefly Runner" from the puzzle-piece menu.
5. Reload any Firefly tab that was already open.

## Use

1. Open `https://firefly.adobe.com/video-generate` and keep that tab in front.
2. Click the extension icon.
3. Choose Resolution, Sound (all clips, or dialogue clips only) and the timeout.
4. Tick the clips (EP01, EP02, "Not downloaded" or one by one).
5. First time: press **Fill next clip only**. It fills the prompt bar for the first ticked clip and stops before Generate. Check it in Firefly.
6. Press **Generate & download** to run the ticked clips one after another. Chrome asks you to confirm because it uses your Firefly credits.
7. **Regenerate.** A downloaded clip is skipped by Generate & download. To make a new take, tick it and press **Regenerate ticked**, or open it in the clip panel and press **Regenerate this clip** (it sends the prompt shown in the box). The earlier take is kept; the new one saves as `2-04 (1).mp4`.
8. **Stop** finishes the current step and stops. A clip that is already generating keeps going in Firefly; press Generate & download again and the runner goes back to waiting for it instead of generating it twice.

Keep the Firefly tab open while it runs; it can be in the background. The status of every clip and a log show in the popup.

## Good to know

- **Elements are not bound.** Firefly's Elements picker is not automated yet. Faces come from the start frame and the prompt.
- **Takes are kept.** A second take of a clip saves as `1-29 (1).mp4`, never over the first.
- **Failures don't stop the run.** If Firefly rejects a clip or it times out, it is marked failed and the runner moves on. A problem filling the prompt bar stops the run so nothing is generated with wrong settings.
- **If Firefly changes its page**, the runner stops with an error naming the control it could not find (for example "duration slider not found").
- **Updating clips:** after a prompt or frame changes, rebuild `jobs/jobs.json` and `jobs/frames/` from the Kling scripts, then press the reload arrow on the extension in `chrome://extensions`.
- **Moving the videos into the project:** they land in `~/Downloads/LOCKED-OUT/`. To copy them next to the frames:

```bash
rsync -av ~/Downloads/LOCKED-OUT/EP01/clips/ "/Volumes/MAC/NEW DRAM/production/EP01/clips/"
```


## Images: text to image and image to image (added 17 November 2026)

The same extension now makes still images on Firefly's image page, one prompt bar for both.

- **What it does for each image job:** switches the bar to **Image**, picks the job's model, aspect ratio and resolution, attaches its reference pictures (up to 16; none means text to image), types the prompt, presses Generate, waits for that image in Firefly's results by the start of its prompt, and downloads it straight away under the job's name: `Downloads/LOCKED-OUT/<episode>/firefly-images/<id>.png`.
- **Speed:** about 20 to 40 seconds per image, and several run at once. Two jobs whose prompts begin the same way never run at the same time, so results cannot be swapped.
- **Cost guard:** by default it only runs on models your plan shows as **Unlimited access**, and stops with a note otherwise. GPT Image 2.6 Flare showed Unlimited access on 17 November 2026.
- **Models** (name as Firefly shows it, or its id): Firefly Image 5, Firefly Image 4, GPT Image 2, GPT Image 2.5 Flare, GPT Image 2.5 Sunburst, GPT Image 2.6 Flare, GPT Image 2.6 Sunburst, Gemini Nano Banana 2.1, Gemini 3.1 (Nano Banana 2), Gemini 3.0 (Nano Banana Pro), HUMAIN Image 1, Flux 3 Image. Aspect: 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16, 9:21, Auto. Resolution: 1K, 2K, 4K.

**Adding image jobs.** List them in `image-jobs.json` in this folder, or in `production/EPxx/firefly-images.json` for an episode:

```json
[
  {"id": "4-09-car", "episode": "EP04", "title": "4-09 with the Episode 1 car",
   "prompt": "Edit Image 1. Keep everything ... Change only one thing: ...",
   "refs": ["production/EP04/kling/start-frames/4-09.jpg", "production/EP01/kling/start-frames/1-28.jpg"],
   "model": "GPT Image 2.6 Flare", "aspect": "16:9", "resolution": "2K"}
]
```

`refs` are paths under the movie folder (or full paths). Then run `build_jobs.py`, reload the extension, press **Images** in the popup to tick them, and **Generate & download**. Use **Fill next clip only** first to see one filled in without generating.

Tested 17 November 2026: a text-to-image test (about 30 s from start to saved file) and an image-to-image edit of EP04 4-09 (the old limousine replaced by Episode 1's modern saloon, everything else kept, 2560x1440, about 40 s).
