import * as THREE from "three";

import { createAtmosphere } from "./atmosphere";
import { Journey, type JourneyState } from "./journey";

export type StudyRenderer = {
  go(state: JourneyState): void;
  setEmpty(empty: boolean): void;
  setScroll(progress: number): void;
  dispose(): void;
};

type Callbacks = {
  onReady(): void;
  onState(state: JourneyState, settled: boolean): void;
  onReveal(state: JourneyState): void;
  onError(error: Error): void;
};

type CameraOffset = { position: number; velocity: number };

/** Exact critically damped integration keeps departure velocity continuous. */
function advanceOffset(offset: CameraOffset, target: number, dt: number) {
  const frequency = 10;
  const displacement = offset.position - target;
  const coefficient = offset.velocity + frequency * displacement;
  const decay = Math.exp(-frequency * dt);
  offset.position = target + (displacement + coefficient * dt) * decay;
  offset.velocity = (offset.velocity - frequency * coefficient * dt) * decay;
}

const skyVertex = /* glsl */ `
varying vec3 vDirection;
void main(){
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;
const skyFragment = /* glsl */ `
varying vec3 vDirection;
void main(){
  vec3 d=normalize(vDirection);
  float horizon=exp(-abs(d.y)*4.5);
  float glow=pow(max(0.0,dot(d,normalize(vec3(.65,.24,-1.0)))),12.0);
  vec2 uv=d.xz/(abs(d.y)+1.6);
  float haze=sin(uv.x*11.0+sin(uv.y*8.0))*sin(uv.y*9.0+uv.x*3.0);
  haze+=.35*sin(uv.x*31.0-uv.y*23.0);
  float value=.005+horizon*.031+glow*.064+haze*.0025;
  gl_FragColor=vec4(vec3(value),1.0);
}`;

const cloudVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime;
uniform float uSeed;
void main(){
  vUv=uv;
  vec3 p=position;
  p.z+=sin(uv.x*3.14159)*40.0;
  p.y+=sin(uv.x*7.0+uTime*.22+uSeed)*sin(uv.y*3.14159)*14.0;
  vec4 world=modelMatrix*vec4(p,1.0);
  vWorld=world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const cloudFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform float uMist;
uniform vec3 uVisitor;
uniform float uEnergy;
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vec2 uv=vUv;
  float t=uTime;
  float wake=exp(-dot(vWorld-uVisitor,vWorld-uVisitor)/32000.0)*uEnergy;
  vec2 flow=vec2(
    sin(uv.y*9.0+t*.19+uSeed)+.5*sin(uv.y*23.0-t*.11),
    cos(uv.x*8.0-t*.16+uSeed)+.4*sin(uv.x*19.0+t*.14)
  );
  uv+=flow*vec2(.018,.022)+vec2(wake*.030,-wake*.022);
  // Two advecting coordinates evolve the internal billows and silhouette.
  vec4 a=texture2D(uMap,uv);
  vec4 b=texture2D(uMap,uv+vec2(sin(t*.11+uSeed)*.013,cos(t*.13+uSeed)*.017));
  vec4 sampleColor=mix(a,b,.32+.15*sin(t*.17+uSeed));
  float border=smoothstep(0.0,.08,vUv.x)*smoothstep(0.0,.08,1.0-vUv.x);
  border*=smoothstep(0.0,.10,vUv.y)*smoothstep(0.0,.08,1.0-vUv.y);
  float density=sampleColor.a*border*uOpacity;
  density*=smoothstep(20.0,150.0,length(cameraPosition-vWorld));
  density*=.92+.08*sin(uv.x*13.0+uv.y*7.0+t*.24+uSeed);
  if(density<.006)discard;
  float l=dot(sampleColor.rgb,vec3(.2126,.7152,.0722));
  float value=mix(pow(max(l,0.0),2.2)*.72+.025,.10,uMist);
  float distanceFog=1.0-exp(-length(cameraPosition-vWorld)*.00020);
  value=mix(value,.16,distanceFog*.45);
  gl_FragColor=vec4(vec3(value),density);
}`;

