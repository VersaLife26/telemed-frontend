"use client";

import { Download, ExternalLink, FileQuestion, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/consumer/ui/Button";
import type { VaultDocument, VaultDownload } from "@/lib/consumer/api/types";
import { browserApi } from "@/lib/consumer/api/client";
import { formatBytes, previewKind, recordContentPath, recordDownloadPath } from "@/lib/consumer/features/vault";
import { cx } from "@/lib/consumer/cx";

export async function presignedUrl(id: string, attachment = false): Promise<string> {
  const link = await browserApi<VaultDownload>(recordDownloadPath(id, attachment));
  if (!link.download_url) throw new Error("No download URL");
  return link.download_url;
}

/**
 * Fetches the file through the same-origin BFF and returns a blob: URL.
 *
 * Presigned API URLs cannot be put in an <iframe>: the gateway sends
 * X-Frame-Options: DENY and frame-ancestors 'none', so the browser shows
 * "refused to connect" instead of the PDF.
 */
export async function previewObjectUrl(id: string): Promise<string> {
  const res = await fetch(`/api/proxy${recordContentPath(id)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not load the file preview.");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function FilePreview({
  doc,
  url,
  onDownload,
  className,
  dark = false,
}: {
  doc: VaultDocument;
  url: string | null;
  onDownload?: () => void;
  className?: string;
  dark?: boolean;
}) {
  const kind = previewKind(doc.content_type);
  const [zoom, setZoom] = useState(1);
  const ghost = dark
    ? "text-white/80 can-hover:hover:bg-white/10 can-hover:hover:text-white"
    : undefined;

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col", className)}>
      <div
        className={cx(
          "flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2",
          dark ? "border-white/10 text-white" : "border-border-subtle text-ink",
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-label">{doc.filename}</p>
          <p className={cx("text-caption", dark ? "text-white/60" : "text-muted")}>
            {[doc.content_type, formatBytes(doc.size_bytes)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {kind === "image" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={ghost}
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                leading={<ZoomOut className="size-4" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className={ghost}
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                leading={<ZoomIn className="size-4" />}
              />
            </>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className={ghost}
            onClick={onDownload}
            leading={<Download className="size-4" />}
          >
            Download
          </Button>
          {url ? (
            <Button
              variant="ghost"
              size="sm"
              className={ghost}
              leading={<ExternalLink className="size-4" />}
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              Open
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cx("min-h-0 flex-1 overflow-auto", dark ? "bg-black/40" : "bg-ink-50")}>
        {!url ? (
          <p className={cx("p-6 text-body", dark ? "text-white/70" : "text-muted")}>Loading preview…</p>
        ) : kind === "pdf" ? (
          <iframe title={doc.filename} src={url} className="h-full min-h-[24rem] w-full border-0" />
        ) : kind === "image" ? (
          <div className="flex h-full items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={doc.filename}
              className="max-h-full max-w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        ) : kind === "video" ? (
          <video src={url} controls className="mx-auto max-h-full w-full bg-black" />
        ) : kind === "audio" ? (
          <div className="flex h-full items-center justify-center p-8">
            <audio src={url} controls className="w-full max-w-lg" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <FileQuestion className={cx("size-10", dark ? "text-white/50" : "text-faint")} />
            <p className={cx("text-body", dark ? "text-white/80" : "text-muted")}>
              This file type cannot be previewed. Download it instead.
            </p>
            <Button onClick={onDownload} leading={<Download className="size-4" />}>
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
