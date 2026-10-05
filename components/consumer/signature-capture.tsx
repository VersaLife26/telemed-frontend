"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, RotateCcw, RotateCw, Undo2 } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Modal } from "@/components/consumer/ui/Modal";

const SOURCE_MAX_SIDE = 1600;
// The model runs in 256px tiles on the CPU when WebGPU is missing; 800px keeps
// that to a few seconds while staying sharp enough to print.
const MODEL_MAX_SIDE = 800;
const MIN_CROP = 0.05;
const HISTORY_LIMIT = 20;

let worker: Worker | null = null;
let nextJob = 0;

function extractor() {
  worker ??= new Worker("/signature-extractor/worker.js");
  return worker;
}

function extractAlpha(image: ImageData, onProgress: (value: number) => void): Promise<Uint8ClampedArray> {
  const w = extractor();
  const id = ++nextJob;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
    };
    const onError = () => {
      cleanup();
      worker?.terminate();
      worker = null;
      reject(new Error("Could not load the background remover."));
    };
    const onMessage = ({ data }: MessageEvent) => {
      if (data.id !== id) return;
      if (data.type === "progress") {
        onProgress(data.value);
        return;
      }
      cleanup();
      if (data.type === "done") resolve(data.alpha);
      else reject(new Error(data.message));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ id, src: image.data, W: image.width, H: image.height }, [image.data.buffer]);
  });
}

export function trimmedPng(canvas: HTMLCanvasElement, pad = 8): Promise<Blob | null> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return Promise.resolve(null);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")?.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png"));
}

async function loadSource(file: File): Promise<ImageBitmap> {
  const full = await createImageBitmap(file);
  const scale = SOURCE_MAX_SIDE / Math.max(full.width, full.height);
  if (scale >= 1) return full;
  const small = await createImageBitmap(full, {
    resizeWidth: Math.round(full.width * scale),
    resizeHeight: Math.round(full.height * scale),
    resizeQuality: "high",
  });
  full.close();
  return small;
}

type Step =
  | { kind: "crop"; source: ImageBitmap }
  | { kind: "processing"; progress: number }
  | { kind: "erase"; result: ImageData };

/**
 * Photo of a signature on paper → crop/rotate → on-device background removal
 * → eraser touch-up → transparent PNG handed to `onDone`.
 */
export function SignaturePhotoPicker({ onDone, busy }: { onDone: (png: Blob) => void; busy?: boolean }) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useRef(0);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    extractor();
    try {
      const bitmap = await loadSource(file);
      source?.close();
      setSource(bitmap);
      setStep({ kind: "crop", source: bitmap });
    } catch {
      setError("Could not read that image. Use a JPEG or PNG photo.");
    }
  }

  function close() {
    job.current++;
    setStep(null);
    setError(null);
    source?.close();
    setSource(null);
  }

  async function process(cropped: ImageData) {
    const current = ++job.current;
    setError(null);
    setStep({ kind: "processing", progress: 0 });
    const { width, height } = cropped;
    try {
      const alpha = await extractAlpha(cropped, (progress) => {
        if (job.current === current) setStep({ kind: "processing", progress });
      });
      if (job.current !== current) return;
      const result = new ImageData(width, height);
      for (let i = 0; i < alpha.length; i++) result.data[i * 4 + 3] = alpha[i]!;
      setStep({ kind: "erase", result });
    } catch (err) {
      if (job.current !== current) return;
      setError(err instanceof Error ? err.message : "Background removal failed.");
      if (source) setStep({ kind: "crop", source });
    }
  }

  const title =
    step?.kind === "crop" ? "Crop your signature" : step?.kind === "processing" ? "Cleaning up" : "Touch up";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          leading={<Camera className="size-4" />}
          busy={busy}
          onClick={() => cameraInput.current?.click()}
        >
          Take photo
        </Button>
        <Button
          size="sm"
          variant="outline"
          leading={<ImageUp className="size-4" />}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Choose image
        </Button>
      </div>
      <p className="text-body-sm text-faint">Sign on plain white paper and photograph it in good light.</p>
      {error && !step ? <Alert tone="danger">{error}</Alert> : null}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Modal open={step !== null} onClose={close} title={title}>
        {error && step ? (
          <div className="mb-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        {step?.kind === "crop" ? (
          <CropStep source={step.source} onCancel={close} onNext={(img) => void process(img)} />
        ) : step?.kind === "processing" ? (
          <div className="flex flex-col gap-3 py-6">
            <p className="text-body-sm text-muted">
              {step.progress === 0
                ? "Loading the background remover. The first run downloads it, so this can take a moment."
                : `Removing background… ${Math.round(step.progress * 100)}%`}
            </p>
            <div className="h-2 overflow-hidden rounded-pill bg-ink-50">
              <div
                className="h-full rounded-pill bg-brand transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(4, step.progress * 100)}%` }}
              />
            </div>
          </div>
        ) : step?.kind === "erase" ? (
          <EraseStep
            result={step.result}
            onBack={() => source && setStep({ kind: "crop", source })}
            onDone={(png) => {
              close();
              onDone(png);
            }}
          />
        ) : null}
        <p className="mt-4 text-[0.6875rem] text-faint">
          Processed on your device. Model:{" "}
          <a className="underline" href="https://openmodeldb.info/models/1x-Book-Compact" target="_blank" rel="noreferrer">
            1x Book Compact
          </a>{" "}
          by asterixcool, CC-BY-SA-4.0.
        </p>
      </Modal>
    </>
  );
}

