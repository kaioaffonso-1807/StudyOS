import assert from "node:assert/strict";
import test from "node:test";
import { calculateOverall, calculateCEFR, updateSkillScores } from "../src/progress-engine.js";

test("updates only the selected skill and clamps performance", () => {
  const scores = { speaking: 50, listening: 50, grammar: 50, vocabulary: 50, pronunciation: 50 } as const;
  const next = updateSkillScores(scores, "speaking", 120);
  assert.equal(next.speaking, 60);
  assert.equal(next.grammar, 50);
});

test("calculates overall score", () => {
  assert.equal(calculateOverall({ speaking: 40, listening: 50, grammar: 60, vocabulary: 70, pronunciation: 80 }), 60);
});

test("does not downgrade an existing CEFR level", () => {
  const scores = { speaking: 10, listening: 10, grammar: 10, vocabulary: 10, pronunciation: 10 };
  assert.equal(calculateCEFR("B1", scores), "B1");
});

test("promotes when the overall threshold is reached", () => {
  const scores = { speaking: 70, listening: 70, grammar: 70, vocabulary: 70, pronunciation: 70 };
  assert.equal(calculateCEFR("A2", scores), "B2");
});
