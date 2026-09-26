"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Upload } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { browserApi } from "@/lib/consumer/api/client";
import { cx } from "@/lib/consumer/cx";
import { loadStampSrc, stampPath, type StampKind } from "@/lib/consumer/features/prescription";

const MAX_BYTES = 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg"]);

type Kind = StampKind;

function credentialFileError(file: File): string | null {
  if (!ALLOWED.has(file.type)) return "Use a PNG or JPEG image.";
  if (file.size > MAX_BYTES) return "Image must be 1 MB or smaller.";
  return null;
}

export function useStampImage(kind: Kind, version: number) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    loadStampSrc(kind)
      .catch(() => null)
      .then((next) => {
        if (!cancelled) setSrc(next);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, version]);
  return src;
}

export function SignatureCard() {
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<SignaturePadHandle | null>(null);
  const signatureInput = useRef<HTMLInputElement>(null);
  const sealInput = useRef<HTMLInputElement>(null);
  const signatureSrc = useStampImage("signature", version);
  const sealSrc = useStampImage("seal", version);

  async function upload(kind: Kind, blob: Blob, filename: string) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", blob, filename);
      await browserApi(stampPath(kind), { method: "PUT", body: form });
      setVersion((v) => v + 1);
      setNotice(kind === "signature" ? "Signature saved." : "Seal saved.");
      if (kind === "signature") {
        padRef.current?.clear();
        setHasInk(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save image");
    } finally {
      setBusy(null);
    }
  }

  function onFile(kind: Kind, file: File | undefined) {
    if (!file) return;
    const invalid = credentialFileError(file);
    if (invalid) {
      setError(invalid);
      setNotice(null);
      return;
    }
    void upload(kind, file, file.name);
  }

  async function saveDrawn() {
    const blob = await padRef.current?.toTrimmedPng();
    if (!blob) {
      setError("Draw your signature first.");
      return;
    }
    await upload("signature", blob, "signature.png");
  }

  return (
    <div id="signature" className="scroll-mt-24">
      <Card className="flex flex-col gap-5">
        <div>
          <h2 className="text-h4 text-ink">Signature &amp; seal</h2>
          <p className="mt-1 text-body-sm text-muted">
            Printed on every prescription you issue. Both are required.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-label text-ink">Signature</p>
              <div role="tablist" aria-label="Signature input" className="flex rounded-md bg-ink-50 p-0.5">
                {(["draw", "upload"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cx(
                      "min-h-8 rounded-[calc(var(--radius-md)-4px)] px-3 text-body-sm font-semibold capitalize",
                      "transition-[background-color,color,transform] duration-[160ms] ease-out active:scale-[0.97]",
                      mode === m ? "bg-surface text-ink shadow-sm" : "text-muted",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {mode === "draw" ? (
              <>
                <SignaturePad handleRef={padRef} onInk={setHasInk} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" busy={busy === "signature"} disabled={!hasInk} onClick={() => void saveDrawn()}>
                    Save signature
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    leading={<Eraser className="size-4" />}
                    disabled={!hasInk}
                    onClick={() => {
                      padRef.current?.clear();
                      setHasInk(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                leading={<Upload className="size-4" />}
                busy={busy === "signature"}
                onClick={() => signatureInput.current?.click()}
              >
                Upload signature image
              </Button>
            )}
            <input
              ref={signatureInput}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                onFile("signature", e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <StoredPreview label="Current signature" src={signatureSrc} />
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-label text-ink">Seal / stamp</p>
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              leading={<Upload className="size-4" />}
              busy={busy === "seal"}
              onClick={() => sealInput.current?.click()}
            >
              {sealSrc ? "Replace seal image" : "Upload seal image"}
            </Button>
            <input
              ref={sealInput}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                onFile("seal", e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="text-body-sm text-faint">PNG with a transparent background prints best. Max 1 MB.</p>
            <StoredPreview label="Current seal" src={sealSrc} />
          </section>
        </div>

        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </Card>
    </div>
  );
}

function StoredPreview({ label, src }: { label: string; src: string | null | undefined }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-body-sm text-muted">{label}</figcaption>
      <div className="flex h-24 items-center justify-center rounded-md border border-border-subtle bg-surface p-2">
        {src === undefined ? (
          <span className="h-10 w-3/4 animate-pulse rounded bg-ink-50" />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-body-sm text-faint">Not added yet</span>
        )}
      </div>
    </figure>
  );
}

type SignaturePadHandle = {
  clear: () => void;
  toTrimmedPng: () => Promise<Blob | null>;
};

type Point = { x: number; y: number };

function SignaturePad({
  handleRef,
  onInk,
}: {
  handleRef: React.RefObject<SignaturePadHandle | null>;
  onInk: (hasInk: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<Point[]>([]);
  const drawing = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#0b2545";
      onInk(false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [onInk]);

  useEffect(() => {
    handleRef.current = {
      clear() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
      toTrimmedPng() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return Promise.resolve(null);
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
        const pad = 8;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(width - 1, maxX + pad);
        maxY = Math.min(height - 1, maxY + pad);
        const out = document.createElement("canvas");
        out.width = maxX - minX + 1;
        out.height = maxY - minY + 1;
        out.getContext("2d")?.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
        return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png"));
      },
    };
  }, [handleRef]);

  function point(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = e.pointerId;
    const p = point(e);
    stroke.current = [p];
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    onInk(true);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current !== e.pointerId) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const rect = e.currentTarget.getBoundingClientRect();
    for (const ev of events) {
      const pts = stroke.current;
      const p = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      pts.push(p);
      if (pts.length < 3) continue;
      // Quadratic segments through midpoints keep strokes smooth without lagging the pen.
      const a = pts[pts.length - 3]!;
      const b = pts[pts.length - 2]!;
      const c = pts[pts.length - 1]!;
      ctx.beginPath();
      ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      ctx.stroke();
    }
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current !== e.pointerId) return;
    drawing.current = null;
    stroke.current = [];
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        aria-label="Signature pad. Draw your signature with a mouse, finger or stylus."
        className="block h-40 w-full cursor-crosshair touch-none rounded-md border border-border-default bg-surface"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-border-default"
      />
    </div>
  );
}
