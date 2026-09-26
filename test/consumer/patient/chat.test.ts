import assert from "node:assert/strict";
import test from "node:test";

import type { ConsultationMessage } from "@/lib/consumer/api/types";
import { consultationMessagesPath, createLiveChat, createMemoryChat } from "@/lib/consumer/features/chat";

function message(id: string, body: string, senderRole: "patient" | "doctor", createdAt: string): ConsultationMessage {
  return { id, consultationId: "c-1", senderUserId: `${senderRole}-user`, senderRole, body, createdAt };
}

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

test("live chat hands the trimmed body to the sender and shows nothing until the server stores it", () => {
  const sent: string[] = [];
  const chat = createLiveChat("doctor", (body) => sent.push(body));
  let bodies: string[] = [];
  chat.subscribe((messages) => {
    bodies = messages.map((m) => m.body);
  });
  chat.send("  from doctor  ");
  chat.send("   ");
  assert.deepEqual(sent, ["from doctor"]);
  assert.deepEqual(bodies, []);
});

test("the POST response, the hub frame and history merge on the server id", () => {
  const chat = createLiveChat("doctor");
  let ids: string[] = [];
  let fromSelf: boolean[] = [];
  chat.subscribe((messages) => {
    ids = messages.map((m) => m.id);
    fromSelf = messages.map((m) => m.fromSelf);
  });
  const mine = message("m-1", "hi", "doctor", "2026-09-21T04:00:00.000Z");
  chat.merge([mine]);
  chat.merge([mine]);
  chat.merge([mine, message("m-2", "hello", "patient", "2026-09-21T04:00:01.000Z")]);
  assert.deepEqual(ids, ["m-1", "m-2"]);
  assert.deepEqual(fromSelf, [true, false]);
});

test("messages are ordered by creation time", () => {
  const chat = createLiveChat("patient");
  let bodies: string[] = [];
  chat.subscribe((messages) => {
    bodies = messages.map((m) => m.body);
  });
  chat.merge([message("b", "second", "doctor", "2026-09-21T04:00:02.000Z")]);
  chat.merge([message("a", "first", "patient", "2026-09-21T04:00:01.000Z")]);
  assert.deepEqual(bodies, ["first", "second"]);
});

test("messages are keyed by appointment id", () => {
  assert.equal(consultationMessagesPath("appt-1"), "/appointments/appt-1/consultation/messages");
});
