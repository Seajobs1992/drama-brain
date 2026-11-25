# Google Flow / Omni 1.2 Flash prompt guide

Use only for Google Flow through the user's Flow runner extension. Full operating guide: doc `flow-guide` (tools/flow-runner/GUIDE.md). Not used for The Man They Erased clips since the move to Wan.

**Settings:** Omni 1.2 Flash, x1, download "1080p Upscaled", never the paid 4K. The clip's cast is attached as Flow characters so the right Flow voice speaks (doc `voices`). Ingredients mode rebuilds the set from a loose start frame; for a wide or any silent shot where the set must hold, use Frames mode (`"mode": "frames"` in `flow-fixes.json`). Frames mode attaches no characters, so never use it for a speaking clip.

**Prompt style (user-approved, Episode 2, 19 Nov 2026):** start from the approved frame with the opening pose, eyeline and speaker readable. One continuous shot with an explicit camera move or a locked camera; steady light unless motivated; physical actions in plain prose in the order they happen. Link each line to a visible cue: the action settles, the speaker looks at a named target, then says the exact words while the listener stays silent. Give the final reaction one beat. Prop movement and end state only where needed. Quiet scene ambience, no music.

**Flow-specific rules**
- Name people by character name. Never describe a child by age: Flow refuses it.
- Over-the-shoulder: name the foreground person, add them to the clip's cast, write "stays silent". Otherwise Flow invents someone.
- A prop reference does not change a prop already in the frame: fix the frame first (a Flow image job, 0 credits).
- Refusals cost nothing. The runner retries, then tries the softer `alt`. Rewrite the description in `flow-fixes.json` with a `why`; never change the spoken words. If Flow refuses the line itself, stop and tell the user.
- One Flow project per episode. Do not generate anything else in the project during a run.
