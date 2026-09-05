# Living monochrome environment

The motion reference is [c9d8e176e34a40278b0a2da2d58f73d6e1e83363](https://github.com/adamwilsondesign/adam/commit/c9d8e176e34a40278b0a2da2d58f73d6e1e83363) and the supplied September 4 recording. The priority is the original sense of distance: forward passage to Work, descent through the cloud deck to About, and reverse ascent to Home. Clouds must remain alive between interactions.

## Preserved choreography

| Movement                               | Desktop                                 | Mobile       |
| -------------------------------------- | --------------------------------------- | ------------ |
| Work camera flight                     | 1400 ms                                 | 1150 ms      |
| Star/logo crossfade, then settle       | 280 + 380 ms                            | 260 + 340 ms |
| Return camera, with logo contraction   | 800 ms; contraction 200 ms              | Same         |
| About descent                          | 1700 ms                                 | 1200 ms      |
| About copy reveal / interaction unlock | 1050 / 1300 ms                          | 760 / 950 ms |
| About return                           | 200 ms content fade, then 780 ms ascent | Same         |

About retains 1.5 viewport heights of vertical travel. The live cloud layer rises and expands past the camera; scrolling advances over the range. Departure carries the visible scroll position into the ascent rather than exposing a reset. Home retains its 200 ms fade; About copy has no added blur or scale.

Camera easing matches the original cubic outside progress 0.42–0.58. The middle segment matches position, velocity and acceleration at both boundaries. Logo growth uses one continuous curve across the star/logo handoff.

## Rendering architecture

`CloudsBackground` keeps the original Vanta/Three.js volumetric cloud renderer mounted across routes. The cloud field evolves continuously and responds to a damped pointer. Travel accelerates an integrated clock from the original resting speed of 0.7 toward the original surge speed of 30. The shader's speed multiplier stays fixed: changing it would jump the entire accumulated noise coordinate. Surge retargeting carries current motion forward; hidden-tab time is excluded.

The sphere, Work ground and doorway are analytic intersections inside the cloud shader. They use fixed world coordinates, perspective projection and monochrome lighting. They are shaded before the live volume, allowing moving clouds to obscure them. The doorway has thickness, a directional ground shadow and a procedural interior. Its projected DOM button preserves hover, keyboard access and the existing transition to `/secret`.

The only imported scenic image in this renderer is `public/world/hand-stone.webp`, an original generated hand asset. It appears as a softened distant shadow with changing concealment. The user's reference images are not used verbatim. The photographic basin and its frozen clouds are no longer part of the rendering path.

About uses the original layered terrain choreography. Five procedural heightfield bands, or three on mobile, now have finer fractured ridges, local surface normals, restrained matte highlights and stronger atmospheric depth. A worker bakes their relief into transferable bitmaps; Home prewarms the cache. Resizes retain the previous terrain until replacement artwork is ready. Where workers or OffscreenCanvas are unavailable, preparation yields between bands.

Live valley mist is drawn between terrain layers. One small procedural mask supplies two independently drifting and continuously sheared passes, changing the outline and internal overlap. Terrain elevation is not recalculated during animation. This remains a hybrid of volumetric clouds, analytic landmarks and composited relief, rather than an unrestricted 3D landscape.

## Three review cycles

1. **Restore travel and aliveness.** Replaced the failed photographic depth-surface approach with the original cloud field and route choreography. Evaluation focused on idle evolution, forward passage, descent and ascent.
2. **Integrate the artwork.** Added cloud-occluded landmarks and the grounded Work doorway. Review exposed smooth, clay-like terrain and stationary valleys; finer relief and deforming mist addressed those findings.
3. **Resolve continuity and delivery risks.** Corrected integrated cloud timing, resize/DPR resolution handling and renderer cleanup. Moved terrain preparation off the animation thread, retained fallbacks, removed the unused replacement renderer, and updated tests to check the active architecture.

The environment is strictly black and white. Content, content structure and CMS loaders remain unchanged. The burger menu is removed across breakpoints.

## Verification and limits

149 unit tests pass, including recorded timings, easing continuity, cloud-clock behavior, exact sphere occlusion and terrain contracts. TypeScript, targeted ESLint and a production build with explicit local fixtures pass. The fixture setting is local validation only; deployed CMS configuration is unchanged.

Live Chromium review covered idle evolution, forward travel, descent, scrolled ascent, empty Work and doorway entry, plus portrait and short landscape layouts. Development contact sheets sample the actual rendered canvases and expose timing stalls; they are not performance benchmarks. A 392 ms arrival stall prompted the worker preparation change. Later captures still contained isolated long intervals, so they do not support a claim of perfect frame delivery.

The updated hermetic browser tests disable WebGL and cover mounting, content, menu removal and keyboard doorway behavior. They were parsed but not executed in this environment because the standalone browser could not launch; live in-app Chromium checks were used separately. Neither unit tests nor these structural checks establish aesthetic quality.

The real Chrome preview remains the motion and aesthetic review target. Screenshots alone cannot prove smoothness, and no frame rate is guaranteed across devices. The hand and terrain remain bounded-view representations designed for the existing route choreography. Physical-device performance and subjective art direction require continued evaluation of the deployed experience.
