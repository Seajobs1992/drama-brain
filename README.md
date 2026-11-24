# Drama Brain

One shared rule book for making the movies. Claude and Codex both have to read it before they can act in a movie folder, and both read the same thing. It exists because they kept forgetting the rules.

## What it is

- **Core rules** (`CORE.md`): twelve lines that apply to every task on every movie.
- **Cards** (`cards/`): one short page per kind of work: starting a new movie, writing, references, frames, clips, edit, credits, review, tools. An agent loads only the card for the task in hand.
- **Movie files**: each movie folder has its own `BRAIN-PROJECT.md` with that movie's facts (cast, voices, places, where files are) and its list of documents. Nothing about one movie lives in the general cards.
- **Library** (`library/`): the general guides and the writing skill, carried inside the brain so they travel with it.
- **Lessons** (`lessons.md`): every correction, dated. The matching card is updated at the same time.
- **The gate**: a hook in Claude Code (carried by the `drama-brain` plugin, below) and in Codex. In a registered movie folder it blocks every tool that changes or generates anything until the agent has read the brain for its task. Anything that spends credits also needs the credits card. In other folders it does nothing.

## Why it does not eat tokens

An agent does not read the documents. It reads the core rules, one or two cards and the movie card: about 1,000 to 1,600 tokens. When it needs detail it asks for one section of one document (`section`) or searches (`find`). The documents behind the brain run to hundreds of thousands of characters and stay on disk.

## Everyday commands

Run them as `python3 ~/drama-brain/brain.py <command>`.

| Command | What it does |
|---|---|
| `start "<task>"` | Core rules and the card for the task. This is what an agent runs first |
| `card <name>` | Another card, when the task changes. `card project` is this movie's facts |
| `find "<words>"` | Search every document, card and lesson |
| `section <doc> "<heading>"` | One section of a document |
| `docs`, `cards`, `projects` | What exists |
| `lesson "<text>" --card <name>` | Record a correction so it is read next time |
| `doctor` | Check that everything is connected |
| `budget` | How many tokens each card costs |

## Adding things

- **A new rule after a mistake:** tell the agent the correction. It must run `lesson`. Or edit the card yourself: they are plain text.
- **A new movie:** `brain.py new-project "<folder>" "<Name>"`. It creates the movie's `BRAIN-PROJECT.md` and puts the folder under the gate. Card `new-movie` gives the order of work.
- **An existing movie folder on this computer:** `brain.py add-project "<folder>"`.
- **A new general guide:** copy it into `library/` and add a line to `docs.json`.

## Another computer

The brain has an online copy on GitHub, named `drama-brain`, under your account. It is PUBLIC (your choice, 2026-11-22): anyone can read it, so never put names, emails or account details in it.

1. On the other computer, sign in to GitHub in a terminal (`gh auth login`), then fetch the brain into the home folder:
   `gh repo clone drama-brain ~/drama-brain`
   (No `gh`? Copy the whole `drama-brain` folder across by USB or AirDrop instead.)
2. Run `python3 ~/drama-brain/brain.py install`. It connects Claude and Codex on that computer and installs the writing skill.
3. Register the movie folders that exist on that computer: `brain.py add-project "<folder>"`. A movie folder copied from this computer already has its `BRAIN-PROJECT.md`.
4. Open Codex once and approve the new hooks when it asks.
5. Load the Flow runner extension in Chrome and build its jobs (see "The Flow runner extension" below).

### If the other computer is Windows

- It needs Python 3. Check with `python --version`. If it is missing, install it from python.org (tick "Add python.exe to PATH") or run `winget install Python.Python.3.12`.
- Unzip or clone the brain to `C:\Users\<you>\drama-brain`, so that `brain.py` is directly inside that folder.
- Set up and prove it:
  `python %USERPROFILE%\drama-brain\brain.py install`
  `python %USERPROFILE%\drama-brain\brain.py selftest`
  `python %USERPROFILE%\drama-brain\brain.py doctor`
