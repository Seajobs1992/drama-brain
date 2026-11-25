# Wan 3.0 prompt guide (Pollo `alibaba` / `wan-v3-0`)

Use only for Wan 3.0. Nothing here applies to MiniMax, Flow, Seedance or stills; nothing from their guides applies here.

Part 1 is the user's standard, word for word (also saved as WAN-3.0-CINEMATIC-DIALOGUE-STANDARD.md in the movie folder). Part 2 is how this movie applies it.

---

# Part 1. Wan 3.0 — Cinematic Dialogue Prompt Standard V1.0

Based on successful generations in our micro-drama production. The single-speaker structure has worked repeatedly; the multi-speaker structure is a proposed extension requiring further testing.

## 1. Single-speaker master template

```text
Single continuous [duration]s cinematic shot. [Character description] in [@keyframe] [position and environment]. Preserve identity, clothing, position and environment. [Camera angle], [shot size], [camera movement]. [Lens]mm lens, f/[aperture], shallow depth of field.

00:00–00:[A]: [Camera movement, character action and eye direction].

00:[A]–00:[B]: Stable [shot size]. [Character] says in English: "[Exact dialogue]." Lip sync. [Voice type, emotional tone and delivery].

00:[B]–00:[duration]: [Natural reaction, expression or gaze direction].

Photorealistic 35mm film aesthetic, subtle grain, natural colours, [lighting direction and quality], creamy background blur.

Audio: English dialogue, [environmental ambience]. No music, narration, voice-over or subtitles.
```

## 2. Multi-speaker master template

```text
Single continuous [duration]s cinematic shot. [@character1] and [@character2] stand exactly as in [@keyframe], [environment]. Preserve identities, clothing, positions and environment. [Camera angle], [shot size], [lens]mm lens, f/[aperture], shallow depth of field.

00:00–00:[A]: [Opening action and camera movement towards character 1].

00:[A]–00:[B]: Stable [shot size] of [character 1]. [Character 1] says in English: "[Exact dialogue]." Lip sync. [Voice and emotional delivery]. [Character 2] remains silent.

00:[B]–00:[C]: Camera smoothly transitions towards [character 2].

00:[C]–00:[D]: Stable [shot size] of [character 2]. [Character 2] says in English: "[Exact dialogue]." Lip sync. [Voice and emotional delivery]. [Character 1] remains silent.

00:[D]–00:[duration]: [Final camera movement and natural character reactions].

Photorealistic 35mm film aesthetic, subtle grain, natural colours, [lighting direction and quality], creamy background blur.

Audio: English dialogue, [environmental ambience]. No overlapping speech, music, narration, voice-over or subtitles.
```

## 3. Recommended dialogue timing

Practical starting points, not official Wan limits. Adjust for emotional delivery, pauses and word complexity.

| Video duration | Speakers | Recommended total words |
|---|---:|---:|
| 3 seconds | 1 | 3–5 |
| 4 seconds | 1 | 5–9 |
| 5 seconds | 1 | 6–12 |
| 6 seconds | 1 | 8–14 |
| 7 seconds | 2 | 8–12 |
| 8 seconds | 2 | 10–15 |
| 10 seconds | 2 | 14–20 |
| 15 seconds | 2–3 | 20–30 |

### Single-speaker timeline — 5 seconds

| Time | Direction |
|---|---|
| 0–1s | Camera preparation |
| 1–4s | Stable dialogue |
| 4–5s | Natural reaction |

### Multi-speaker timeline — 10 seconds

| Time | Direction |
|---|---|
| 0–1s | Opening action |
| 1–4s | Speaker 1 |
| 4–5s | Camera transition |
| 5–9s | Speaker 2 |
| 9–10s | Final reaction |

## 4. Proven dialogue syntax

```text
[Character] says in English: "[Exact dialogue]." Lip sync. [Voice type and emotional delivery].
```

