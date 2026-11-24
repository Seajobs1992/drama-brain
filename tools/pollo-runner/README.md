# Pollo runner

**What it is for (creator, 24 Nov 2026):** an extra, free path for **MiniMax H3** clips and **GPT Image 2** pictures on the browser account's Unlimited plan. It does **not** replace Wan 3.0: Wan stays on the Pollo MCP as before. The runner never chooses Wan or any paid setting.

A Chrome extension that runs a movie's pictures and clips on the Pollo.ai website, on the plan's free **Unlimited** settings, instead of paid MCP credits. For each job it:

1. opens Pollo's image or video page and picks the mode, the model and the **Unlimited** switch;
2. sets the settings (9:16, 2K, Medium for pictures; 5 s, 768p for clips; always 1 output);
3. uploads the job's pictures into Pollo's library once (named by a content hash, so a picture is never uploaded twice) and attaches them: references as **Image 1, Image 2 …** (they appear in the prompt as @ chips), or the **Start** and **End** frame of a clip;
4. types the prompt;
5. checks the bar: price must read **Unlimited**, the model and settings must match, the picture count must match. Anything off stops the run before Generate;
6. presses Generate once, records Pollo's task id, and checks right away that the task was charged 0 credits (if not, the run stops);
7. waits, then saves the result into the output folder chosen for the movie: `<folder>/<episode>/<id>.png|mp4`, plus `<id>.json` with the task ids, prompt, settings and credit (0).

## What is free (checked live on 24 Nov 2026, Ultra plan)

| | Free (Unlimited) | Costs credits |
|---|---|---|
| **GPT Image 2** (pictures) | 1K or 2K, Low or Medium, any ratio, up to 16 reference pictures | 4K, High |
| **MiniMax H3** (clips) | 5 s at 768p, start frame, end frame or reference pictures. Sound comes on by itself (no switch) | longer than 5 s, 2K, 480p is not marked free |

Pollo marks free choices with an "unlimited" badge and the price next to Generate reads **Unlimited**. The runner relies on that label, so if Pollo ends the offer the runner stops instead of spending. MiniMax H3 Max is also marked Unlimited but is not set up in the runner.

Unlimited jobs wait in a slower shared queue: a test picture took about 2 minutes, a 5 s clip about 3 minutes (24 Nov 2026, afternoon).

**Risk:** Pollo's Terms and Conditions (Prohibited Conduct) forbid using "any automated system, including bots" on the site, and Pollo may suspend an account "for any reason". The runner is paced (one job at a time, a pause between jobs) but that does not make it allowed. The creator chose to accept this on 24 Nov 2026 for the browser account (a different account from the MCP one).

## Install (once)

1. Chrome: open `chrome://extensions`, turn on **Developer mode**, **Load unpacked**, choose this folder (`/Volumes/MAC/NEW DRAM/tools/pollo-runner`; on another computer `~/drama-brain/tools/pollo-runner`).
2. Pin **Pollo Runner** from the puzzle-piece menu.
3. Sign in to pollo.ai in that Chrome (the creator signs in; the runner never touches sign-in).

## Make the job list

