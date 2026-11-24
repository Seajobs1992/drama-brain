# Reference-to-video production (Pollo, Wan, Seedance and similar)

Use this when clips are made from reference pictures rather than one start frame per shot. Verify every model limit, input name and price from the live tool before relying on it; the notes below are what worked or failed in practice, not guarantees.

## Lock the staging before the clip

Reference pictures alone give a model faces, costumes and a room, but no staging. It fills the gap by copying the reference poses: characters stand front-on side by side, props stay where the character sheet put them. Never send a dialogue scene as references only.

For each clip, make and approve one **keyframe**: a still of the clip's opening (or, when the clip must arrive somewhere, its closing) blocking. It fixes who stands where, which way each person faces, hands and props, framing and lens. Make it from the scene's location picture, the character sheets and the prop references, then check it like any frame. Check its costumes against the previous episode's footage too, not only against the prompt.

**Check whether the mode really takes a first frame.** Read the live model schema. If the reference mode has no first-frame field, the keyframe is only one loose reference among many, whatever the prompt says, and the model will rebuild the set and the staging. Wan 3.0 reference-to-video is like this (verified 2026-11-22). See "Wan 3.0" below.

## One clip, several shots

One generation can carry several editorial shots. Group shots into a clip by place, time and continuous action, usually 8 to 30 seconds, within the model's verified maximum. Give each clip its own keyframe.

Reference order (name each reference and mention it in the prompt by that name, for example `[@image1]` on Pollo):
1. The locked keyframe.
2. The character sheets of everyone visible.
3. Prop references.
4. The location picture(s) for every camera direction the clip uses.

Prompt structure:
1. First line: `HARD CONSTRAINT: frame 0 must reproduce [@image1] exactly: same composition, same camera distance, same subject positions, same lighting. Do not reinterpret it.` This only helps on a route that really takes a first frame; on Wan 3.0 reference-to-video it does not lock anything (see "Wan 3.0" below). When the keyframe is the closing blocking instead, say "use [@image1] as the blocking and framing the clip must arrive at in its last seconds".
2. Format, duration, language, location with its reference.
3. Each character: which reference they keep face, hair and wardrobe from, and their fixed screen side.
4. Each prop: which reference, where it is, and its state for the whole clip ("tied at her right wrist for the whole clip and never leaves it", or "both wrists bare, no cord").
5. Timed shots, `0-3s:`, `3-6s:`..., each with framing, lens, one camera instruction, action, and any line as `NAME (delivery note): "exact words"`.
6. End state: final positions, expressions, prop locations. Then: "Lip sync for each speaker; people who are not speaking keep their mouths closed. Nobody looks into the camera. No music. No subtitles, captions or on-screen text."

The words in the prompt are the script's exact words. Delivery notes go in brackets, never in the line.

## Prompt craft (from invideo's model guide; written for Seedance, verify on each model)

- Length: past about 150 words Seedance drops instructions. Keep each clip prompt as short as the beats allow; put identity, prop state and look in the references and a short lock line, not in long description. When instructions are ignored in a long prompt, test a shorter one before anything else.
- Dialogue in double quotes is the lip-sync signal. Keep each line under about 12 words; split a longer locked line across shots without changing a word. Say what is heard in the last seconds, or a long clip trails into silence.
- Time brackets `[00:00 - 00:03]` make hard cuts; write "one continuous shot, no cuts" when none is wanted.
- Write camera motion apart from subject motion ("she turns; the camera holds"). One camera move per shot.
- Each reference has one job and one named token; attachment order is binding.
- End with a `Preserve:` line naming the identity, the prop state and the composition to hold.
- Identity references: front plus left and right three-quarter views, face 30 to 50 percent of the frame; a few strong references beat many mixed ones. Re-attach them on every generation.
- Two resolved faces per shot; crowds as soft background or silhouettes.
- Between takes, change one thing at a time.

## Wan 3.0 (Pollo `alibaba` / `wan-v3-0`, researched and tested 2026-11-22)

Sources: Alibaba Model Studio's Wan 3.0 generation and prompt guides, Pollo's docs and live schema, the Wan GitHub code, community guides. Tested on The Valet, Episode 2, Clip B1.

**Pick the mode per shot:**
- **Reference-to-video** takes up to 10 images, 5 videos and 5 audio clips, but no first frame. Use it for dialogue, where voice and face references matter.
- **Image-to-video** takes a true first frame (`image`) and an optional end frame (`imageTail`), 2 to 30 s, with sound. It takes no voice or face references. Use it for silent shots where the set, the staging or a prop must hold exactly: wides, inserts, walks.
- Same price for both: 6 credits a second at 720p.
- A dialogue clip can be split into silent image-to-video shots plus one reference-to-video piece for the lines, then joined in the edit.

