# Production, continuity and quality

Production discipline adapted from Pollo's `/short-drama-creator` skill and merged with this skill's own lessons. Story, genre and directing decisions stay with SKILL.md and the other references; this file governs how approved material becomes reliable footage and how footage is judged. Where the two differ, the creator's rules win (casting, race, voices, budget).

## Beats, shots and jobs

A beat changes the story; a shot is a choice of coverage; a generation job is one model request. They need not match one to one. Keep a whole spoken line and its essential reaction in one unit when possible. Give each job one dominant purpose and split it when dialogue, interaction or prop changes exceed what the route has shown it can handle, not merely because the script starts a new sentence. Replace travel with the meaningful arrival.

## Timing feasibility

Before showing any timed plan:
1. Time every spoken line at a natural pace in its language, with its pauses and interruptions.
2. Add the seconds for visible action, reactions, the held beat after a decisive line, and any new location the viewer must read.
3. Confirm it fits each time range and the total. Never fill the whole runtime with talk.
4. If locked dialogue does not fit, keep the words and say so; never hide it with rushed delivery or a dropped reaction.

## Continuity bible

Give every recurring element a stable ID: characters, locations and sub-spaces, critical props, wardrobe and injury states, voices. Record fixed features apart from scene state; a scene prompt never redefines a master identity. One master identity reference per character goes into every clip that shows them (directly or through a keyframe built from it). Keep one global look lock (medium, palette, white balance, contrast, light direction, time of day, lens and texture) and apply it to every character, location, prop, keyframe and clip prompt.

Character references show only what changes the picture: age, face structure, hair, build, distinguishing features, wardrobe, palette. Never state race, ethnicity or skin colour; the creator picks faces from options. No labels or text inside reference images.

Location references show fixed geometry, entrances, furniture, light sources and signature objects, with no people. Variants (time, weather, damage) are made from the master so the layout holds. Check every shot's background against a location picture at the right distance (see the background table in shots-and-flow).

## Prop state and the causality gate

For every critical prop keep, per beat: visible or absent, holder and hand, location, orientation, state (full, empty, wet, open), and the action that changes it. Record when it is first seen and how it got there.

- A prop is established before first use, or acquired visibly at that beat.
- It stays with the same owner, hand or place until a visible action or a scene change moves it.
- "Not visible because of framing" is not "absent": keep its last known owner and place in the next prompt.
- Before a dependent keyframe or clip, compare its incoming state with the last accepted one and block the call if a prop's source, owner, hand or visibility cannot be explained.
- Count handheld objects in the keyframe and the prompt ("one coupe, in her right hand; her left hand is empty"). Reject any result where a prop appears, duplicates, switches hands or vanishes without its recorded action.
- An action with a prop (a pour, a handoff, a drop) happens in one shot only; neighbouring shots show the before or after state. Split a difficult handoff into: A holds it, the handoff, B holds it.

## Blocking map

Before keyframes, make one blocking map per continuous scene: each person's mark tied to a fixed landmark, posture, facing, gaze target and screen side; each prop's holder and hand; the relationship axis. For each next keyframe record only the change: who moves, along which path, to which mark, what changes hands. Camera reframing alone never moves a person. Prefer one blocking change between neighbouring anchors.

## Gaze

Give every visible face a gaze target in every shot: another character, a prop, a fixed mark or a named off-screen point ("looks toward Margot, off screen right"). Never "looks forward" or "faces camera". Looking into the lens is allowed only for an approved direct address; otherwise forbid it and reject accidental lens contact.

## People per shot

Keep no more than two actively interacting people in one generated shot unless the route has proven it can handle more. A third person gets separate coverage, enters after someone leaves, speaks off screen, or stays still in the background, and is tracked while off screen; nobody who has not exited may vanish.

Genre exception: in humiliation, reveal and payback scenes the watching crowd is part of the drama. Keep the crowd as background and give their reaction its own shot (laughing behind hands, turning, freezing) rather than cutting the witnesses.

## Sound and dialogue

Keep a line record: speaker, exact wording, time, delivery note, and the accepted voice for that character. One voice per character across the whole series; check that a new clip's voice still matches. Native dialogue is used where lips must sync; an off-screen line or voice-over has no visible lips. Choose sound for its job: the room, an action, a held silence of stated length, a cue that changes the room. Music never goes inside a clip; it is an edit decision.

## Faces on lines

Every spoken line plays on a shot where the speaker's face is readable: a medium close-up or closer, or at least a clear medium. A wide only establishes the place, for 2 to 3 seconds, then cuts in to the speaker. Never put an important line on a wide where the speaker is small.

## Edit and finish (from invideo's editing skills)

- Save close-ups for the two or three beats per scene that need the eyes; never cut two same-size shots of one face back to back. Cut on motion.
- One grade and grain across every clip, so the episode looks like one camera.
- Sound: one thing to listen to at a time. Pull music out just before the line that matters; after a big line let it play alone for 4 to 7 seconds; quiet makes loud. Music starts on a turn, never under the top of a scene.
- Captions and on-screen text are added in the edit, never generated; read every name and number letter by letter.
- After any edit change, look at the frames on either side of it and listen on a phone speaker.
- invideo (CLI and skill installed) is the finishing tool: join the clips, trim bad tails, add captions, mix, grade, export. Creative decisions come from this skill.

## Checking footage

Judge the footage, not the prompt. A successful task proves media exists, not that it works. A transcript proves words and timing only; it does not prove who spoke, lip sync, emotion or voice consistency. Check the opening, the difficult action or line, and the ending state, more densely where failure is likely (4 frames a second through any prop action or movement).

| Check | Works when | Fails when |
|---|---|---|
| Story clarity | The goal, the obstacle and the turn read from the picture | The meaning exists only in the prompt |
| Rhythm | Order, holds, reactions and sound make the turn land | The reveal is early, the reaction missing or the hold dead |
| Acting | Expressions, pauses, gaze and reactions fit the intention | Emotion changes without cause, the key reaction is absent |
| Dialogue | Exact words, right speaker, natural pace | A line is missing, changed, reassigned or cut off |
| Identity and voice | Faces, wardrobe and voices stay recognisable | Drift or a voice switch changes who seems to speak |
| Space and props | Moves and handoffs are reachable and recorded | A jump, duplicate, hand switch or vanishing prop |
| Picture | Framing shows the action; movement serves the beat | Hands or faces hidden, morphs, flicker, extra shots |
| Sound | Lines are clear; sound or silence supports the turn | Noise hides a line or contradicts the picture |

Report ready, accepted, faulty and not yet generated scope separately, and say plainly what was not checked.

## Repair

Repair only the failing clip or picture, with a material change (references, timing, dialogue load, action complexity, coverage or performance), never the same paid job again. Cap: the first take plus at most two targeted repairs per failed clip within the approved budget; beyond that, the creator decides. For a missing line, one revised attempt with less load or the speaker isolated, then stop and propose another route. If the take is usable and the problem is order, hold, sound placement or text, keep the take and fix it in the edit.

After any picture is revised, recheck the whole active set (palette, light, props, wardrobe) and regenerate only what no longer matches; a change inherited by later pictures means those later pictures are redone from the revised one.
