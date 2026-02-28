# Image Generation Prompts

## Prompt composition

- **Source files**: prompts are defined in `src/lib/constants.ts` (`BASE_TEMPLATE`, `ACTION_PROMPTS`, `RUN_DIRECTION_LOCK`) and assembled by `src/lib/prompt.ts` (`composePrompt`).
- `composePrompt` starts with `BASE_TEMPLATE`, injects the action-specific prompt, and then, when the user supplies a custom prompt, appends it inside an `=== USER CUSTOM CONSTRAINTS ===` block (after sanitizing to 300 characters and stripping HTML tags).
- When the user chooses the **run** action, `composePrompt` also appends the `RUN_DIRECTION_LOCK` paragraph inside an `=== DIRECTION LOCK (NON-NEGOTIABLE) ===` block to keep the character facing the same direction.
- The `actionPrompt` for the `custom` action is built from the sanitized user prompt (defaulting to `a clean idle loop` when empty) so that `BASE_TEMPLATE` always has a complete action description.
\
The same logic runs when the create page sends a task: `src/app/create/page.tsx` gathers the selected action, optional custom prompt, and calls `composePrompt`, then forwards `finalPrompt` to the AI task queue. This doc tracks the text payload that hits the image generator.

## Base template

```
Convert this character image into a pixel art sprite sheet for game animation.

=== LAYOUT ===
- 4 rows x 4 columns = 16 animation frames total (left-to-right, top-to-bottom)
- Square canvas (1:1 ratio)
- Seamless white background (#FFFFFF), no cell border lines

=== CHARACTER CONSISTENCY (CRITICAL) ===
- Keep body proportions, face/hair/clothes colors and character size consistent across all frames
- Only limb pose changes between frames
- Full body visible in each frame

=== LOOP STABILITY (CRITICAL) ===
- Fixed camera and framing for all 16 frames (no zoom, no pan, no crop changes)
- Keep character anchored to a stable center and stable scale to avoid jitter/flicker
- Preserve silhouette readability frame-to-frame; no random shape mutation
- Use smooth in-between transitions with even temporal spacing
- Frame 16 must connect naturally back to frame 1 for a seamless loop

=== ANIMATION ===
[INJECT_ACTION_PROMPT]

=== PIXEL ART STYLE ===
- 8-bit retro game sprite style
- Clean black outlines
- Limited palette (16-32 colors)
- No anti-aliasing
```

## Action-specific prompts

The `ACTION_PROMPTS` record hard-codes one prompt per built-in action. Each prompt assumes a 16-frame loop and describes pacing, pose progression, and loop requirements.

- `walk`: "16-frame side-view walk loop, one facing direction. Key pose order: right-contact -> down -> passing -> up -> left-contact -> down -> passing -> up, then continue to frame 16 and loop to frame 1. Obvious stepping (not idle): clear foot separation, left-right weight shift, opposite arm swing. No duplicate or near-duplicate adjacent frames."
- `run`: "16-frame run loop, one facing direction only. Fast contact/recoil with clear airborne moments, strong forward lean, and energetic opposite arm swing. Keep motion progression obvious in every frame; no duplicate or near-duplicate adjacent frames. Never flip/mirror or turn to the opposite side."
- `jump`: "16-frame jump loop: crouch -> takeoff -> peak -> descent -> landing -> recovery. Keep arc and timing coherent, with clear vertical displacement and landing compression. No duplicate or near-duplicate adjacent frames; frame 16 loops naturally to frame 1."
- `idle`: "16-frame subtle idle loop, one facing direction. Keep frames mostly similar with tiny breathing, slight body sway, and occasional blink. Motion must stay minimal and calm; micro-change is expected (adjacent frames can be close). Seamless loop from frame 16 to frame 1."
- `attack`: "16-frame melee attack loop: wind-up -> strike -> follow-through -> recover. Keep strong silhouette changes and readable impact timing. Clear progression per frame, no duplicate or near-duplicate adjacent frames, and natural loop continuity."
- `fall`: "16-frame fall/hit loop: lose balance -> descend -> impact -> settle. Emphasize gravity and weight with visible vertical change and impact compression. Keep per-frame progression clear, avoid duplicate or near-duplicate adjacent frames, and maintain a smooth loop."
- `custom`: Template string `16-frame animation of: {user_custom_prompt}. Keep a complete smooth loop.` (the placeholder is replaced with the sanitized custom prompt).

## Direction lock for runs

When `actionType === "run"`, the prompt builder appends the following text block:

```
Run direction lock rule: keep one fixed facing direction across all 16 frames; do not turn around, do not face the opposite side, and do not horizontally flip/mirror in any frame.
```

Keeping this block separate ensures the AI never reverses the facing direction mid-loop and enforces consistent spatial orientation for fast actions.

## Custom constraints

