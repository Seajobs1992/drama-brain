# Stills prompt guide: Adobe Firefly (GPT Image 2.6) and Pollo GPT Image

Use only for still images (masters, angle plates, keyframes, props). From 24 Nov 2026 every still for The Man They Erased is made in Firefly through the bridge (`tools/firefly-mcp-bridge`, `node ctl.mjs`); Pollo image credits are too costly.

**Order of work:** the empty master, then its four-wall set (FRONT, BACK, LEFT, RIGHT), then the staging map, then frames whose background is the wall behind each person (card `frames`).

**Four-wall view prompt (one image per wall, never four in one image):** "Image 1 is the approved <place>. Keep everything in it exactly: <the fixed items and the light>. Now make a new empty photograph of the same place from the opposite side, looking at the <BACK/LEFT/RIGHT> wall (<compass>): it shows <the items on that wall, from the master or the written layout>, <light direction as seen from here>. Eye level, 35mm lens, f/2.8. <Items that must NOT appear because they are behind the camera>. No people. No text. Photorealistic, <period>, 35mm film look. Landscape 16:9." Check each view against the master and its neighbours: corners join, furniture and light agree.

**Prompt shape**
- Image 1 is the approved place (master or angle plate): "Image 1 is the approved camera B view of the shed: keep its ... exactly." Name what must NOT appear from this camera ("NO cart wheel, NO loom").
- Then the camera: "Camera B, medium close-up, eye level, 85mm lens, f/1.4".
- Then each person by clothing with "(face and clothes from Image 2)", their spot, hands (LEFT or RIGHT), props with counts, eye target and side ("turned a little to screen LEFT ... off screen LEFT").
- Speaking frames: "Mouth CLOSED, face large, level and nearly frontal", and "He is ALONE in the frame" unless the shot is a planned over-the-shoulder (then name and reference the foreground person).
- End: "Photorealistic, late Joseon Korea, 35mm film look, subtle grain, natural colour. No text, letters or numbers anywhere. Nobody looks into the camera. Landscape 16:9."
- Edits: one approved scene reference and one clear change; short.

**Firefly refusals:** a silent refusal blocks the runner for 40 minutes. Avoid "trapped", "torn", "bleeding", "bright blood" (write "a thin red cut"), describe children by name, prefer calm reference frames. If a job sits generating over 6 minutes, have the user look at the tab.

**Bridge:** the Firefly tab must stay in view (Chrome pauses hidden tabs). A job can finish without downloading; ask the user to download it, then move it into the project.

**Pollo GPT Image (if ever used again):** it kept turning eyes against the axis (E2-12, E2-20); state the eye target and screen side every time and check it.
