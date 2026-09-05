/**
 * Quiet, fixed landmarks behind the live cloud volume. The camera translates
 * through world coordinates; the photograph is only a distant hand shadow.
 * All foreground occlusion is supplied by the evolving Vanta cloud field.
 */
export const cloudLandmarks = /* glsl */ `
uniform float uTravel;
uniform float uAbout;
uniform float uSeconds;
uniform sampler2D uHand;
uniform float uPortalReveal;
uniform float uPortalHover;
uniform float uCompact;

// This unit vector is an XYZ direction, never an RGB color. All rendered
// colors below use vec3(single luminance), with the grayscale CSS retained.
const vec3 WORLD_LIGHT_DIRECTION = normalize(vec3(0.74, 0.30, 0.60));
const vec3 DOOR_PIVOT = vec3(0.0, -0.20, -9.13);
const mat3 DOOR_LOCAL = mat3(0.978, 0.0, 0.208, 0.0, 1.0, 0.0, -0.208, 0.0, 0.978);
const mat3 DOOR_WORLD = mat3(0.978, 0.0, -0.208, 0.0, 1.0, 0.0, 0.208, 0.0, 0.978);

float worldSphereHit(vec3 ro, vec3 rd, vec3 center, float radius) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + radius * radius;
  if (h < 0.0) return 10000.0;
  float nearHit = -b - sqrt(h);
  return nearHit > 0.0 ? nearHit : 10000.0;
}

float worldBoxHit(vec3 ro, vec3 rd, vec3 lower, vec3 upper, out vec3 normal) {
  vec3 inv = 1.0 / (rd + vec3(0.000001));
  vec3 lo = (lower - ro) * inv;
  vec3 hi = (upper - ro) * inv;
  vec3 entry = min(lo, hi);
  vec3 leave = max(lo, hi);
  float nearHit = max(max(entry.x, entry.y), entry.z);
  float farHit = min(min(leave.x, leave.y), leave.z);
  normal = vec3(0.0, 0.0, 1.0);
  if (nearHit < 0.0 || farHit < nearHit) return 10000.0;
  vec3 local = (ro + nearHit * rd - (lower + upper) * 0.5) / ((upper - lower) * 0.5);
  vec3 face = abs(local);
  if (face.x > face.y && face.x > face.z) normal = vec3(sign(local.x), 0.0, 0.0);
  else if (face.y > face.z) normal = vec3(0.0, sign(local.y), 0.0);
  else normal = vec3(0.0, 0.0, sign(local.z));
  return nearHit;
}

float worldDoorHit(vec3 ro, vec3 rd, out vec3 normal) {
  ro = DOOR_LOCAL * (ro - DOOR_PIVOT) + DOOR_PIVOT;
  rd = DOOR_LOCAL * rd;
  vec3 n;
  float nearest = worldBoxHit(ro, rd, vec3(-0.68, -1.20, -9.55), vec3(-0.50, 0.86, -9.0), normal);
  float hit = worldBoxHit(ro, rd, vec3(0.50, -1.20, -9.55), vec3(0.68, 0.86, -9.0), n);
  if (hit < nearest) { nearest = hit; normal = n; }
  hit = worldBoxHit(ro, rd, vec3(-0.50, 0.64, -9.55), vec3(0.50, 0.86, -9.0), n);
  if (hit < nearest) { nearest = hit; normal = n; }
  hit = worldBoxHit(ro, rd, vec3(-0.97, -1.25, -9.54), vec3(0.97, -1.20, -8.72), n);
  if (hit < nearest) { nearest = hit; normal = n; }
  normal = DOOR_WORLD * normal;
  return nearest;
}

vec3 worldBehindClouds(vec2 p, vec2 pointer, vec3 sky, out float groundMask) {
  float travel = clamp(uTravel, 0.0, 1.0);
  float about = clamp(uAbout, 0.0, 1.0);
  vec3 ro = vec3(0.0, -3.0 * about, 4.0 - 6.0 * travel);
  float portrait = max(0.0, 1.1 - iResolution.x / iResolution.y);
  ro.xy += clamp(pointer, vec2(-1.0), vec2(1.0)) * vec2(0.04, 0.025);
  vec3 rd = normalize(vec3(p + vec2(0.0, 0.55 * about - 0.35 * uCompact * travel), -1.5));
  vec3 col = vec3(dot(sky, vec3(0.333333)));
  groundMask = 0.0;
  float nearest = 10000.0;
  float basin = smoothstep(0.65, 1.0, travel) * (1.0 - smoothstep(0.0, 0.45, about));
  float reveal = clamp(uPortalReveal, 0.0, 1.0);

  // An enormous presence far beyond the sphere. Texture detail never becomes
  // surface detail: only a blurred, breathing shadow makes it through the mist.
  float handT = (-16.0 - ro.z) / rd.z;
  vec2 handUv = ((ro + rd * handT).xy - vec2(9.0 - portrait * 9.0, 4.0)) / vec2(12.0, 18.0) + 0.5;
  if (handT > 0.0 && handUv.x > 0.0 && handUv.x < 1.0 && handUv.y > 0.0 && handUv.y < 1.0) {
    vec2 spread = vec2(0.007, 0.006);
    vec4 hand = texture2D(uHand, handUv) * 0.40;
    hand += texture2D(uHand, handUv + vec2(spread.x, 0.0)) * 0.15;
    hand += texture2D(uHand, handUv - vec2(spread.x, 0.0)) * 0.15;
    hand += texture2D(uHand, handUv + vec2(0.0, spread.y)) * 0.15;
    hand += texture2D(uHand, handUv - vec2(0.0, spread.y)) * 0.15;
    float veil = noise(vec3(handUv * 3.4, uSeconds * 0.014));
    float conceal = smoothstep(0.24, 0.70, veil) * smoothstep(0.13, 0.52, handUv.y);
    float presence = hand.a * (0.10 + 0.35 * conceal);
    col = mix(col, col * 0.36 + vec3(0.004), presence);
  }

  // A single solid landmark. The forward camera moves past its left edge,
  // instead of scaling an illustration in place. The light is broad and matte.
  vec3 sphereCenter = vec3(6.8 - portrait * 6.0, 1.8, -8.0);
  float sphereT = worldSphereHit(ro, rd, sphereCenter, 2.6);
  if (sphereT < nearest) {
    vec3 position = ro + rd * sphereT;
    vec3 normal = normalize(position - sphereCenter);
    float light = smoothstep(-0.25, 0.95, dot(normal, WORLD_LIGHT_DIRECTION));
    float mineral = noise(position * 8.0) * 0.62 + noise(position * 23.0) * 0.38;
    float value = 0.040 + 0.34 * pow(light, 1.2);
    value += (mineral - 0.5) * (0.020 + light * 0.035);
    float rim = pow(1.0 - max(0.0, dot(normal, -rd)), 3.0);
    value += rim * light * 0.034;
    float haze = 1.0 - exp(-sphereT * 0.009);
    vec3 oc = ro - sphereCenter;
    float b = dot(oc, rd);
    float discriminant = b * b - dot(oc, oc) + 2.6 * 2.6;
    float coverage = smoothstep(0.0, 0.045, discriminant);
    col = mix(col, mix(vec3(value), col, haze), coverage);
    nearest = sphereT;
  }

  // The Work shelf is an actual plane in the same projection. Its texture is
  // fixed in world space; only the atmosphere moves over its surface.
  if (basin > 0.001 && ro.y > -1.25 && rd.y < -0.001) {
    float groundT = (-1.25 - ro.y) / rd.y;
    if (groundT > 0.0 && groundT < nearest) {
      vec3 position = ro + rd * groundT;
      float stone = noise(position * vec3(6.0, 1.0, 6.0));
      float variation = noise(position * 0.42);
      float value = 0.085 + stone * 0.019 + variation * 0.024;
      float distanceMist = 1.0 - exp(-groundT * 0.085);
      value = mix(value, 0.34, distanceMist);
      vec3 shadowNormal;
      float shadowHit = worldDoorHit(position + vec3(0.0, 0.003, 0.0), WORLD_LIGHT_DIRECTION, shadowNormal);
      if (shadowHit < 1000.0) {
        float shadow = (0.20 + reveal * 0.32) * exp(-shadowHit * 0.07);
        value *= 1.0 - shadow;
      }
      float fog = noise(vec3(position.xz * 0.36 + vec2(uSeconds * 0.012, uSeconds * 0.004), 3.7));
      value += smoothstep(0.35, 0.75, fog) * 0.035;
      float opacity = basin * (1.0 - smoothstep(20.0, 90.0, groundT));
      col = mix(col, vec3(value), opacity);
      groundMask = opacity * (1.0 - smoothstep(12.0, 35.0, groundT));
      if (opacity > 0.99) nearest = groundT;
    }
  }

  if (basin > 0.001) {
    // The opening retains the surrounding world's mountain and cloud language.
    // Its small orb provides a visual echo, not another independent scene.
    vec3 windowRo = DOOR_LOCAL * (ro - DOOR_PIVOT) + DOOR_PIVOT;
    vec3 windowRd = DOOR_LOCAL * rd;
    float windowT = (-9.545 - windowRo.z) / windowRd.z;
    vec3 windowPosition = windowRo + windowRd * windowT;
    if (windowT > 0.0 && windowT < nearest && abs(windowPosition.x) < 0.50 && windowPosition.y > -1.20 && windowPosition.y < 0.64) {
      vec2 uv = vec2(windowPosition.x + 0.50, (windowPosition.y + 1.20) / 1.84);
      float ridge = 0.22 + noise(vec3(uv.x * 7.0, 4.2, 1.0)) * 0.12;
      float farRidge = 0.32 + noise(vec3(uv.x * 4.0, 2.1, 5.0)) * 0.09;
      float valley = mix(0.35, 0.74, smoothstep(farRidge - 0.015, farRidge + 0.035, uv.y));
      valley = mix(0.24, valley, smoothstep(ridge - 0.005, ridge + 0.015, uv.y));
      float drift = noise(vec3(uv * vec2(5.0, 7.0), uSeconds * 0.035));
      valley = mix(valley, 0.80, smoothstep(0.39, 0.78, drift) * (1.0 - smoothstep(0.35, 0.64, uv.y)) * 0.65);
      vec2 orb = (uv - vec2(0.59, 0.68)) * vec2(1.0, 1.84);
      float orbRadius = 0.115;
      float orbDistance = length(orb);
      if (orbDistance < orbRadius) {
        vec3 normal = vec3(orb / orbRadius, sqrt(max(0.0, 1.0 - dot(orb, orb) / (orbRadius * orbRadius))));
        float orbValue = 0.07 + max(0.0, dot(normal, WORLD_LIGHT_DIRECTION)) * 0.22;
        valley = mix(valley, orbValue, 1.0 - smoothstep(orbRadius - 0.006, orbRadius, orbDistance));
      }
      valley += clamp(uPortalHover, 0.0, 1.0) * 0.035;
      float visibility = basin * (0.20 + 0.80 * reveal);
      col = mix(col, vec3(valley), visibility);
      groundMask = max(groundMask, basin * 0.8);
    }

    vec3 frameNormal;
    float frameT = worldDoorHit(ro, rd, frameNormal);
    if (frameT < nearest) {
      vec3 position = ro + rd * frameT;
      float light = max(0.0, dot(frameNormal, WORLD_LIGHT_DIRECTION));
      float stone = noise(position * 34.0) * 0.7 + noise(position * 11.0) * 0.3;
      float value = 0.10 + light * 0.52 + (stone - 0.5) * 0.04;
      float visibility = basin * (0.20 + 0.80 * reveal);
      col = mix(col, vec3(value), visibility);
      groundMask = max(groundMask, basin * 0.72);
    }
  }
  return col;
}
`;
