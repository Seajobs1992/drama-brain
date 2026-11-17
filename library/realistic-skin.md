# Prompt rules for realistic skin

Researched 15 November 2026 after the creator found Jonah's skin "like plastic, too smooth". Applies to every character image in this series.

Source quality: the OpenAI prompting guide for GPT Image 2.6 and Runware's GPT Image 2 guide are the best sources. The rest are vendor and tutorial blogs that agree with each other but are not controlled tests.

## Add

| Rule | Example wording | Source |
|---|---|---|
| Say plainly that it is a photograph | "Photorealistic. A real photograph." | OpenAI, Runware |
| Name two or three skin details, no more | "visible pores, fine lines at the eyes, uneven skin tone" | OpenAI, Runware, blogs |
| Use OpenAI's exclusion line | "Real skin texture. No glamorization, no heavy retouching." | OpenAI, Runware |
| One light from one named side | "soft window light from camera left, natural shadow on the far cheek" | blogs |
| Camera words describe the look, not the physics | "35mm film photograph, 50mm lens, eye level, subtle film grain" | OpenAI, Runware |
| Labelled sections in this order | Scene or background, then Subject, then Details, then Constraints | OpenAI |
| With a reference image, number it, give its job, and list what to preserve | "Image 1 is the identity reference. Do not change his face, facial features, skin tone, body shape or identity in any way." | OpenAI, Runware |
| **Make the face big** | Identity image as a medium close-up, head and shoulders | observed on Jonah v3 and v4 |

## Avoid

| Avoid | Why |
|---|---|
| flawless, perfect, smooth, airbrushed, beauty, glam | Tells the model to smooth. One such word can cancel the texture words |
| 8K, hyper-realistic, ultra-detailed, masterpiece | Linked to an over-processed digital look. Sources disagree on 8K; drop it to be safe |
| studio lighting, soft even light | Flat, even light removes the shadows that show texture |
| cinematic, film still, movie poster, dramatic colour grading | OpenAI steers away from these for realism |
| Long lists of skin flaws | Prompt overload can cause a scaly "fish scale" skin artefact |
| Banning blur, noise or grain | Grain is part of what reads as a real photograph |
| Stacking several lighting setups | One clear direction works better |

## What went wrong on Jonah

- My prompts said "plain warm-grey studio background, soft even light" and "realistic contemporary film still". Both are on the avoid list.
- Every identity image was full figure, so the face was about 150 pixels tall in a 2K frame. That is too small for pores. The sheet's large face panel was then built from that small face and came out smooth.
- v4 used a long list of skin flaws. It added some redness but not real texture, which fits the warning about overload.

## Two open points for the creator

1. **Your template** says "consistent soft studio lighting" and "sharp production-reference detail". The first is on the avoid list. I have not changed your template. If the sheet still comes out smooth from a good close-up reference, adding one line such as "Real skin texture, no glamorization, no heavy retouching" is the smallest change to test.
2. **Quality setting.** OpenAI says quality controls "how much visual detail the model can render, such as texture". Neither guide says High fixes skin. A Medium against High test on the same prompt costs 4 and 9 credits.

## Identity portrait prompt, using these rules

```
BACKGROUND: plain warm-grey painted backdrop.

SUBJECT: Image 1 is the identity reference. Use this exact man. Do not change his face, facial features, skin tone, hair, beard, build or identity in any way. A white man, 33, olive waxed-canvas work jacket with a darker brown cord collar and brass buttons, charcoal henley.

DETAILS: Photorealistic. A real photograph. Medium close-up, head and shoulders, eye level, facing the camera, neutral expression. Soft window light from camera left, natural shadow on the right cheek. Visible pores, fine lines at the eyes, uneven skin tone. 35mm film photograph, 50mm lens, subtle film grain, natural colour.

CONSTRAINTS: Real skin texture. No glamorization, no heavy retouching. 16:9. No text, no red anywhere.
```