Jobs come from the movie folder and are never synced. Put a `pollo-jobs.json` in `production/EPxx/` (or one at the movie's top level):

```json
[
 {"id": "K1-01", "episode": "EP01", "type": "image",
  "prompt": "Edit Image 1. Keep everything. Change only one thing: ...",
  "refs": ["production/EP01/frames/master.png", "production/cast/cole.png"]},

 {"id": "1-04", "episode": "EP01", "type": "video", "mode": "frames",
  "prompt": "Slow push in. He looks up. Quiet lobby tone, no music.",
  "frame": "production/EP01/frames/K1-04.png",
  "end": "production/EP01/frames/K1-04e.png"},

 {"id": "1-05", "episode": "EP01", "type": "video", "mode": "reference",
  "prompt": "Image 1 is the scene. He says: ...",
  "refs": ["production/EP01/frames/K1-05.png"]}
]
```

- Pictures: `aspect` (default 9:16), `resolution` 1K or 2K (default 2K), `quality` Low or Medium (default Medium).
- Clips must name their **mode**, because it changes what Pollo makes:
  - `"mode": "frames"`: **Text/Image to Video**. `frame` is the exact first picture of the clip, `end` (optional) the exact last picture. Use it when the clip must start (and end) on an approved keyframe: walks, prop landings, a held composition. Pollo takes the ratio from the start frame.
  - `"mode": "reference"`: **Reference to Video**. `refs` (pictures) are attached as references, not as the first picture. Set `aspect` (default 9:16). Use it for dialogue and for people or places the model must keep but may re-frame.
    In this mode Pollo names each @ chip by the picture's file name, not "Image 1". So the runner puts the @ chip of picture N exactly where the prompt says **Image N** (or **@N**), like typing @ in Flow. A picture the prompt never names is put at the start, in order. Write each picture's role next to its name: "Image 1 is the lobby. Image 2 is Cole's face."
  - Always 5 s, 768p.
- Prompts go in as one line. Write "Image 1", "Image 2" in the order of `refs`. Any other "@" in a prompt is typed as "at".
- Pictures (GPT Image 2) attach as chips labelled "Image 1", "Image 2" at the start of the prompt, which match the words in the prompt.
- The runner checks the mode before sending: no Start/End frame in Reference mode, no reference pictures in Frames mode, and the exact number of frames, references and @ chips.
- The builder refuses anything that would cost credits.

Then build and reload:

```bash
cd "/Volumes/MAC/NEW DRAM/tools/pollo-runner" && python3 build_jobs.py "<movie folder>"
```

Press the reload arrow on Pollo Runner in `chrome://extensions`, then reload the Pollo tab. The popup's footer shows how many jobs it has and when they were built.

## Output folder (asked before the first run of each movie)

Chrome extensions can only save inside Chrome's own download folder, so the runner has a **Saver** tab (pinned).
- Press **Folder…** in the popup (or just press **Run ticked**: if no folder is set, the Saver tab opens). Press **Choose folder…** and pick the folder in the macOS window, for example the movie's `production` folder.
- The folder is remembered **per movie** (the movie named in the job list). A new movie asks again.
- Files go to `<folder>/<episode>/<job id>.png|mp4`, each with `<job id>.json` (task id, record, prompt, settings, credit). An existing file is never overwritten: a new take is `1-04 (1).mp4`.
- After Chrome restarts it asks for your OK again: the Saver tab shows **Allow access**.
- Keep the Saver tab open during a run. If it is closed, results still save, but into Chrome's download folder, and the log says so.

## Run

1. Open `https://pollo.ai/image` (signed in) and keep that tab open. It can be in the background, but keep the Chrome window visible (a covered window can stall timers, as with Firefly).
2. Click the extension icon. Tick jobs (**Not saved**, **Images**, **Videos** or one by one).
3. First time on a new movie: **Fill next only**. It fills the first ticked job and stops before Generate. Look at the bar in Pollo.
4. **Run ticked**: sends the ticked jobs one after another and saves each result. Settings: **At once** 1 to 6 (default 1; Pollo's Ultra limit is 6 tasks at once), **Pause between jobs** 0 to 120 s (default 30 s), **Give up after** 10 to 120 min (default 40 min). They can be changed during a run and apply within a few seconds. The pause and a low At once are only caution about Pollo's ban on bots; Pollo itself does not need them (the runner always waits for Pollo to confirm each send).
5. **Stop** stops after the current step. Jobs already sent keep generating; press **Run ticked** again to collect them (they are never sent twice).
6. **Redo ticked** clears the status of ticked jobs so Run sends them again (a new take saves as `<id> (1).png`; nothing is overwritten). Only for a fault the edit cannot hide.

Every step, the task ids and errors show in the popup log and on a small banner in the Pollo tab.

## Good to know

- **Right picture, right place (1.4.0):** before sending, the runner downloads every picture attached in Pollo again and compares its bytes (SHA-1) with the job's own file, in order: Image 1, Image 2 … or start frame, end frame. Then each @ chip in the prompt must point at the right picture. Any difference and the job is not sent. Pollo keeps the exact bytes of an upload, so this is exact. Tested 24 Nov 2026: right order passed; swapped pictures, swapped start/end, a missing end frame and a chip in the wrong place were all refused.
- **Which result belongs to which job:** each job has its own id (`EP01/1-04`). When Generate is pressed the runner takes the task id from Pollo's own answer to that press, stores it with the job, and later asks Pollo about that task id only. Results are never matched by prompt or by position in a list, so several jobs generating at once, or other generations in the account, cannot be mixed up. Each saved file is named by the job id and its `.json` holds the task id and record number.
- **One tab runs the jobs:** a run belongs to the Pollo tab it was started in. Another open Pollo tab stays out of it, so nothing is sent twice.
- **Free-only guard, three times:** the builder refuses paid settings; the page check refuses to press Generate unless the price reads Unlimited and the bar matches; after sending, the task's own record must say 0 credits, or the run stops.
- **Failures are not retried.** A refused or failed job is marked failed with Pollo's message and the run moves on.
- **If Pollo changes its page**, the run stops with a message naming what it could not find. The page code is all in `page.js` (labels mapped 24 Nov 2026: `prompt-generate-btn`, `chat-child-category-select`, `chat-footer-fields`, `upload-card-asset-picker`, `credit-cost-value`, `unlimited-badge`).
- **@ pictures without focus (1.3.0):** Pollo's @ list only opens while the Pollo page has focus, so a run started from the popup could not place them (first Chrome run, 24 Nov 2026: "Pollo's @ list did not offer …"). `hook.js` now copies the picture chips Pollo adds when pictures are chosen and puts each where the prompt says Image N, through Pollo's own editor. Pollo records the same prompt as typing @ by hand (checked, 0 credits).
- **A job only filled** ("filled, not sent") is sent on **Run ticked**; Fill next only skips saved and failed jobs and says so.
- **Model list:** the runner opens only the list the model button itself names (`aria-controls`): a sheet in a narrow window, a drop-down in a wide one. Never the model gallery lower on the page (a card there opens a model page). Fixed in 1.2.1 after the first Chrome run stopped with "The model list did not open".
- **Pollo's settings panel** sometimes measures 0 x 0 while it shows; the runner judges dialogs by their contents. A stray open list is closed with Escape first.
- **Upload names:** Pollo keeps only the first 25 characters of a file name, so the builder names each picture `<hash8>-<short name>`.
- **No folders starting with "_" in this folder** (for example `__pycache__` from a Python check): Chrome then refuses to load the extension. Delete them.
- **Keep the Chrome window wide.** In a narrow window Pollo hides the price label; the runner then refuses to send ("price shows "", not Unlimited"), which is safe but stops the run.
- **Files:** `saver.html/js` (the Saver tab: output folder per movie, writes the files), `hook.js` (inside the page: passes on Pollo's submit answer, and places @ picture chips through Pollo's editor; sends nothing itself), `page.js` (everything on the page), `runner.js` (the loop), `background.js` (job files and downloads), `popup.*`, `build_jobs.py`. The `jobs` folder is built per computer and not synced.

## Tested

24 Nov 2026, in the signed-in Pollo account, credits unchanged (33,691):
- GPT Image 2, 2 references, 9:16 2K Medium: filled, sent, saved 1440x2560 PNG, 0 credits.
- MiniMax H3 from a start frame, 5 s 768p: filled, sent, saved 768x1344 MP4 with sound, 5.2 s, 0 credits.
- The run loop ran both unattended (one picture, then one clip): picture saved 45 s after sending, clip 3 min. Both 0 credits.
- Both clip modes, 24 Nov 2026 16:00, 0 credits each:
  - **Frames, Start + End** (T-frames): start = the drawing, end = the real pear (checked by file size in the slots). The clip opens on the drawing and lands on the real pear. Saved under a minute after sending.
  - **Reference to Video, 2 pictures** (T-ref): Pollo recorded the prompt as `[@pear] [@pear-real] is the kitchen counter … lifts the pear from [@pear-real] …`. The clip keeps the counter scene of Image 1 and a right hand enters from the right and lifts the pear, as written.
  - Found and fixed: when the page is already on Pollo's "create" view, Generate does not change the address, so the runner missed the task id (the job still ran). Since 1.2.0, `hook.js` passes on Pollo's own submit answer (the record id) and the runner turns it into the task id. Tested: record 144307255 caught this way.
- **First full run in the creator's Chrome (1.3.0), 24 Nov 2026 16:31-16:39, unattended:** T-img (GPT Image 2, 2 refs, 1440x2560), T-frames (H3 start + end, 768x1344, 5.2 s, sound) and T-ref (H3 Reference, @ chips in place) all saved with their .json (task id, record, 0 credits). Balance 33,691 unchanged. Each about 1 minute from sending to saved. Saved in Chrome's download folder (the Saver tab came in 1.5.0 and had not been run in Chrome yet).
- **1.5.0 in the creator's Chrome, 24 Nov 2026 16:45-16:48:** T-ref with the Saver tab: "pictures checked byte for byte (2 picture(s), 3 @ in the prompt)", sent, saved into the chosen folder as `EP00/T-ref.mp4` + `T-ref.json` (task id, record 144316261, 0 credits). Clip correct.
- Note: on the flat cartoon test still, H3 drew faint moving streaks on the plain background in both test clips (model behaviour, not the runner). Check this on the first real film still. The extension's Chrome side (popup, downloads) was not yet run in the creator's Chrome at the time of writing.