| Performance | Voice direction |
|---|---|
| Emotional | Shaken, vulnerable female voice. |
| Angry | Firm, controlled, angry male voice. |
| Authoritative | Low, commanding male voice. |
| Sad | Soft, sorrowful female voice. |
| Suspicious | Restrained, questioning male voice. |
| Romantic | Warm, affectionate female voice. |
| Exhausted | Steady, tired male voice. |
| Confrontational | Clear, demanding female voice. |
| Sarcastic | Dry, teasing female voice. |
| Fearful | Anxious, trembling female voice. |

## 5. Instructions to avoid

Based on previous failed prompts, avoid these unless further testing establishes their usefulness:

- Mouth open or mouth closed.
- Lips and jaw moving visibly.
- Every word clearly articulated.
- Precise English phoneme movements.
- Mouth matching every syllable.
- Korean-language articulation.
- Speech language: English (en-US).
- Long negative prompt lists.
- Repeated lip-sync instructions.
- Unnecessary pauses between sentences.

## 6. Cinematic visual standard

```text
Photorealistic 35mm film aesthetic, subtle grain, natural colours, realistic lighting, shallow depth of field, sharp subject focus and creamy background blur.
```

| Shot type | Recommended lens | Aperture |
|---|---|---|
| Extreme close-up | 85–100mm | f/1.4–2.0 |
| Close-up | 85mm | f/1.4 |
| Medium close-up | 50–85mm | f/1.4–1.8 |
| Medium shot | 50mm | f/1.8 |
| Two-shot | 35–50mm | f/1.8–2.8 |
| Over-the-shoulder | 50–85mm | f/1.8 |
| Wide shot | 24–35mm | f/2.8–4.0 |
| Establishing shot | 24mm | f/4.0–5.6 |

These are creative cinematography recommendations rather than proven lip-sync requirements.

## 7. Master rules for AI agents generating Wan prompts

When generating Wan 3.0 image-to-video prompts:

1. Keep prompts concise, precise and cinematic.
2. Preserve character identity, clothing, spatial positioning and environment from the reference keyframe.
3. Use continuous cinematic shots unless cuts are explicitly requested.
4. Specify shot size, camera angle, camera movement, lens and aperture.
5. Divide the shot into chronological, non-overlapping timestamps.
6. Allocate sufficient time for natural dialogue delivery.
7. Establish stable framing before dialogue begins.
8. Identify the speaking character explicitly.
9. Always introduce dialogue using: `[Character] says in English: "[Exact dialogue]." Lip sync.`
10. Describe voice and emotional delivery briefly.
11. Never change the original dialogue without authorisation.
12. For multiple speakers, assign separate speaking windows and identify the silent character.
13. Prefer camera transitions between dialogue lines.
14. Do not instruct characters to open or close their mouths.
15. Do not describe lip, jaw, tongue, phoneme or syllable mechanics.
16. Do not introduce unrelated languages into the prompt.
17. Do not use excessive or repetitive negative prompts.
18. Preserve eye direction and character continuity.
19. Maintain a photorealistic 35mm cinematic aesthetic, natural colours, subtle grain and scene-appropriate lighting.
20. Specify English dialogue and appropriate environmental ambience. Exclude music, narration, voice-over and subtitles unless requested.
21. If the dialogue cannot fit naturally within the requested duration, recommend increasing the duration rather than accelerating the speech.
22. If a multi-speaker generation repeatedly fails, recommend separate single-speaker shots.
23. Never sacrifice cinematic quality by unnecessarily simplifying the visual direction.
24. Output only the finished generation prompt unless an explanation is requested.

**Core principle: Direct the actor's performance, not the mechanics of their mouth.**

## Validation status

The single-speaker format has succeeded repeatedly in the user's reported generations. This does not guarantee every generation will succeed or establish which individual prompt change caused the improvement. The multi-speaker format, timing ranges and cinematography recommendations are starting points for further testing.


---

# Part 2. Wan 3.0 working recipe (user-approved, updated 24 November 2026)