**Reference-to-video prompts, in the official order:**
1. Overall description: the place cited by its reference, the people with their references and costumes, the prop with its reference and size, and the headcount ("Only Nia and Theo are in frame; nobody else enters").
2. Timed shots: `Shot 1 [0-4s] ...`, `Shot 2 [4-10s] Hard cut. ...`. No gaps. 2 to 6 s each. One clear action per shot.
3. Lines: `Theo says, low: "exact words"`.
4. Voices: "Nia's voice timbre references [@voice1]." Then "Lip sync. No background music."
5. Last, an `Avoid:` list. Wan 3.0 has no negative prompt field, so the avoid list goes in the prompt: "other people, badges, name tags, text or labels; adding or removing objects; scale drift; position changes; looking into the camera".

**Image-to-video prompts:** write only the motion and the camera ("Fixed shot, camera static..."). The picture already gives the rest.

**End frames:** any shot that walks someone to a mark, or lands a prop, needs an end frame showing the final blocking or prop state. Without one, Wan drifted at the end: Theo walked round to the wrong side, and a thin ring turned into a thick band as it landed.

**Small props:** never use a macro reference alone. Make a keyframe that shows the prop in a hand at true size, and give the size against the body ("band thinner than a matchstick, diamond no bigger than a grain of rice"). Cite the prop as held by a character.

**Subtle motion:** Wan avoids fast repeated motion, so a "trembling hand" barely shows. Describe what we see ("the ring shakes visibly in his palm") and give it its own short insert, ideally with an end frame.

## Wan 3.0 working recipe (user-approved, 23 and 24 November 2026)

This is what produced approved clips on The Man They Erased (period Korean faces, English dialogue, graded and upscaled keyframes). It was found by paid trial and error and it overrides the older Wan notes above wherever they differ. Verify price and limits live.

**References**
- The graded keyframe is the ONLY reference. No character sheets, no face pictures, no location picture, no audio, no reference video. Proven with an identical prompt: with the character sheet attached the mouth barely moved; with it removed the lips synced.
- Never use a frame pulled from a clip as the keyframe. Its background is blurred, and Wan invented a new wall and extra people.
- Every speaker's face must be visible in the keyframe. If one is not, say so before the quote and plan how the camera reaches that face.

**Mode per shot**
- Dialogue: reference-to-video with the keyframe named `keyframe`, cited as `[@keyframe]`.
- Silent: image-to-video with the graded image as the true first frame (this locks the grade and the set). Add an end frame when an action must land. Middle beats go in words.

