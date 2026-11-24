---
name: credits
title: Spending credits
order: 60
keywords: credit, generate, generation, regenerate, remake, redo, retake, spend, cost, balance, pollo, firefly, batch, overnight
---
- PRE-SPEND LOCK (the gate enforces it): read the skill in full (SKILL.md, reference-video-production, shots-and-flow), write a pre-spend sheet, run `brain.py precheck <sheet.md>` (format: `brain.py precheck`), show its quote, wait for the user's own yes. Paid calls are then allowed only for the sheet's jobs. A retake needs a new sheet and a new yes.
- Generate only what the user asked for. An authorisation covers the work it named, not the next episode.
- Before paid work: an exact quote and the current balance.
- One take of every item. Pass the count as 1 explicitly; tools default to 2 or 4. Another take only if the first fails a check or the user asks.
- No automatic retry of a failed call. A successful result with a defect gets one targeted correction, with the reason recorded.
- Prove risky steps for free first: fill without generating, a 0-credit image, a dry run.
- After changing a tool or extension, confirm the new code is live before the first paid call.
- Record the real task ID only after the tool returns it. After an interruption, poll the existing job, never resubmit.
- Flow refusals are free. Flow image jobs are 0 credits. Never use the paid 4K upscale.
- Pollo is for images only, never audio.
- Report credits honestly, including what your own mistakes wasted.

## Learned the hard way
- 2026-11-21: Submitted 24 Pollo face options (6 characters x 4) right after 'start with character' without first showing the count, the exact credit cost and the balance; the creator felt credits were wasted. Rule: before any paid batch, state how many items, the exact cost and the balance, and wait for a go, even when the step was already named.
- 2026-11-22: Pollo audio allowed for voice references: on 22 November 2026 the user said yes to testing Pollo MiniMax speech (Korean voices reading English lines) after being told the card said Pollo is for images only. For The Man They Erased, Pollo text-to-speech may make short voice references for Wan; ElevenLabs is still not used for character voices. Quote count and cost first.
- 2026-11-23: User correction (24 Nov 2026): 2a and 2c (frames K5, K5e, K7) went as two clips, 14 s, when the whole action fits ONE 6 s shot. Rule: before quoting, read the beats in order and merge consecutive silent beats on the same set into one shot (first frame = first beat, end frame = last beat, middle beats in words). Pay for seconds only where the story needs them.
