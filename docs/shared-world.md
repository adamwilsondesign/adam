# Continuous monochrome world

Motion baseline: c9d8e176e34a40278b0a2da2d58f73d6e1e83363 and the supplied September 4 recording.

## Preserved choreography

Work: 1400 ms forward flight (1150 mobile), 280 ms point/logo crossfade, 380 ms settle. Return: 800 ms. About: 1700 ms descent (1200 mobile), text at 1050 ms (760 mobile), 780 ms ascent after the 200 ms content fade. Home's original 200 ms fade and About's original unblurred text treatment are restored.

The camera retains the cubic baseline outside progress .42–.58. Inside that window a quintic Hermite segment matches position, velocity and acceleration at both boundaries. Logo scale uses one continuous curve across crossfade and settle. The About return carries the current scroll position back through the ascent instead of resetting it visibly.

## Rendering

One persistent Three.js renderer. An original photographic basin plate is projected onto a static depth surface; it is an approximation of distant geography, not a fully modeled landscape. The sphere, stone doorway and Work ground plane are geometry. An original hand texture sits behind the sphere, with its lower edge fading into atmosphere. The source images are original generated assets; none of the user's reference images are used on the site.

A bounded ray-marched cloud shelf runs at 55% of the scene's internal width and height. It is composited against scene depth with depth-aware upsampling. Cloud density is world-space, with continuous wind and a restrained pointer influence. The camera crosses the shelf during About travel. The final pass produces neutral grayscale with restrained static grain and an editorial contrast treatment behind the text.

The doorway occupies a fixed point on the Work ground plane. Its accessible DOM button is positioned from the projected geometry. It receives the scene's directional lighting and casts a shadow onto that ground. Its interior uses the basin texture and an orb, rather than a second per-frame scene render. The existing click-through transition to /secret is unchanged.

## Verification and limits

140 unit checks, including baseline durations, monotonic travel, acceleration continuity at the blend boundaries, and continuous logo growth. TypeScript, ESLint and a production build with explicit local fixtures were checked. The live renderer is inspected separately in desktop and mobile-sized browser views. Fixture mode is only for local verification; CMS loaders and production configuration are unchanged.

This is a hybrid depth-surface scene. The hand is an atmospheric image asset, not a rigged 3D hand. It supports the bounded existing journeys, not unrestricted camera exploration. Browser screenshots do not establish physical-device performance or subjective smoothness; the Chrome preview is the visual and motion review target. No claim of a guaranteed frame rate is made.

## Generated asset provenance

Built-in image generation was used. Runtime assets:
- public/world/hand-stone.webp (original source retained in Codex generated_images)
- public/world/basin-distance.webp

Hand prompt: "Use case: stylized-concept. Create a production texture asset for an art-directed surreal monochrome 3D landscape: one monumental anatomically correct human LEFT hand seen palm toward camera at a slight three-quarter angle, fingers reaching upward with natural slight separation and curvature, thumb on image right. Entire hand and long wrist visible, isolated with genuinely transparent background. Aged pale basalt / weathered stone surface, exceptionally fine photographic material, broad soft directional illumination from upper right, deep charcoal shadows on left. Strict neutral black and white only. Uncanny, solemn, sculptural, realistic anatomy, no cartoon, no extra fingers. No sphere, no landscape, no cloud, no text, no frame, no ground shadow. Vertical image, hand fills height with margins. This will be placed far behind clouds in a continuous landscape; silhouette and broad tonal volume are paramount."

Basin prompt: "Use case: stylized-concept. Production environment matte painting for a mysterious monochrome interactive world. Wide 3:2 image, exceptionally detailed cinematic black and white photograph of an immense range of dark eroded volcanic mountains rising through a sea of soft stratocumulus clouds and valley mist. Viewpoint high above a mountain basin. Foreground sharp craggy black ridges occupy bottom 25%, staggered distant peaks diminish into luminous gray mist toward the low horizon at 55% image height. Upper 45% quiet dark charcoal storm sky with a soft light source from upper right, no visible sun. Asymmetric composition with strongest mountain silhouettes on right, quiet soft cloud space on left for future typography. Fine photographic rock detail, deep blacks, selectively glowing cloud edges, broad shadow masses, realistic geological forms, elegant restrained contrast. Strict neutral grayscale. No objects in sky, no sphere, no hand, no people, no text, no buildings. No painterly brushstrokes, no plastic CGI, no repeated peaks. This is an original distant landscape plate, not a screenshot or UI mockup."
