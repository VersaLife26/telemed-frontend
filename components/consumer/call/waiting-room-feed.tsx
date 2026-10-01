"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Megaphone, Newspaper } from "lucide-react";

import { Modal } from "@/components/consumer/ui/Modal";
import { browserApi } from "@/lib/consumer/api/client";
import type { WaitingRoomItem, WaitingRoomItemKind } from "@/lib/consumer/api/types";
import { apiFileSrc } from "@/lib/consumer/features/practice";
import { cx } from "@/lib/consumer/cx";

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

function HostedVideo({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <p className="rounded-lg bg-tint px-3 py-2 text-body-sm text-muted">
        This video could not be played here. Try &quot;Watch video&quot; below or open the link in your browser.
      </p>
    );
  }
  return (
    <video
      className="w-full rounded-xl"
      controls
      src={src}
      preload="metadata"
      aria-label={`Video: ${title}`}
      onError={() => setFailed(true)}
    >
      <track kind="captions" label="Captions not provided" />
    </video>
  );
}

type FeedFilter = "all" | WaitingRoomItemKind;

function kindLabel(kind: WaitingRoomItemKind): string {
  return kind === "ad" ? "Ad" : "Article";
}

function WaitingRoomItemDetail({ item }: { item: WaitingRoomItem }) {
  const hostedVideoSrc = item.videoFileUrl
    ? (apiFileSrc(item.videoFileUrl) ?? item.videoFileUrl)
    : item.videoUrl && isDirectVideo(item.videoUrl)
      ? item.videoUrl
      : null;

  return (
    <div className="space-y-4 text-ink">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={apiFileSrc(item.imageUrl) ?? item.imageUrl}
          alt=""
          className="max-h-56 w-full rounded-xl object-cover"
        />
      ) : null}
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted">
        {kindLabel(item.kind)}
      </p>
      {item.body ? <p className="whitespace-pre-wrap text-body text-ink">{item.body}</p> : null}
      {hostedVideoSrc ? <HostedVideo src={hostedVideoSrc} title={item.title} /> : null}
      {(item.linkUrl || (item.videoUrl && !isDirectVideo(item.videoUrl))) ? (
        <div className="flex flex-wrap gap-2">
          {item.videoUrl && !isDirectVideo(item.videoUrl) ? (
            <a
              href={item.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center justify-center rounded-pill bg-tint px-4 text-[0.8125rem] font-semibold text-ink transition-[scale] duration-[140ms] ease-out active:scale-[0.97] can-hover:hover:bg-blue-200"
            >
              Watch video
            </a>
          ) : null}
          {item.linkUrl ? (
            <a
              href={item.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center justify-center rounded-pill bg-[image:var(--gradient-cta)] px-4 text-[0.8125rem] font-semibold text-on-brand shadow-brand transition-[scale] duration-[140ms] ease-out active:scale-[0.97] can-hover:hover:brightness-[1.06]"
            >
              {item.kind === "ad" ? "Learn more" : "Read more"}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FeedTile({ item, onSelect }: { item: WaitingRoomItem; onSelect: () => void }) {
  const thumb = item.imageUrl ? (apiFileSrc(item.imageUrl) ?? item.imageUrl) : null;
  const Icon = item.kind === "ad" ? Megaphone : FileText;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="group flex h-full w-full flex-col overflow-hidden rounded-xl bg-white/10 text-left text-white ring-1 ring-white/15 transition-[background-color,ring-color,scale] duration-[140ms] ease-out active:scale-[0.98] can-hover:hover:bg-white/15 can-hover:hover:ring-white/30"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-800/80">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/35">
              <Icon className="size-8" aria-hidden="true" />
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
            {kindLabel(item.kind)}
          </span>
        </div>
        <div className="flex min-h-[3.25rem] flex-1 flex-col justify-center p-2.5">
          <p className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-white">{item.title}</p>
        </div>
      </button>
    </li>
  );
}

export function WaitingRoomFeed({ layout = "inline" }: { layout?: "inline" | "sidebar" }) {
  const sidebar = layout === "sidebar";
  const [items, setItems] = useState<WaitingRoomItem[] | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [selected, setSelected] = useState<WaitingRoomItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    void browserApi<WaitingRoomItem[]>("/waiting-room-content")
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "all") return items;
    return items.filter((item) => item.kind === filter);
  }, [filter, items]);

  const counts = useMemo(() => {
    if (!items) return { all: 0, article: 0, ad: 0 };
    return {
      all: items.length,
      article: items.filter((i) => i.kind === "article").length,
      ad: items.filter((i) => i.kind === "ad").length,
    };
  }, [items]);

  if (!items || items.length === 0) return null;

  const filters: { id: FeedFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "article", label: "Articles", count: counts.article },
    { id: "ad", label: "Ads", count: counts.ad },
  ];

  return (
    <>
      <section
        className={cx(
          "w-full min-w-0 text-left text-white",
          sidebar &&
            "flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/10 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:border-t-0",
          !sidebar && "max-w-sm",
        )}
        aria-label="While you wait"
      >
        <div className="mb-3 shrink-0 space-y-3">
          <p className="flex items-center gap-2 text-body-sm text-white/70">
            <Newspaper className="size-4" aria-hidden="true" />
            While you wait
          </p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter content">
            {filters.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={filter === entry.id}
                disabled={entry.count === 0}
                onClick={() => setFilter(entry.id)}
                className={cx(
                  "rounded-pill px-3 py-1.5 text-[0.8125rem] font-semibold transition-[background-color,color] duration-[140ms] ease-out disabled:cursor-not-allowed disabled:opacity-40",
                  filter === entry.id
                    ? "bg-white text-ink"
                    : "bg-white/10 text-white/80 can-hover:hover:bg-white/20",
                )}
              >
                {entry.label}
                {entry.count > 0 ? ` (${entry.count})` : ""}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-body-sm text-white/60">Nothing in this category right now.</p>
        ) : (
          <ul
            className={cx(
              "grid grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3",
              sidebar ? "min-h-0 flex-1" : "max-h-[40vh]",
            )}
          >
            {filtered.map((item) => (
              <FeedTile key={item.id} item={item} onSelect={() => setSelected(item)} />
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        description={selected ? kindLabel(selected.kind) : undefined}
      >
        {selected ? <WaitingRoomItemDetail item={selected} /> : null}
      </Modal>
    </>
  );
}
