# Drama Brain

One shared rule book for making the movies. Claude and Codex both have to read it before they can act in a movie folder, and both read the same thing. It exists because they kept forgetting the rules.

## What it is

- **Core rules** (`CORE.md`): twelve lines that apply to every task on every movie.
- **Cards** (`cards/`): one short page per kind of work: starting a new movie, writing, references, frames, clips, edit, credits, review, tools. An agent loads only the card for the task in hand.
- **Movie files**: each movie folder has its own `BRAIN-PROJECT.md` with that movie's facts (cast, voices, places, where files are) and its list of documents. Nothing about one movie lives in the general cards.
- **Library** (`library/`): the general guides and the writing skill, carried inside the brain so they travel with it.
- **Lessons** (`lessons.md`): every correction, dated. The matching card is updated at the same time.
- **The gate**: a hook in Claude Code and in Codex. In a registered movie folder it blocks every tool that changes or generates anything until the agent has read the brain for its task. Anything that spends credits also needs the credits card. In other folders it does nothing.

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

The brain has a private online copy on GitHub, named `drama-brain`, under your account.

1. On the other computer, sign in to GitHub in a terminal (`gh auth login`), then fetch the brain into the home folder:
   `gh repo clone drama-brain ~/drama-brain`
   (No `gh`? Copy the whole `drama-brain` folder across by USB or AirDrop instead.)
2. Run `python3 ~/drama-brain/brain.py install`. It connects Claude and Codex on that computer and installs the writing skill.
3. Register the movie folders that exist on that computer: `brain.py add-project "<folder>"`. A movie folder copied from this computer already has its `BRAIN-PROJECT.md`.
4. Open Codex once and approve the new hooks when it asks.
5. Load the Flow runner extension in Chrome and build its jobs (see "The Flow runner extension" below).

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

## Turning it off

Create an empty file named `OFF` in the brain folder. Delete it to turn the gate back on. Only you should do this.

## What it cannot do

- It makes an agent read the rules and blocks it until it has. It cannot make an agent obey every line: that still needs your eye and the `lesson` habit.
- Codex runs hooks only after you approve them in Codex.
- A movie on a drive that is not plugged in is not gated until the drive is back.
