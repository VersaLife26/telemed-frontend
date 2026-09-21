import assert from "node:assert/strict";
import test from "node:test";

import { createLiveChat, createMemoryChat } from "@/lib/consumer/features/chat";

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

test("live chat delivers the far side's messages into the same thread", () => {
  const sent: { id: string; body: string }[] = [];
  const chat = createLiveChat((msg) => sent.push(msg));
  let bodies: string[] = [];
  const fromSelf: boolean[] = [];
  chat.subscribe((messages) => {
    bodies = messages.map((m) => m.body);
    fromSelf.splice(0, fromSelf.length, ...messages.map((m) => m.fromSelf));
  });
  chat.send("from doctor");
  chat.receive({ id: sent[0]?.id ?? "x", body: "from doctor" });
  chat.receive({ id: "remote-1", body: "from patient" });
  assert.deepEqual(bodies, ["from doctor", "from patient"]);
  assert.deepEqual(fromSelf, [true, false]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.body, "from doctor");
});

test("server history merges without duplicating a client-sent line", () => {
  const chat = createLiveChat();
  let ids: string[] = [];
  chat.subscribe((messages) => {
    ids = messages.map((m) => m.id);
  });
  chat.send("hi");
  const localId = ids[0];
  chat.mergeFromServer(
    [
      {
        id: "server-uuid",
        content: "hi",
        sender_role: "doctor",
        created_at: "2026-09-21T04:00:00.000Z",
        metadata: { client_id: localId },
      },
      {
        id: "other",
        content: "hello",
        sender_role: "patient",
        created_at: "2026-09-21T04:00:01.000Z",
      },
    ],
    "doctor",
  );
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids.includes(localId!));
  assert.ok(ids.includes("other"));
});
