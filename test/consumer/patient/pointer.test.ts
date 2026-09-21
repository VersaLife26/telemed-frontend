import assert from "node:assert/strict";
import test from "node:test";

import { clamp01, parsePointer, pointerMatches } from "@/lib/consumer/features/pointer";

test("pointer coordinates stay inside the 0–1 frame", () => {
  assert.equal(clamp01(-0.2), 0);
  assert.equal(clamp01(1.4), 1);
  assert.equal(clamp01(Number.NaN), 0);
});

test("pointer frames from the far side are accepted only with numbers", () => {
  assert.equal(parsePointer(null), null);
  assert.equal(parsePointer({ x: "0.2", y: 0.3, active: true }), null);
  assert.deepEqual(parsePointer({ x: 0.2, y: 1.5, active: true, surface: "video" }), {
    x: 0.2,
    y: 1,
    active: true,
    surface: "video",
    fileId: undefined,
  });
  assert.deepEqual(parsePointer({ active: false, surface: "file", fileId: "doc-1" }), {
    x: 0,
    y: 0,
    active: false,
    surface: "file",
    fileId: "doc-1",
  });
});

test("a file laser only draws on the matching document", () => {
  const pointer = parsePointer({ x: 0.4, y: 0.5, active: true, surface: "file", fileId: "a" });
  assert.equal(pointerMatches(pointer, "file", "a"), true);
  assert.equal(pointerMatches(pointer, "file", "b"), false);
  assert.equal(pointerMatches(pointer, "video"), false);
});
