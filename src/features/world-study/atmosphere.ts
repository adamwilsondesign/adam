import * as THREE from "three";

export interface AtmospherePointer {
  /** Normalized device coordinates, -1…1. */
  x: number;
  y: number;
  /** Restrained visitor activity, 0…1. */
  energy: number;
}

export interface StudyAtmosphere {
  render(scene: THREE.Scene, timeSeconds: number, pointer: AtmospherePointer): void;
  /** CSS dimensions and the renderer's actual pixel ratio. */
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const reconstruction = /* glsl */ `
  uniform mat4 uProjectionInverse;
  uniform mat4 uCameraWorld;
  uniform vec3 uCameraPosition;
  uniform float uNear;
  uniform float uFar;

  vec3 viewPosition(vec2 uv, float depth) {
    vec4 p = uProjectionInverse * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
  }

  vec3 worldDirection(vec2 uv) {
    vec3 viewRay = normalize(viewPosition(uv, 0.5));
    return normalize(mat3(uCameraWorld) * viewRay);
  }

  float linearDepth(float d) {
    return (uNear * uFar) / max(0.0001, uFar - d * (uFar - uNear));
  }
`;

const volumeFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uDepth;
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform vec3 uWake;
  uniform float uWakeEnergy;
  uniform float uSteps;
  ${reconstruction}

  // XYZ direction only. All radiance below is a neutral scalar.
  const vec3 LIGHT_DIRECTION = vec3(0.629, 0.734, 0.262);
  const float CLOUD_BOTTOM = -70.0;
  const float CLOUD_TOP = 150.0;
  const float MAX_DISTANCE = 3200.0;

  // The two texture channels contain adjacent Z slices of a periodic noise
  // lattice. One bilinear lookup reconstructs a smooth 3D sample.
  float noise3(vec3 p) {
    vec3 ip = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec2 uv = ip.xy + vec2(37.0, 17.0) * ip.z + f.xy;
    vec2 slices = texture2D(uNoise, (uv + 0.5) / 256.0).rg;
    return mix(slices.x, slices.y, f.z);
  }

  vec3 movingDomain(vec3 p) {
    // The weather never reverses or speeds up when the visitor travels.
    p.x -= uTime * 6.2;
    p.z += uTime * 2.8;
    vec3 q = p * 0.012;
    q.x += 0.24 * sin(q.z * 0.7 + uTime * 0.20);
    q.y += 0.22 * sin(q.x * 0.8 + uTime * 0.18);
    q.z += 0.18 * cos(q.y + uTime * 0.19);
    return q;
  }

  float cloudDensity(vec3 p, float distanceFromCamera) {
    float wake = exp(-dot(p - uWake, p - uWake) / 25000.0) * uWakeEnergy;
    p.y += wake * 9.0;
    vec3 q = movingDomain(p);
    float broad = noise3(q * 0.48);
    float body = noise3(q);
    // Detail is stationary in its own slowly advecting coordinates, rather
    // than a high-frequency time term that would make edges shimmer.
    float detail = noise3(q * 2.13 + vec3(7.0, uTime * 0.032, 11.0));
    float erosion = noise3(q * 6.71 + vec3(19.0, uTime * 0.025, 3.0));
    // Fine structure participates in the shape itself, rather than merely
    // tinting the outside of a low-frequency, hill-like density field.
    float shape = body * 0.53 + detail * 0.34 + broad * 0.13;
    float center = 38.0 + (broad - 0.5) * 48.0;
    float vertical = abs((p.y - center) / 104.0);
    float profile = vertical * vertical * 0.48;
    float coverageThreshold = mix(0.42, 0.26, smoothstep(0.30, 0.72, broad));
    float surface = shape - coverageThreshold - profile;
    float edgeErosion = mix(0.25, 0.045, smoothstep(0.0, 0.20, surface));
    float fineErosion = (1.0 - erosion) * (1.0 - erosion) * edgeErosion;
    float d = max(0.0, surface - fineErosion - wake * 0.035) * 3.15;
    d *= smoothstep(CLOUD_BOTTOM, CLOUD_BOTTOM + 24.0, p.y);
    d *= 1.0 - smoothstep(CLOUD_TOP - 28.0, CLOUD_TOP, p.y);
    // Fade only the remote end of the enormous volume, never its local form.
    d *= 1.0 - smoothstep(2400.0, MAX_DISTANCE, distanceFromCamera);
    return d;
  }

