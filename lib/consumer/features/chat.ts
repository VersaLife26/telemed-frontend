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
  receive(msg: { id: string; body: string }): void;
  mergeFromServer(rows: ServerChatMessage[], selfRole: string): void;
  reset(): void;
};

export type ServerChatMessage = {
  id: string;
  content: string;
  sender_role?: string;
  created_at?: string;
  metadata?: { client_id?: string } | string | null;
};

/**
 * In-memory stub. Echoes the sender's own messages locally so the panel can
 * be wired without a live call (tests, empty workspace).
 */
export function createMemoryChat(): ChatTransport {
  return createLiveChat();
}

/**
 * Shared in-call transcript. Local send, signalling receive, and REST history
 * all merge on id so doctor and patient see the same thread.
 */
export function createLiveChat(onSend?: (msg: { id: string; body: string }) => void): LiveChat {
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
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${messages.length}`;
      upsert({ id, body: text, at: Date.now(), fromSelf: true });
      onSend?.({ id, body: text });
    },
    receive(msg) {
      const body = msg.body.trim();
      if (!body) return;
      upsert({
        id: msg.id || `${Date.now()}-${messages.length}`,
        body,
        at: Date.now(),
        fromSelf: false,
      });
    },
    mergeFromServer(rows, selfRole) {
      for (const row of rows) {
        const body = (row.content ?? "").trim();
        if (!body) continue;
        upsert({
          id: clientIdOf(row),
          body,
          at: row.created_at ? Date.parse(row.created_at) || Date.now() : Date.now(),
          fromSelf: (row.sender_role || "") === selfRole,
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

function clientIdOf(row: ServerChatMessage): string {
  const raw = row.metadata;
  if (raw && typeof raw === "object" && raw.client_id) return raw.client_id;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as { client_id?: string };
      if (parsed.client_id) return parsed.client_id;
    } catch {
      /* ignore */
    }
  }
  return row.id;
}

export function consultationMessagesPath(consultationId: string): string {
  return `/consultations/${consultationId}/messages`;
}
