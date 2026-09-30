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

function payload(draft: Draft) {
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    body: draft.body.trim() || null,
    linkUrl: draft.linkUrl.trim() || null,
    videoUrl: draft.videoUrl.trim() || null,
    displayOrder: Number(draft.displayOrder),
    isActive: draft.isActive,
  };
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
  const [removeImage, setRemoveImage] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  const open = creating || editing !== null;

  function close() {
    setCreating(false);
    setEditing(null);
    setFile(null);
    setRemoveImage(false);
    setFieldError(null);
    setDraft(emptyDraft());
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
            row.original.videoUrl ? "Video" : null,
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
                setFieldError(null);
                setFile(null);
                setRemoveImage(false);
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
    if (draft.kind === "article" && draft.body.trim() === "") {
      setFieldError("Articles need a body patients can read.");
      return;
    }
    if (!/^\d+$/.test(draft.displayOrder.trim())) {
      setFieldError("Display order must be a whole number.");
      return;
    }

    setPending(true);
    setFieldError(null);
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

      toast.success(creating ? "Waiting room item created." : "Waiting room item updated.");
      close();
      router.refresh();
    } catch (cause) {
      const error = toApiError(cause);
      setFieldError(error.errors.body?.[0] ?? error.errors.title?.[0] ?? error.detail ?? null);
      const { title, description } = describeForToast(error);
      toast.error(title, description ? { description } : undefined);
    } finally {
      setPending(false);
    }
  }

  const filePreview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(
    () => () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    },
    [filePreview],
  );
  const preview = filePreview ?? (!removeImage ? (editing?.imageUrl ?? null) : null);

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
            setFieldError(null);
            setFile(null);
            setRemoveImage(false);
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
              Articles need a title and body. Ads can include an image, a video URL, and a link back
              to VersaLife.
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
                placeholder={
                  draft.kind === "article"
                    ? "What should the patient read while they wait?"
                    : "Optional short copy for the ad."
                }
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-image">Image</Label>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
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
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={removeImage}
                    onCheckedChange={(next) => setRemoveImage(next === true)}
                  />
                  Remove current image
                </label>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-video">Video URL</Label>
              <Input
                id="wr-video"
                value={draft.videoUrl}
                placeholder="https://…"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, videoUrl: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Optional. Patients can watch this from the waiting room (ads especially).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-link">Link URL</Label>
              <Input
                id="wr-link"
                value={draft.linkUrl}
                placeholder="https://versalifehealth.com"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, linkUrl: event.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wr-order">Display order</Label>
              <Input
                id="wr-order"
                value={draft.displayOrder}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayOrder: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">Lower numbers are listed first.</p>
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

            {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}

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
