import { MOUNTAIN_LAYERS, MOUNTAIN_LAYERS_MOBILE } from "./mountains";
import { renderTerrainLayer } from "./terrain";
import type { TerrainRasterLayer } from "./terrain-cache";

// Terrain is prepared away from the animation thread, then transferred once.
// The finished bitmaps are composited by the existing camera choreography.
self.onmessage = (event: MessageEvent<{ width: number; height: number }>) => {
  const { width, height } = event.data;
  const layers = width < 768 ? MOUNTAIN_LAYERS_MOBILE : MOUNTAIN_LAYERS;
  const prepared: TerrainRasterLayer[] = [];
  try {
    for (const layer of layers) {
      const drawWidth = Math.ceil(width * 1.3);
      const drawHeight = Math.ceil(layer.band * height) + 2;
      const target = new OffscreenCanvas(1, 1);
      const baseColor = renderTerrainLayer(
        target,
        layer,
        Math.max(2, Math.round(drawWidth * 0.9)),
        Math.max(2, Math.round(drawHeight * 0.9)),
      );
      prepared.push({
        layer,
        image: target.transferToImageBitmap(),
        drawWidth,
        drawHeight,
        baseColor,
      });
    }
    self.postMessage({ layers: prepared }, { transfer: prepared.map((layer) => layer.image) });
  } catch (error) {
    for (const layer of prepared) (layer.image as ImageBitmap).close();
    self.postMessage({
      error: error instanceof Error ? error.message : "Terrain preparation failed",
    });
  }
};
