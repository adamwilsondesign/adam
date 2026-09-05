"use client";

import { useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getAboutPose,
  registerCloudShiftHandler,
  registerCloudSurgeHandler,
  setAnchorSilhouette,
  type CloudShift,
} from "@/features/sky/sky-director";
import { worldState } from "@/features/world/world-state";
import { dampingFactor } from "@/lib/motion";
import { cloudShader } from "./cloud-shader";
import { CloudMotion } from "./cloud-motion";
import styles from "./CloudsBackground.module.css";

const SKY_DISABLED = process.env.NEXT_PUBLIC_DISABLE_SKY === "1";
const NIGHT = {
  backgroundColor: 0x080808,
  skyColor: 0x141414,
  cloudColor: 0x585858,
  cloudShadowColor: 0x0d0d0d,
  sunColor: 0x888888,
  sunGlareColor: 0x333333,
  sunlightColor: 0xa0a0a0,
};

/** The original living volume persists across every route. Landmarks are shaded
 * behind that volume, so a cloud actually obscures them as it evolves. */
export function CloudsBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cloudShiftRef = useRef<CloudShift | null>(null);
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  const [fallback, setFallback] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = Boolean(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    if (SKY_DISABLED) return;
    const timer = window.setTimeout(() => {
      import("@/features/about/terrain-cache").then(({ prewarmTerrain }) => prewarmTerrain());
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (SKY_DISABLED) return;
    registerCloudShiftHandler((shift) => {
      cloudShiftRef.current = shift;
      const el = rootRef.current;
      if (!el) return;
      el.style.transform = shift
        ? `translate3d(0, ${shift.y.toFixed(2)}px, 0) scale(${shift.scale.toFixed(4)})`
        : "";
      el.style.opacity = shift ? shift.opacity.toFixed(4) : "";
      el.style.willChange = shift ? "transform, opacity" : "";
    });
    return () => registerCloudShiftHandler(null);
  }, []);

  useEffect(() => {
    if (SKY_DISABLED || !ref.current) return;
    let disposed = false;
    let failed = false;
    let tornDown = false;
    let effect: import("vanta/dist/vanta.clouds.min").VantaCloudsEffect | null = null;
    let hand: import("three").Texture | null = null;
    let emptyHand: import("three").Texture | null = null;
    let cleanup = () => {};
    const clock = new CloudMotion();
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let width = window.innerWidth,
      height = window.innerHeight;
    let last = performance.now(),
      seconds = 0,
      cloudTime = 0,
      reveal = 0,
      hover = 0;
    let portal: HTMLElement | null = null;
    const review =
      process.env.NODE_ENV === "development" &&
      new URLSearchParams(location.search).has("motion-review");

    const teardown = () => {
      if (tornDown) return;
      tornDown = true;
      cleanup();
      cleanup = () => {};
      registerCloudSurgeHandler(null);
      setAnchorSilhouette(null);
      worldState.ready = false;
      document.documentElement.removeAttribute("data-world-ready");
      document.documentElement.style.removeProperty("--portal-caption-y");
      portal?.removeAttribute("style");
      worldState.portal?.removeAttribute("style");
      portal = null;
      hand?.dispose();
      hand = null;
      emptyHand?.dispose();
      emptyHand = null;
      const current = effect;
      effect = null;
      if (current) {
        const renderer = current.renderer;
        // Vanta stops its frame loop and removes the canvas; renderer.dispose
        // also releases Three's buffers/program caches, which Vanta leaves alive.
        try {
          current.destroy();
        } finally {
          renderer.dispose();
        }
      }
    };
    const showFallback = () => {
      if (disposed || failed) return;
      failed = true;
      teardown();
      setFallback(true);
    };

    (async () => {
      try {
        const [THREE, { default: CLOUDS }] = await Promise.all([
          import("three"),
          import("vanta/dist/vanta.clouds.min"),
        ]);
        if (disposed || failed || !ref.current) return;
        // Budget physical pixels, independent of Retina density. Vanta's default
        // resolution uniform omits DPR; update it to the actual drawing buffer.
        const dpr = window.devicePixelRatio || 1;
        effect = CLOUDS({
          el: ref.current,
          THREE,
          mouseControls: false,
          mouseEase: false,
          touchControls: false,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: dpr * 1.6,
          scaleMobile: dpr * 1.65,
          speed: 0.7,
          ...NIGHT,
        });
        if (!effect) throw new Error("Cloud renderer unavailable");
        // A transparent sampler keeps the world valid while its optional
        // distant texture loads, including when that image cannot be fetched.
        emptyHand = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
        emptyHand.needsUpdate = true;
        const uniforms = Object.assign(effect.uniforms, {
          uTravel: { value: 0 },
          uAbout: { value: 0 },
          uSeconds: { value: 0 },
          uHand: { value: emptyHand },
          uPortalReveal: { value: 0 },
          uPortalHover: { value: 0 },
          uCompact: { value: 0 },
        });
        hand = new THREE.TextureLoader().load(
          "/world/hand-stone.webp",
          (texture) => {
            if (disposed || failed || tornDown) {
              texture.dispose();
              return;
            }
            uniforms.uHand.value = texture;
            emptyHand?.dispose();
            emptyHand = null;
          },
          undefined,
          () => {
            hand?.dispose();
            hand = null;
          },
        );
        hand.minFilter = THREE.LinearFilter;
        hand.magFilter = THREE.LinearFilter;
        for (const child of effect.scene.children) {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
            child.material.fragmentShader = cloudShader;
            child.material.needsUpdate = true;
          }
        }
        const resolution = new THREE.Vector2();
        const resize = () => {
          width = window.innerWidth;
          height = window.innerHeight;
          effect?.renderer.getDrawingBufferSize(resolution);
          uniforms.iResolution.value.copy(resolution);
        };
        effect.onResize = resize;
        resize();
        const onPointer = (event: PointerEvent) => {
          if (event.pointerType !== "mouse") return;
          pointer.tx = Math.max(0, Math.min(1, event.clientX / width));
          pointer.ty = Math.max(0, Math.min(1, event.clientY / height));
        };
        const onTouch = (event: TouchEvent) => {
          const touch = event.touches[0];
          if (!touch) return;
          pointer.tx = 1 - touch.clientX / width;
          pointer.ty = 1 - touch.clientY / height;
        };
        const onLeave = () => {
          pointer.tx = pointer.ty = 0.5;
        };
        const visibility = () => {
          clock.resetTimestamp();
          last = performance.now();
        };
        const contextLost = (event: Event) => {
          event.preventDefault();
          showFallback();
        };
        window.addEventListener("pointermove", onPointer, { passive: true });
        window.addEventListener("touchmove", onTouch, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
        document.addEventListener("visibilitychange", visibility);
        effect.renderer.domElement.addEventListener("webglcontextlost", contextLost);
        cleanup = () => {
          window.removeEventListener("pointermove", onPointer);
          window.removeEventListener("touchmove", onTouch);
          document.documentElement.removeEventListener("pointerleave", onLeave);
          document.removeEventListener("visibilitychange", visibility);
          effect?.renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        };
        registerCloudSurgeHandler((duration, intensity) => {
          if (!reduced.current) clock.surge(performance.now(), duration, intensity);
        });
        effect.onUpdate = () => {
          if (!effect || disposed || failed) return;
          const now = performance.now();
          const dt = Math.min(50, Math.max(0, now - last));
          last = now;
          // ShaderBase.resize overwrites iResolution after its onResize hook.
          // Reading canvas dimensions here corrects it after every resize/DPR
          // change, without a GPU readback or an extra allocation.
          resolution.set(effect.renderer.domElement.width, effect.renderer.domElement.height);
          uniforms.iResolution.value.copy(resolution);
          // Vanta writes its own wall clock before this callback. Always replace
          // that value, even if the browser delivers a frame while hidden.
          uniforms.iTime.value = cloudTime;
          if (document.hidden) {
            clock.resetTimestamp();
            return;
          }
          if (!reduced.current) {
            cloudTime = clock.advance(now).time;
            seconds += dt / 1000;
            const follow = dampingFactor(dt, 3.1);
            pointer.x += (pointer.tx - pointer.x) * follow;
            pointer.y += (pointer.ty - pointer.y) * follow;
          } else {
            // Freeze the current phase and viewpoint. Resetting to zero would
            // visibly replace the clouds; advancing underneath would jump later.
            clock.resetTimestamp();
          }
          uniforms.iMouse.value.set(pointer.x * resolution.x, pointer.y * resolution.y);
          // Uniform speed stays .7. Only the integrated clock advances:
          // acceleration never remaps the entire thousand-second noise seed.
          uniforms.iTime.value = cloudTime;
          const travel = Math.max(0, Math.min(1, worldState.workTravel));
          const about = getAboutPose();
          reveal += ((worldState.portal ? 1 : 0) - reveal) * dampingFactor(dt, 3.8);
          hover += ((worldState.portalHover ? 1 : 0) - hover) * dampingFactor(dt, 4);
          const compact = Math.max(0, Math.min(1, (650 - height) / 200));
          const framingLift = compact * travel * height * 0.175 - about * height * 0.275;
          uniforms.uCompact.value = compact;
          uniforms.uTravel.value = travel;
          uniforms.uAbout.value = about;
          uniforms.uSeconds.value = seconds;
          uniforms.uPortalReveal.value = reveal;
          uniforms.uPortalHover.value = hover;
          const xOffset = Math.max(-1, Math.min(1, pointer.x * 2 - 1)) * 0.04;
          const sphereX = 6.8 - Math.max(0, 1.1 - resolution.x / resolution.y) * 6;
          const yOffset = Math.max(-1, Math.min(1, pointer.y * 2 - 1)) * 0.025 - about * 3;
          const sphereDepth = 12 - travel * 6;
          const focal = height * 0.75;
          setAnchorSilhouette({
            x: width * 0.5 + ((sphereX - xOffset) * focal) / sphereDepth,
            y: height * 0.5 - ((1.8 - yOffset) * focal) / sphereDepth - framingLift,
            radius: (2.6 * focal) / sphereDepth,
            alpha: cloudShiftRef.current?.opacity ?? 1,
            projection: {
              width,
              height,
              aspect: resolution.x / resolution.y,
              centerX: sphereX - xOffset,
              centerY: 1.8 - yOffset,
              depth: sphereDepth,
              radius: 2.6,
              framingY: 0.55 * about - 0.35 * compact * travel,
              layerScale: cloudShiftRef.current?.scale ?? 1,
              layerShiftY: cloudShiftRef.current?.y ?? 0,
            },
          });
          // Keep the semantic button aligned to the actual projected opening.
          // No layout reads or React updates on the animation path.
          if (worldState.portal) {
            portal = worldState.portal;
            const depth = 13 - travel * 6;
            const left = width * 0.5 + ((-0.68 - xOffset) * focal) / depth - 12;
            const top = height * 0.5 - ((0.86 - yOffset) * focal) / depth - 12 - framingLift;
            const portalWidth = (1.36 * focal) / depth + 24;
            const portalHeight = (2.06 * focal) / depth + 24;
            Object.assign(portal.style, {
              position: "fixed",
              left: `${left}px`,
              top: `${top}px`,
              width: `${portalWidth}px`,
              height: `${portalHeight}px`,
              padding: "0",
            });
            document.documentElement.style.setProperty(
              "--portal-caption-y",
              `${top + portalHeight + (height < 480 ? -4 : 26)}px`,
            );
          } else if (portal) {
            portal.removeAttribute("style");
            portal = null;
          }
        };
        if (review)
          effect.afterRender = () => window.dispatchEvent(new Event("adam:environment-frame"));
        worldState.ready = true;
        document.documentElement.setAttribute("data-world-ready", "");
      } catch {
        showFallback();
      }
    })();
    return () => {
      disposed = true;
      teardown();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.clouds}
      data-dimmed={pathname !== "/" || undefined}
      data-live-clouds
      aria-hidden
    >
      {fallback || SKY_DISABLED ? (
        <div className={styles.fallback} />
      ) : (
        <div ref={ref} className={styles.scene} />
      )}
      <div className={styles.veil} data-active={pathname !== "/" || undefined} />
    </div>
  );
}
