# AI Cinematography — Camera Movements, Angles and Shots

A practical prompt reference for AI micro-drama production.

## 1. Camera movements (18)

| Camera movement  | AI video prompt                                                          |
|------------------|--------------------------------------------------------------------------|
| 01\. Static      | Locked-off camera, fixed frame, only the subject moves.                  |
| 02\. Pan         | Slow camera pan from left to right.                                      |
| 03\. Tilt        | Slow camera tilt upwards from boots to face.                             |
| 04\. Push In     | Slow cinematic dolly in towards a close-up of the subject’s face.        |
| 05\. Pull Out    | Slow dolly backwards to reveal the surrounding environment.              |
| 06\. Tracking    | Steadicam follows closely behind the moving subject.                     |
| 07\. Truck       | Camera moves horizontally alongside the subject at matching speed.       |
| 08\. Orbit       | Camera smoothly orbits 180 degrees around the subject.                   |
| 09\. Crane Up    | Camera rises smoothly from ground level to high above the subject.       |
| 10\. Handheld    | Handheld camera with subtle, natural camera shake.                       |
| 11\. Crash Zoom  | One decisive, rapid zoom into the subject’s eyes.                        |
| 12\. Dolly Zoom  | Subject remains the same size while the background appears to stretch.   |
| 13\. Whip Pan    | Rapid camera pan to the right with natural motion blur.                  |
| 14\. FPV Drone   | FPV camera swoops down and flies through the doorway.                    |
| 15\. Rack Focus  | Focus gradually shifts from the foreground object to the subject’s face. |
| 16\. Bullet Time | Time appears frozen as the camera orbits around the subject.             |
| 17\. Top Down    | Overhead camera looking vertically down at the subject.                  |
| 18\. POV         | First-person perspective with the subject’s own hands visible in frame.  |

## 2. Camera angles and shots (20)

| Camera angle / shot          | AI generation prompt                                                                   |
|------------------------------|----------------------------------------------------------------------------------------|
| 01\. Eye Level               | Camera positioned at the subject’s eye level, natural perspective.                     |
| 02\. High Angle              | Camera positioned above the subject, looking downwards.                                |
| 03\. Low Angle               | Camera positioned below the subject, looking upwards.                                  |
| 04\. Bird’s Eye View         | Elevated aerial perspective looking down over the entire scene.                        |
| 05\. Dutch Angle             | Camera tilted diagonally to create tension and unease.                                 |
| 06\. Over the Shoulder (OTS) | Camera positioned behind one character’s shoulder, focusing on the opposite character. |
| 07\. Close-Up (CU)           | Tight framing of the subject’s face, capturing facial expressions.                     |
| 08\. Wide Shot (WS)          | Wide framing showing the subject and surrounding environment.                          |
| 09\. Long Shot (LS)          | Full-body framing showing the subject from head to toe within the environment.         |
| 10\. POV Shot                | First-person perspective through the character’s eyes.                                 |
| 11\. Top Down                | Camera directly overhead at a 90-degree downward angle.                                |
| 12\. Side Angle              | Camera positioned beside the subject, capturing their profile.                         |
| 13\. Back View               | Camera positioned directly behind the subject.                                         |
| 14\. Framed Shot             | Subject framed through a doorway, window or foreground object.                         |
| 15\. Symmetrical Shot        | Centred subject with balanced, symmetrical composition.                                |
| 16\. Tilt Up                 | Camera gradually tilts upwards to reveal the subject.                                  |
| 17\. Tilt Down               | Camera gradually tilts downwards to reveal the subject.                                |
| 18\. OTS Close-Up            | Tight over-the-shoulder framing focusing on the opposite character’s face.             |
| 19\. Leading Lines           | Environmental lines guide the viewer’s attention towards the subject.                  |
| 20\. Extreme Low Angle       | Camera positioned near ground level, looking sharply upwards.                          |

## 3. Additional essential cinematic shots (18)

