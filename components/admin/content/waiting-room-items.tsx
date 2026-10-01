"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import { send } from "@/lib/admin/api/browser";
import { endpoints } from "@/lib/admin/api/endpoints";
import { describeForToast, toApiError } from "@/lib/admin/api/errors";
import type { WaitingRoomItem, WaitingRoomItemKind } from "@/lib/admin/api/types";

type Draft = {
  kind: WaitingRoomItemKind;
  title: string;
  body: string;
  linkUrl: string;
  videoUrl: string;
  displayOrder: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({
  kind: "article",
  title: "",
  body: "",
  linkUrl: "",
  videoUrl: "",
  displayOrder: "0",
  isActive: true,
});

function fromRow(row: WaitingRoomItem): Draft {
  return {
    kind: row.kind,
    title: row.title,
    body: row.body ?? "",
    linkUrl: row.linkUrl ?? "",
    videoUrl: row.videoUrl ?? "",
    displayOrder: String(row.displayOrder),
    isActive: row.isActive,
  };
}

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidHttpUrl(raw: string): boolean {
  const normalized = normalizeHttpUrl(raw);
  if (!normalized) return true;
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function payload(draft: Draft) {
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    body: draft.body.trim() || null,
    linkUrl: normalizeHttpUrl(draft.linkUrl),
    videoUrl: normalizeHttpUrl(draft.videoUrl),
    displayOrder: Number(draft.displayOrder),
    isActive: draft.isActive,
  };
}

type FieldKey = "title" | "body" | "linkUrl" | "videoUrl" | "displayOrder";

function firstFieldError(errors: Record<string, string[]>, ...keys: string[]): string | null {
  for (const key of keys) {
    const message = errors[key]?.[0];
    if (message) return message;
  }
  return null;
}

export function WaitingRoomItemsSection({
  rows,
  readOnly,
}: {
  rows: WaitingRoomItem[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<WaitingRoomItem | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [file, setFile] = React.useState<File | null>(null);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);
  const [removeVideo, setRemoveVideo] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = React.useState<Partial<Record<FieldKey, boolean>>>({});

  const open = creating || editing !== null;

  function close() {
    setCreating(false);
    setEditing(null);
    setFile(null);
    setVideoFile(null);
    setRemoveImage(false);
    setRemoveVideo(false);
    setFieldErrors({});
    setTouched({});
    setDraft(emptyDraft());
  }

  function localProblem(field: FieldKey): string | null {
    if (field === "body" && draft.kind === "article" && draft.body.trim() === "") {
      return "Articles need a body patients can read.";
    }
    if (field === "displayOrder" && !/^\d+$/.test(draft.displayOrder.trim())) {
      return "Display order must be a whole number.";
    }
    if (field === "linkUrl" && draft.linkUrl.trim() !== "" && !isValidHttpUrl(draft.linkUrl)) {
      return "Link must be an http or https URL.";
    }
    if (field === "videoUrl" && draft.videoUrl.trim() !== "" && !isValidHttpUrl(draft.videoUrl)) {
      return "Video must be an http or https URL.";
    }
    return null;
  }

  function problemFor(field: FieldKey): string | null {
    return fieldErrors[field] ?? (touched[field] ? localProblem(field) : null);
  }

  const columns = React.useMemo<ColumnDef<WaitingRoomItem, unknown>[]>(
    () => [
      {
        accessorKey: "kind",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant={row.original.kind === "ad" ? "muted" : "success"}>
            {row.original.kind === "ad" ? "Ad" : "Article"}
          </Badge>
        ),
      },
      { accessorKey: "title", header: "Title" },
      {
        id: "media",
        header: "Media",
        cell: ({ row }) => {
          const parts = [
            row.original.imageUrl ? "Image" : null,
            row.original.videoFileUrl || row.original.videoUrl ? "Video" : null,
            row.original.linkUrl ? "Link" : null,
          ].filter(Boolean);
          return parts.length > 0 ? parts.join(" · ") : "—";
        },
      },
      { accessorKey: "displayOrder", header: "Order" },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="muted">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={() => {
                setFieldErrors({});
                setTouched({});
                setFile(null);
                setVideoFile(null);
                setRemoveImage(false);
                setRemoveVideo(false);
                setEditing(row.original);
                setDraft(fromRow(row.original));
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [readOnly],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const markTouched: Partial<Record<FieldKey, boolean>> = {
      title: true,
      body: true,
      linkUrl: true,
      videoUrl: true,
      displayOrder: true,
    };
    setTouched(markTouched);

    const blocked = (["title", "body", "linkUrl", "videoUrl", "displayOrder"] as const).some(
      (field) => localProblem(field) !== null,
    );
    if (blocked) return;

    setPending(true);
    setFieldErrors({});
    try {
      const saved = creating
        ? await send<WaitingRoomItem>("POST", endpoints.content.waitingRoomItem(), payload(draft))
        : await send<WaitingRoomItem>(
            "PUT",
            endpoints.content.waitingRoomItem(editing!.id),
            payload(draft),
          );

      if (file) {
        const form = new FormData();
        form.append("file", file);
        await send<WaitingRoomItem>("PUT", endpoints.content.waitingRoomItemImage(saved.id), form);
      } else if (removeImage && editing?.imageUrl) {
        await send("DELETE", endpoints.content.waitingRoomItemImage(editing.id));
      }

      if (videoFile) {
        const form = new FormData();
        form.append("file", videoFile);
        await send<WaitingRoomItem>("PUT", endpoints.content.waitingRoomItemVideo(saved.id), form);
      } else if (removeVideo && editing?.videoFileUrl) {
        await send("DELETE", endpoints.content.waitingRoomItemVideo(editing.id));
      }

      toast.success(creating ? "Waiting room item created." : "Waiting room item updated.");
      close();
      router.refresh();
    } catch (cause) {
      const error = toApiError(cause);
      setFieldErrors({
        title: firstFieldError(error.errors, "title") ?? undefined,
        body: firstFieldError(error.errors, "body") ?? undefined,
        linkUrl: firstFieldError(error.errors, "linkUrl") ?? undefined,
        videoUrl: firstFieldError(error.errors, "videoUrl") ?? undefined,
        displayOrder: firstFieldError(error.errors, "displayOrder") ?? undefined,
      });
      const { title, description } = describeForToast(error);
      toast.error(title, description ? { description } : undefined);
    } finally {
      setPending(false);
    }
  }

  const filePreview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const videoPreview = React.useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
  React.useEffect(
    () => () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    },
    [filePreview],
  );
  React.useEffect(
    () => () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    },
    [videoPreview],
  );
  const preview = filePreview ?? (!removeImage ? (editing?.imageUrl ?? null) : null);
  const uploadedVideo = videoPreview ?? (!removeVideo ? (editing?.videoFileUrl ?? null) : null);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Waiting room</h2>
          <p className="text-sm text-muted-foreground">
            Articles and ads patients can read or watch while they wait to be admitted.
          </p>
        </div>
        <Button
          size="sm"
          disabled={readOnly}
          onClick={() => {
            setFieldErrors({});
            setTouched({});
            setFile(null);
            setVideoFile(null);
            setRemoveImage(false);
            setRemoveVideo(false);
            setDraft(emptyDraft());
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          New item
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption="Waiting room"
        emptyState={
          <EmptyState
            icon={FileText}
            title="No waiting room items yet"
            description="Create an article or an ad with the button above."
          />
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !pending) close();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "New waiting room item" : "Edit waiting room item"}</DialogTitle>
            <DialogDescription>
              Articles need a title and body. Ads can include an image, an uploaded video, a video
              URL, and a link.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="wr-kind">Type</Label>
              <Select
                value={draft.kind}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, kind: value as WaitingRoomItemKind }))
                }
              >
                <SelectTrigger id="wr-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="ad">Ad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-title">
                Title <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="wr-title"
                value={draft.title}
                required
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-body">Body{draft.kind === "article" ? " *" : ""}</Label>
              <Textarea
                id="wr-body"
                rows={6}
                value={draft.body}
                required={draft.kind === "article"}
                aria-invalid={problemFor("body") !== null}
                placeholder={
                  draft.kind === "article"
                    ? "What should the patient read while they wait?"
                    : "Optional short copy for the ad."
                }
                onBlur={() => setTouched((current) => ({ ...current, body: true }))}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
              {problemFor("body") ? (
                <p className="text-xs text-destructive">{problemFor("body")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-image">Image</Label>
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="h-32 w-full rounded-md object-cover"
                />
              ) : null}
              <Input
                id="wr-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setRemoveImage(false);
                }}
              />
              <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB.</p>
              {editing?.imageUrl && !file ? (
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="wr-remove-image"
                    checked={removeImage}
                    onCheckedChange={(next) => setRemoveImage(next === true)}
                  />
                  <Label htmlFor="wr-remove-image" className="font-normal">
                    Remove current image
                  </Label>
                </div>
              ) : null}
            </div>

            {draft.kind === "ad" ? (
              <div className="space-y-1.5">
                <Label htmlFor="wr-video-file">Ad video</Label>
                {uploadedVideo ? (
                  <video
                    className="h-32 w-full rounded-md bg-black object-contain"
                    src={uploadedVideo}
                    controls
                    aria-label="Ad video preview"
                  >
                    <track kind="captions" label="Captions not provided" />
                  </video>
                ) : null}
                <Input
                  id="wr-video-file"
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(event) => {
                    setVideoFile(event.target.files?.[0] ?? null);
                    setRemoveVideo(false);
                  }}
                />
                <p className="text-xs text-muted-foreground">MP4 or WebM, up to 25 MB. Plays in the waiting room.</p>
                {editing?.videoFileUrl && !videoFile ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="wr-remove-video"
                      checked={removeVideo}
                      onCheckedChange={(next) => setRemoveVideo(next === true)}
                    />
                    <Label htmlFor="wr-remove-video" className="font-normal">
                      Remove current video
                    </Label>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="wr-video">Video URL</Label>
              <Input
                id="wr-video"
                value={draft.videoUrl}
                placeholder="https://…"
                aria-invalid={problemFor("videoUrl") !== null}
                onBlur={() => setTouched((current) => ({ ...current, videoUrl: true }))}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, videoUrl: event.target.value }))
                }
              />
                  <p className="text-xs text-muted-foreground">
                    Optional YouTube or other link. Ads can also upload a video file above.
                  </p>
              {problemFor("videoUrl") ? (
                <p className="text-xs text-destructive">{problemFor("videoUrl")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-link">Link URL</Label>
              <Input
                id="wr-link"
                value={draft.linkUrl}
                placeholder="https://versalifehealth.com"
                aria-invalid={problemFor("linkUrl") !== null}
                onBlur={() => setTouched((current) => ({ ...current, linkUrl: true }))}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, linkUrl: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                You can paste a domain like <span className="font-mono">www.example.com</span>; https is added
                automatically.
              </p>
              {problemFor("linkUrl") ? (
                <p className="text-xs text-destructive">{problemFor("linkUrl")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-order">Display order</Label>
              <Input
                id="wr-order"
                value={draft.displayOrder}
                aria-invalid={problemFor("displayOrder") !== null}
                onBlur={() => setTouched((current) => ({ ...current, displayOrder: true }))}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayOrder: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">Lower numbers are listed first.</p>
              {problemFor("displayOrder") ? (
                <p className="text-xs text-destructive">{problemFor("displayOrder")}</p>
              ) : null}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="wr-active"
                checked={draft.isActive}
                onCheckedChange={(next) =>
                  setDraft((current) => ({ ...current, isActive: next === true }))
                }
              />
              <div>
                <Label htmlFor="wr-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive items stay in this console but are hidden from patients.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : creating ? "Create" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
