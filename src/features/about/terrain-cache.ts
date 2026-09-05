import { MOUNTAIN_LAYERS, MOUNTAIN_LAYERS_MOBILE, type MountainLayer } from "./mountains";
import { renderTerrainLayer } from "./terrain";

export type TerrainRasterLayer = {
  layer: MountainLayer;
  image: ImageBitmap | HTMLCanvasElement;
  drawWidth: number;
  drawHeight: number;
  baseColor: string;
};

export type PreparedTerrain = {
  width: number;
  height: number;
  layers: TerrainRasterLayer[];
  /** Release the scene's lease; the latest size remains cached for return visits. */
  release: () => void;
};

type Entry = {
  width: number;
  height: number;
  retained: boolean;
  users: number;
  layers?: TerrainRasterLayer[];
  ready: Promise<TerrainRasterLayer[]>;
};

// One cached viewport per breakpoint, plus any old bitmap still being drawn.
// Resize jobs run serially; obsolete queued sizes are discarded before baking.
const latest = new Map<boolean, Entry>();
let queue: Promise<unknown> = Promise.resolve();
let worker: Worker | null = null;
let workerUnavailable = false;

function disposeUnused(entry: Entry) {
  if (entry.retained || entry.users || !entry.layers) return;
  for (const { image } of entry.layers) {
    if ("close" in image) image.close();
    else image.width = image.height = 0;
  }
  entry.layers = undefined;
}

function abortError() {
  return new DOMException("Terrain preparation is no longer needed", "AbortError");
}

async function bakeWithYield(width: number, height: number): Promise<TerrainRasterLayer[]> {
  const layers = width < 768 ? MOUNTAIN_LAYERS_MOBILE : MOUNTAIN_LAYERS;
  const result: TerrainRasterLayer[] = [];
  for (const layer of layers) {
    // Unsupported browsers still return to the event loop between relief bands.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const image = document.createElement("canvas");
    const drawWidth = Math.ceil(width * 1.3);
    const drawHeight = Math.ceil(layer.band * height) + 2;
    const baseColor = renderTerrainLayer(
      image,
      layer,
      Math.max(2, Math.round(drawWidth * 0.9)),
      Math.max(2, Math.round(drawHeight * 0.9)),
    );
    result.push({ layer, image, drawWidth, drawHeight, baseColor });
  }
  return result;
}

async function bake(width: number, height: number): Promise<TerrainRasterLayer[]> {
  if (
    !workerUnavailable &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  ) {
    try {
      worker ??= new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
      const activeWorker = worker;
      return await new Promise<TerrainRasterLayer[]>((resolve, reject) => {
        const removeListeners = () => {
          activeWorker.removeEventListener("message", onMessage);
          activeWorker.removeEventListener("error", onError);
          activeWorker.removeEventListener("messageerror", onError);
        };
        const onMessage = (
          event: MessageEvent<{ layers?: TerrainRasterLayer[]; error?: string }>,
        ) => {
          removeListeners();
          if (event.data.layers) resolve(event.data.layers);
          else reject(new Error(event.data.error || "Terrain worker returned no artwork"));
        };
        const onError = () => {
          removeListeners();
          reject(new Error("Terrain worker could not be loaded"));
        };
        activeWorker.addEventListener("message", onMessage);
        activeWorker.addEventListener("error", onError);
        activeWorker.addEventListener("messageerror", onError);
        activeWorker.postMessage({ width, height });
      });
    } catch {
      worker?.terminate();
      worker = null;
      workerUnavailable = true;
    }
  }
  return bakeWithYield(width, height);
}

/** Prepare once, without blocking navigation or the cloud animation clock. */
export function prepareTerrain(
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<PreparedTerrain> {
  if (signal?.aborted) return Promise.reject(abortError());
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const mobile = width < 768;
  let entry = latest.get(mobile);
  if (!entry || entry.width !== width || entry.height !== height) {
    if (entry) {
      entry.retained = false;
      disposeUnused(entry);
    }
    const next: Entry = { width, height, retained: true, users: 0, ready: Promise.resolve([]) };
    next.ready = queue.then(async () => {
      if (!next.retained && next.users === 0) throw abortError();
      const layers = await bake(width, height);
      next.layers = layers;
      disposeUnused(next);
      return layers;
    });
    // Rejection is contained so one obsolete request never blocks later sizes.
    queue = next.ready.catch(() => {
      if (latest.get(mobile) === next) latest.delete(mobile);
      next.retained = false;
      disposeUnused(next);
    });
    entry = next;
    latest.set(mobile, next);
  }
  const selected = entry;
  selected.users++;
  return new Promise<PreparedTerrain>((resolve, reject) => {
    let pending = true;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      selected.users--;
      disposeUnused(selected);
    };
    const onAbort = () => {
      if (!pending) return;
      pending = false;
      release();
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    selected.ready.then(
      (layers) => {
        if (!pending) return;
        pending = false;
        signal?.removeEventListener("abort", onAbort);
        resolve({ width, height, layers, release });
      },
      (error: unknown) => {
        if (!pending) return;
        pending = false;
        signal?.removeEventListener("abort", onAbort);
        release();
        reject(error);
      },
    );
  });
}

/** Call after the Home environment is ready so arrival only composites bitmaps. */
export function prewarmTerrain(width = window.innerWidth, height = window.innerHeight): void {
  void prepareTerrain(width, height).then(
    (terrain) => terrain.release(),
    () => undefined,
  );
}