| Shot                    | AI generation prompt                                                                |
|-------------------------|-------------------------------------------------------------------------------------|
| Extreme Wide Shot (EWS) | Expansive environmental framing with the subject appearing small.                   |
| Establishing Shot       | Wide cinematic view establishing the location and atmosphere.                       |
| Medium Shot (MS)        | Frame the subject from the waist upwards.                                           |
| Medium Close-Up (MCU)   | Frame the subject from the chest upwards.                                           |
| Medium Long Shot (MLS)  | Frame the subject from the knees upwards.                                           |
| Extreme Close-Up (ECU)  | Extreme close-up isolating the eyes, lips or another specific detail.               |
| Cowboy Shot             | Frame the subject from mid-thigh upwards.                                           |
| Two Shot                | Frame two characters together within the same composition.                          |
| Three Shot              | Frame three characters together within the same composition.                        |
| Single Shot             | Isolate one character within the frame.                                             |
| Dirty Single            | Frame one character with part of another character visible in the foreground.       |
| Clean Single            | Frame one character without another character visible in the foreground.            |
| Reaction Shot           | Focus on the character’s emotional reaction to an event or dialogue.                |
| Insert Shot             | Tight framing of an important object, hand movement or detail.                      |
| Cutaway Shot            | Focus on a secondary object or event away from the main action.                     |
| Reverse Shot            | Opposite camera perspective of the conversation while maintaining screen direction. |
| Ground-Level Shot       | Camera positioned at ground level, looking across the scene.                        |
| Three-Quarter Shot      | Camera positioned approximately 45 degrees from the subject’s front.                |

## 4. Best camera combinations for micro-drama

| Scene                       | Camera combination                      |
|-----------------------------|-----------------------------------------|
| Emotional dialogue          | Medium close-up + eye level + static    |
| Shocking revelation         | Close-up + slow push in                 |
| Powerful character entrance | Medium long shot + low angle + tracking |
| Secret conversation         | Over the shoulder + static              |
| Character crying            | Extreme close-up + slow push in         |
| Villain introduction        | Low angle + slow tilt up                |
| Suspense                    | Medium shot + slow dolly in             |
| Character feeling helpless  | High angle + slow pull out              |
| Argument                    | Dirty single + subtle handheld          |
| Discovering evidence        | Insert shot + rack focus                |
| Dramatic betrayal           | Close-up + dolly zoom                   |
| Palace introduction         | Extreme wide shot + crane up            |
| Character walking away      | Back view + tracking                    |
| Intense confrontation       | Over-the-shoulder close-up + static     |
| Unexpected discovery        | Reaction shot + crash zoom              |

## 5. Master camera prompt structure

``` text
Shot size:
Camera angle:
Camera movement:
Camera position:
Lens:
Aperture:
Focus:
Subject action:
Continuity lock:
```

### Example: cinematic dialogue scene

``` text
Single continuous cinematic shot.

Medium close-up, eye-level camera,
three-quarter angle, slow subtle dolly in.

85mm lens, f/1.4, shallow depth of field.
Sharp focus on the subject's eyes,
soft cinematic background blur.

Preserve character identity, clothing,
body position, eyeline, lighting and
environment exactly as in the reference.

Only the camera performs the specified
movement. No unintended character movement,
repositioning, reframing or scene changes.
```

For a continuity-locked AI micro-drama workflow, treat **shot size, camera angle, camera movement, lens and subject blocking as separate parameters** rather than combining everything into a vague cinematic instruction.

Note: The first two sections preserve the categories of the supplied reference images, including overlapping entries. Rack focus is a focus technique, while top down and POV describe perspective rather than physical camera movement.

## 6. How this movie uses this guide (user rule, 24 November 2026)

The user: "we are doing more than AI film, we are doing AI reality movie". Every shot plan and every frame and clip prompt uses this guide:
- Each shot names its shot size, camera angle and camera movement from the tables above as separate parameters, plus lens, aperture and focus, chosen to fit the beat (section 4 gives starting combinations).
- Vary them across a scene: no run of shots at the same size and angle. Use establishing, reaction, insert, cutaway, dirty single and reverse shots where the story needs them.
- Keyframes: the still shows the OPENING of the shot at its stated size and angle, because the video model starts from it. Movement goes in the clip prompt, not the still.
- Wan clip prompts: the camera travels in silent beats; a speaking face is held in a stable shot (see the "Wan 3.0 working recipe" in reference-video-production).
