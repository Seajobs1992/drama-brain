# LOCKED OUT Flow runner: the full guide

For the creator, and for any assistant (Claude, Codex or another LLM) asked to prepare or run a production with it. Everything an assistant needs to prepare a new episode or a new series is here, including the exact file formats the builder reads. Written 16 November 2026 against Google Flow as it looked that day.

## 1. What it is, in one paragraph

A Chrome extension that runs a whole episode inside Google Flow (flow.google.com) from one popup: it creates the **characters** (picture, name, Flow voice), **uploads** the scene masters and props, can make the **start frames** inside Flow, and **animates the clips** (start frame + characters + the exact scripted line), then downloads every result under the clip's own name. The creator presses the buttons; nothing is generated without a press. The assistant's job is to prepare the production files it reads and to fix prompts Flow refuses.

**Standing rules** (the creator's, not negotiable):
- One take of everything (x1). Another take only when asked.
- The creator picks casting and voices; an assistant proposes, never decides.
- Dialogue is the script's exact wording, never reworded.
- Credits are spent by the creator's click, never by an assistant from chat.

## 2. How it works

```
popup.html / popup.js      the window: steps, lists, settings, buttons
        │  chrome.storage (queue, settings, statuses, log …)
        ▼
bridge.js  (content script, isolated world on the Flow tab)
        │  runs the loop: fill → start → watch → rename → download, one job after another
        ▼
agent.js   (content script, MAIN world on the Flow tab)
           drives Flow's real controls by their labels: settings popover, prompt box,
           ingredient picker, Start/End frame pickers, tile menus, character page
background.js (service worker)
           serves jobs/*.json and pictures to the tab; names each download after its job;
           sends genuine clicks and keystrokes through chrome.debugger where Flow insists on them
```

**Why some things need a genuine click or key.** Flow starts an *image* only from a real mouse click on Start (a scripted click does nothing; a video starts either way), and saves a *character's name* only on a real Enter key. The background sends those through Chrome's debugging channel. They only reach the tab that is showing, so **the Flow tab must stay in front while the runner works**, and Chrome shows a short "started debugging this browser" bar each time.

**How a finished tile is matched to its job.** Flow lists the newest generation first. The runner tags each new tile with its job the moment it appears, remembers the order it submitted jobs of each kind, and after a rename finds a tile by its name. This holds only if nothing else is generated in that Flow project while it runs. **One Flow project per run; do not make other images or videos in it meanwhile.**

**Where the content comes from.** The popup never invents anything. `build_jobs.py` reads the production files and writes:

| File | Holds | Built from |
|---|---|---|
| `jobs/jobs.json` | the clips: id, title, prompt, prompt without voice tags, length, cast, dialogue flag, which clips already exist on disk | `production/EPxx/EPxx-KLING-ANIMATION-SCRIPT.md` + `production/EPxx/clips/`, `flow-clips/` |
| `jobs/images.json` | the frames to make in Flow: id, ingredients (master, characters, props), draft prompt, whether an approved file exists | the `## Frames` table of `production/EPxx/EPxx-SHOT-PLAN.md` |
| `jobs/assets.json` | masters, references and props to upload by name | the `ASSETS` table inside `build_jobs.py` |
| `jobs/cast.json` | characters: name, picture or description, Flow voice | the `CAST` table inside `build_jobs.py` |
| `jobs/frames/EPxx/*.jpg`, `jobs/cast/*.jpg`, `jobs/assets/*` | copies of the pictures, so the extension can read them | `production/EPxx/kling/start-frames/`, the cast pictures, the asset files |

After any change to those sources: run the builder, then reload the extension in `chrome://extensions`, then reload the Flow tab.

```bash
python3 "/Volumes/MAC/NEW DRAM/tools/flow-runner/build_jobs.py"
```

Job keys are `EP04/4-02` (clip), `EP04/img:4-02` (frame), `EP04/up:M12` (upload). Statuses, prompt edits, rejections and the log live in `chrome.storage.local` under `statuses`, `promptOverrides`, `rejections`, `useAlt`, `log`, `projectCasts` (characters known per Flow project id), `settings`.

## 3. Starting a fresh episode or a fresh movie

### 3.1 The folder

```
production/EP05/
  EP05-KLING-ANIMATION-SCRIPT.md     the clips (section 3.2)
  EP05-SHOT-PLAN.md                  the frames table (section 3.3), optional
  kling/start-frames/5-01.jpg …      the approved start frame of every clip (16:9)
  masters/, references/              scene masters, props, location pictures (for frames made in Flow)
  clips/                             where move_clips.sh puts clips from the Kling runner
  flow-clips/, flow-frames/          where move_clips.sh puts this runner's clips and frames
  flow-fixes.json                    prompts rewritten after Flow rejections (section 6), optional
```

Then in `build_jobs.py`: add the episode to `EPISODES` (`("EP05", "production/EP05/EP05-KLING-ANIMATION-SCRIPT.md")`), add new characters to `CAST`, add the episode's masters and props to `ASSETS`. For a **new series**, change `ROOT`, the two tables, the series name in `popup.html` (`.mark`) and `manifest.json`, and the `LOCKED-OUT/` prefix in the output paths of `build_jobs.py` and `move_clips.sh`.

### 3.2 The clip script format (what the builder parses)

The file is the episode's animation script, in Markdown. The builder needs these exact shapes; everything else in the file is free.

1. **Title line**: `# <Series>. Episode 4: What a Lock Tells You. <anything>` → the episode title.
2. **Voices table** under a heading starting `## N. Voices`: one row per speaking character, `| Jonah | low, quiet, even voice, short and exact, never raised |`. These tags are removed from a clip's prompt when the character is attached as a Flow character (its own voice speaks).
3. **Edit order table**: rows like `| 1 | 4-01 | 4-01.jpg | 3 | none | He lets her in |`. The second column fixes the running order; the third names the start frame file.
4. **Clips section** under a heading `## N. Clips` (or `## N. The clips`). Each clip:

```
### 4-02. You went in at eleven
Start `4-02.jpg`. 3 s. Bind: Nora. Audio on.
```
The woman in the navy trench coat says it flatly to the man in the foreground on the left. Static camera.

[Nora, the woman in the navy trench coat, plain, level, tired professional voice, unhurried, neither warm nor hard]: "You went in at eleven."

Sound: dialogue only. Only the woman speaks, a clean close voice. No music, no sound effects, no ambience, no background noise. No text or subtitles.
```
```

- `Start \`file\`.` the start frame in `kling/start-frames/`; several clips may share one (4-03, 4-03b, 4-03c).
- `N s.` the clip length (Omni: 3 to 15 s; Veo ignores it, always 8 s).
- `Bind: A, B.` the cast of the clip, names exactly as in `CAST`; or `No Element.` for nobody.
- `Audio on` for dialogue clips, `Audio optional` for silent ones (sets the dialogue flag).
- The fenced block is the prompt, sent as one line. Speaker lines are `[Name, position in the picture, voice tag]: "exact line"`. The creator's current rule for sound is plain dialogue only: no music, effects or ambience in any clip.
- An optional `End \`file\`.` on the Start line is not parsed yet; a clip with an `endFrame` field in `jobs.json` runs in Flow's Frames mode (start + end frame, no characters).

### 3.3 The frames table (optional, for frames made in Flow)

In `EPxx-SHOT-PLAN.md`, under `## Frames`, rows `| 4-02 | 2 | M12 | Nora, screen-right facing left, MCU | NORA: You went in at eleven. |` (id, seconds, master, description, speaker and line). The builder makes one image job per row: ingredients = the master + every cast name found in the description or the speaker + known references (Deck, Surveyor, P12, P13); the prompt is a **draft** built from the description. A good frame prompt needs the continuity details (which sleeve carries the dust, which wrist the bracelet, bag side), so an assistant should write proper prompts for an episode before anyone runs them, or the creator edits them in the popup.

### 3.4 Cast and assets

```python
CAST = [
    ("Jonah", "EP01/kling/elements/Jonah/I1-Jonah-portrait-v6.jpg", "Schedar"),
    ("Nora",  "EP03/kling/elements/Nora.jpg", "Kore"),
    ("Bibi",  "EP03/kling/elements/Bibi.jpg", ""),                       # no voice chosen yet
    ("Deck",  "describe: A man in his thirties, …", "Algenib"),          # no picture: Flow draws the portrait
]
ASSETS = { "EP04": [("M12", "production/EP04/masters/M12-workshop-predawn-v3.png"), …] }
```

Pictures are paths under `production/`. The voice is one of Flow's 30 stock voices by name (Achernar, Achird, Algenib, Algieba, Alnilam, Aoede, Autonoe, Callirrhoe, Charon, Despina, Enceladus, Erinome, Fenrir, Gacrux, Iapetus, Kore, Laomedeia, Leda, Orus, Puck, Pulcherrima, Rasalgethi, Sadachbia, Sadaltager, Schedar, Sulafat, Umbriel, Vindemiatrix, Zephyr, Zubenelgenubi); Flow cannot take outside voices such as ElevenLabs. Current LOCKED OUT choices: Jonah Schedar, Wren Leda, Nora Kore, Vivienne Gacrux, Pryce Umbriel; Customer and Bibi not chosen. An asset's name (M12) is what frame prompts and the `## Frames` table use; the file's extension is added on upload (`M12.png`) and ignored when matching.

### 3.5 Running an episode, start to finish

1. Open Chrome with the extension (Developer mode → Load unpacked → this folder). Create or open **one Flow project for the episode** at `flow.google.com/project/…`, keep that tab in front, click the extension. The top line names the project it sees.
2. Pick the **Episode**.
3. **1 Characters**: press "What is in the project?", tick who is missing, "Create N characters". Free. Each gets its picture, name and voice. Characters belong to one Flow project.
4. **2 Uploads** (only if frames will be made in Flow): tick the masters and props, "Upload N pictures". Free.
5. **3 Frames** (only if the episode has no approved frames, or to remake one): read and edit each draft prompt in the panel (edits save as you type), tick, "Make N frames". 0 credits. Each is renamed to its id in Flow and, by default, saved to `flow-frames/`.
6. **4 Clips**: tick one clip first. The panel says which start frame, which characters and voices, the model and length, the cost, and the file name. "Check in Flow first" fills Flow's prompt box without generating; "Animate N clips" runs them, up to three at once. About 3 credits a second with Omni 1.2 Flash. Then tick the rest.
7. Watch the banner on the Flow page or the **Log** tab. Finished files land in `~/Downloads/LOCKED-OUT/EPxx/flow-clips/` (and `flow-frames/`, and `flow-report.json`); run `move_clips.sh` to move them into `production/EPxx/`.
8. Rejections: section 6.

Settings worth knowing: **Start frame for a clip** (the approved file, or the frame made in Flow with the same id), **Characters in clips** (attach the cast so their voices speak; the written voice tags are then left out), **Stop if a clip costs more than** (checked against Flow's own quote before anything is spent), **Video model** (Omni 1.2 Flash, or Veo 3.1 Lite / Fast / Quality: fixed 8 s, better lip sync, dearer; Fast and Quality leave Flow on 5 December 2026).

## 4. What the pills and counters mean

| Shown | Meaning |
|---|---|
| `approved file` (frame) | a start frame exists in `kling/start-frames`; making it in Flow would be a new version |
| `needs M4` (frame, amber) | the frame names a master that is not in this episode's `ASSETS`; Flow cannot use it until it is |
| `Kling clip` (blue) / `Flow clip` (green) | a take already exists on disk from the Kling runner / from this runner |
| `filling`, `generating 46%`, `finished, waiting to download`, `downloading (1080p upscaled)` | live states during a run |
| `downloaded`, `uploaded`, `in Flow as "4-02"` | done |
| `retrying after a Flow failure` | Flow failed (busy, glitch); its own Retry was pressed once, free |
| `rejected once, trying the softer prompt` | a policy refusal; the prepared softer prompt is being tried |
| `rejected: <Flow's words>` (red) | a policy refusal with no fix yet; see section 6 |
| `failed: …` / `error: …` (red) | anything else; the text says what |
| Step counters | Characters `4/5 in project`; Uploads `1/8 done`; Frames `30/30 approved, 2 made in Flow`; Clips `1/27 in Flow, 22 Kling` |

"Not done" ticks only items this runner has not finished (and skips frames that already have an approved file). "Rejected" ticks the items Flow refused. "Another take" re-runs ticked clips that are already done; the new file saves as `4-02 (1).mp4`.

## 5. Where files land

`~/Downloads/LOCKED-OUT/EPxx/flow-clips/<id>.mp4` (1080p upscale, free, or 720p original), `flow-frames/<id>.jpg` (Flow's native 1376×768), `flow-report.json`. Chrome's download folder may be elsewhere (this Mac: `/Volumes/MUSIC/Apothecarys Ledger/episode 1 video /LOCKED-OUT/`). `move_clips.sh` (run it in a terminal, it watches for up to 4 hours) moves everything into `production/EPxx/…`, never overwriting: a second take becomes `4-02 take2.mp4`.

## 6. Rejected prompts: what happens and how to fix them

Flow refuses some prompts on policy grounds (weapons, violence and injury described bluntly, anything it reads as a real person, sometimes words around children). It shows the reason on the failed tile, in its own words, and does not charge for it. Retrying the same words never helps, so the runner never does that.

**What the runner does by itself**

1. A failure that is *not* a policy refusal (busy server, a glitch): it presses Flow's own **Retry** once, free. If that fails too, the item is `failed: …`.
2. A policy refusal: it records Flow's words and the exact prompt it sent. If the job has a **softer prompt** prepared (`alt` in `flow-fixes.json`), it tries that once, automatically. If not, or if the softer prompt is refused as well, the item is `rejected: <Flow's words>` and the run moves on to the next item.

**The fix loop, for the creator or an assistant**

1. In the popup, **Log → Save report for this episode**. It writes `LOCKED-OUT/EPxx/flow-report.json`: every item's status and the prompt sent, and a `rejected` list with Flow's reason, the refused prompt, and where the fix goes. `move_clips.sh` moves it into `production/EPxx/`.
2. Write `production/EPxx/flow-fixes.json`:

```json
{
  "4-10": {
    "prompt": "The rewritten prompt that keeps the action, the exact line and the continuity, with the words Flow refused taken out.",
    "alt": "An even softer version, tried automatically once if Flow refuses the first."
  },
  "frame 4-25": { "prompt": "…" }
}
```
   Keys are the clip id, or `frame ` + id for a frame. `prompt` replaces the script's prompt for the run (the popup shows "Fixed prompt from flow-fixes.json"); `alt` is the fallback. The script file itself is left as written.
3. Rules for the rewrite: keep the dialogue line word for word; keep who is where and what they hold; replace the refused word with what the viewer would see instead (a bang and a flinch rather than the shot; "a dark mark on the brick" rather than blood; "the man goes still" rather than the injury); name no real people or brands; do not describe a child in any way beyond age, clothes and action. Flow's own reason usually names the category.
4. Run the builder, reload the extension and the Flow tab, tick **Rejected** in that step, run. A clip the popup's panel already shows as edited keeps the person's edit over the fix.

An assistant with access to the files can do steps 1 to 4 without the popup except the final run, which stays with the creator.

## 6b. Lessons from the first full episode (EP02, 16 November 2026)

- **Flow judges spoken words.** A line that sounds like a threat ("Open it for me and none of this reaches a judge") was refused in every video, however it was staged. Flow's **voice preview** speaks it: on the character's page open the voice, type the voice's name in the window's search (so it is highlighted without being applied), put the line in "Sample dialogue", press Preview, then play; the page plays a blob that can be saved. Lay it over a silent shot in the edit. Exact words, Flow voice.
- **Refusals about minors** come from wording around a child ("the seven-year-old girl ... toward the woman"); naming her (Wren) and dropping the age passed. They are not consistent: the same prompt can pass on a later try, which is why the runner retries a refusal twice before the softer prompt.
- **Two sentences need about 5 s** on Omni; 4 s cut the second sentence twice. `flow-fixes.json` takes `"seconds"`.
- **`flow-fixes.json` can also change** `"cast"` (who is attached) and `"frame"` (another start frame), for cutaways.
- **Check every download by content** (words with Whisper, picture against the start frame). The runner now checks each tile's prompt before downloading, which fixes the cause, but a check costs nothing.

## 6c. Continuity checks the user's review added (EP02 v2, 17 November 2026)

- **Wides come from the location authority.** Before any wide, compare its master with the series' location authority (CONTINUITY-LOCKS) and the first episode's wide, not only with the previous master. EP02's 2-15 showed the wrong shop because its master was side-on.
- **Ingredients mode recomposes.** Flow treats the start frame as a loose reference there. For a wide or any shot where the set must stay exact, give the clip `"mode": "frames"` in `flow-fixes.json`: Flow then starts from the exact picture (no characters can be attached, so use it for shots without dialogue, or accept the written voice).
- **Over-the-shoulder shots:** name the foreground person in the prompt and add them to `"cast"`, with "she stays silent". Otherwise Flow invents someone (a boy in 2-04b, a stranger in 2-13).
- **Props:** describe by shape, never by a word with two meanings ("red bow" became a ribbon). Put the action the shot plan asks for in the prompt.
- **A prop reference attached to a clip does not change what is already in the frame.** Fix the frame first in Flow (an image job with the frame and the prop as ingredients, 0 credits), then animate.
- **After a run, compare a still from each clip with its start frame** (set, positions, props, the foreground person) before assembling. A word check alone is not enough.
- **Never trust a mark on a tile.** Flow's grid reuses its tile elements as it scrolls, so a tag left on one can sit on a different clip after a scroll. Since 17 November 2026 the extension downloads the tile it has just matched by prompt, and never looks a tile up by a tag. After any batch of downloads, check that the files are all different and look at a still of each.
- **After editing the extension,** check the page's `data-loflow-version` stamp; a reload that silently fails runs the old code.

## 7. Limits and gotchas

- Chrome caps a popup at 800×600; this one is 640×584 and scrolls inside its lists, not as a page.
- Voices are Flow's 30. Characters are per Flow project. Names in a project must be unique; the runner names uploads by file and renames generated items to their id.
- Images come out at 1376×768. Fine as start frames for 720p/1080p video; the 2K Pollo frames remain the source for covers.
- Omni: 3 to 15 s, about 3 credits a second, up to 5 character voices in a clip. Veo: 8 s fixed, 1 voice. Prices are read from Flow's quote before each start.
- Do not switch tabs, open another Flow project in the same tab, or generate by hand in the project while a run is going.
- The uploads list covers Episode 4 only, by the creator's choice; frames of Episodes 1 to 3 show `needs …` until their masters are added.
- Frames made in Flow use draft prompts unless rewritten; the draft lacks continuity details.
- Agent-mode tiles in Flow have no Retry button; the runner never uses Agent mode.
- `in Flow as "4-02"` statuses are kept per episode, not per Flow project; working on one episode in two projects can show a stale pill.

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Top line says "Open your Flow project in this tab first" | the active tab is not `flow.google.com/project/…`; open the project there, reopen the popup |
| "The Flow tab has an old copy of the extension" | reload the extension in `chrome://extensions`, then the Flow tab |
| Nothing happens after Start, log says "showed no new tile yet" | the tab was not in front, so the genuine click or key did not land; bring it forward, the runner keeps watching and submits again after a minute |
| A character is "NAME NOT SAVED" | same cause; rename it on its page in Flow (Enter saves) |
| `Not in this Flow project: M12` | run step 2 for that master, or add it to `ASSETS` and rebuild |
| `"Nora" is not a character in this Flow project` | run step 1 in this project; press "What is in the project?" first |
| Clip downloaded with the wrong number | something else was generated in the project during the run; use "Another take" for that clip with nothing else running |
| Flow quotes more than the limit | the clip is skipped with a note; raise "Stop if a clip costs more than" or pick a cheaper model |

## 9. File map

`manifest.json` permissions: downloads, storage, debugger; host flow.google.com. `popup.html`, `popup.js` the window. `bridge.js` the loop. `agent.js` the page driver (every Flow control it uses is named in a comment with the date it was mapped). `background.js` files, download naming, genuine clicks and keys, report writing. `build_jobs.py` the builder (EPISODES, CAST, ASSETS, flow-fixes). `move_clips.sh` moves results into the project. `README.md` the short version; `GUIDE.md` this file. `../firefly-kling-runner/` is the earlier runner for Kling 3.0 in Adobe Firefly, same popup pattern.

## 10. On another computer

The extension's code travels inside the Drama Brain (`~/drama-brain/tools/flow-runner`). The movie itself does not: the `jobs` folder (start frames, cast pictures, prompts) is built on each computer from that computer's copy of the movie folder.

1. Get the brain on that computer (see the brain's README, "Another computer").
2. In the Chrome you will use for Flow: `chrome://extensions`, turn on **Developer mode**, **Load unpacked**, choose `~/drama-brain/tools/flow-runner`. Pin it.
3. Build the jobs from the movie folder on that computer, then reload the extension:
   `python3 ~/drama-brain/tools/flow-runner/build_jobs.py "<movie folder>"`
   The movie folder is the one that holds `production/EPxx`. Without it there is nothing to tick: bring the movie folder across on its drive first.
4. Sign in to Google Flow with the same account. Flow projects and their characters belong to the account, so they are already there; a new Flow project needs its characters created again (step 1 in the popup).
5. Clips download into Chrome's download folder under `LOCKED-OUT/EPxx/`. To move them into the movie folder:
   `FLOW_DOWNLOADS="<Chrome's download folder>/LOCKED-OUT" MOVIE_DIR="<movie folder>" ./move_clips.sh`

The working copy (the master) is the one in the LOCKED OUT folder on the first Mac. The brain copies it on every `sync` from that Mac, so change the extension there. A change made only in the brain's copy on another computer is overwritten by the next sync.

The episode list, cast and voices in `build_jobs.py` are LOCKED OUT's. For another movie, edit `EPISODES`, `CAST` and `ASSETS` at the top of that file (section 3).

