---
name: clips
title: Animating clips in Google Flow
order: 40
keywords: animate, animation, clip, flow, veo, omni, kling, lip sync, lipsync, rejected prompt, refused, refusal, runner, generate episode, ingredients, frames mode
with: project, credits
---
Clips are made in Google Flow through the user's Flow runner extension. Guide: doc `flow-guide` (sections 3, 6 and 6c). The user prefers the extension to chat-driven generation.

**Set-up**
- Omni 1.2 Flash, x1, download "1080p Upscaled", never the paid 4K.
- The clip's cast is attached as Flow characters so the right Flow voice speaks (all 30 voices: doc `voices`). No ElevenLabs for voices. Effects yes, music never inside a clip.
- Do not generate anything else in the Flow project while a run is going.

**Prompts**
- The spoken line is the script's exact words. A line needs time: about 2.5 words a second, so two sentences need 5 s.
- Name people by character name. Do not describe a child by age: Flow refuses it.
- Describe props by shape, never by a word with two meanings ("red bow" became a ribbon). Put in the action the shot plan asks for.
- Over-the-shoulder: name the foreground person, add them to the clip's cast, and write "stays silent". Otherwise Flow invents someone.
- Ingredients mode treats the start frame as a loose reference and will rebuild the set. For a wide or any shot where the set must stay exact and nobody speaks, set `"mode": "frames"` in the episode's `flow-fixes.json`.
- A prop reference attached to a clip does not change a prop already in the frame. Fix the frame first (a Flow image job, 0 credits), then animate.

**Refusals**
- Refusals cost nothing. The runner retries, then tries the softer `alt`. Rewrite the description in `flow-fixes.json` with a `why`, never the spoken words.
- If Flow refuses the spoken line itself, stop and tell the user. Do not invent a workaround without their OK.

**After a run, before any edit**
- For EVERY clip, compare stills from the clip with its start frame: set, positions, props, gloves and bags, the foreground person.
- Check the words of every clip against the script. Both checks, every clip. A word check alone let a wrong set through.
- Downloads are matched by their prompt, not by position. After editing the extension, confirm the page's version stamp before spending.

## Learned the hard way
- 2026-11-17: Flow's grid reuses its tile elements while scrolling, so a mark put on a tile element can end up on a different clip. On EP03 the fetch-by-prompt helper downloaded the same clip ten times under ten names. Fixed in the extension (2026-11-17f): download the tile that was just matched, never one found again by a mark. After any batch download, check the files are all different (md5) and look at a still of each.
