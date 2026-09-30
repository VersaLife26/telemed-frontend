"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";

import { browserApi } from "@/lib/consumer/api/client";
import type { WaitingRoomItem } from "@/lib/consumer/api/types";
import { apiFileSrc } from "@/lib/consumer/features/practice";

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

export function WaitingRoomFeed() {
  const [items, setItems] = useState<WaitingRoomItem[] | null>(null);

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

  if (!items || items.length === 0) return null;

  return (
    <section className="w-full max-w-sm text-left" aria-label="While you wait">
      <p className="mb-3 flex items-center gap-2 text-body-sm text-white/70">
        <Newspaper className="size-4" aria-hidden="true" />
        While you wait
      </p>
      <ul className="flex max-h-[40vh] flex-col gap-3 overflow-y-auto pr-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="overflow-hidden rounded-2xl bg-white/10 text-white ring-1 ring-white/15"
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={apiFileSrc(item.imageUrl) ?? item.imageUrl}
                alt=""
                className="h-36 w-full object-cover"
              />
            ) : null}
            <div className="space-y-2 p-4">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-white/55">
                {item.kind === "ad" ? "Ad" : "Article"}
              </p>
              <h2 className="text-h3">{item.title}</h2>
              {item.body ? <p className="text-body-sm text-white/75 whitespace-pre-wrap">{item.body}</p> : null}
              {item.videoUrl ? (
                isDirectVideo(item.videoUrl) ? (
                  <video className="w-full rounded-lg" controls src={item.videoUrl} preload="metadata" />
                ) : (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-body-sm text-white underline underline-offset-2"
                  >
                    Watch video
                  </a>
                )
              ) : null}
              {item.linkUrl ? (
                <a
                  href={item.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-body-sm text-white underline underline-offset-2"
                >
                  {item.kind === "ad" ? "Learn more" : "Read more"}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
