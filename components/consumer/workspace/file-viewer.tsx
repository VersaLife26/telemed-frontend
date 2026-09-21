"use client";

import { useEffect, useState } from "react";

import { FilePreview, presignedUrl, previewObjectUrl } from "@/components/consumer/vault/file-preview";
import type { VaultDocument } from "@/lib/consumer/api/types";

export function FileViewerApp({ doc }: { doc: VaultDocument }) {
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
      onDownload={() => {
        void presignedUrl(doc.id, true).then((href) => {
          window.open(href, "_blank", "noopener,noreferrer");
        });
      }}
    />
  );
}
