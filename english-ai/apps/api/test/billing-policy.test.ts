import test from "node:test";
import assert from "node:assert/strict";
import { usageLimits } from "../src/billing.js";

test("free plan has conservative daily AI and voice limits", () => {
  const limits = usageLimits("free");
  assert.equal(limits.ai_turn, 10);
  assert.equal(limits.voice_turn, 3);
  assert.equal(limits.realtime_call, 5);
});

test("pro plan has higher configurable daily limits", () => {
  const limits = usageLimits("pro");
  assert.equal(limits.ai_turn, 100);
  assert.equal(limits.voice_turn, 30);
  assert.equal(limits.realtime_call, 30);
});
