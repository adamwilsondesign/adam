import * as THREE from "three";
import { fullscreenVertex, skyFragment, cloudFragment, compositeFragment } from "./world-shaders";
import { getAboutScrollProgress, setAnchorSilhouette } from "@/features/sky/sky-director";
import {
  QualityBudget,
  springStep,
  cameraSegment,
  STAR_CAPACITY,
  starFrame,
  updateWorldFrame,
  worldState,
} from "./world-state";

const skyVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`;

/** One WebGL context. Static geometry + textured cloud banks; no terrain bakes during travel. */
export async function createWorld(
  canvas: HTMLCanvasElement,
  route: () => string,
  stats: HTMLOutputElement | null,
  onLost: () => void,
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x999999, 0.00085);
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 3500);
  const loader = new THREE.TextureLoader();
  let handMap: THREE.Texture, mineral: THREE.Texture, landscapeMap: THREE.Texture;
  try {
    [handMap, mineral, landscapeMap] = await Promise.all([
      loader.loadAsync("/world/hand-stone.webp"),
      loader.loadAsync("/world/mineral.png"),
      loader.loadAsync("/world/basin-distance.webp"),
    ]);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  mineral.wrapS = mineral.wrapT = THREE.RepeatWrapping;
  mineral.repeat.set(12, 12);
  mineral.anisotropy = 2;
  const resources: { dispose: () => void }[] = [handMap, mineral, landscapeMap];
  function keep<T extends { dispose: () => void }>(item: T): T {
    resources.push(item);
    return item;
  }

  const sky = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(2, 2)),
    keep(
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        depthTest: false,
        depthWrite: false,
        uniforms: { uDescent: { value: 0 } },
      }),
    ),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);
  const landscapeMaterial = keep(
    new THREE.MeshBasicMaterial({
      map: landscapeMap,
      depthWrite: false,
      color: 0x8c8c8c,
      fog: false,
    }),
  );
  // Project the authored basin onto a depth surface. Near ridges have substantially
  // more parallax than the horizon; all routes view these same world coordinates.
  const landscapeGeometry = keep(new THREE.PlaneGeometry(2, 2, 160, 100));
  const positions = landscapeGeometry.getAttribute("position");
  const uv = landscapeGeometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    const distance = 1400 + Math.pow(v, 1.7) * 1400;
    positions.setXYZ(
      i,
      (u - 0.5) * distance * 2.08,
      145 + (v - 0.5) * distance * 1.39,
      170 - distance,
    );
  }
  landscapeGeometry.computeVertexNormals();
  const landscape = new THREE.Mesh(landscapeGeometry, landscapeMaterial);
  scene.add(landscape);
  scene.add(new THREE.HemisphereLight(0x999999, 0x050505, 0.22));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(180, 220, -1180);
  sun.target.position.set(0, -95, -1000);
  scene.add(sun.target);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -160,
    right: 160,
    top: 160,
    bottom: -160,
    near: 1,
    far: 650,
  });
  sun.shadow.bias = -0.0003;
  scene.add(sun);

  const plateauMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x343434,
      roughness: 1,
      map: mineral,
      bumpMap: mineral,
      bumpScale: 0.15,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  plateauMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying float vGroundDepth;\n" +
      shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvGroundDepth=-mvPosition.z;",
      );
    shader.fragmentShader =
      "varying float vGroundDepth;\n" +
      shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\ngl_FragColor.a*=1.-smoothstep(650.,1250.,vGroundDepth);",
      );
  };
  const plateau = new THREE.Mesh(keep(new THREE.PlaneGeometry(2600, 2600)), plateauMaterial);
  plateau.rotation.x = -Math.PI / 2;
  plateau.position.set(0, -95, -500);
  plateau.receiveShadow = true;
  scene.add(plateau);

  // One shared, solid landmark. Its projected position follows only the camera.
  const sphereMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x737373,
      fog: false,
      roughness: 0.92,
      map: mineral,
      bumpMap: mineral,
      bumpScale: 0.035,
    }),
  );
  const sphere = new THREE.Mesh(keep(new THREE.SphereGeometry(140, 96, 64)), sphereMaterial);
  sphere.position.set(310, 145, -1000);
  scene.add(sphere);
  const handMaterial = keep(
    new THREE.MeshBasicMaterial({
      map: handMap,
      transparent: true,
      depthWrite: false,
      fog: false,
      color: 0x777777,
      opacity: 0.55,
    }),
  );
  handMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      "#include <alphamap_fragment>\ndiffuseColor.a*=smoothstep(.18,.68,vUv.y);",
    );
  };
  const hand = new THREE.Mesh(keep(new THREE.PlaneGeometry(400, 600)), handMaterial);
  hand.position.set(270, 330, -1800);
  scene.add(hand);
  const sceneTarget = keep(new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }));
  sceneTarget.depthTexture = keep(new THREE.DepthTexture(1, 1, THREE.UnsignedIntType));
  const cloudTarget = keep(new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }));
  const passCamera = new THREE.Camera();
  const passGeometry = keep(new THREE.PlaneGeometry(2, 2));
  const cloudMaterial = keep(
    new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: cloudFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uDepth: { value: sceneTarget.depthTexture },
        uInverseProjection: { value: camera.projectionMatrixInverse },
        uCameraWorld: { value: camera.matrixWorld },
        uEye: { value: camera.position },
        uTime: { value: 0 },
        uSize: { value: new THREE.Vector2() },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uPointer: { value: new THREE.Vector2() },
      },
    }),
  );
  const compositeMaterial = keep(
    new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: sceneTarget.texture },
        uCloud: { value: cloudTarget.texture },
        uDepth: { value: sceneTarget.depthTexture },
        uCloudSize: { value: new THREE.Vector2() },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
      },
    }),
  );
  const cloudPass = new THREE.Scene();
  cloudPass.add(new THREE.Mesh(passGeometry, cloudMaterial));
  const compositePass = new THREE.Scene();
  compositePass.add(new THREE.Mesh(passGeometry, compositeMaterial));

  // Portal shares the same light/materials. Positioned to its accessible DOM target on layout changes.
  const portal = new THREE.Group();
  scene.add(portal);
  const portalStone = keep(
    new THREE.MeshStandardMaterial({
      color: 0x999999,
      emissive: 0x080808,
      roughness: 0.9,
      map: mineral,
      bumpMap: mineral,
      bumpScale: 0.05,
      transparent: true,
    }),
  );
  const slab = keep(new THREE.BoxGeometry(1, 1, 1));
  for (const [x, y, sx, sy] of [
    [-3.2, 8, 1.2, 16],
    [3.2, 8, 1.2, 16],
    [0, 15.4, 7.6, 1.2],
    [0, -0.4, 12, 1],
  ] as const) {
    const mesh = new THREE.Mesh(slab, portalStone);
    mesh.position.set(x, y, 0);
    mesh.scale.set(sx, sy, 1.4);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    portal.add(mesh);
  }
  const portalMap = keep(landscapeMap.clone());
  portalMap.repeat.set(0.24, 1);
  portalMap.offset.set(0.4, 0);
  const interiorMaterial = keep(
    new THREE.MeshBasicMaterial({ map: portalMap, color: 0xeeeeee, transparent: true, opacity: 0 }),
  );
  const aperture = new THREE.Mesh(keep(new THREE.PlaneGeometry(5.2, 14.7)), interiorMaterial);
  aperture.position.set(0, 7.8, -0.65);
  portal.add(aperture);
  // A quiet view of a distant ridge is sufficient here; the existing portal interaction stays intact.
  const innerOrb = new THREE.Mesh(keep(new THREE.SphereGeometry(1.1, 32, 20)), sphereMaterial);
  innerOrb.position.set(0.4, 9.4, -0.3);
  portal.add(innerOrb);
  portal.position.set(0, -95, -1000);
  portal.scale.setScalar(16);
  portal.rotation.y = -0.12;
  portal.visible = false;

  // Project-star points retain their exact radial/logo handoff in a single GPU batch.
  const starScene = new THREE.Scene();
  const starGeometry = keep(new THREE.BufferGeometry());
  const starPositions = new Float32Array(STAR_CAPACITY * 3),
    starSizes = new Float32Array(STAR_CAPACITY),
    starAlphas = new Float32Array(STAR_CAPACITY);
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  starGeometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(starSizes, 1).setUsage(THREE.DynamicDrawUsage),
  );
  starGeometry.setAttribute(
    "aAlpha",
    new THREE.BufferAttribute(starAlphas, 1).setUsage(THREE.DynamicDrawUsage),
  );
  const starMaterial = keep(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: { uDpr: { value: 1 } },
      vertexShader: `attribute float aSize;attribute float aAlpha;uniform float uDpr;varying float vAlpha;void main(){vAlpha=aAlpha;gl_Position=vec4(position,1.);gl_PointSize=aSize*2.*uDpr;}`,
      fragmentShader: `varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.91,.93,.91,vAlpha*(1.-smoothstep(.35,1.,d)));}`,
    }),
  );
  const points = new THREE.Points(starGeometry, starMaterial);
  points.frustumCulled = false;
  starScene.add(points);

  let width = 1,
    height = 1,
    resizePending = true;
  const quality = new QualityBudget();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches;
  const onMotion = () => {
    reduced = motion.matches;
  };
  motion.addEventListener("change", onMotion);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    pointer.tx = event.clientX / width - 0.5;
    pointer.ty = event.clientY / height - 0.5;
  };
  const onPointerOut = () => {
    pointer.tx = pointer.ty = 0;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("blur", onPointerOut);
  const onResize = () => {
    resizePending = true;
  };
  window.addEventListener("resize", onResize, { passive: true });
  let reducedSignature = "";
  let lastPortal: HTMLElement | null = null;
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.25 : 1.5) * quality.scale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.setViewOffset(width, height, width < 768 ? width * 0.28 : 0, 0, width, height);
    const rw = Math.round(width * dpr),
      rh = Math.round(height * dpr);
    sceneTarget.setSize(rw, rh);
    cloudTarget.setSize(Math.ceil(rw * 0.55), Math.ceil(rh * 0.55));
    cloudMaterial.uniforms.uSize!.value.set(Math.ceil(rw * 0.55), Math.ceil(rh * 0.55));
    compositeMaterial.uniforms.uCloudSize!.value.copy(cloudMaterial.uniforms.uSize!.value);
    starMaterial.uniforms.uDpr!.value = dpr;
    resizePending = false;
  };
  resize();
  const initiallyAbout = route() === "/about";
  let descent = initiallyAbout ? 1 : 0,
    descentFrom = descent,
    descentTarget = descent,
    descentStarted = performance.now(),
    descentDuration = 1700,
    scroll = 0,
    scrollVelocity = 0,
    exitScroll = 0,
    travel = route().startsWith("/work") ? 1 : 0,
    portalAlpha = 0,
    time = 0;
  const sphereProjected = new THREE.Vector3(),
    edgeProjected = new THREE.Vector3();
  const diagnostic = new URLSearchParams(location.search).has("worldDebug");
  if (stats) stats.hidden = !diagnostic;
  const samples: number[] = [];
  let count = 0,
    last = performance.now(),
    raf = 0,
    stopped = false;
  const frame = (now: number) => {
    if (stopped) return;
    const raw = now - last;
    const dt = Math.min(0.05, Math.max(0.001, raw / 1000));
    last = now;
    if (resizePending) resize();
    updateWorldFrame(now);
    const about =
      route() === "/about" && !(worldState.aboutActive && worldState.aboutPhase === "leaving");
    const target = about ? 1 : 0;
    if (target !== descentTarget) {
      descentFrom = descent;
      descentTarget = target;
      descentStarted = now;
      descentDuration = target ? (width < 768 ? 1200 : 1700) : 780;
      if (!target) exitScroll = scroll;
    }
    descent = reduced
      ? target
      : cameraSegment(descentFrom, target, 0, descentDuration, now - descentStarted);
    const follow = 1 - Math.exp(-dt * 7);
    pointer.x += (pointer.tx - pointer.x) * follow;
    pointer.y += (pointer.ty - pointer.y) * follow;
    if (reduced) pointer.x = pointer.y = 0;
    if (about) {
      const step = springStep(scroll, scrollVelocity, getAboutScrollProgress(), dt, 18);
      scroll = step.position;
      scrollVelocity = step.velocity;
    } else {
      scroll = exitScroll * (descentFrom ? descent / descentFrom : 0);
      scrollVelocity = 0;
    }
    if (!reduced) time += dt;
    worldState.aboutProgress = descent;
    travel = reduced ? (route().startsWith("/work") ? 1 : 0) : worldState.workTravel;
    // The recorded axes: forward into Work, vertical through the shelf into About.
    camera.position.set(
      pointer.x * 5,
      145 - descent * 170 + pointer.y * 2,
      170 - travel * 115 - scroll * 80,
    );
    camera.rotation.set(-0.1, -pointer.x * 0.003, 0);
    camera.updateMatrixWorld();
    plateauMaterial.opacity = travel;
    plateau.visible = travel > 0.001;
    sky.material.uniforms.uDescent!.value = descent;
    cloudMaterial.uniforms.uTime!.value = time;
    cloudMaterial.uniforms.uPointer!.value.set(pointer.x, pointer.y);
    sphere.position.x = 310 + pointer.x * 1.6;
    sphere.position.y = 145 + pointer.y * 0.7;
    hand.position.x = 270 + pointer.x * 0.6;
    sphereProjected.copy(sphere.position).project(camera);
    edgeProjected.copy(sphere.position);
    edgeProjected.x += 140;
    edgeProjected.project(camera);
    setAnchorSilhouette({
      x: (sphereProjected.x * 0.5 + 0.5) * width,
      y: (-0.5 * sphereProjected.y + 0.5) * height,
      radius: Math.abs(edgeProjected.x - sphereProjected.x) * width * 0.5,
      alpha: 1,
    });
    lastPortal = worldState.portal;
    portalAlpha += (Number(!!lastPortal) - portalAlpha) * (1 - Math.exp(-dt * 5));
    portal.visible = portalAlpha > 0.002;
    if (portal.visible) {
      portalStone.opacity = portalAlpha;
      interiorMaterial.opacity = portalAlpha;
      if (lastPortal) {
        const top = new THREE.Vector3(0, 15.4, 0).applyMatrix4(portal.matrixWorld).project(camera);
        const bottom = new THREE.Vector3(0, -0.4, 0)
          .applyMatrix4(portal.matrixWorld)
          .project(camera);
        const ph = Math.abs(top.y - bottom.y) * height * 0.5;
        const cx = (top.x * 0.5 + 0.5) * width,
          cy = (1 - top.y) * height * 0.5;
        lastPortal.style.position = "fixed";
        lastPortal.style.left = `${cx - ph * 0.27}px`;
        lastPortal.style.top = `${cy}px`;
        lastPortal.style.width = `${ph * 0.54}px`;
        lastPortal.style.height = `${ph}px`;
        lastPortal.parentElement?.style.setProperty(
          "--portal-caption-y",
          `${Math.min(height - 205, (1 - bottom.y) * height * 0.5 + 18)}px`,
        );
      }
      const targetGlow = worldState.portalHover ? 0.95 : 0.72;
      interiorMaterial.color.lerp(
        new THREE.Color(targetGlow, targetGlow, targetGlow),
        1 - Math.exp(-dt * 8),
      );
    }
    for (let i = 0; i < starFrame.count; i++) {
      const j = i * 4,
        k = i * 3;
      starPositions[k] = (starFrame.data[j]! / width) * 2 - 1;
      starPositions[k + 1] = 1 - (starFrame.data[j + 1]! / height) * 2;
      starPositions[k + 2] = 0.999999;
      starSizes[i] = starFrame.data[j + 2]!;
      starAlphas[i] = starFrame.data[j + 3]! * (1 - descent * 0.93);
    }
    starGeometry.setDrawRange(0, starFrame.count);
    for (const key of ["position", "aSize", "aAlpha"])
      starGeometry.getAttribute(key).needsUpdate = true;
    const signature = `${width}:${height}:${quality.scale}:${descent}:${scroll.toFixed(4)}:${portalAlpha.toFixed(3)}:${worldState.portalHover}:${starFrame.count}`;
    if (reduced && signature === reducedSignature) {
      raf = requestAnimationFrame(frame);
      return;
    }
    reducedSignature = signature;
    renderer.info.reset();
    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(starScene, camera);
    renderer.setRenderTarget(cloudTarget);
    renderer.clear();
    renderer.render(cloudPass, passCamera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(compositePass, passCamera);
    if (raw > 0) {
      samples.push(raw);
      if (samples.length > 3600) samples.shift();
      if (quality.sample(raw)) resizePending = true;
    }
    if (diagnostic && stats && ++count % 60 === 0) {
      const sorted = [...samples].sort((a, b) => a - b);
      stats.textContent = `World · ${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles / 1000)}k triangles · p95 ${(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1)} ms · scale ${quality.scale.toFixed(2)} · ${width}×${height}`;
    }
    raf = requestAnimationFrame(frame);
  };
  // Compile every material once before the first visible travel.
  portal.visible = true;
  renderer.compile(scene, camera);
  renderer.compile(starScene, camera);
  renderer.compile(cloudPass, passCamera);
  renderer.compile(compositePass, passCamera);
  portal.visible = false;
  renderer.info.autoReset = false;
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !stopped) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onContextLost = (event: Event) => {
    event.preventDefault();
    stopped = true;
    cancelAnimationFrame(raf);
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  if (!document.hidden) raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("blur", onPointerOut);
    motion.removeEventListener("change", onMotion);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    setAnchorSilhouette(null);
    for (const resource of resources) resource.dispose();
    renderer.dispose();
  };
}