  float lightOcclusion(vec3 p) {
    vec3 q = movingDomain(p + LIGHT_DIRECTION * 26.0);
    float broad = noise3(q * 0.48);
    float body = noise3(q);
    float center = 38.0 + (broad - 0.5) * 48.0;
    float vertical = abs((p.y + LIGHT_DIRECTION.y * 26.0 - center) / 104.0);
    float coverageThreshold = mix(0.42, 0.26, smoothstep(0.30, 0.72, broad));
    return max(0.0, body * 0.68 + broad * 0.32 - coverageThreshold - 0.035 - vertical * vertical * 0.48) * 3.15;
  }

  void main() {
    vec3 rd = worldDirection(vUv);
    float depth = texture2D(uDepth, vUv).x;
    float surfaceDistance = depth > 0.999999 ? MAX_DISTANCE : length(viewPosition(vUv, depth));
    float verticalDirection = abs(rd.y) < 0.0001 ? (rd.y < 0.0 ? -0.0001 : 0.0001) : rd.y;
    float ta = (CLOUD_BOTTOM - uCameraPosition.y) / verticalDirection;
    float tb = (CLOUD_TOP - uCameraPosition.y) / verticalDirection;
    float start = max(0.0, min(ta, tb));
    float end = min(min(MAX_DISTANCE, surfaceDistance), max(ta, tb));

    if (end <= start) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float stepLength = (end - start) / uSteps;
    // Spatially fixed interleaved sampling hides march bands without boiling
    // noise or a history buffer that could trail through a fast transition.
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float distanceAlongRay = start + stepLength * (0.18 + jitter * 0.64);
    float transmittance = 1.0;
    float radiance = 0.0;
    float forwardSilver = pow(max(0.0, dot(rd, LIGHT_DIRECTION)), 9.0);

    for (int i = 0; i < 48; i++) {
      if (float(i) >= uSteps || transmittance < 0.018) break;
      vec3 p = uCameraPosition + rd * distanceAlongRay;
      float density = cloudDensity(p, distanceAlongRay);
      if (density > 0.008) {
        float occlusion = lightOcclusion(p);
        float sun = exp(-occlusion * 5.2);
        float heightLight = smoothstep(-40.0, 132.0, p.y);
        float litEdge = clamp((density - occlusion) * 4.2, 0.0, 1.0);
        float illumination = 0.009 + heightLight * 0.018;
        illumination += sun * (0.055 + litEdge * 0.22);
        illumination += forwardSilver * sun * 0.025;
        // The authored near-cloud detail remains visible through this sparse
        // physical volume; it supplies intervening depth and self-shadow.
        float alpha = 1.0 - exp(-density * stepLength * 0.0022);
        radiance += transmittance * alpha * illumination;
        transmittance *= 1.0 - alpha;
      }
      distanceAlongRay += stepLength;
    }
    // Premultiplied volume: it can be bilinearly reconstructed without a
    // gray fringe at its boundary and composited over crisp scene geometry.
    gl_FragColor = vec4(vec3(radiance), 1.0 - transmittance);
  }
`;

const compositeFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform sampler2D uDepth;
  uniform sampler2D uVolume;
  uniform vec2 uVolumeSize;
  uniform vec2 uSceneTexel;
  uniform float uTime;
  ${reconstruction}

  float depthWeight(vec2 uv, float centerDepth) {
    float sampleDepth = linearDepth(texture2D(uDepth, uv).x);
    // Reject cloud samples stopped by a different surface. This protects
    // thin ridge, hand and sphere edges during the low-resolution upscale.
    float tolerance = max(4.0, centerDepth * 0.008);
    return exp(-abs(sampleDepth - centerDepth) / tolerance);
  }

  vec4 volumeAtFullResolution(float centerDepth) {
    vec2 pixel = vUv * uVolumeSize - 0.5;
    vec2 base = floor(pixel);
    vec2 f = fract(pixel);
    vec2 uv00 = (base + vec2(0.5, 0.5)) / uVolumeSize;
    vec2 uv10 = (base + vec2(1.5, 0.5)) / uVolumeSize;
    vec2 uv01 = (base + vec2(0.5, 1.5)) / uVolumeSize;
    vec2 uv11 = (base + vec2(1.5, 1.5)) / uVolumeSize;
    float w00 = (1.0-f.x) * (1.0-f.y) * depthWeight(uv00, centerDepth);
    float w10 = f.x * (1.0-f.y) * depthWeight(uv10, centerDepth);
    float w01 = (1.0-f.x) * f.y * depthWeight(uv01, centerDepth);
    float w11 = f.x * f.y * depthWeight(uv11, centerDepth);
    float total = w00+w10+w01+w11;
    if (total < 0.0001) return texture2D(uVolume, vUv);
    return (
      texture2D(uVolume, uv00)*w00 + texture2D(uVolume, uv10)*w10 +
      texture2D(uVolume, uv01)*w01 + texture2D(uVolume, uv11)*w11
    ) / total;
  }

  void main() {
    vec3 scene = texture2D(uScene, vUv).rgb;
    float depth = texture2D(uDepth, vUv).x;
    float centerDepth = linearDepth(depth);
    // Only geometric silhouettes receive a subpixel edge soften. Depth
    // derivatives cost no additional samples; detailed surfaces stay crisp.
    float silhouette = smoothstep(0.018, 0.065, fwidth(centerDepth) / max(1.0, centerDepth));
    if (silhouette > 0.005) {
      vec3 neighbors = texture2D(uScene, vUv + vec2(uSceneTexel.x, 0.0)).rgb;
      neighbors += texture2D(uScene, vUv - vec2(uSceneTexel.x, 0.0)).rgb;
      neighbors += texture2D(uScene, vUv + vec2(0.0, uSceneTexel.y)).rgb;
      neighbors += texture2D(uScene, vUv - vec2(0.0, uSceneTexel.y)).rgb;
      scene = mix(scene, neighbors * 0.25, silhouette * 0.30);
    }
    vec3 rd = worldDirection(vUv);
    vec3 surface = uCameraPosition + rd * min(2700.0, length(viewPosition(vUv, depth)));

    // Sparse low-altitude mist occupies the spaces between depth-writing
    // ridges. It does not cover the foreground or lift the whole black point.
    float heightFog = exp(-abs((surface.y + uCameraPosition.y) * 0.5 + 75.0) / 95.0);
    float distanceFog = 1.0 - exp(-max(0.0, centerDepth - 260.0) * 0.00038);
    float fog = min(0.22, heightFog * distanceFog * 0.30);
    float lightCone = pow(max(0.0, dot(rd, normalize(vec3(0.60, 0.70, 0.25)))), 14.0);
    scene = mix(scene, vec3(0.18 + lightCone * 0.06), fog);

    vec4 volume = volumeAtFullResolution(centerDepth);
    vec3 color = volume.rgb + scene * (1.0 - volume.a);
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    // Neutral output is enforced here regardless of imported image metadata.
    // One display-level dither also disguises 8-bit integration banding.
    float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy + floor(uTime * 12.0), vec2(0.06711056, 0.00583715)))) - 0.5;
    gl_FragColor = vec4(vec3(clamp(pow(max(0.0, luminance - 0.004) * 1.10, 1.09), 0.0, 1.0)), 1.0);
    #include <encodings_fragment>
    gl_FragColor.rgb = clamp(gl_FragColor.rgb + grain * 0.014, 0.0, 1.0);
  }
`;

/** A small immutable 3D noise lookup; no generated images or per-frame baking. */
function createNoiseTexture() {
  const side = 256;
  const lattice = new Uint8Array(side * side);
  let seed = 0x31c6ae07;
  for (let i = 0; i < lattice.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    lattice[i] = (seed >>> 0) & 255;
  }
  const pixels = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const index = (y * side + x) * 4;
      pixels[index] = lattice[y * side + x]!;
      pixels[index + 1] = lattice[((y + 17) & 255) * side + ((x + 37) & 255)]!;
      pixels[index + 2] = 0;
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, side, side, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A single shared-camera atmosphere for the isolated visual study. Render the
 * detailed world once with a real depth attachment, march weather up to those
 * surfaces at a bounded pixel cost, then composite at native scene resolution.
 */
export function createAtmosphere(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
): StudyAtmosphere {
  const noise = createNoiseTexture();
  const depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  // Linear 8-bit color loses most of the charcoal range before the final
  // display encoding. Half-float keeps the authored sky and shadows smooth.
  const colorType =
    renderer.capabilities.isWebGL2 && renderer.extensions.has("EXT_color_buffer_float")
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: colorType,
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture,
  });
  sceneTarget.texture.name = "world-study-scene";
  const volumeTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: colorType,
    depthBuffer: false,
    stencilBuffer: false,
  });
  volumeTarget.texture.name = "world-study-volume";

  const reconstructionUniforms = {
    uProjectionInverse: { value: new THREE.Matrix4() },
    uCameraWorld: { value: new THREE.Matrix4() },
    uCameraPosition: { value: new THREE.Vector3() },
    uNear: { value: camera.near },
    uFar: { value: camera.far },
  };
  const volumeMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: volumeFragment,
    uniforms: {
      ...reconstructionUniforms,
      uDepth: { value: depthTexture },
      uNoise: { value: noise },
      uTime: { value: 0 },
      uWake: { value: new THREE.Vector3() },
      uWakeEnergy: { value: 0 },
      uSteps: { value: 48 },
    },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const compositeMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: compositeFragment,
    uniforms: {
      ...reconstructionUniforms,
      uScene: { value: sceneTarget.texture },
      uDepth: { value: depthTexture },
      uVolume: { value: volumeTarget.texture },
      uVolumeSize: { value: new THREE.Vector2(1, 1) },
      uSceneTexel: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  compositeMaterial.extensions.derivatives = true;
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeometry, volumeMaterial);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pointerRay = new THREE.Vector3();
  const smoothPointer = new THREE.Vector2();
  const previousClearColor = new THREE.Color();
  let pointerEnergy = 0;
  let previousTime: number | null = null;
  let disposed = false;

  const resize = (width: number, height: number, dpr: number) => {
    if (disposed) return;
    const pixelRatio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    sceneTarget.setSize(
      Math.max(1, Math.round(safeWidth * pixelRatio)),
      Math.max(1, Math.round(safeHeight * pixelRatio)),
    );
    compositeMaterial.uniforms.uSceneTexel!.value.set(
      1 / sceneTarget.width,
      1 / sceneTarget.height,
    );
    const scale = safeWidth < 700 ? 0.58 : 0.6;
    const volumeWidth = Math.max(1, Math.round(safeWidth * scale));
    const volumeHeight = Math.max(1, Math.round(safeHeight * scale));
    volumeTarget.setSize(volumeWidth, volumeHeight);
    compositeMaterial.uniforms.uVolumeSize!.value.set(volumeWidth, volumeHeight);
    volumeMaterial.uniforms.uSteps!.value = safeWidth < 700 ? 36 : 48;
  };

  return {
    resize,
    render(scene, timeSeconds, pointer) {
      if (disposed) return;
      const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
      const dt = previousTime === null ? 1 / 60 : Math.min(0.05, Math.max(0, time - previousTime));
      previousTime = time;
      const smoothing = 1 - Math.exp(-3.2 * dt);
      smoothPointer.x +=
        (THREE.MathUtils.clamp(pointer.x || 0, -1, 1) - smoothPointer.x) * smoothing;
      smoothPointer.y +=
        (THREE.MathUtils.clamp(pointer.y || 0, -1, 1) - smoothPointer.y) * smoothing;
      pointerEnergy +=
        (THREE.MathUtils.clamp(pointer.energy || 0, 0, 1) - pointerEnergy) * smoothing;

      camera.updateMatrixWorld();
      reconstructionUniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
      reconstructionUniforms.uCameraWorld.value.copy(camera.matrixWorld);
      reconstructionUniforms.uCameraPosition.value.setFromMatrixPosition(camera.matrixWorld);
      reconstructionUniforms.uNear.value = camera.near;
      reconstructionUniforms.uFar.value = camera.far;
      const cameraPosition = reconstructionUniforms.uCameraPosition.value;
      pointerRay
        .set(smoothPointer.x, smoothPointer.y, 0.5)
        .unproject(camera)
        .sub(cameraPosition)
        .normalize();
      const seaDistance =
        Math.abs(pointerRay.y) > 0.001 ? (38 - cameraPosition.y) / pointerRay.y : 500;
      const wakeDistance = THREE.MathUtils.clamp(seaDistance, 180, 900);
      volumeMaterial.uniforms
        .uWake!.value.copy(pointerRay)
        .multiplyScalar(wakeDistance)
        .add(cameraPosition);
      volumeMaterial.uniforms.uWakeEnergy!.value = pointerEnergy;
      volumeMaterial.uniforms.uTime!.value = time;
      compositeMaterial.uniforms.uTime!.value = time;

      const previousTarget = renderer.getRenderTarget();
      const previousAutoClear = renderer.autoClear;
      const previousClearAlpha = renderer.getClearAlpha();
      renderer.getClearColor(previousClearColor);
      renderer.autoClear = true;
      try {
        renderer.setRenderTarget(sceneTarget);
        renderer.render(scene, camera);
        quad.material = volumeMaterial;
        renderer.setRenderTarget(volumeTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.render(postScene, postCamera);
        quad.material = compositeMaterial;
        renderer.setRenderTarget(previousTarget);
        renderer.render(postScene, postCamera);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(previousClearColor, previousClearAlpha);
        renderer.autoClear = previousAutoClear;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      sceneTarget.dispose();
      depthTexture.dispose();
      volumeTarget.dispose();
      noise.dispose();
      volumeMaterial.dispose();
      compositeMaterial.dispose();
      quadGeometry.dispose();
      postScene.clear();
    },
  };
}
