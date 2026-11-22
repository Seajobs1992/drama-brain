---
name: references
title: Characters, props and location references
order: 20
keywords: character sheet, character, casting, cast, face, identity, portrait, prop, costume, wardrobe, reference, location reference, master, option board, skin, plastic
with: project, credits
---
Order of work: references first, inspected, then anything that depends on them.

**Faces and casting**
- The user chooses every face, ethnicity and voice from an options board (four options). Never pick for them, never proceed on your own pick.
- Voices come from Flow's 30 stock voices: doc `voices` lists them all with their descriptions. Offer three or four that fit, the user picks.
- First an identity image: head and shoulders, face large. Then the character sheet, built FROM that image.
- The sheet uses the user's template, word for word: `brain.py template character-sheet`. Never write your own sheet prompt. Three panels: face, full body, headless costume.
- Skin: add "Photorealistic. A real photograph.", two or three skin details, one light from a named side, 35mm film look. Avoid: flawless, perfect, smooth, beauty, 8K, hyper-realistic, cinematic, film still, "studio lighting", "soft even light". Full table: `brain.py section skin "Add"` and `"Avoid"`.
- For references in a prompt: number each image, say its role, and "Do not change the face, features, skin tone, body shape or identity."

**Props**
- Anything a character carries or wears as identity (bag, jewellery, key, chain, scarf, cup) is a prop with its own clean reference image, made from the first approved image it appears in.
- Record it in the project's prop ledger (doc `locks`): construction, which hand or arm, which episodes, its state.
- Attach the prop reference to every generation where the prop is visible. Check it in every frame like a face.

**Places**
- An empty location reference, then a populated scene master (positions, light). Close-ups and reverse angles come from the populated master.
- A new master must match the location authority in doc `locks` and the place's first wide shot. Put them side by side before using it.

**Always**
- No text, numbers, logos or plates in images.
- Log the real task ID only after the tool returns it. Never write a log row in the same batch as the generate call.
- Record every selection in doc `locks`. Your selection is not approval: show the board.

## Learned the hard way
- 2026-11-20: Description writers that state race or ethnicity (the original Storyboard Studio told its character writer to 'Include race/ethnicity') take the casting choice away: every face option came out the same person (The Cleaner, Ruth, 2026-11-20). Rule: character descriptions give age, build, hair and clothes but never race, ethnicity or skin colour; the creator picks those from face options.
- 2026-11-20: Storyboard tool location sheets drawn as four views in one image invent each quarter: the reverse repeated the wide, panel 3 was another room, panel 4 added a keyboard (The Cleaner office, 2026-11-20). Rule: make the wide master alone first; make every other angle from it as reference, with a written wall-by-wall room layout and the screen sides worked out per camera; no objects the script does not name.
- 2026-11-22: Location angles were planned by room direction only, so close shots had no usable background: the stage (Shot 17), the doorway (Shots 15, 16, 18) and the saloon by the ramp (Shots 10, 12) appeared only as tiny areas in the masters; the creator caught the missing stage view. Rule: before making angles, go shot by shot: write which way the camera faces and what fills the frame behind the subject at that shot size; wherever the master shows that area small, make a closer view of it. Show that shot-by-shot table with the quote.
