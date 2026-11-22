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