- Register the movie. For a new one: `python %USERPROFILE%\drama-brain\brain.py new-project "C:\path\to\Movie Folder" "Movie Name"`.
- `selftest` runs the real gate against a throwaway folder and must show every line as `pass`. If a line fails, the gate is not protecting that computer yet.
- **The Flow Chrome on Windows:** double-click `%USERPROFILE%\drama-brain\tools\flow-runner\open-flow-chrome.bat`. It opens Google Chrome with its own profile (`%USERPROFILE%\flow-chrome-profile`, apart from your everyday Chrome) and remote debugging on port 9333, like the Flow Chrome on the first Mac. The first time: sign in to Google Flow and Adobe Firefly in that window and load both extensions there (below). It remembers them after that. Always open it with this file, or the agent cannot reach it. For a desktop shortcut, right-click the file, choose Send to, then Desktop.
- Both Chrome extensions work on Windows: Load unpacked `%USERPROFILE%\drama-brain\tools\flow-runner` and `%USERPROFILE%\drama-brain\tools\firefly-kling-runner`, then build each one's jobs with `python` instead of `python3`, for example `python %USERPROFILE%\drama-brain\tools\firefly-kling-runner\build_jobs.py "C:\path\to\Movie Folder"`.
- `move_clips.sh` in both runners is for Mac. On Windows, move the downloaded clips from `Downloads\LOCKED-OUT\` into the movie folder by hand, or ask the agent to.

Keeping the two computers in step:

- A lesson is sent to the online copy the moment it is recorded.
- Each new Claude or Codex session quietly fetches the latest brain (at most every six hours).
- After you edit a card by hand, or if `doctor` says the copies are out of step, run `python3 ~/drama-brain/brain.py sync`.

The `local/` folder is per computer (which movie folders exist here, session notes) and is never copied.

## The Flow runner extension

The Chrome extension that runs frames and clips in Google Flow travels inside the brain, at `tools/flow-runner`, with its full guide (`tools/flow-runner/GUIDE.md`).

- **What is in the brain:** the extension's code and guide.
- **What is not:** the `jobs` folder, which holds the movie's start frames, cast pictures and prompts. It is built on each computer from the movie folder, and it is never sent online.
- **On another computer:** in Chrome open `chrome://extensions`, turn on Developer mode, press Load unpacked and choose `~/drama-brain/tools/flow-runner`. Then build the jobs from the movie folder on that computer: `python3 ~/drama-brain/tools/flow-runner/build_jobs.py "<movie folder>"`. The guide's section 10 has every step.
- **Changing the extension:** the working copy is the one in the LOCKED OUT folder on the first Mac (`mirrors.json` names it). `sync` on that Mac copies it into the brain.

## The Firefly runner extension

The second Chrome extension, at `tools/firefly-kling-runner`, with its guide in `tools/firefly-kling-runner/README.md`. It runs in Adobe Firefly: Kling 3.0 video clips, and still images (text to image and image to image) with the model, aspect, size, quality and an "Unlimited models only" switch chosen in its popup.

- **On another computer:** Load unpacked `~/drama-brain/tools/firefly-kling-runner`, then `python3 ~/drama-brain/tools/firefly-kling-runner/build_jobs.py "<movie folder>"`. Its `jobs` folder is built per computer, like the Flow runner's.
- **Changing it:** same as the Flow runner. The working copy is in the LOCKED OUT folder on the first Mac, and `sync` copies it here.

## The Claude Code plugin

Claude gets the brain as one plugin, `drama-brain`, kept in `plugin/` and installed from this folder itself, so a change here is live with no reinstall (in a running session: `/reload-plugins`).

- **The gate:** the same three hooks (session start, each message, each tool), calling `brain.py hook`. Its hooks file names this computer's Python and path, so `install` writes it on each computer and it is never synced.
- **The skill:** `ai-microdrama-director`, linked from the plugin to the live copy in `~/.agents/skills` (Codex and `sync` use that copy).
- **Slash commands:** `/drama-brain:start`, `/drama-brain:card`, `/drama-brain:find`, `/drama-brain:section`, `/drama-brain:lesson`. Each runs `brain.py`, so the gate counts it.
- **Which folders:** every registered movie, and any folder with a `BRAIN-PROJECT.md` in it or above it.
- **Set up:** `brain.py install` adds the plugin and removes the old gate hooks from `~/.claude/settings.json`. If the plugin cannot be installed it falls back to those settings hooks. `doctor` checks it.

## Turning it off

Create an empty file named `OFF` in the brain folder. Delete it to turn the gate back on. Only you should do this.

## What it cannot do

- It makes an agent read the rules and blocks it until it has. It cannot make an agent obey every line: that still needs your eye and the `lesson` habit.
- Codex runs hooks only after you approve them in Codex.
- A movie on a drive that is not plugged in is not gated until the drive is back.
