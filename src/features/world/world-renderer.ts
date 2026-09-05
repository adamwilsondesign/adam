import * as THREE from "three";
import { getAboutScrollProgress, setAnchorSilhouette } from "@/features/sky/sky-director";
import {
  QualityBudget,
  springStep,
  STAR_CAPACITY,
  starFrame,
  updateWorldFrame,
  worldState,
} from "./world-state";

const noise = (x: number, z: number) => {
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const a = Math.floor(x),
    b = Math.floor(z);
  let u = x - a,
    v = z - b;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(a, b), hash(a + 1, b), u),
    THREE.MathUtils.lerp(hash(a, b + 1), hash(a + 1, b + 1), u),
    v,
  );
};
function heightAt(x: number, z: number) {
  // Deliberately placed peaks leave an open basin under the content.
  const peaks = [
    [-240, -300, 66, 130],
    [-100, -240, 45, 85],
    [70, -300, 78, 105],
    [220, -220, 95, 115],
    [150, -35, 58, 80],
    [-200, 15, 25, 105],
  ];
  let massif = 0;
  for (const peak of peaks) {
    const [px, pz, h, r] = peak as [number, number, number, number];
    massif = Math.max(massif, h * Math.exp(-Math.pow((x - px) / r, 2) - Math.pow((z - pz) / r, 2)));
  }
  let relief = 0,
    frequency = 0.017,
    amplitude = 1;
  for (let i = 0; i < 5; i++) {
    relief += (1 - Math.abs(noise(x * frequency + 31, z * frequency + 17) * 2 - 1)) * amplitude;
    frequency *= 2.06;
    amplitude *= 0.32;
  }
  return -26 + massif * (0.25 + relief * 0.65) + Math.sin(x * 0.012 + z * 0.01) * 2;
}

const skyVertex = `varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,1.,1.);}`;
const skyFragment = `varying vec2 vUv; uniform float uTime; uniform vec2 uResolution;
void main(){
 vec2 uv=vUv; float glow=exp(-length((uv-vec2(.78,.36))*vec2(1.2,2.4))*3.);
 vec3 col=mix(vec3(.045,.056,.067),vec3(.22,.235,.24),pow(1.-uv.y,2.))* .9;
 col+=vec3(.23,.225,.20)*glow;
 float grain=fract(sin(dot(floor(uv*uResolution),vec2(12.9898,78.233)))*43758.5453)-.5;
 col+=grain*.012; col*=1.-.21*length((uv-.5)*1.2);
 gl_FragColor=vec4(col,1.);
}`;
const cloudVertex = `varying vec2 vUv; varying float vDepth; void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`;
const cloudFragment = `uniform sampler2D uMap; uniform float uTime; uniform float uOpacity; varying vec2 vUv; varying float vDepth;
void main(){vec2 uv=vUv; uv.x+=sin(uv.y*7.+uTime*.028)*.009; uv.y+=sin(uv.x*9.+uTime*.019)*.006;
vec4 tex=texture2D(uMap,uv); float nearFade=smoothstep(5.,45.,vDepth);float fog=1.-exp(-vDepth*.0018);
vec3 color=mix(tex.rgb*.63,vec3(.25,.28,.30),fog);
gl_FragColor=vec4(color,tex.a*uOpacity*nearFade);}`;

