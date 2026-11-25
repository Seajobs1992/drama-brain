---
name: review
title: When the user reports a problem or asks why
order: 70
keywords: why, wrong, rubbish, terrible, bad, mistake, problem, issue, bug, not right, doesnt match, doesn't match, fix, check, review, compare, different
---
- Look before you answer. Open the actual files, make a contact sheet, put the output beside its reference. Do not answer from memory.
- Check the rules first: `brain.py find "<words>"`. If the rule exists, say so: the failure was yours, not a gap in the rules.
- Answer plainly: what is wrong, where (shot IDs), why it happened, and whether it was your prompt, your check, or the tool.
- A complaint or a question is not an order to regenerate. Report and wait. When the user says fix it, fix everything they named, one take each, verify each, then report.
- Name every other fault you found while looking, even ones they did not mention.
- Never defend an output because it was "approved earlier". The latest correction wins.
- After fixing: `brain.py lesson "<what went wrong, and the rule>" --card <name>`, so the same mistake is blocked next time for Claude and Codex both.

## Learned the hard way
- 2026-11-22: A small prop came out oversized (The Valet EP02 Clip B1: the engagement ring rendered as a chunky man-sized band) because the prop reference was a macro shot with nothing for scale and the prompt gave no size. Rule: for small props, state the real size against a body part ('fine, sized for a woman's finger, band thinner than a matchstick') and give the insert a keyframe that shows the prop in a hand. Also my first check missed most faults: check a clip at 4 frames a second through every shot, not 2, before reporting.
- 2026-11-17: When another writer edits the active screenplay, reread current file and chapter boundaries before repeating findings. Cite current episode numbers and distinguish resolved findings from remaining issues.
- 2026-11-18: A clip matching its own starting frame does not prove sequence continuity. Compare adjacent shots against one pavilion layout and explicit character positions; do not pass landing/hoist shots when men teleport between the landing and far end without an on-screen or clearly motivated move. Review the assembled sequence before calling it usable.
- 2026-11-19: When a spatial master is corrected, audit every dependent shot including recovered clips against the entire layout: boy/cradle, shaft, divider, men, seats, and state. Prior reference status and successful decoding do not certify continuity. Never package recovered clips without picture review.
- 2026-11-21: The rebuilt pavilion exit-route prompt asked Firefly to reveal unestablished geometry. It drew a broad landing and staircase and changed the location. Exclude that result. Use locked approved backgrounds for visible coverage; establish the stair connection in an approved layout before requesting a new angle that reveals it.
- 2026-11-21: The bounded Firefly stair test was also rejected. The steps read as feeding onto the suspended cradle. Mark the stair head and separate fixed landing on the approved location layout before another take.
- 2026-11-21: User marked the exit stair head at the foreground edge of the fixed hall floor immediately left of the divider. Refer to EXIT-STAIR-USER-MARKUP.png before any stair generation.
- 2026-11-21: The gift-table prompt assumed the tall writing desk under the fire scroll was the gift table. The user rejected the result. Verify the gift table identity and placement against the pavilion master before another take.
- 2026-11-25: I called a clip's eyeline wrong from a small contact sheet (The Valet C07: Lena looked screen RIGHT as planned; I reported LEFT and nearly spent two jobs on a fix). Rule: before reporting an eyeline fault, crop the eyes at full size every half second and confirm iris position and head turn against the plan's screen direction.
