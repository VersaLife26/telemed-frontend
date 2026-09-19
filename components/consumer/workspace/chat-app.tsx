"use client";

import { ChatPanel } from "@/components/consumer/call/chat-panel";
import type { ChatTransport } from "@/lib/consumer/features/chat";

export function ChatApp({ transport }: { transport: ChatTransport | null }) {
  return (
    <div className="flex h-full min-h-0 flex-col text-white">
      <ChatPanel
        transport={transport}
        emptyTitle="No call in progress"
        emptyBody="Chat opens with the current consultation. Join a visit from Meet first."
        dark
      />
    </div>
  );
}