type Crop = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "ne" | "sw" | "se";

const FULL_CROP: Crop = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function CropStep({
  source,
  onCancel,
  onNext,
}: {
  source: ImageBitmap;
  onCancel: () => void;
  onNext: (image: ImageData) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [quarter, setQuarter] = useState(0);
  const [fine, setFine] = useState(0);
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const drag = useRef<{ id: number; handle: Handle; x: number; y: number; crop: Crop; rect: DOMRect } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rad = ((quarter * 90 + fine) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    canvas.width = Math.round(source.width * cos + source.height * sin);
    canvas.height = Math.round(source.width * sin + source.height * cos);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
  }, [source, quarter, fine]);

  function turn(by: number) {
    setQuarter((q) => (q + by + 4) % 4);
    setCrop(FULL_CROP);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const handle = (e.target as HTMLElement).dataset.handle as Handle | undefined;
    if (!handle || drag.current || !frameRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      handle,
      x: e.clientX,
      y: e.clientY,
      crop,
      rect: frameRef.current.getBoundingClientRect(),
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = (e.clientX - d.x) / d.rect.width;
    const dy = (e.clientY - d.y) / d.rect.height;
    const c = d.crop;
    if (d.handle === "move") {
      setCrop({ ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) });
      return;
    }
    let l = c.x, t = c.y, r = c.x + c.w, b = c.y + c.h;
    if (d.handle.includes("w")) l = clamp(l + dx, 0, r - MIN_CROP);
    if (d.handle.includes("e")) r = clamp(r + dx, l + MIN_CROP, 1);
    if (d.handle.includes("n")) t = clamp(t + dy, 0, b - MIN_CROP);
    if (d.handle.includes("s")) b = clamp(b + dy, t + MIN_CROP, 1);
    setCrop({ x: l, y: t, w: r - l, h: b - t });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  function next() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sx = Math.round(crop.x * canvas.width);
    const sy = Math.round(crop.y * canvas.height);
    const sw = Math.max(1, Math.round(crop.w * canvas.width));
    const sh = Math.max(1, Math.round(crop.h * canvas.height));
    const scale = Math.min(1, MODEL_MAX_SIDE / Math.max(sw, sh));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    onNext(ctx.getImageData(0, 0, out.width, out.height));
  }

  const corner = "absolute size-6 rounded-full border-2 border-brand bg-white shadow-sm";

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={frameRef}
        className="relative mx-auto w-fit touch-none select-none overflow-hidden rounded-md"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="block max-h-[45dvh] max-w-full" />
        <div
          data-handle="move"
          className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
        >
          <span data-handle="nw" className={`${corner} -left-3 -top-3 cursor-nwse-resize`} />
          <span data-handle="ne" className={`${corner} -right-3 -top-3 cursor-nesw-resize`} />
          <span data-handle="sw" className={`${corner} -bottom-3 -left-3 cursor-nesw-resize`} />
          <span data-handle="se" className={`${corner} -bottom-3 -right-3 cursor-nwse-resize`} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" aria-label="Rotate left" onClick={() => turn(-1)}>
          <RotateCcw className="size-4" />
        </Button>
        <input
          type="range"
          min={-45}
          max={45}
          step={0.5}
          value={fine}
          aria-label="Straighten"
          onChange={(e) => setFine(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[var(--color-brand)]"
        />
        <Button size="sm" variant="ghost" aria-label="Rotate right" onClick={() => turn(1)}>
          <RotateCw className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={next}>
          Remove background
        </Button>
      </div>
    </div>
  );
}

function EraseStep({
  result,
  onBack,
  onDone,
}: {
  result: ImageData;
  onBack: () => void;
  onDone: (png: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const erasing = useRef<{ id: number; x: number; y: number } | null>(null);
  const [brush, setBrush] = useState(20);
  const [canUndo, setCanUndo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = result.width;
    canvas.height = result.height;
    canvas.getContext("2d")?.putImageData(result, 0, 0);
    history.current = [];
    setCanUndo(false);
  }, [result]);

  function toCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = e.currentTarget.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale, scale };
  }

  function erase(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, width: number) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (erasing.current || !ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    history.current.push(ctx.getImageData(0, 0, e.currentTarget.width, e.currentTarget.height));
    if (history.current.length > HISTORY_LIMIT) history.current.shift();
    setCanUndo(true);
    setEmpty(false);
    const p = toCanvas(e);
    erasing.current = { id: e.pointerId, x: p.x, y: p.y };
    erase(ctx, p, p, brush * p.scale);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const last = erasing.current;
    const ctx = e.currentTarget.getContext("2d");
    if (!last || last.id !== e.pointerId || !ctx) return;
    const p = toCanvas(e);
    erase(ctx, last, p, brush * p.scale);
    erasing.current = { id: e.pointerId, x: p.x, y: p.y };
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (erasing.current?.id === e.pointerId) erasing.current = null;
  }

  function undo() {
    const prev = history.current.pop();
    if (prev) canvasRef.current?.getContext("2d")?.putImageData(prev, 0, 0);
    setCanUndo(history.current.length > 0);
  }

  async function finish() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    const png = await trimmedPng(canvas);
    setSaving(false);
    if (!png) {
      setEmpty(true);
      return;
    }
    onDone(png);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-muted">Rub out any smudges or lines the cleanup missed.</p>
      <div className="mx-auto w-fit overflow-hidden rounded-md border border-border-subtle bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
        <canvas
          ref={canvasRef}
          aria-label="Signature preview. Drag to erase."
          className="block max-h-[45dvh] max-w-full cursor-crosshair touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-body-sm text-muted">Eraser</span>
        <input
          type="range"
          min={6}
          max={60}
          value={brush}
          aria-label="Eraser size"
          onChange={(e) => setBrush(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[var(--color-brand)]"
        />
        <Button size="sm" variant="ghost" leading={<Undo2 className="size-4" />} disabled={!canUndo} onClick={undo}>
          Undo
        </Button>
      </div>

      {empty ? <Alert tone="danger">Nothing left to save. Undo or start over.</Alert> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          Back to crop
        </Button>
        <Button size="sm" busy={saving} onClick={() => void finish()}>
          Use signature
        </Button>
      </div>
    </div>
  );
}
