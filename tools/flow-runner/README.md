# LOCKED OUT Flow runner

Short version. The complete guide, including file formats for a new episode or series and the rejected-prompt loop, is **GUIDE.md**.

A Chrome extension that runs the LOCKED OUT clips in Google Flow, the same way the Firefly/Kling runner does. For each ticked clip it:

1. clears Flow's prompt box and sets **Video**, **Ingredients**, **16:9**, the chosen model, **720p**, the clip's **length** from the script (3 to 15 s on Omni) and **x1** (one take);
2. reads Flow's price and skips the clip if it is above "Max credits a clip";
3. pastes the clip's approved start frame into the prompt box, where Flow makes it an **Ingredient**;
4. types the clip's prompt exactly as in the episode script;
5. presses **Start generation**, keeping up to "At once" clips generating;
6. when a clip is finished, opens its menu and asks for **Download → 1080p Upscaled** (free; never the paid 4K). Flow makes the upscale and downloads it, and the extension saves it as `LOCKED-OUT/EP04/flow-clips/4-02.mp4`. Downloads go one at a time so each file gets the right name.

Clips go to `flow-clips/`, apart from the Kling takes in `clips/`. `../firefly-kling-runner/move_clips.sh` moves them into `production/EP04/flow-clips/`.

## Install (once)

1. In the Chrome you use for Flow, open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** → `/Volumes/MAC/NEW DRAM/tools/flow-runner`.
3. Pin "LOCKED OUT Flow Runner". Reload any open Flow tab.

## Use

Open your LOCKED OUT project in Flow (`flow.google.com/project/...`), keep that tab in front, click the extension. The top line says which project it sees. Pick the **Episode**, then go through the steps left to right; each step explains itself, has its own tick buttons and its own run button.

1. **Characters**: tick the cast, "Create ticked characters". Once per Flow project, free.
2. **Uploads** (only if you will make frames in Flow): tick the masters and props, "Upload ticked". Free.
3. **Frames** (optional): tick frames, read and edit the draft prompt in the panel, "Make ticked frames". 0 credits.
4. **Clips**: tick clips (one first), look at the panel (start frame, characters and voices, cost, file name), "Animate ticked clips". "Fill in Flow, don't generate" shows the clip in Flow's prompt box without spending anything.

The **Log** tab shows what happened; **Settings** holds the model, the start-frame choice and the limits, each with a line saying what it does. Don't make other videos or images in the project while it runs: it matches finished items to jobs by their order.

## Rebuild the clip list

After a script or frame changes: `python3 "/Volumes/MAC/NEW DRAM/tools/flow-runner/build_jobs.py"`, then reload the extension.

## Characters and voices

Flow cannot take the ElevenLabs voices; it has about 30 voices of its own. So each LOCKED OUT character exists in the Flow project as a **Flow character**: the approved reference picture, the name, and a Flow voice. When a clip is filled, its cast (the "Bind:" line in the episode script) is attached next to the start frame, so Flow knows who is speaking and uses that character's voice. The written voice tags in the prompt are dropped for those clips, so the prompt does not fight the voice.

| Character | Picture | Flow voice |
|---|---|---|
| Jonah | EP01 `I1-Jonah-portrait-v6.jpg` | Schedar (male, even, mid-low) |
| Wren | EP01 `Wren-option-A.jpg` | Leda (female, youthful, mid-high) |
| Nora | EP03 `Nora.jpg` | Kore (female, firm, mid) |
| Vivienne | EP01 `Vivienne-option-D.jpg` | Gacrux (female, mature, mid) |
| Pryce | EP01 `Pryce-option-B.jpg` | Umbriel (male, smooth, lower) |
| Customer | EP01 `C1-Customer-v1.jpg` | Zubenelgenubi (suggested, not yet confirmed) |
| Bibi | EP03 `Bibi.jpg` | not chosen yet |

The list lives in `build_jobs.py` (`CAST`); change a voice there and rebuild.

**In the popup → Characters:** tick the cast and press **Create ticked in this project**. It is free. Keep the Flow tab in front while it runs: Flow only saves a character's name on a real Enter key, which the extension sends through Chrome's debugging channel (Chrome shows a "started debugging this browser" bar for a moment), and those keystrokes only land in the tab that is showing. **Check project** lists the characters the open project already has. Characters belong to one Flow project, so a new project needs them created again.

The tick **Attach each clip's cast as characters** is on by default. Untick it to run with the start frame only (the prompt then keeps its written voice tags).

Made this way on 16 November 2026 in the project "Nov 16 - 18:55": Jonah, Wren, Nora, Vivienne, Pryce.

## Uploads, frames made in Flow, and reuse by name

Everything in a Flow project has a name, and the extension picks things by name instead of uploading them again.

- **Clip start frames** are uploaded once as `EP04-4-02.jpg` and reused from the project after that (16 November 2026: the second fill of a clip found its frame already there).
- **Uploads** (the popup's "uploads" tick buttons): the selected masters, references and props of an episode go into the project by name (`M12.png`, `C2-Surveyor.png`, …). The list is `ASSETS` in `build_jobs.py`, taken from each episode's GENERATION-LOG. Only EP04 is listed so far.
- **Frames made in Flow** (the "frames" tick buttons): one image job per frame in the episode's shot plan, 0 credits. Each job names its ingredients (the master, the characters, props) and carries a DRAFT prompt built from the shot plan's description: edit it in the clip panel before running. The finished image is renamed to the frame id (`4-02`) in Flow and, by default, downloaded to `LOCKED-OUT/EP04/flow-frames/4-02.png`.
- **Clip start frame** setting: "approved file" (the frame in `kling/start-frames`) or "Flow-made image of the same id" (the `4-02` image made in Flow, if it exists; else the file).
- **Start and end frame**: a clip with an `endFrame` runs in Flow's Frames mode (no cast in that mode; the prompt keeps its voice tags). No clip has one yet.

**Why the tab must stay in front.** Flow starts an image only from a genuine mouse click on Start (a scripted click does nothing; a video starts either way), and saves a character's name only on a genuine Enter. The extension sends both through Chrome's debugging channel, which only reaches the tab that is showing. So while it runs, leave the Flow tab in front; Chrome's "started debugging this browser" bar comes and goes with each click.

**Characters from a description.** A cast entry with `describe:` instead of a picture (in `CAST`, `build_jobs.py`) is made from Flow's "Describe your character" box: Flow draws the portrait (about 20 s, 0 credits) and opens the character page, where the name and voice go on as usual. Tested 16 November 2026 with a throwaway description, then trashed. Every LOCKED OUT character so far has an approved picture, so no entry uses it yet.

## Tested on 16 November 2026 (all free except the one clip)

- Clip 4-02 generated, 1080p upscale downloaded under its name (9 credits).
- Characters Jonah, Wren, Nora, Vivienne, Pryce created with voices.
- M12 uploaded by name; the 4-02 frame image made in Flow from M12 + Nora (0 credits), renamed to `4-02`; a clip fill then picked that Flow-made frame when the setting asked for it.
- A clip's start frame reused on its second fill.
- Not yet run through the popup itself: a batch of several items at once, image downloads, and the Frames mode (start + end frame).

## Not built yet

- Customer's and Bibi's voices (the creator's choice).
