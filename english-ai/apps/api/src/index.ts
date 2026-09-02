import express from "express";
import { buildDailyPlan, type LearningProfile } from "./learning-engine.js";
import { listOpenMistakes, recordMistake, resolveMistake } from "./store.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
app.use(express.json());

const defaultProfile: LearningProfile = {
  cefrLevel: "A1", speaking: 28, listening: 35, grammar: 36, vocabulary: 42, pronunciation: 30
};

app.get("/health", (_req, res) => res.json({ ok: true, service: "studyos-english-api" }));

app.get("/api/v1/lessons/daily", (req, res) => {
  const level = String(req.query.level ?? defaultProfile.cefrLevel).toUpperCase();
  const profile = { ...defaultProfile, cefrLevel: level };
  res.json({ plan: buildDailyPlan(profile, Number(req.query.minutes ?? 10)) });
});

app.post("/api/v1/placement/submit", (req, res) => {
  const score = Math.max(0, Math.min(100, Number(req.body?.score ?? 0)));
  const level = score >= 80 ? "B2" : score >= 60 ? "B1" : score >= 40 ? "A2" : "A1";
  res.json({ score, level, nextStep: "Start your personalized daily lesson." });
});

app.get("/api/v1/users/:userId/mistakes", (req, res) => {
  res.json({ mistakes: listOpenMistakes(req.params.userId) });
});

app.post("/api/v1/users/:userId/mistakes", (req, res) => {
  const category = String(req.body?.category ?? "grammar");
  const source = String(req.body?.source ?? "conversation");
  const item = recordMistake({ userId: req.params.userId, category, source, originalText: req.body?.originalText, correctedText: req.body?.correctedText });
  res.status(201).json({ mistake: item });
});

app.post("/api/v1/users/:userId/mistakes/:id/resolve", (req, res) => {
  const item = resolveMistake(req.params.userId, req.params.id);
  if (!item) return res.status(404).json({ error: "Mistake not found" });
  return res.json({ mistake: item });
});

app.post("/api/v1/conversations", (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const userId = String(req.body?.userId ?? "demo-user");
  if (!message) return res.status(400).json({ error: "message is required" });

  const correction = /yesterday.*\bgo\b|\bi go\b/i.test(message) ? "Yesterday, I went to..." : null;
  if (correction) recordMistake({ userId, category: "grammar", source: "conversation", originalText: message, correctedText: correction });

  res.json({
    reply: correction ? `Good job. A natural correction is: "${correction}". Now try saying the whole sentence.` : "Nice! Tell me a little more about that.",
    correction,
    score: correction ? 78 : 88,
    reviewQueued: Boolean(correction)
  });
});

app.listen(port, () => console.log(`StudyOS English API listening on port ${port}`));
