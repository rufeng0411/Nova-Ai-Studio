# Fan cam examples

These examples are generic. Do not reuse private user details, local file
paths, or conversation-specific prompts.

## Football final, nervous supporter

User details:

```text
International football final. The uploaded person is a national team supporter
in a packed night stadium. Tense match atmosphere, compact score overlay,
small top-right football live channel bug, realistic broadcast crowd cutaway.
Reaction: nervous.
Budget: economy.
```

Plan:

- GPT Image 2 quality: `low`.
- Kling endpoint: `fal-ai/kling-video/v3/standard/image-to-video`.
- Beats: 3 beats, 9 seconds.

Image prompt:

```text
Use the uploaded photo as the identity reference for the featured spectator.
Preserve the real face, age impression, skin tone, hair, facial hair, glasses
if present, face structure, pores, asymmetry, and ordinary imperfections.
Create a horizontal 16:9 realistic live TV broadcast screenshot from an
international football final at night. The person is seated naturally among
packed national team supporters, watching the pitch with a nervous reaction:
alert eyes, tight mouth, slightly raised shoulders, and a small forward lean.
Use a professional football broadcast camera look with mild compression noise,
subtle motion blur, off-center crop, foreground heads partly blocking the view,
imperfect background faces, and natural stadium floodlights. Add a compact
score and match-clock overlay and a small top-right generic channel bug reading
"FOOTBALL LIVE". No AI beauty retouching, no face anatomy changes, no portrait
orientation, no studio portrait, no fake sponsor marks, no oversized logos, no
warped text, no anime, no cartoon.
```

Kling beats:

```json
[
  {
    "duration": "3",
    "prompt": "Use @Element1 as the exact live football broadcast cutaway. Preserve the featured supporter, compact score overlay, top-right FOOTBALL LIVE bug, seat layout, outfit, lighting, and nervous reaction. Add mild TV feed vibration, tiny head motion, crowd shoulder movement, and realistic compression."
  },
  {
    "duration": "3",
    "prompt": "Stay on @Element1. The supporter keeps watching the pitch with alert eyes, a small blink, tight mouth, and stiff shoulders. Nearby fans shift and lean toward the action. Keep identity, wardrobe, scoreboard, channel bug, stadium light, and crowd depth stable."
  },
  {
    "duration": "3",
    "prompt": "End on @Element1 as the football crowd rises around a dangerous offscreen chance. Foreground heads move, arms lift softly out of focus, and the featured supporter stays nervous and locked on the match. Preserve face, overlay, channel bug, venue, and broadcast realism."
  }
]
```

## Basketball playoff, excited lower-bowl fan

User details:

```text
Professional basketball playoff game. The uploaded person is in lower-bowl
seats near the court, wearing home-team colors. Bright arena lights, hardwood
glow, compact quarter and game-clock overlay, crowd reacting to a late shot.
Reaction: excited.
Budget: balanced.
```

Plan:

- GPT Image 2 quality: `high`.
- Kling endpoint: `fal-ai/kling-video/v3/pro/image-to-video`.
- Beats: 4 beats, 12 seconds.

Channel bug:

```text
BASKET LIVE
```

Beat structure:

1. Establish lower-bowl broadcast cutaway.
2. Fan leans in and reacts to offscreen play.
3. Broadcast camera tightens through moving foreground fans.
4. Arena crowd surges around the fan.

## Tennis final, restrained focused spectator

User details:

```text
Major tennis final. The uploaded person is a spectator in center court seating.
Restrained crowd, green court atmosphere in the background, compact tennis
scoreboard, small top-right tennis channel bug. Reaction: focused.
Budget: premium.
```

Plan:

- GPT Image 2 quality: `high`.
- Kling endpoint: `fal-ai/kling-video/v3/pro/image-to-video`.
- Beats: 3 beats, 9 seconds.

Channel bug:

```text
COURT LIVE
```

Notes:

- Tennis crowds should not behave like football crowds.
- Use restrained applause, head turns, quiet tension, and small expression
  changes.
- Scoreboard should use player names, sets, games, or points rather than a
  football-style clock.

## Racing grandstand, surprised spectator

User details:

```text
Formula racing street circuit. The uploaded person is watching from a crowded
grandstand as something fast happens offscreen. Sunlit race-day broadcast,
timing tower graphics, grandstand flags and headphones, small racing channel
bug. Reaction: surprised.
Budget: premium 4K final.
```

Plan:

- GPT Image 2 quality: `high`.
- Kling endpoint: `fal-ai/kling-video/v3/4k/image-to-video`.
- Beats: 4 beats, 12 seconds.

Channel bug:

```text
RACE LIVE
```

Notes:

- Do not use ball-sport language.
- Motion should come from head turns, fast offscreen tracking, flag movement,
  and crowd reaction to the race.

## Caught eating at a live match

User details:

```text
Live sports match. The uploaded person is caught by the broadcast camera while
eating a snack in the stands, then realizes the camera is on them. Packed crowd,
compact score overlay, small generic channel bug, candid but not slapstick.
Reaction: surprised then amused.
Budget: balanced.
```

Plan:

- GPT Image 2 quality: `high`.
- Kling endpoint: `fal-ai/kling-video/v3/pro/image-to-video`.
- Beats: 5 beats, 15 seconds.

Beat structure:

1. Establish the person mid-snack in the live broadcast cutaway.
2. They keep eating while watching the event.
3. Nearby fans notice the camera or screen.
4. The person realizes and reacts naturally.
5. Crowd energy rises while the person laughs or freezes.

Prompt notes:

- Keep food ordinary and event-plausible.
- Avoid humiliating or exaggerated comedy framing.
- Keep identity preservation stronger than the gag.

## Combat sports, angry but restrained spectator

User details:

```text
Championship fight night. The uploaded person is seated in a lower-bowl crowd,
watching a controversial exchange. Dramatic arena light, round clock overlay,
small fight-night channel bug, nearby fans reacting. Reaction: angry.
Budget: economy.
```

Plan:

- GPT Image 2 quality: `low`.
- Kling endpoint: `fal-ai/kling-video/v3/standard/image-to-video`.
- Beats: 3 beats, 9 seconds.

Channel bug:

```text
FIGHT LIVE
```

Notes:

- Angry means tense jaw and restrained complaint, not violence.
- Preserve the person as an ordinary spectator.
