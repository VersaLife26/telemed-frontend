import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryChat } from "@/lib/consumer/features/chat";

test("the chat stub echoes the sender locally", () => {
  const chat = createMemoryChat();
  let seen: string[] = [];
  const stop = chat.subscribe((messages) => {
    seen = messages.map((m) => m.body);
  });
  chat.send("hello");
  chat.send("  ");
  assert.deepEqual(seen, ["hello"]);
  stop();
  chat.send("later");
  assert.deepEqual(seen, ["hello"]);
});
