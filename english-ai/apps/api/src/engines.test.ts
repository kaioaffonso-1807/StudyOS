import assert from "node:assert/strict";
import test from "node:test";
import { buildAdaptiveLesson } from "./adaptive-engine.js";
import { nextReview } from "./review-engine.js";
import { calculateCEFR, calculateOverall, updateSkillScores } from "./progress-engine.js";

test("adaptive lesson prioritizes the oldest due review", () => {
  const lesson = buildAdaptiveLesson({
    level: "B1",
    dailyMinutes: 20,
    scores: { speaking: 50, listening: 50, grammar: 50, vocabulary: 50, pronunciation: 50 },
    mistakes: [],
    reviews: [
      { id: "newer", prompt: "new", category: "grammar", repetitions: 1, ease: 2.5, intervalDays: 1, dueAt: "2026-09-04T10:00:00.000Z" },
      { id: "older", prompt: "old", category: "grammar", repetitions: 1, ease: 2.5, intervalDays: 1, dueAt: "2026-09-03T10:00:00.000Z" }
    ]
  });

  assert.equal(lesson.activities[2].reviewId, "older");
  assert.match(lesson.focus, /old/);
});

test("adaptive lesson falls back to the weakest weighted skill", () => {
  const lesson = buildAdaptiveLesson({
    level: "A2",
    dailyMinutes: 15,
    scores: { speaking: 50, listening: 55, grammar: 40, vocabulary: 60, pronunciation: 45 },
    mistakes: [],
  });

  assert.equal(lesson.primarySkill, "grammar");
  assert.equal(lesson.minutes, 15);
});

test("review grading resets failed cards to a short retry interval", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");
  const updated = nextReview({
    id: "r1", prompt: "I go yesterday", answer: "I went yesterday", category: "grammar",
    repetitions: 4, ease: 2.5, intervalDays: 10, dueAt: now.toISOString()
  }, 0, now);

  assert.equal(updated.repetitions, 0);
  assert.equal(updated.intervalDays, 0.04);
  assert.equal(updated.dueAt, new Date(now.getTime() + 0.04 * 24 * 60 * 60 * 1000).toISOString());
});

test("review grading schedules a first successful repetition for tomorrow", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");
  const updated = nextReview({
    id: "r1", prompt: "I go yesterday", category: "grammar",
    repetitions: 0, ease: 2.5, intervalDays: 0, dueAt: now.toISOString()
  }, 5, now);

  assert.equal(updated.repetitions, 1);
  assert.equal(updated.intervalDays, 1);
});

test("progress score and CEFR calculations stay bounded", () => {
  const scores = { speaking: 80, listening: 80, grammar: 80, vocabulary: 80, pronunciation: 80 };
  assert.equal(calculateOverall(scores), 80);
  assert.equal(calculateCEFR("B2", scores), "B2");
  assert.equal(calculateCEFR("B1", scores), "B2");

  const next = updateSkillScores(scores, "speaking", 100);
  assert.equal(next.speaking, 84);
});