**Prompt form (the user's own, keep it this short)**

Single speaker:

    Single continuous 5s cinematic shot. The young woman in [@keyframe] stands exactly as shown, before the painted scroll, lantern on the right. Preserve identity, clothing, position and environment. 85mm lens, f/1.4, shallow depth of field.

    00:00–00:00.5: Medium shot. She takes a subtle breath as the camera pushes towards her face.

    00:00.5–00:03.5: Medium close-up. She looks at the guests off-screen right and says in English: “exact line” Lip sync. Quiet, steady female voice, natural mouth articulation.

    00:03.5–00:05: She closes her mouth and maintains her gaze.

    Photorealistic 35mm film aesthetic, subtle grain, natural colours, warm lantern light, creamy background blur.

    Audio: English dialogue only, hushed hall ambience. No music, no narration, no voice-over, no additional dialogue, no other languages, no subtitles or on-screen text. NO native language, pure English dialogue, lip sync to the dialogue.

Two speakers in one shot (the multi-speaker form):

    Single continuous 7s cinematic shot. The man in the beige jacket and the man in the blue-grey robe stand exactly as in [@keyframe], <place, two set items>. Preserve identities, clothing, positions and environment exactly as in [@keyframe]. 50mm lens, f/1.8, shallow depth of field.

    00:00–00:00.5: Wide shot. Both mouths closed. Camera glides in towards the face of the man in the beige jacket.

    00:00.5–00:03.5: Stable medium close-up of the man in the beige jacket. He ... says in English: “line one” Lip sync. Sharp, low male voice. The other man remains silent.

    00:03.5–00:04: Both mouths closed. Camera smoothly pans to the face of the man in the blue-grey robe.

    00:04–00:06.5: Stable medium close-up of the man in the blue-grey robe. He ... says in English: “line two” Lip sync. Stiff male voice. The man in beige remains silent.

    00:06.5–00:07: Camera eases back to a two-shot. Both look at <target>, never into the lens.

    Photorealistic 35mm film aesthetic, subtle grain, natural colours, <light>, creamy background blur.

    Audio: Exact English dialogue synchronised with each speaker’s mouth, <ambience>. No overlapping speech, music, narration, voice-over or subtitles, no other languages. NO native language, pure English dialogue, lip sync to the dialogue.

**User's working single-speaker prompt (24 Nov 2026, Episode 2 C21, "This prompt works"). Model to copy: short, the camera reaches a stable medium close-up before the line, the speaker named by clothing, a natural pause asked for between sentences:**

    Single continuous 4s cinematic shot. The man in [@image1] stands at the top of the stairs, half turned back. Preserve identity, clothing, position and environment. Eye-level medium shot, three-quarter angle, slow cinematic push-in. 50mm lens, f/1.8, shallow depth of field.

    00:00–00:00.5: Camera gently pushes towards his face.

    00:00.5–00:03.5: Stable medium close-up. The man in beige says in English: "I sent letters. Every month." Lip sync. Low, quiet male voice, with a brief natural pause between sentences.

    00:03.5–00:04: He holds his gaze without moving closer.

    Photorealistic 35mm film aesthetic, subtle grain, natural colours, warm lantern light, creamy background blur.

    Audio: English dialogue, subtle hall ambience. No music, narration, voice-over or subtitles.

**English speech lock (user, 24 Nov 2026: "Next batch we will add this to our prompt"). Add to EVERY Wan dialogue prompt, single or multi speaker, word for word, after the Audio line:**

    Speech language: English (en-US).

    The character speaks English naturally, with mouth movements precisely matching the audible English phonemes, syllables and speech rhythm.

    Negative prompt list: Korean-language articulation, dubbed speech, mismatched lip-sync, incorrect phonetic movements, unsynchronised audio.

**Rules inside the form**
- Each timed beat opens with its shot size. The camera travels only in SILENT beats; every speaking beat is a stable close-up. A longer version with the camera moving during the lines failed.
- Name each person by one clothing tag. Do not list props, hats or set details the frame already shows; over-description confused the model.
- A speaking face is level and near-frontal, never tipped down, with a stated eye target and "never into the lens".
- Cinematic direction in every prompt: shot size, the move, lens and aperture. Do not lock the camera unless the user or the plan asks.
- The line is the script's exact words in double quotes, followed by "Lip sync." and a short voice description. Never name an accent.

**Length**
- No clip over 7 seconds. Give every second a job. Budget about 3 words a second, plus half-second silent beats for the camera. If the plan says 10 s, aim for 6.
- Merge consecutive silent beats on one set into one shot (first frame, end frame, middle in words). Put two short lines in one multi-speaker shot rather than two clips.

**Known drifts to check for**
- When the camera pushes in from a wide keyframe in reference mode, Wan may rebuild the background behind the faces. Naming two set items from the frame helps.
- A writing hand adds an extra mark even when forbidden. Plan a trim or a hold on the still.
- A second copy of a prop can appear for a second after a move. Fix in the edit first.
- Lines can start later than the timecode asks; leave about half a second spare.

**Check every clip before showing it**
- Transcribe the words with word times. Sheet the clip at 4 frames a second beside its keyframe. Zoom on the speaker's mouth at 6 frames a second with timestamps and compare with when the sound runs. The creator judges the lips.

**Working order**
- Prove the form on one clip, then batch up to four, each with its own pre-spend sheet row, quote and go.

## Shot load

Follow [production and quality](production-and-quality.md) for people per shot, the prop state record, gaze targets, timing feasibility, checking footage and the repair cap.

## Test before scaling

Run one representative clip first (the one with two speakers and a prop) and inspect it: cut times, staging against the keyframe, faces, the prop, every spoken word, lip sync on the right speaker. Only then generate the rest, one clip at a time, each checked before the next.

## Observed failures to plan around

- Planned cuts can come out late, merged or missing. Keep each timed shot at least 2 to 3 seconds and check cut times in the output.
- Props drift before faces. Restate the prop and its state in every clip and check it in stills.
- Wide shots inherit the camera height of the location picture they were given. Give the angle you want, not a high reference, for a wide at eye level.
- A multi-shot retake costs the whole clip. Fix the keyframe or the prompt first, never retry blindly.
- A close-up with only "nobody looks into the camera" still came out looking into the lens. Give every close-up a stated eyeline target: "looks toward Margot, off screen right".
- When the last shot is a hold, the model filled the spare seconds with an extra, unrequested shot (an empty room). End the last shot on a stated action and write "The clip ends on this shot."
- Ask for "hard cuts, no dissolves"; one clip without it dissolved into its last shot.