- Custom prompts are sanitized (`trim`, remove `<...>` tags, cap at 300 characters) before use.
- For built-in actions, the sanitized custom string is appended after `=== USER CUSTOM CONSTRAINTS ===` so that the base prompt still describes the canonical action while the custom text adds fine-tuned constraints (e.g., color hints, accessories, mood). For the `custom` action, the sanitized text replaces `{user_custom_prompt}` inside the action prompt itself.

## How the final prompt looks

`composePrompt` returns `finalPrompt`, `actionPrompt`, and `customPrompt`. The `finalPrompt` string consists of:
1. The `BASE_TEMPLATE` with `[INJECT_ACTION_PROMPT]` replaced by the chosen action prompt.
2. If the user supplied a custom prompt (and the action is not `custom`), an `=== USER CUSTOM CONSTRAINTS ===` section containing the sanitized text.
3. If the action is `run`, an additional `=== DIRECTION LOCK (NON-NEGOTIABLE) ===` section containing the run direction lock rule.

Use `finalPrompt` when you send the request to the image-generation API; the other two return values help diagnose which piece came from the action template vs. user input.

## Example: composed prompt payload

1. **User selection**: action `run`, custom note `"fast sprint with wind-blown cape and glowing boots"`.
2. `composePrompt` injects the `run` entry from `ACTION_PROMPTS` into `BASE_TEMPLATE`, appends the sanitized custom text as `=== USER CUSTOM CONSTRAINTS ===`, then adds the `RUN_DIRECTION_LOCK` block because the action is `run`.
3. The resulting `finalPrompt` looks like (line breaks preserved to emphasize sections):

```text
Convert this character image into a pixel art sprite sheet for game animation.

=== LAYOUT ===
- 4 rows x 4 columns = 16 animation frames total (left-to-right, top-to-bottom)
- Square canvas (1:1 ratio)
- Seamless white background (#FFFFFF), no cell border lines

=== CHARACTER CONSISTENCY (CRITICAL) ===
- Keep body proportions, face/hair/clothes colors and character size consistent across all frames
- Only limb pose changes between frames
- Full body visible in each frame

=== LOOP STABILITY (CRITICAL) ===
- Fixed camera and framing for all 16 frames (no zoom, no pan, no crop changes)
- Keep character anchored to a stable center and stable scale to avoid jitter/flicker
- Preserve silhouette readability frame-to-frame; no random shape mutation
- Use smooth in-between transitions with even temporal spacing
- Frame 16 must connect naturally back to frame 1 for a seamless loop

=== ANIMATION ===
A precise 16-frame, alternating-leg sprint running loop on a clean white background. Poses progress frame-by-frame logically with a strong forward lean and energetic, synchronized opposite arm swings (e.g., Frame 1 shows right foot contact, and an energetic left arm forward swing). Frames 1 through 8 depict the complete cycle of the right foot contacting the ground, pushing off, and entering a clear airborne moment, leading into the left leg cycle. Frames 9 through 16 depict the exact mirror-phase action for the left foot, showing its contact, push-off, and airborne moment. The overall sequence across the entire 16 frames creates a seamless, un-interrupted alternating-leg movement pattern, with Frame 16 smoothly transitioning back to the Frame 1 pose for a perfect loop. Keep motion progression obvious and distinct in every single frame; no duplicate or near-duplicate adjacent frames. Never flip/mirror or turn to the opposite side. Dynamic wind-blown cape and glowing boots are visible in all frames.

=== PIXEL ART STYLE ===
- 8-bit retro game sprite style
- Clean black outlines
- Limited palette (16-32 colors)
- No anti-aliasing

=== USER CUSTOM CONSTRAINTS ===
fast sprint with wind-blown cape and glowing boots

=== DIRECTION LOCK (NON-NEGOTIABLE) ===
Run direction lock rule: keep one fixed facing direction across all 16 frames; do not turn around, do not face the opposite side, and do not horizontally flip/mirror in any frame.
```

This payload is what gets dispatched to the image-generation API, ensuring action intent, user tweaks, and strict run-direction handling coexist in a single string.


=== ANIMATION ===
A precise 16-frame, alternating-leg sprint running loop on a clean white background. Poses progress frame-by-frame logically with a strong forward lean and energetic, synchronized opposite arm swings (e.g., Frame 1 shows right foot contact, and an energetic left arm forward swing). Frames 1 through 8 depict the complete cycle of the right foot contacting the ground, pushing off, and entering a clear airborne moment, leading into the left leg cycle. Frames 9 through 16 depict the exact mirror-phase action for the left foot, showing its contact, push-off, and airborne moment. The overall sequence across the entire 16 frames creates a seamless, un-interrupted alternating-leg movement pattern, with Frame 16 smoothly transitioning back to the Frame 1 pose for a perfect loop. Keep motion progression obvious and distinct in every single frame; no duplicate or near-duplicate adjacent frames. Never flip/mirror or turn to the opposite side. Dynamic wind-blown cape and glowing boots are visible in all frames.