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

1. Copy the whole `drama-brain` folder to the home folder there (USB, AirDrop, or a private online copy through `brain.py sync`).
2. Run `python3 ~/drama-brain/brain.py install`. It connects Claude and Codex on that computer and installs the writing skill.
3. Register the movie folders that exist on that computer: `brain.py add-project "<folder>"`.
4. Open Codex once and approve the new hooks when it asks.

The `local/` folder is per computer (which movie folders exist here, session notes) and is never copied.

## Turning it off

Create an empty file named `OFF` in the brain folder. Delete it to turn the gate back on. Only you should do this.

## What it cannot do

- It makes an agent read the rules and blocks it until it has. It cannot make an agent obey every line: that still needs your eye and the `lesson` habit.
- Codex runs hooks only after you approve them in Codex.
- A movie on a drive that is not plugged in is not gated until the drive is back.
