/**
 * Living mist between the baked mountain bands. One small procedural mask is
 * cached; two independent, continuously sheared passes change its silhouette
 * and internal overlaps. No pixel reads, texture uploads or blur per frame.
 */

const MASK_WIDTH = 512;
const MASK_HEIGHT = 128;
const STRIPS = 8;
const TAU = Math.PI * 2;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (a: number, b: number, value: number) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0xa9f13;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const sx = smooth(0, 1, x - ix);
  const sy = smooth(0, 1, y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function cloudNoise(x: number, y: number): number {
  return (
    noise(x, y) * 0.57 +
    noise(x * 2.07 + 12.3, y * 2.07 + 7.1) * 0.26 +
    noise(x * 4.17 + 3.7, y * 4.17 + 19.4) * 0.12 +
    noise(x * 8.31 + 8.2, y * 8.31 + 2.9) * 0.05
  );
}

export type ValleyMistPainter = {
  /**
   * Draw after a distant ridge and before its nearer neighbor. Coordinates
   * use the caller's current canvas space. `depth` is 0 distant → 1 near;
   * `seconds` must be a continuous clock. Caller chooses the bank's centerY
   * so its own camera/scroll projection controls the mist's location.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    centerY: number,
    depth: number,
    seconds: number,
    alpha?: number,
  ): void;
  dispose(): void;
};

/** Create once inside the scene's browser lifecycle; dispose on unmount. */
export function createValleyMist(): ValleyMistPainter {
  const mask = document.createElement("canvas");
  mask.width = MASK_WIDTH;
  mask.height = MASK_HEIGHT;
  const maskContext = mask.getContext("2d")!;
  const pixels = maskContext.createImageData(MASK_WIDTH, MASK_HEIGHT);

  for (let y = 0; y < MASK_HEIGHT; y++) {
    const v = y / (MASK_HEIGHT - 1);
    for (let x = 0; x < MASK_WIDTH; x++) {
      const u = x / (MASK_WIDTH - 1);
      const warp = (noise(u * 4.2, v * 2.1) - 0.5) * 0.65;
      const density = cloudNoise(u * 7.1 + warp, v * 3.7 + warp * 0.36);
      const center = 0.48 + (noise(u * 5.3, 4.1) - 0.5) * 0.18;
      const body = Math.exp(-Math.pow((v - center) / 0.29, 2) * 1.5);
      const edge =
        smooth(0, 0.1, u) * (1 - smooth(0.9, 1, u)) * smooth(0, 0.14, v) * (1 - smooth(0.86, 1, v));
      const a = smooth(0.2, 0.66, density) * body * edge;
      const offset = (y * MASK_WIDTH + x) * 4;
      pixels.data[offset] = 202;
      pixels.data[offset + 1] = 202;
      pixels.data[offset + 2] = 202;
      pixels.data[offset + 3] = Math.round(a * 255);
    }
  }
  maskContext.putImageData(pixels, 0, 0);
  let disposed = false;

  return {
    draw(ctx, width, height, centerY, depth, seconds, alpha) {
      if (disposed || width <= 0 || height <= 0) return;
      const d = clamp01(depth);
      const opacity = clamp01(alpha ?? 0.23 - d * 0.115);
      if (opacity < 0.001) return;
      const inheritedAlpha = ctx.globalAlpha;
      const bandHeight = height * (0.145 - d * 0.028);
      const stripWidth = width / STRIPS;
      ctx.save();
      ctx.imageSmoothingEnabled = true;

      for (let pass = 0; pass < 2; pass++) {
        const tileWidth = width * (pass === 0 ? 1.24 : 1.71);
        const sourceScale = MASK_WIDTH / tileWidth;
        const rate = (1.4 + d * 2.4) * (pass === 0 ? 1 : 0.63);
        const phase = seconds * rate + d * 113.0 + pass * 237.0;
        const drift = ((phase % MASK_WIDTH) + MASK_WIDTH) % MASK_WIDTH;
        const passHeight = bandHeight * (pass === 0 ? 1 : 0.76);
        const passY = centerY + (pass === 0 ? -0.04 : 0.11) * bandHeight;
        const pulse = 0.94 + 0.06 * Math.sin(seconds * 0.12 + d * 4.7 + pass * 2.9);
        ctx.globalAlpha = inheritedAlpha * opacity * (pass === 0 ? 0.67 : 0.43) * pulse;

        const lift = (x: number) => {
          const u = x / width;
          return (
            Math.sin(u * TAU * 1.37 + seconds * 0.17 + d * 4.2 + pass * 2.1) * passHeight * 0.13 +
            Math.sin(u * TAU * 3.1 - seconds * 0.11 + d * 7.4 + pass) * passHeight * 0.045
          );
        };

        for (let strip = 0; strip < STRIPS; strip++) {
          const left = strip * stripWidth;
          const y0 = lift(left);
          const slope = (lift(left + stripWidth) - y0) / stripWidth;
          const sourceX = (drift + left * sourceScale) % MASK_WIDTH;
          const sourceWidth = stripWidth * sourceScale;
          const firstWidth = Math.min(sourceWidth, MASK_WIDTH - sourceX);
          const firstDestination = firstWidth / sourceScale;

          // Each strip is a parallelogram. Adjacent edges meet exactly, so
          // the continuously changing outline has neither steps nor gaps.
          ctx.save();
          ctx.transform(1, slope, 0, 1, left, passY + y0);
          ctx.drawImage(
            mask,
            sourceX,
            0,
            firstWidth,
            MASK_HEIGHT,
            0,
            -passHeight / 2,
            firstDestination,
            passHeight,
          );
          if (firstWidth < sourceWidth) {
            ctx.drawImage(
              mask,
              0,
              0,
              sourceWidth - firstWidth,
              MASK_HEIGHT,
              firstDestination,
              -passHeight / 2,
              stripWidth - firstDestination,
              passHeight,
            );
          }
          ctx.restore();
        }
      }
      ctx.restore();
    },
    dispose() {
      disposed = true;
      mask.width = 1;
      mask.height = 1;
    },
  };
}
