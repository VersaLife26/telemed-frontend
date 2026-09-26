"use client";

import { useEffect, useState } from "react";

import { FilePreview, presignedUrl, previewObjectUrl } from "@/components/consumer/vault/file-preview";
import type { VaultDocument } from "@/lib/consumer/api/types";
import type { CallPointerBind } from "@/lib/consumer/features/pointer";

export function FileViewerApp({ doc, pointer }: { doc: VaultDocument; pointer?: CallPointerBind | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    previewObjectUrl(doc.id)
      .then((next) => {
        objectUrl = next;
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id]);

  return (
    <FilePreview
      doc={doc}
      url={url}
      dark
      pointer={pointer}
      onDownload={() => {
        void presignedUrl(doc.id).then((href) => {
          window.open(href, "_blank", "noopener,noreferrer");
        });
      }}
    />
  );
}
