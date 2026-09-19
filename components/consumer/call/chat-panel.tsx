"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/consumer/ui/Button";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import type { ChatMessage, ChatTransport } from "@/lib/consumer/features/chat";
import { cx } from "@/lib/consumer/cx";

export function ChatPanel({
  transport,
  emptyTitle = "No messages yet",
  emptyBody = "Messages stay on this device until the chat backend is connected.",
  dark = false,
}: {
  transport: ChatTransport | null;
  emptyTitle?: string;
  emptyBody?: string;
  dark?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!transport) {
      setMessages([]);
      return;
    }
    return transport.subscribe(setMessages);
  }, [transport]);

  if (!transport) {
    return (
      <EmptyState
        title={emptyTitle}
        body={emptyBody}
      />
    );
  }

  function send() {
    transport?.send(draft);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className={cx("text-body-sm", dark ? "text-white/60" : "text-muted")}>{emptyBody}</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cx("flex", message.fromSelf ? "justify-end" : "justify-start")}
            >
              <p
                className={cx(
                  "max-w-[85%] rounded-lg px-3 py-2 text-body-sm",
                  message.fromSelf
                    ? "bg-brand text-on-brand"
                    : dark
                      ? "bg-white/10 text-white"
                      : "bg-tint text-ink",
                )}
              >
                {message.body}
              </p>
            </div>
          ))
        )}
      </div>
      <form
        className={cx(
          "flex shrink-0 gap-2 border-t p-3",
          dark ? "border-white/10" : "border-border-subtle",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message"
          className={cx(
            "min-h-11 min-w-0 flex-1 rounded-pill px-4 text-body outline-none",
            dark
              ? "bg-white/10 text-white placeholder:text-white/40"
              : "border border-border-default bg-surface text-ink",
          )}
        />
        <Button type="submit" size="sm" leading={<Send className="size-4" />} disabled={!draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
