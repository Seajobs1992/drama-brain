---
name: edit
title: Assembling and finishing an episode
order: 50
keywords: assemble, assembly, join, final video, full video, render, captions, subtitle, srt, loudness, logo, watermark, end card, export, cut, timeline, sound mix, music
with: project
---
- Every clip has passed the picture check and the word check (card `clips`) before it enters the cut.
- Edit order comes from the table in the episode's animation script. Do not reorder by taste.
- Captions are the script's exact words, timed to the speech. Also write the `.srt`.
- Loudness: episode about -14 LUFS, dialogue clips about -17, ambience-only clips about -23.
- No music unless the user asks for it in the edit. Never music inside generated clips.
- Text that must be read (letters, signatures, signs) is added in the edit, tracked to the picture, because generated images carry no text.
- Brand: the watermark and end card named in the project file.
- Each episode has a rebuild script. A new cut is a new version number. Never overwrite a version the user has seen.
- Rejected takes are kept in named folders with the reason in the name, not deleted.

**Before telling the user it is ready**
- Contact sheet of the finished file in edit order: every shot present, captions visible.
- Transcribe the finished file: every line present, in order.
- Write or update the episode report: what went wrong, what was fixed, credits spent including credits wasted by your own mistakes, and what deserves the user's eye.
- Send the small phone preview with the report.

## Learned the hard way
- 2026-11-17: On 17 Nov 2026 the user cut EP02 themselves and asked for ONE ElevenLabs instrumental for the edit. Music in the user's own edit is allowed when they ask, and ElevenLabs is fine for music; the no-ElevenLabs rule is about character voices, and the no-music rule is about music baked into generated clips. Score to the cut's moods with timestamps, one take.
- 2026-11-17: LOCKED OUT already has a cover style: production/EP01/upload/EP01 TikTok cover 1080x1920.jpg. For each new episode the user wants that same cover with only the EPISODE number changed (Arial Black 56, dark on the yellow badge). Do not design or generate a new thumbnail; check the previous episode's upload folder first.
- 2026-11-19: Color and motion filters produced H264 yuv444p, rejected by Windows Media Player. Explicitly export yuv420p with H264 High profile and suitable level, and inspect pixel format and profile as well as decode success.
- 2026-11-19: User rejected opaque black panels over character freeze frames. Keep full picture visible and overlay readable names directly with subtle shadow. Do not add a black title panel or crop for introductions.
- 2026-11-19: Episode 1 time labels appear only once each: SIX YEARS EARLIER at the first past scene, PRESENT DAY at first return. Later flashbacks retain visual transitions without repeated time labels. Character introductions appear once per person, restrained and over the correct body.
- 2026-11-19: Freeze-frame character introductions must hold picture only. Build continuous music and ambience stems over the expanded timeline; keep dialogue aligned with moving shots. Never insert silence into the complete mixed soundtrack for a picture hold. User requests on-screen subtitles timed to exact spoken dialogue.
- 2026-11-19: User requires original-master quality for final delivery. Rebuild picture effects, holds, titles and subtitles directly from original footage in one pipeline; never chain lossy intermediate renders. Export a lossless edited master and clearly distinguish any compressed playback copy. Remove Yoon Jeong-suk freeze hold; keep her shot moving.
- 2026-11-19: User removed the EP01 pavilion wide shot at edited time17.00-18.67s (source15.75-17.416667). Keep all dialogue and retime subsequent audio/subtitles. Raise subtitle bottom margin to270px at2160p so player controls do not cover them; avoid collisions with time labels.
