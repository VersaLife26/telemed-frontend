/* eslint-disable */
// Signature background removal. Model: 1x Book Compact by asterixcool
// (https://openmodeldb.info/models/1x-Book-Compact), CC-BY-SA-4.0.
importScripts("ort.webgpu.min.js");
ort.env.wasm.wasmPaths = new URL("./", self.location.href).href;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
const TILE = 256, PAD = 20;

const ready = (async () => {
  if (navigator.gpu && (await navigator.gpu.requestAdapter().catch(() => null))) {
    try {
      return await ort.InferenceSession.create("model.onnx", { executionProviders: ["webgpu"] });
    } catch (e) {
      console.warn("WebGPU failed, falling back to CPU", e);
    }
  }
  return ort.InferenceSession.create("model.onnx", { executionProviders: ["wasm"] });
})();

// Applies a 1D window op along rows (horizontal) or columns, clamping at edges.
function pass(a, W, H, r, horizontal, op) {
  const out = new Float32Array(a.length), len = horizontal ? W : H, lines = horizontal ? H : W;
  const step = horizontal ? 1 : W, lineStep = horizontal ? W : 1;
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    for (let i = 0; i < len; i++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const v = a[base + Math.min(len - 1, Math.max(0, i + k)) * step];
        acc = op === "max" ? Math.max(acc, v) : acc + v;
      }
      out[base + i * step] = op === "max" ? acc : acc / (2 * r + 1);
    }
  }
  return out;
}

// The model is trained on book scans and erases coloured ink as "bleed", so feed it
// grayscale with the paper flattened to white: divide by a background estimate
// (max filter removes ink, repeated box blur approximates a gaussian).
function flatten(src, W, H) {
  const g = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = (0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]) / 255;
  let bg = pass(pass(g, W, H, 7, true, "max"), W, H, 7, false, "max");
  for (let i = 0; i < 3; i++) bg = pass(pass(bg, W, H, 20, true, "avg"), W, H, 20, false, "avg");
  for (let i = 0; i < W * H; i++) g[i] = Math.min(1, g[i] / Math.max(bg[i], 1e-3));
  return g;
}

onmessage = async ({ data: { id, src, W, H } }) => {
  try {
    const session = await ready;
    const flat = flatten(src, W, H);
    const alpha = new Uint8ClampedArray(W * H);
    const tiles = Math.ceil(W / TILE) * Math.ceil(H / TILE);
    let done = 0;
    for (let ty = 0; ty < H; ty += TILE) {
      for (let tx = 0; tx < W; tx += TILE) {
        const x0 = Math.max(0, tx - PAD), y0 = Math.max(0, ty - PAD);
        const x1 = Math.min(W, tx + TILE + PAD), y1 = Math.min(H, ty + TILE + PAD);
        const w = x1 - x0, h = y1 - y0, n = w * h;
        const inp = new Float32Array(3 * n);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const s = (y0 + y) * W + x0 + x, d = y * w + x;
          inp[d] = inp[n + d] = inp[2 * n + d] = flat[s];
        }
        const { output } = await session.run({ input: new ort.Tensor("float32", inp, [1, 3, h, w]) });
        const o = output.data;
        for (let y = ty; y < Math.min(H, ty + TILE); y++) for (let x = tx; x < Math.min(W, tx + TILE); x++) {
          const d = (y - y0) * w + (x - x0);
          // Alpha ramps from opaque at luminance 0.5 to transparent at 0.92.
          const L = 0.299 * o[d] + 0.587 * o[n + d] + 0.114 * o[2 * n + d];
          alpha[y * W + x] = 255 * Math.min(1, Math.max(0, (0.92 - L) / 0.42));
        }
        postMessage({ id, type: "progress", value: ++done / tiles });
      }
    }
    postMessage({ id, type: "done", alpha }, [alpha.buffer]);
  } catch (e) {
    postMessage({ id, type: "error", message: e instanceof Error ? e.message : String(e) });
  }
};