/** One WebGL context. Static geometry + textured cloud banks; no terrain bakes during travel. */
export async function createWorld(
  canvas: HTMLCanvasElement,
  route: () => string,
  stats: HTMLOutputElement | null,
  onLost: () => void,
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x42494d, 0.0024);
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 1300);
  const loader = new THREE.TextureLoader();
  let cloudMap: THREE.Texture, mineral: THREE.Texture;
  try {
    [cloudMap, mineral] = await Promise.all([
      loader.loadAsync("/world/cloud-sculpted.webp"),
      loader.loadAsync("/world/mineral.png"),
    ]);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  mineral.wrapS = mineral.wrapT = THREE.RepeatWrapping;
  mineral.repeat.set(12, 12);
  mineral.anisotropy = 2;
  const resources: { dispose: () => void }[] = [cloudMap, mineral];
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
        uniforms: { uTime: { value: 0 }, uResolution: { value: new THREE.Vector2() } },
      }),
    ),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xa0adb5, 0x171b20, 0.8));
  const sun = new THREE.DirectionalLight(0xeee8d9, 1.45);
  sun.position.set(180, 220, -80);
  scene.add(sun);

  const terrainGeometry = keep(new THREE.PlaneGeometry(1100, 1100, 220, 220));
  terrainGeometry.rotateX(-Math.PI / 2);
  terrainGeometry.translate(0, 0, -270);
  const vertices = terrainGeometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++)
    vertices.setY(i, heightAt(vertices.getX(i), vertices.getZ(i)));
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x606366,
      roughness: 1,
      map: mineral,
      bumpMap: mineral,
      bumpScale: 1.4,
    }),
  );
  scene.add(new THREE.Mesh(terrainGeometry, terrainMaterial));

  // One shared, solid landmark. Its projected position follows only the camera.
  const sphereMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x777a7b,
      roughness: 0.92,
      map: mineral,
      bumpMap: mineral,
      bumpScale: 0.18,
    }),
  );
  const sphere = new THREE.Mesh(keep(new THREE.SphereGeometry(49, 64, 40)), sphereMaterial);
  sphere.position.set(118, 109, -210);
  scene.add(sphere);
  const monolithMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x3c4144, roughness: 1 }));
  const monolithGeometry = keep(new THREE.BoxGeometry(1.5, 9, 2));
  const monoliths = new THREE.InstancedMesh(monolithGeometry, monolithMaterial, 9);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 9; i++) {
    const x = -260 + i * 65,
      z = -210 - Math.sin(i * 2.1) * 50;
    dummy.position.set(x, heightAt(x, z) + 4.5, z);
    dummy.updateMatrix();
    monoliths.setMatrixAt(i, dummy.matrix);
  }
  scene.add(monoliths);

  // Shared geometry and atlas, 26 bounded cloud draws. Cloud time never follows travel speed.
  const cloudGeometry = keep(new THREE.PlaneGeometry(1, 1));
  const cloudBanks: {
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    x: number;
    seed: number;
  }[] = [];
  for (let i = 0; i < 26; i++) {
    const material = keep(
      new THREE.ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        uniforms: {
          uMap: { value: cloudMap },
          uTime: { value: 0 },
          uOpacity: { value: i < 16 ? 0.86 : 0.48 },
        },
      }),
    );
    const mesh = new THREE.Mesh(cloudGeometry, material);
    const x = ((i % 6) - 2.5) * 140 + Math.sin(i * 4.5) * 30,
      z = -440 + Math.floor(i / 6) * 125;
    mesh.position.set(x, i < 16 ? 33 + Math.sin(i * 2.7) * 5 : 14, z);
    mesh.scale.set(180 + (i % 3) * 35, 65 + (i % 4) * 11, 1);
    mesh.rotation.z = Math.sin(i) * 0.035;
    scene.add(mesh);
    cloudBanks.push({ mesh, x, seed: i * 3.7 });
  }

  // Portal shares the same light/materials. Positioned to its accessible DOM target on layout changes.
  const portal = new THREE.Group();
  scene.add(portal);
  const portalStone = keep(
    new THREE.MeshStandardMaterial({
      color: 0x93928c,
      emissive: 0x17191b,
      roughness: 0.9,
      map: mineral,
      bumpMap: mineral,
      bumpScale: 0.15,
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
    portal.add(mesh);
  }
  const portalTarget = keep(
    new THREE.WebGLRenderTarget(256, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }),
  );
  const portalCamera = new THREE.PerspectiveCamera(60, 0.5, 1, 1300);
  const interiorMaterial = keep(
    new THREE.MeshBasicMaterial({
      map: portalTarget.texture,
      transparent: true,
      opacity: 0,
      color: 0xc1c7c8,
    }),
  );
  const aperture = new THREE.Mesh(keep(new THREE.PlaneGeometry(5.2, 14.7)), interiorMaterial);
  aperture.position.set(0, 7.8, -0.65);
  portal.add(aperture);
  const shadowMaterial = keep(
    new THREE.MeshBasicMaterial({
      color: 0x06090c,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(7, 42)), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.rotation.z = -0.55;
  shadow.position.set(-10, -0.85, 17);
  portal.add(shadow);
  const floorMap = keep(mineral.clone());
  floorMap.repeat.set(90, 90);
  const floorMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x54595d,
      map: floorMap,
      bumpMap: floorMap,
      bumpScale: 0.24,
      depthWrite: false,
      roughness: 1,
      transparent: true,
      opacity: 0,
    }),
  );
  floorMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying float vFloorDepth;\n" +
      shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvFloorDepth=-mvPosition.z;",
      );
    shader.fragmentShader =
      "varying float vFloorDepth;\n" +
      shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\ngl_FragColor.a *= 1.-smoothstep(110.,380.,vFloorDepth);",
      );
  };
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(600, 600)), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.1;
  portal.add(floor);
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
  let lastPortalRevision = -1;
  let reducedSignature = "";
  let portalRect: DOMRect | null = null,
    lastPortal: HTMLElement | null = null;
  const portalObserver = new ResizeObserver(() => {
    if (worldState.portal) portalRect = worldState.portal.getBoundingClientRect();
  });
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.25 : 1.5) * quality.scale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.setViewOffset(width, height, width < 768 ? width * 0.45 : 0, 0, width, height);
    sky.material.uniforms.uResolution!.value.set(width * dpr, height * dpr);
    starMaterial.uniforms.uDpr!.value = dpr;
    if (worldState.portal) portalRect = worldState.portal.getBoundingClientRect();
    resizePending = false;
  };
  resize();
  const initiallyAbout = route() === "/about";
  let descent = initiallyAbout ? 1 : 0,
    descentVelocity = 0,
    scroll = 0,
    scrollVelocity = 0,
    travel = route().startsWith("/work") ? 1 : 0,
    portalAlpha = 0,
    time = 0;
  const sphereProjected = new THREE.Vector3(),
    edgeProjected = new THREE.Vector3(),
    portalPoint = new THREE.Vector3();
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
    if (reduced) {
      descent = target;
      descentVelocity = 0;
      scroll = about ? getAboutScrollProgress() : 0;
      pointer.x = pointer.y = 0;
    } else {
      const d = springStep(
        descent,
        descentVelocity,
        target,
        dt,
        about ? (width < 768 ? 4.6 : 3.4) : 4.6,
      );
      descent = d.position;
      descentVelocity = d.velocity;
      const s = springStep(scroll, scrollVelocity, about ? getAboutScrollProgress() : 0, dt, 4);
      scroll = s.position;
      scrollVelocity = s.velocity;
      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
      time += dt;
    }
    worldState.aboutProgress = descent;
    travel = reduced ? (route().startsWith("/work") ? 1 : 0) : worldState.workTravel;
    camera.position.set(
      pointer.x * 3.2,
      64 - descent * 42 + pointer.y * 1.5,
      150 - travel * 65 - scroll * 65,
    );
    camera.rotation.set(0.012 + descent * 0.065, -pointer.x * 0.004, 0);
    camera.updateMatrixWorld();
    for (const bank of cloudBanks) {
      bank.mesh.position.x =
        bank.x + Math.sin(time * 0.004) * 40 + Math.sin(time * 0.01 + bank.seed) * 1.5;
      bank.mesh.material.uniforms.uTime!.value = time + bank.seed;
    }
    sphereProjected.copy(sphere.position).project(camera);
    edgeProjected.copy(sphere.position);
    edgeProjected.x += 49;
    edgeProjected.project(camera);
    setAnchorSilhouette({
      x: (sphereProjected.x * 0.5 + 0.5) * width,
      y: (-0.5 * sphereProjected.y + 0.5) * height,
      radius: Math.abs(edgeProjected.x - sphereProjected.x) * width * 0.5,
      alpha: 1,
    });
    if (lastPortal !== worldState.portal || lastPortalRevision !== worldState.portalRevision) {
      lastPortalRevision = worldState.portalRevision;
      portalObserver.disconnect();
      lastPortal = worldState.portal;
      if (lastPortal) {
        portalObserver.observe(lastPortal);
        portalRect = lastPortal.getBoundingClientRect();
      } else portalRect = null;
    }
    portalAlpha += (Number(!!lastPortal) - portalAlpha) * (1 - Math.exp(-dt * 5));
    portal.visible = portalAlpha > 0.002;
    if (portal.visible && portalRect) {
      const depth = 95,
        viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth;
      const scale = ((portalRect.height / height) * viewHeight) / 20;
      portalPoint
        .set(
          ((portalRect.x + portalRect.width / 2) / width) * 2 - 1,
          1 - ((portalRect.y + portalRect.height * 0.83) / height) * 2,
          0.5,
        )
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      portal.position.copy(camera.position).addScaledVector(portalPoint, depth);
      portal.scale.setScalar(scale);
      portal.rotation.y = -0.12;
      portalStone.opacity = portalAlpha;
      floorMaterial.opacity = portalAlpha;
      interiorMaterial.opacity = portalAlpha;
      const glow = worldState.portalHover ? 1 : 0.83;
      interiorMaterial.color.setRGB(glow, glow, glow);
      shadowMaterial.opacity = portalAlpha * 0.3;
    }
    for (let i = 0; i < starFrame.count; i++) {
      const j = i * 4,
        k = i * 3;
      starPositions[k] = (starFrame.data[j]! / width) * 2 - 1;
      starPositions[k + 1] = 1 - (starFrame.data[j + 1]! / height) * 2;
      starPositions[k + 2] = 0.99995 - Math.sin(Math.PI * Math.min(1, Math.max(0, travel))) * 0.03;
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
    if (portal.visible) {
      portal.visible = false;
      portalCamera.position.set(100 + pointer.x * 1.2, 80 + pointer.y * 0.6, 140);
      portalCamera.lookAt(sphere.position.x, sphere.position.y - 18, sphere.position.z);
      renderer.setRenderTarget(portalTarget);
      renderer.clear();
      renderer.render(scene, portalCamera);
      renderer.setRenderTarget(null);
      portal.visible = true;
    }
    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(starScene, camera);
    if (raw > 0 && raw < 250) {
      samples.push(raw);
      if (samples.length > 300) samples.shift();
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
    portalObserver.disconnect();
    setAnchorSilhouette(null);
    for (const resource of resources) resource.dispose();
    renderer.dispose();
  };
}