/** An isolated art/motion sample; all scenery uses this single perspective camera. */
export async function createStudyRenderer(
  canvas: HTMLCanvasElement,
  callbacks: Callbacks,
): Promise<StudyRenderer> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x080808, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(47, 1, 1, 8000);
  const atmosphere = createAtmosphere(renderer, camera);
  const resources: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(resource: T): T => {
    if (disposed) resource.dispose();
    else resources.push(resource);
    return resource;
  };
  const loader = new THREE.TextureLoader();
  let disposed = false;
  let contextLost = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let last = performance.now();
  let seconds = 19;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches;
  let journey = new Journey({ idleIntensity: reduced ? 0 : 1, pointerIntensity: reduced ? 0 : 1 });
  let state: JourneyState = "home";
  let announcedSettled = true;
  let announcedReveal = true;
  let empty = false;
  let emptyMix = 0;
  let scrollTarget = 0;
  const scroll: CameraOffset = { position: 0, velocity: 0 };
  const scrollPresence: CameraOffset = { position: 0, velocity: 0 };
  const pointer = { x: 0, y: 0, energy: 0 };
  const objectReaction = new THREE.Vector2();
  const visitor = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();
  const pointerRay = new THREE.Vector3();
  const review = new URLSearchParams(window.location.search).get("motion-review") === "1";

  try {
    const [ridge, lowRidge, cloud, handMap, mineral] = await Promise.all(
      [
        "/world-study/ridge.webp",
        "/world-study/low-ridge.webp",
        "/world-study/cloud.webp",
        "/world-study/hand.webp",
        "/world/mineral.png",
      ].map(async (url) => {
        const texture = keep(await loader.loadAsync(url));
        texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return texture;
      }),
    );
    mineral!.wrapS = mineral!.wrapT = THREE.RepeatWrapping;
    mineral!.repeat.set(7, 7);

    const sky = new THREE.Mesh(
      keep(new THREE.SphereGeometry(6000, 48, 24)),
      keep(
        new THREE.ShaderMaterial({
          vertexShader: skyVertex,
          fragmentShader: skyFragment,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      ),
    );
    sky.renderOrder = -100;
    scene.add(sky);

    // Physical relief bends each authored ridge through depth. Distinct ridges
    // sit hundreds of units apart; mist occupies those spaces rather than a PNG.
    const mountain = (
      map: THREE.Texture,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      exposure: number,
      yaw = 0,
    ) => {
      const geometry = keep(new THREE.PlaneGeometry(w, h, 80, 36));
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i) / w;
        const py = positions.getY(i) / h + 0.5;
        positions.setZ(i, Math.sin(px * Math.PI * 1.3) * w * 0.09 + (1 - py) * (1 - py) * w * 0.12);
      }
      geometry.computeVertexNormals();
      const material = keep(
        new THREE.MeshBasicMaterial({
          map,
          color: new THREE.Color(exposure, exposure, exposure),
          alphaTest: 0.42,
          side: THREE.DoubleSide,
        }),
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = yaw;
      scene.add(mesh);
      return mesh;
    };
    mountain(ridge!, -700, -430, -3650, 7400, 2800, 0.9, 0.025);
    mountain(lowRidge!, 500, -155, -2920, 6200, 2100, 0.7, -0.025);
    mountain(ridge!, 0, -380, -2200, 4200, 1900, 0.65, -0.035);
    mountain(lowRidge!, -200, -210, -1560, 3700, 1700, 0.56, 0.035);
    mountain(lowRidge!, 120, -220, -1250, 3000, 1600, 0.43, -0.035).scale.x = -1;
    mountain(lowRidge!, 0, -285, -750, 2300, 1400, 0.32, -0.025);

    const floor = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(10000, 10000)),
      keep(new THREE.MeshBasicMaterial({ color: 0x151515 })),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1550;
    scene.add(floor);

    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(1200, 1250, -2750);
    key.target.position.set(480, 280, -1700);
    scene.add(key, key.target);
    scene.add(new THREE.HemisphereLight(0xc5c5c5, 0x101010, 0.16));
    const fill = new THREE.DirectionalLight(0x999999, 0.055);
    fill.position.set(-1100, 400, 1000);
    scene.add(fill);

    const orbMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.93,
        metalness: 0.02,
        bumpMap: mineral,
        bumpScale: 0.34,
      }),
    );
    const orb = new THREE.Mesh(keep(new THREE.SphereGeometry(385, 128, 96)), orbMaterial);
    orb.position.set(760, 445, -2320);
    scene.add(orb);
    const handMaterial = keep(
      new THREE.MeshBasicMaterial({
        map: handMap,
        color: 0x747474,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const hand = new THREE.Mesh(keep(new THREE.PlaneGeometry(1450, 2175, 24, 32)), handMaterial);
    hand.position.set(620, 710, -3350);
    hand.rotation.z = -0.09;
    scene.add(hand);

    // Full-resolution authored cloud detail accompanies the true volume. These
    // curved sheets occupy real depth, undulate internally and move in world wind.
    const cloudLayers: Array<{
      mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
      x: number;
      y: number;
      z: number;
      seed: number;
    }> = [];
    const makeCloud = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      opacity: number,
      mist: number,
      seed: number,
      tilt = 0,
    ) => {
      const material = keep(
        new THREE.ShaderMaterial({
          vertexShader: cloudVertex,
          fragmentShader: cloudFragment,
          uniforms: {
            uMap: { value: cloud },
            uTime: { value: seconds },
            uSeed: { value: seed },
            uOpacity: { value: opacity },
            uMist: { value: mist },
            uVisitor: { value: visitor },
            uEnergy: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h, 32, 16)), material);
      mesh.position.set(x, y, z);
      mesh.rotation.x = tilt;
      mesh.rotation.y = Math.sin(seed * 1.3) * 0.13;
      scene.add(mesh);
      cloudLayers.push({ mesh, x, y, z, seed });
    };
    for (let row = 0; row < 7; row++) {
      const z = 300 - row * 485;
      for (let col = 0; col < 3; col++) {
        const seed = row * 3.71 + col * 1.41;
        makeCloud(
          (col - 1) * 820 + Math.sin(seed) * 220,
          25 + Math.sin(seed * 2) * 28,
          z,
          1120 + row * 45,
          295,
          0.83,
          0,
          seed,
          -0.48,
        );
      }
    }
    // Fine low mist moves through the valleys independently of the sea above.
    for (let row = 0; row < 5; row++) {
      makeCloud(
        Math.sin(row * 4) * 500,
        -345 + Math.sin(row) * 40,
        130 - row * 480,
        2250,
        420,
        0.18,
        0.85,
        23 + row * 2.6,
        -0.18,
      );
    }

    const portal = new THREE.Group();
    portal.position.set(80, 390, -1800);
    portal.scale.setScalar(1.4);
    portal.rotation.y = -0.09;
    scene.add(portal);
    const doorwayFill = new THREE.PointLight(0xffffff, 2.2, 1100);
    doorwayFill.position.set(380, 810, -1150);
    scene.add(doorwayFill);
    const stone = keep(
      new THREE.MeshStandardMaterial({
        color: 0x848484,
        roughness: 1,
        map: mineral,
        bumpMap: mineral,
        bumpScale: 0.22,
        transparent: true,
        opacity: 0,
      }),
    );
    const slab = keep(new THREE.BoxGeometry(1, 1, 1));
    for (const [x, y, z, w, h, d] of [
      [-48, 84, 0, 14, 168, 24],
      [48, 84, 0, 14, 168, 24],
      [0, 160, 0, 96, 16, 24],
      [0, -7, 12, 224, 14, 185],
    ] as const) {
      const block = new THREE.Mesh(slab, stone);
      block.position.set(x, y, z);
      block.scale.set(w, h, d);
      portal.add(block);
    }
    const apertureMap = keep(lowRidge!.clone());
    apertureMap.repeat.set(0.373, 1);
    apertureMap.offset.set(0.31, 0);
    const apertureMaterial = keep(
      new THREE.MeshBasicMaterial({
        map: apertureMap,
        color: 0xd6d6d6,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    const aperture = new THREE.Mesh(keep(new THREE.PlaneGeometry(82, 146)), apertureMaterial);
    aperture.position.set(0, 78, -13);
    portal.add(aperture);
    const glowMaterial = keep(
      new THREE.MeshBasicMaterial({ color: 0x9b9b9b, transparent: true, opacity: 0 }),
    );
    const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(82, 146)), glowMaterial);
    glow.position.set(0, 78, -14);
    portal.add(glow);
    const innerOrbMaterial = keep(orbMaterial.clone());
    innerOrbMaterial.transparent = true;
    innerOrbMaterial.opacity = 0;
    const innerOrb = new THREE.Mesh(keep(new THREE.SphereGeometry(12, 32, 24)), innerOrbMaterial);
    innerOrb.position.set(0, 105, 0);
    portal.add(innerOrb);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 600 ? 57 : 47;
      camera.updateProjectionMatrix();
      atmosphere.resize(width, height, dpr);
    };
    const onPointer = (event: PointerEvent) => {
      const x = (event.clientX / width) * 2 - 1,
        y = 1 - (event.clientY / height) * 2;
      pointer.energy = Math.min(1, pointer.energy + Math.hypot(x - pointer.x, y - pointer.y) * 1.9);
      pointer.x = x;
      pointer.y = y;
      if (!reduced) journey.setPointer(x, y);
    };
    const onLeave = () => {
      pointer.x = pointer.y = 0;
      journey.setPointer(0, 0);
    };
    const onVisibility = () => {
      const now = performance.now();
      last = now;
      if (document.hidden) journey.pause(now);
      else journey.resume(now);
    };
    const onMotion = () => {
      reduced = motion.matches;
      journey = new Journey({
        initialState: state,
        idleIntensity: reduced ? 0 : 1,
        pointerIntensity: reduced ? 0 : 1,
      });
      announcedSettled = true;
      announcedReveal = true;
      callbacks.onState(state, true);
      callbacks.onReveal(state);
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frame);
      callbacks.onError(
        new Error("The graphics context was interrupted. Reload to re-enter the world."),
      );
    };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotion);
    canvas.addEventListener("webglcontextlost", onContextLost);
    resize();
    renderer.compile(scene, camera);

    const render = (now: number) => {
      if (disposed || contextLost) return;
      frame = requestAnimationFrame(render);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (document.hidden) return;
      if (!reduced) seconds += dt;
      const sample = journey.sample(now);
      eye.fromArray(sample.pose.eye);
      look.fromArray(sample.pose.target);
      advanceOffset(scroll, scrollTarget, dt);
      advanceOffset(scrollPresence, sample.state === "about" ? 1 : 0, dt);
      const s = scroll.position * scrollPresence.position;
      eye.z -= s * 160;
      eye.y -= s * 45;
      look.z -= s * 160;
      look.y -= s * 45;
      // Portrait framing translates both eye and target; every object and the
      // cloud ray share the resulting view, rather than moving a landmark alone.
      const portrait = Math.max(0, 1.05 - width / height);
      eye.x += portrait * 170;
      look.x += portrait * 170;
      camera.position.copy(eye);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      sky.position.copy(eye);
      pointerRay.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(eye).normalize();
      const intersection = Math.abs(pointerRay.y) > 0.001 ? (38 - eye.y) / pointerRay.y : 700;
      visitor
        .copy(eye)
        .addScaledVector(
          pointerRay,
          intersection > 0 ? THREE.MathUtils.clamp(intersection, 120, 1800) : 700,
        );
      pointer.energy *= Math.exp(-dt * 2.8);
      objectReaction.x +=
        ((reduced ? 0 : pointer.x) - objectReaction.x) * (1 - Math.exp(-dt * 1.8));
      objectReaction.y +=
        ((reduced ? 0 : pointer.y) - objectReaction.y) * (1 - Math.exp(-dt * 1.8));
      orb.position.x = 760 + objectReaction.x * 12;
      orb.position.y = 445 + Math.sin(seconds * 0.15) * 3.5 + objectReaction.y * 7;
      orb.rotation.y = seconds * 0.008;
      hand.position.x = 620 - objectReaction.x * 9;
      hand.position.y = 710 + Math.sin(seconds * 0.09) * 5 + objectReaction.y * 8;
      hand.rotation.z = -0.09 + Math.sin(seconds * 0.07) * 0.009 + objectReaction.x * 0.012;
      for (const layer of cloudLayers) {
        layer.mesh.position.x =
          layer.x + Math.sin(seconds * 0.04) * 145 + Math.sin(seconds * 0.09 + layer.seed) * 12;
        layer.mesh.position.y = layer.y + Math.sin(seconds * 0.12 + layer.seed) * 5;
        layer.mesh.material.uniforms.uTime!.value = seconds;
        layer.mesh.material.uniforms.uEnergy!.value = reduced ? 0 : pointer.energy;
      }
      emptyMix += ((empty && state === "work" ? 1 : 0) - emptyMix) * (1 - Math.exp(-dt * 3.4));
      portal.visible = emptyMix > 0.002;
      doorwayFill.intensity = emptyMix * 2.2;
      stone.opacity = emptyMix;
      apertureMaterial.opacity = emptyMix;
      glowMaterial.opacity = emptyMix;
      innerOrbMaterial.opacity = emptyMix;
      atmosphere.render(scene, seconds, {
        x: pointer.x,
        y: pointer.y,
        energy: reduced ? 0 : pointer.energy,
      });
      if (review) window.dispatchEvent(new Event("adam:environment-frame"));
      if (sample.progress >= 0.72 && !announcedReveal) {
        announcedReveal = true;
        callbacks.onReveal(state);
      }
      if (sample.settled && !announcedSettled) {
        announcedSettled = true;
        callbacks.onState(state, true);
      }
    };
    render(performance.now());
    if (!contextLost) callbacks.onReady();

    return {
      go(next) {
        if (disposed || contextLost || next === state) return;
        state = next;
        announcedSettled = false;
        announcedReveal = false;
        callbacks.onState(next, false);
        if (reduced) {
          journey = new Journey({ initialState: next, idleIntensity: 0, pointerIntensity: 0 });
        } else journey.go(next, performance.now());
      },
      setEmpty(value) {
        empty = value;
      },
      setScroll(value) {
        scrollTarget = Math.max(0, Math.min(1, value));
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointer);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        motion.removeEventListener("change", onMotion);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        atmosphere.dispose();
        for (const resource of resources) resource.dispose();
        renderer.dispose();
      },
    };
  } catch (error) {
    disposed = true;
    cancelAnimationFrame(frame);
    atmosphere.dispose();
    for (const resource of resources) resource.dispose();
    renderer.dispose();
    throw error;
  }
}
