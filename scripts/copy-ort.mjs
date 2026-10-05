// Copies the onnxruntime-web runtime next to the signature model in public/.
// The extractor worker is a plain script under public/ rather than a bundled
// chunk because /_next/static carries a CSP without 'wasm-unsafe-eval'. The
// files are too large to commit, so they come from node_modules on every build.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "onnxruntime-web", "dist");
const dst = join(root, "public", "signature-extractor");

mkdirSync(dst, { recursive: true });
for (const file of ["ort.webgpu.min.js", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) {
  copyFileSync(join(src, file), join(dst, file));
}
