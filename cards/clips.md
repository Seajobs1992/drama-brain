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
- 2026-11-17: The user runs the Flow extension themselves and it is fast; driving it from outside with scripts was slow and buggy (EP03 took over an hour). Prepare the jobs, tell the user exactly which clips to tick and which settings to change, let them press Animate, then check the results. Drive it only if asked.
- 2026-11-17: The extension matched clips to Flow tiles by the first 70 letters of the prompt, so clips made from one frame (4-03, 4-03b, 4-03c; 4-21 and 4-23) looked identical and got each other's files. Fixed 2026-11-17h: compare the start and the end of the prompt. After every run, transcribe each speaking clip and check its line before trusting the file name.
- 2026-11-17: EP04 took hours because all episodes shared one Flow project (~200 clips): positions slipped, searches crawled, and I patched the extension mid-run three times. Rule: one new Flow project per episode, and test the extension on a 3-clip batch before a full run. Never fix the tool during a paid run; stop, fix, test, then resume.
- 2026-11-18: Flow Frames mode attaches no characters, so a speaking clip in Frames mode loses the character's chosen Flow voice. Use Frames mode only for silent clips; for a speaking clip that drifted, keep Ingredients and name the set, sides and direction in the prompt. Also give a line enough length: a 5-word line that starts late gets cut at 3 s (EP04 4-11).
- 2026-11-22: Wan multi-shot clips (The Valet, Clip B): a close-up told only 'nobody looks into the camera' still looked into the lens, and a final held shot was followed by an unrequested empty-room shot. Rule: every close-up states an eyeline target ('looks toward Margot, off screen right'); the last shot ends on a stated action and the prompt says 'The clip ends on this shot.'; always say 'hard cuts, no dissolves'.
- 2026-11-22: Champagne pour (The Valet Clip A, Flow and Wan): Flow poured in the two-shot AND again in the insert, gave Celeste a second glass, drew the glass bowl apart from its stem, and kept the glass full while it poured; Wan had Celeste stoop awkwardly in the wide. Rule: a pour or any prop action happens in ONE shot only (the insert); the other shots show the before or after state; say 'she holds a single coupe', 'the coupe empties as she pours', and keep the hand on the stem in frame.
- 2026-11-22: Second glass (The Valet Clip A, both Flow and Wan): Celeste ended up holding another coupe in her other hand while pouring and after, because the keyframe already showed her holding a coupe at her waist and the prompt said 'tips her coupe' without saying the other hand was empty. Rule: count every handheld prop in the keyframe and the prompt: 'she holds ONE coupe, in her right hand; her left hand is empty'; after the pour, 'the same empty coupe in her right hand'. Check hands in every still.
- 2026-11-22: Wan close-ups look into the lens whatever the text says (The Valet Clips B and C, even with a 148-word prompt and a stated eyeline). Rule: for any close-up where the eyeline matters, describe the head angle, not just the gaze ('three-quarter profile, face turned to screen right, eyes on the tower'), and give the shot its own keyframe or end frame showing that angle; for a voice-over over a face, show the face in profile or from behind, or use a cutaway, so parted lips cannot read as speech.
- 2026-11-22: Wan mirrored a locked over-the-shoulder keyframe (The Valet Clip D2): frame 0 came out with the foreground shoulder on the other side, so both reverse shots looked screen left. Rule: in each reverse shot state the screen sides in frame terms ('Ellis's shoulder at the RIGHT edge, Nia LEFT of centre looking screen right') and check frame 0 against the keyframe before accepting; flipping the picture is not an allowed fix.
- 2026-11-22: Wan copies props from a character sheet into clips even when the prompt says otherwise (The Valet EP02 Clip A: Nia's old key cord came back on her wrist from her sheet, as in EP01 Clip E). Rule: once a prop leaves a character, stop attaching the sheet that shows it; attach the face picture (head and shoulders) plus a keyframe that shows the current costume instead.
- 2026-11-22: Wan 3.0 reference-to-video has no true first frame: a 'frame 0 reproduces image1' keyframe is only a loose reference, so Wan rebuilds the set and staging (The Valet EP02 B1). Rule: shots where the set and staging must hold and nobody speaks go through Wan image-to-video (true first frame, optional end frame); keep reference-to-video for the dialogue, where voices and faces need references. Write ref2video prompts in the official order: overall description, references, Shot 1 [0-4s]..., 'Name says: "..."', voice timbre lines, then an Avoid list.
- 2026-11-22: Image-to-video with only a start frame still drifts at the end of a move: Theo walked round to the wrong side of Nia and a thin ring turned into a thick band when it landed in a palm (The Valet EP02 B1a, B1c). Rule: any shot with a walk to a mark or a prop landing gets an end frame (imageTail) showing the final blocking or prop state, checked like a keyframe.
- 2026-11-22: Wan image-to-video with start and end frames fixed the end blocking and a small prop's size (The Valet EP02 B1a v2, B1c v2), but a walk that passes close behind another person doubled the walker for about 0.3 s. Rule: in a wide, route a walking character through clear space, not past or behind another person; check the middle of every walk at 5 to 12 frames a second.