**Dialogue prompts follow the user's standard above, word for word. It replaces every older Wan prompt form, including the English speech lock, the "NO native language" line, "natural mouth articulation", "Mouth closed", full-volume wording and negative lists. Core principle: direct the actor's performance, not the mechanics of their mouth.**

**References**
- The graded keyframe is the ONLY reference. No character sheets, face pictures, location pictures or audio.
- A speaking keyframe shows ONLY the speaker: no over-the-shoulder head or shoulder in a talking shot.
- Never use a frame pulled from a clip, or an upscaled crop, as a speaking keyframe.
- Every speaker's face must be visible in the keyframe, mouth closed, eyes on a stated target.

**Mode:** every clip is reference-to-video (user: "reference to video has a cinematic look"), the keyframe named `keyframe` and cited as `[@keyframe]`. Silent neighbours on one set may share one clip with `[@frame1]` and `[@frame2]` and one hard cut.

**Single speaker (the standard's template):**

    Single continuous [N]s cinematic shot. [Character] in [@keyframe] [position and environment]. Preserve identity, clothing, position and environment. [Camera angle], [shot size], [camera movement]. [Lens]mm lens, f/[aperture], shallow depth of field.

    00:00–00:01: [Camera movement, character action and eye direction].

    00:01–00:0[N-1]: Stable [shot size]. [Character] says in English: "[Exact dialogue]." Lip sync. [Voice type, emotional tone and delivery].

    00:0[N-1]–00:0[N]: [Natural reaction, expression or gaze direction], never into the lens.

    Photorealistic 35mm film aesthetic, subtle grain, natural colours, [lighting direction and quality], creamy background blur.

    Audio: English dialogue, [environmental ambience]. No music, narration, voice-over or subtitles.

Proven on The Man They Erased E3 C18 (the user's prompt, "The prompt worked"):

    Single continuous 5s cinematic shot. The young woman in [@keyframe] stands beside the scroll, holding the scorched sleeve against its bottom edge. Preserve identity, clothing, position and environment. Eye-level medium close-up, slow cinematic push-in. 85mm lens, f/1.4, shallow depth of field.

    00:00–00:01: Camera gently pushes towards her face as she looks at the elderly lady off-screen left.

    00:01–00:04: Stable medium close-up. The young woman says in English: “Why is this in his picture?” Lip sync. Clear, shaken and demanding young female voice.

    00:04–00:05: She maintains her gaze towards the elderly lady, visibly disturbed, never into the lens.

    Photorealistic 35mm film aesthetic, subtle grain, natural colours, soft morning light through paper doors on the left, creamy background blur.

    Audio: English dialogue, hushed room ambience. No music, narration, voice-over or subtitles.

**Two speakers:** use the standard's multi-speaker template (a stable shot per speaker, the camera moves only between lines, the silent one named). Never arc across the 180-degree line; if a speaker's face is not on the keyframe's side, cut to their own camera (A or B) as a separate clip. If a two-speaker clip fails twice, split it into single-speaker clips.

**Words and time:** use the standard's word table (5 s = 6 to 12 words, 4 s = 5 to 9, 3 s = 3 to 5). Size the clip to the line; never a long window for a short line. No clip over 7 s.

**If the lips fail twice on the same frame:** stop rewriting. Make a 4 s MiniMax H3 image-to-video take of the line from the same keyframe, let the user approve its lips, then Wan reference-to-video with `keyframe` + `video1` = that take: "Reference [@video1]'s performance, lip movements and timing exactly." (Fixed E3 C09 and C12.)

**Known drifts to check for**
- Wan may rebuild the background behind the face, or add a figure at the frame edge. Naming two set items from the frame helps.
- A line can start later than the timecode asks.
- A second copy of a prop can appear after a move. Fix in the edit first.

**Check every clip before showing it:** transcribe the words with word times, sheet the clip at 4 frames a second beside its keyframe, zoom on the mouth. The creator judges the lips.
