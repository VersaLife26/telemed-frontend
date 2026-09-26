import type { ConsultationMessage } from "@/lib/consumer/api/types";

export type ChatMessage = {
  id: string;
  body: string;
  at: number;
  fromSelf: boolean;
};

export type ChatTransport = {
  send(body: string): void;
  subscribe(listener: (messages: ChatMessage[]) => void): () => void;
};

export type LiveChat = ChatTransport & {
  merge(rows: ConsultationMessage[]): void;
  reset(): void;
};

/**
 * In-memory stub. Echoes the sender's own messages locally so the panel can
 * be wired without a live call (tests, empty workspace).
 */
export function createMemoryChat(): ChatTransport {
  return createLiveChat("");
}

/**
 * Shared in-call transcript. With `onSend`, a line only appears once the
 * server has stored it: the POST response and the hub's `chat` frame carry the
 * same message id, so they merge into one entry, and REST history merges the
 * same way.
 */
export function createLiveChat(selfRole: string, onSend?: (body: string) => void): LiveChat {
  let messages: ChatMessage[] = [];
  const listeners = new Set<(messages: ChatMessage[]) => void>();

  function emit() {
    for (const listener of listeners) listener(messages);
  }

  function upsert(next: ChatMessage) {
    if (messages.some((m) => m.id === next.id)) return;
    messages = [...messages, next].sort((a, b) => a.at - b.at);
    emit();
  }

  return {
    send(body: string) {
      const text = body.trim();
      if (!text) return;
      if (onSend) {
        onSend(text);
        return;
      }
      upsert({ id: `${Date.now()}-${messages.length}`, body: text, at: Date.now(), fromSelf: true });
    },
    merge(rows) {
      for (const row of rows) {
        const body = row.body.trim();
        if (!body) continue;
        upsert({
          id: row.id,
          body,
          at: Date.parse(row.createdAt) || Date.now(),
          fromSelf: row.senderRole === selfRole,
        });
      }
    },
    reset() {
      messages = [];
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(messages);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function consultationMessagesPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/consultation/messages`;
}
