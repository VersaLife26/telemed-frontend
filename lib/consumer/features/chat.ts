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

/**
 * In-memory stub. Echoes the sender's own messages locally so the panel can
 * be wired to a real backend later without changing the UI.
 */
export function createMemoryChat(): ChatTransport {
  let messages: ChatMessage[] = [];
  const listeners = new Set<(messages: ChatMessage[]) => void>();

  function emit() {
    for (const listener of listeners) listener(messages);
  }

  return {
    send(body: string) {
      const text = body.trim();
      if (!text) return;
      messages = [
        ...messages,
        {
          id: `${Date.now()}-${messages.length}`,
          body: text,
          at: Date.now(),
          fromSelf: true,
        },
      ];
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
