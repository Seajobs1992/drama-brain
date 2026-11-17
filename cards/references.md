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
