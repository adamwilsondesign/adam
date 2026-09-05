/* Original cloud density and mineral textures. Offline generation only. */
import sharp from "sharp";
import fs from "node:fs";
function hash(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function noise(x, y) {
  const a = Math.floor(x),
    b = Math.floor(y);
  let u = x - a,
    v = y - b;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  return (
    (hash(a, b) * (1 - u) + hash(a + 1, b) * u) * (1 - v) +
    (hash(a, b + 1) * (1 - u) + hash(a + 1, b + 1) * u) * v
  );
}
function fbm(x, y) {
  let f = 0,
    a = 0.5;
  for (let k = 0; k < 6; k++) {
    f += a * noise(x, y);
    x = x * 2.03 + 7;
    y = y * 2.03 + 3;
    a *= 0.5;
  }
  return f;
}
(async () => {
  fs.mkdirSync("public/world", { recursive: true });
  const n = 512,
    cloud = Buffer.alloc(n * n * 4),
    stone = Buffer.alloc(n * n * 4);
  // A sculpted bank, asymmetrically lit from above/right. Eight lobes share a body.
  function density(u, v) {
    let shape = 0;
    for (let i = 0; i < 8; i++) {
      const cx = 0.13 + i * 0.103,
        cy = 0.53 + Math.sin(i * 2.1) * 0.09,
        rx = 0.12 + hash(i, 2) * 0.1,
        ry = 0.14 + hash(i, 3) * 0.15;
      shape = Math.max(shape, Math.exp(-(((u - cx) / rx) ** 2) - ((v - cy) / ry) ** 2));
    }
    const f = fbm(u * 9, v * 9);
    return Math.max(0, Math.min(1, (shape - 0.18 + (f - 0.5) * 0.67) * 2.1));
  }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = x / (n - 1),
        v = y / (n - 1),
        i = (y * n + x) * 4;
      const d = density(u, v),
        light = Math.max(
          0,
          Math.min(1, 0.48 + (density(u + 0.008, v - 0.012) - d) * 7 + (1 - v) * 0.27),
        );
      const c = 76 + light * 135;
      cloud[i] = c;
      cloud[i + 1] = c;
      cloud[i + 2] = c * 0.985;
      cloud[i + 3] = Math.round(d * 235);
      // Periodic lattice noise guarantees matching tile edges at every octave.
      const tileNoise = (xx, yy, period) => {
        const a = Math.floor(xx),
          b = Math.floor(yy);
        const wrap = (v) => ((v % period) + period) % period;
        const h = (x, y) => hash(wrap(x), wrap(y));
        let fx = xx - a,
          fy = yy - b;
        fx = fx * fx * (3 - 2 * fx);
        fy = fy * fy * (3 - 2 * fy);
        return (
          (h(a, b) * (1 - fx) + h(a + 1, b) * fx) * (1 - fy) +
          (h(a, b + 1) * (1 - fx) + h(a + 1, b + 1) * fx) * fy
        );
      };
      let q = 0,
        amp = 0.5;
      for (let k = 0; k < 6; k++) {
        const period = 8 * 2 ** k;
        q += tileNoise(u * period, v * period, period) * amp;
        amp *= 0.5;
      }
      const r = 100 + q * 110;
      stone[i] = r;
      stone[i + 1] = r;
      stone[i + 2] = r;
      stone[i + 3] = 255;
    }
  await sharp(cloud, { raw: { width: n, height: n, channels: 4 } })
    .png()
    .toFile("public/world/cloud-bank.png");
  await sharp(stone, { raw: { width: n, height: n, channels: 4 } })
    .png()
    .toFile("public/world/mineral.png");
})();
