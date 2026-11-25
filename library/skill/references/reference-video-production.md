# Reference-to-video production (any model)

Use this when clips are made from reference pictures rather than one start frame per shot. Verify every model limit, input name and price from the live tool before relying on it; the notes below are what worked or failed in practice, not guarantees.

## Lock the staging before the clip

Reference pictures alone give a model faces, costumes and a room, but no staging. It fills the gap by copying the reference poses: characters stand front-on side by side, props stay where the character sheet put them. Never send a dialogue scene as references only.

For each clip, make and approve one **keyframe**: a still of the clip's opening (or, when the clip must arrive somewhere, its closing) blocking. It fixes who stands where, which way each person faces, hands and props, framing and lens. Make it from the scene's location picture, the character sheets and the prop references, then check it like any frame. Check its costumes against the previous episode's footage too, not only against the prompt.

**Check whether the mode really takes a first frame.** Read the live model schema. If the reference mode has no first-frame field, the keyframe is only one loose reference among many, whatever the prompt says, and the model will rebuild the set and the staging. Wan 3.0 reference-to-video is like this (verified 2026-11-22); see model-prompts/wan-3.0.md.

## One clip, several shots

One generation can carry several editorial shots. Group shots into a clip by place, time and continuous action, usually 8 to 30 seconds, within the model's verified maximum. Give each clip its own keyframe.

Reference order (name each reference and mention it in the prompt by that name, for example `[@image1]` on Pollo):
1. The locked keyframe.
2. The character sheets of everyone visible.
3. Prop references.
4. The location picture(s) for every camera direction the clip uses.

Prompt structure (generic, for models whose own guide does not say otherwise; NEVER for Wan 3.0, which has its own form):
1. First line: `HARD CONSTRAINT: frame 0 must reproduce [@image1] exactly: same composition, same camera distance, same subject positions, same lighting. Do not reinterpret it.` This only helps on a route that really takes a first frame; on Wan 3.0 reference-to-video it does not lock anything. When the keyframe is the closing blocking instead, say "use [@image1] as the blocking and framing the clip must arrive at in its last seconds".
2. Format, duration, language, location with its reference.
3. Each character: which reference they keep face, hair and wardrobe from, and their fixed screen side.
4. Each prop: which reference, where it is, and its state for the whole clip ("tied at her right wrist for the whole clip and never leaves it", or "both wrists bare, no cord").
5. Timed shots, `0-3s:`, `3-6s:`..., each with framing, lens, one camera instruction, action, and any line as `NAME (delivery note): "exact words"`.
6. End state: final positions, expressions, prop locations. Then: "Lip sync for each speaker; people who are not speaking keep their mouths closed. Nobody looks into the camera. No music. No subtitles, captions or on-screen text."

The words in the prompt are the script's exact words. Delivery notes go in brackets, never in the line.

## Model prompt guides

The prompt itself is written from the running model's own guide in `model-prompts/` (see its README): Wan 3.0, MiniMax H3, Google Flow / Omni, Seedance, stills (Firefly / GPT Image). This file covers what is true for every model: staging, keyframes, shot load, testing and checking. Never carry one model's prompt wording into another's.

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
- Small props: never use a macro reference alone. Make a keyframe that shows the prop in a hand at true size, and give the size against the body ("band thinner than a matchstick").
- Subtle motion: models avoid fast repeated motion, so a "trembling hand" barely shows. Describe what is seen and give it its own short insert.
- A shot that walks someone to a mark or lands a prop drifts at the end without a stated end state (The Valet: Theo walked to the wrong side, a thin ring became a band).
