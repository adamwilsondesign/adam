# World study assets

The four new artwork assets below were generated with the built-in image generation tool for this study on 2026-09-05. The user's references informed the monochrome tone and visual direction; none of those images was used verbatim as an environment asset. Sharp was used only for format conversion to WebP, preserving each generated alpha channel.

## Cloud bank and mountain ridges

These are summaries of the generation briefs, not verbatim generation prompts. Each original PNG and corresponding WebP is 1536 × 1024.

| Runtime asset                 | Generated source filename                       | Generation brief                                                                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/world-study/ridge.webp`     | `exec-b0ad0af7-029c-4ae4-8058-ec2845673c22.png` | An original isolated, detailed monochrome mountain ridge with sharp, weathered rock faces, a taller mass toward the right, a lower saddle toward the left, and directional silver light. Intended as a depth-layered landscape element with transparent sky around its silhouette. |
| `/world-study/low-ridge.webp` | `exec-f780c350-e595-4a7b-81ce-0a38d538c6b8.png` | An original lower, broader monochrome rocky ridge with a central valley, finely eroded surfaces, and restrained directional highlights. Intended to provide a distinct foreground and intermediate terrain silhouette against transparent sky.                                     |
| `/world-study/cloud.webp`     | `exec-3177bb8a-5fa1-451f-8097-ea6790df23a4.png` | An original isolated monochrome cloud bank with billowing internal depth, bright upper edges, dark folds, and soft transparent margins. Intended as authored detail within the moving, layered cloud environment.                                                                  |

The repository files are in `public/world-study/`. Their depth placement, deformation, occlusion, and animation are applied by the renderer at runtime, not baked into a composited scene image.

## Spectral sculpted hand

- Runtime asset: `/world-study/hand.webp`
- Repository file: `public/world-study/hand.webp`
- Original generated source filename: `exec-31e6cc1b-9d10-4bdb-ae3c-ee403e85f775.png`
- Generated with the built-in image generation tool on 2026-09-05.
- Original and final dimensions: 1024 × 1536.
- Conversion only: Sharp WebP, quality 92, alpha quality 100, effort 6. No background extraction, geometric editing, or image compositing was performed.
- Alpha verified in the source and final WebP. Source includes 930,268 completely transparent pixels; sampled areas between all fingers and outside the hand are alpha zero. The generated sculpture is mostly alpha 253–254 with antialiased boundaries.
- The generation contains slight RGB differences despite the monochrome prompt; the renderer should shade this asset by luminance to maintain the study's strict black-and-white output.

### Full generation prompt

```text
Use case: stylized-concept.
Asset type: a high-resolution isolated alpha cutout for a surreal, strictly monochrome interactive landscape.
Primary request: Create ONE original, anatomically elegant, monumental sculpted human hand. Palm faces the viewer in a subtle three-quarter view, upright with the wrist extending down and ending in a clean, softly rounded sculptural cut. Five long graceful fingers, relaxed and slightly spread with natural varying bends, not a rigid stop-sign gesture. Keep all fingertips and the entire outline comfortably inside the image. Include a modest length of wrist below the palm.
Style/material: extremely refined photoreal museum sculpture, pale weathered smooth stone and satin plaster. Lifelike anatomy and tendons, broad restrained tonal planes, delicate pores and very fine age marks; smooth expensive sculptural finish, no chunky rough polygons, no coarse noisy texture, no heavy marble veins. Mysterious and uncanny rather than decorative or Halloween.
Lighting: a single broad gentle silver light from upper right, deep soft grey shadows on the left and in the palm creases. The sculpture is solid and opaque with carefully antialiased edges, not a translucent ghost.
Composition: vertically oriented hand centered in a portrait composition, fingertips pointing up, wrist at bottom, isolated with clear empty margins on every side, slight three-quarter angle giving actual dimensionality.
Color: STRICT BLACK AND WHITE, all pixels neutral grayscale, no skin tones or warm/cool tint.
Background: actual completely transparent alpha everywhere outside the hand, including every opening BETWEEN the fingers. Do not simulate transparency with a checkerboard, solid black, grey, or white. No background or scene at all.
Avoid: sphere, other objects, clouds, haze, glow, cast shadow on any background, pedestal, person or arm beyond the short wrist, jewelry, paint, gold, symbols, typography, text, watermark, frame. No source images are supplied; this must be an original sculpture.
```

## Reused procedural mineral texture

- Runtime asset: `/world/mineral.png`
- Repository file: `public/world/mineral.png`
- Source: the existing offline procedural generator in `scripts/generate-world-assets.mjs`.
- This legacy texture is reused for mineral surface detail. It was not newly generated by the image generation tool for this study and is not taken from the user's reference artwork.
