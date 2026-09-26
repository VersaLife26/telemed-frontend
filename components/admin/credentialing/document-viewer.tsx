"use client";

import * as React from "react";
import {
  ExternalLink,
  FileWarning,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { proxyUrl } from "@/lib/admin/api/browser";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiQuery } from "@/lib/admin/api/hooks";
import type { DoctorDocument, SignedUrl } from "@/lib/admin/api/types";
import { documentLabel } from "@/lib/admin/credentialing";
import { cn } from "@/lib/admin/utils";

/**
 * Side-by-side document viewer for a doctor's uploaded credentials.
 *
 * Design decisions that are not cosmetic:
 *
 *  - **Tabs, not a carousel.** A reviewer comparing the name on the NIC against
 *    the name on the SLMC certificate needs to get back to the previous
 *    document in one keystroke. Radix Tabs give arrow-key navigation for free.
 *  - **Zoom and rotate, because scans are phone photographs.** A NIC
 *    photographed sideways at 200px is unreadable without them, and an
 *    unreadable document is how "photo clear" gets ticked without being true.
 *  - **`sandbox` on the PDF frame.** These are files uploaded by someone
 *    applying for the right to consult patients. A malicious PDF must not be
 *    able to run script in the console's origin.
 *  - **Signed links are minted per tab, on demand.** Each view is recorded by
 *    the API as a document access, and the link is short-lived, so it is not
 *    fetched until the reviewer opens that document.
 *  - **No `next/image`.** Routing a NIC scan through the image optimiser would
 *    copy it into an on-disk cache that outlives the signed link.
 */
export function DocumentViewer({
  applicationId,
  documents,
}: {
  applicationId: string;
  documents: DoctorDocument[];
}) {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileWarning}
        title="No documents were uploaded"
        description="This registration has no credential documents attached. A doctor cannot be approved without an SLMC certificate and an identity document — reject it and ask them to re-submit."
      />
    );
  }

  const first = documents[0];
  if (!first) return null;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-lg border border-border bg-card",
        expanded && "fixed inset-4 z-50 shadow-2xl",
      )}
    >
      <Tabs
        defaultValue={first.id}
        className="flex min-h-0 flex-1 flex-col"
        onValueChange={() => {
          // Reset the transform when switching documents: carrying a 3x zoom
          // from a certificate onto a photograph is disorienting.
          setZoom(1);
          setRotation(0);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
          <TabsList>
            {documents.map((doc) => (
              <TabsTrigger key={doc.id} value={doc.id}>
                {documentLabel(doc.type)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              aria-label="Zoom out"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="size-4" aria-hidden="true" />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
              aria-label="Zoom in"
              disabled={zoom >= 4}
            >
              <ZoomIn className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              aria-label={`Rotate 90 degrees, currently ${rotation} degrees`}
            >
              <RotateCw className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Exit full screen" : "Expand to full screen"}
              aria-pressed={expanded}
            >
              {expanded ? (
                <Minimize2 className="size-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {documents.map((doc) => (
          <TabsContent key={doc.id} value={doc.id} className="mt-0 flex min-h-0 flex-1 flex-col">
            <DocumentPane applicationId={applicationId} doc={doc} zoom={zoom} rotation={rotation} expanded={expanded} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/**
 * The API signs links as a path on its own origin (`/api/v1/files/{token}`),
 * which the browser can only reach through this console's proxy. An absolute
 * link (a storage origin) is used as-is.
 */
function viewableUrl(url: string): string {
  return url.startsWith("/") ? proxyUrl(url) : url;
}

function DocumentPane({
  applicationId,
  doc,
  zoom,
  rotation,
  expanded,
}: {
  applicationId: string;
  doc: DoctorDocument;
  zoom: number;
  rotation: number;
  expanded: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const signed = useApiQuery<SignedUrl>(
    ["doctor-application-document", applicationId, doc.id],
    endpoints.credentialing.document(applicationId, doc.id),
    { staleTime: Infinity, gcTime: 0, retry: false },
  );

  const isPdf = doc.contentType.includes("pdf");
  const label = documentLabel(doc.type);

  if (signed.isPending) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Fetching a signed link…
      </div>
    );
  }

  if (signed.isError || failed) {
    const url = signed.data ? viewableUrl(signed.data.url) : null;
    return (
      <div className="p-6">
        <EmptyState
          icon={FileWarning}
          title={`${label} could not be displayed`}
          description={
            signed.isError
              ? signed.error.userMessage
              : "The link may have expired, or the browser refused to embed the file."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFailed(false);
                  void signed.refetch();
                }}
              >
                <RotateCw className="size-4" aria-hidden="true" />
                Get a fresh link
              </Button>
              {url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Open in a new tab
                  </a>
                </Button>
              ) : null}
            </div>
          }
        />
      </div>
    );
  }

  const url = viewableUrl(signed.data.url);

  return (
    <>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto bg-muted/40 p-4",
          expanded ? "" : "max-h-[32rem]",
        )}
      >
        {isPdf ? (
          <iframe
            src={url}
            title={label}
            // The uploader controls these bytes. Nothing in this frame may run
            // script, submit a form, or navigate the top-level page.
            sandbox=""
            referrerPolicy="no-referrer"
            className="h-[30rem] w-full rounded border border-border bg-background"
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            src={url}
            alt={`${label} submitted by this doctor`}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="mx-auto block max-w-none rounded border border-border bg-background"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "top center",
              transition: "transform 120ms ease-out",
            }}
          />
        )}
      </div>

      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {doc.fileName} · {doc.contentType}
      </p>
    </>
  );
}
