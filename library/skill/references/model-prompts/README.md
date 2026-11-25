# Prompt guides, one per model

Every generator reads a prompt differently. Write a prompt ONLY from the guide of the model that will run it. Never carry wording from one model's guide into another's (example of the damage: Seedance and Flow habits like "mouths closed", long avoid lists and language locks broke Wan's lips on The Man They Erased).

| Model (where) | Used for | Guide |
|---|---|---|
| Wan 3.0 (Pollo `alibaba` / `wan-v3-0`, reference-to-video) | All clips for The Man They Erased | [wan-3.0.md](wan-3.0.md) |
| MiniMax H3 (Pollo `minimax` / `minimax-h3`, image-to-video) | A lip reference take when Wan's lips fail twice on one frame | [minimax-h3.md](minimax-h3.md) |
| Google Flow, Omni 1.2 Flash (Flow runner extension) | Clips on earlier projects | [google-flow-omni.md](google-flow-omni.md) |
| Seedance (Pollo) | Not in current use | [seedance.md](seedance.md) |
| Adobe Firefly (GPT Image 2.6 through the Firefly bridge), Pollo GPT Image | Every still: masters, angle plates, keyframes, props | [stills-firefly-gpt-image.md](stills-firefly-gpt-image.md) |

Rules for every model:
- The script's exact words, in double quotes. Never reword a line.
- Never add to or cut from a prompt the user supplies.
- Verify the model's live schema (inputs, durations, price) before spending; these guides record what worked, not guarantees.
- Never suggest another model unless the user asks.
