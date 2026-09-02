import express from "express";
import multer from "multer";
import { buildDailyPlan, type LearningProfile } from "./learning-engine.js";
import { generateTutorReply } from "./ai-tutor.js";
import { listOpenMistakes, recordMistake, resolveMistake } from "./store.js";
import { synthesizeSpeech, transcribeAudio } from "./speech.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});
app.use(express.json({ limit: "20mb" }));

const defaultProfile: LearningProfile = { cefrLevel: "A1", speaking: 28, listening: 35, grammar: 36, vocabulary: 42, pronunciation: 30 };

app.get("/health", (_req, res) => res.json({ ok: true, service: "studyos-english-api", aiEnabled: Boolean(process.env.OPENAI_API_KEY), voiceEnabled: Boolean(process.env.OPENAI_API_KEY) }));

app.get("/api/v1/lessons/daily", (req, res) => {
  const level = String(req.query.level ?? defaultProfile.cefrLevel).toUpperCase();
  const minutes = Math.max(5, Math.min(60, Number(req.query.minutes ?? 10)));
  res.json({ plan: buildDailyPlan({ ...defaultProfile, cefrLevel: level }, minutes) });
});

app.post("/api/v1/placement/submit", (req, res) => {
  const score = Math.max(0, Math.min(100, Number(req.body?.score ?? 0)));
  const level = score >= 80 ? "B2" : score >= 60 ? "B1" : score >= 40 ? "A2" : "A1";
  res.json({ score, level, nextStep: "Start your personalized daily lesson." });
});

app.get("/api/v1/users/:userId/mistakes", (req, res) => res.json({ mistakes: listOpenMistakes(req.params.userId) }));

app.post("/api/v1/users/:userId/mistakes", (req, res) => {
  const item = recordMistake({ userId: req.params.userId, category: String(req.body?.category ?? "grammar"), source: String(req.body?.source ?? "conversation"), originalText: req.body?.originalText, correctedText: req.body?.correctedText });
  res.status(201).json({ mistake: item });
});

app.post("/api/v1/users/:userId/mistakes/:id/resolve", (req, res) => {
  const item = resolveMistake(req.params.userId, req.params.id);
  if (!item) return res.status(404).json({ error: "Mistake not found" });
  return res.json({ mistake: item });
});

app.post("/api/v1/conversations", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const userId = String(req.body?.userId ?? "demo-user");
  const level = String(req.body?.level ?? "A1").toUpperCase();
  const goal = req.body?.goal ? String(req.body.goal) : undefined;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const ai = await generateTutorReply(message, { level, goal, mistakes: listOpenMistakes(userId) });
    if (ai) {
      const correction = ai.correction ? String(ai.correction) : null;
      if (correction) recordMistake({ userId, category: String(ai.category ?? "grammar"), source: "conversation", originalText: message, correctedText: correction });
      return res.json({ reply: String(ai.reply ?? "Tell me more."), correction, score: Number(ai.score ?? 85), reviewQueued: Boolean(correction), provider: "openai" });
    }
  } catch (error) {
    console.error("AI tutor unavailable", error);
  }

  const correction = /yesterday.*\bgo\b|\bi go\b/i.test(message) ? "Yesterday, I went to..." : null;
  if (correction) recordMistake({ userId, category: "grammar", source: "conversation", originalText: message, correctedText: correction });
  return res.json({ reply: correction ? `Good job. A natural correction is: "${correction}". Now try saying the whole sentence.` : "Nice! Tell me a little more about that.", correction, score: correction ? 78 : 88, reviewQueued: Boolean(correction), provider: "fallback" });
});

app.post("/api/v1/speech/transcribe", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Voice AI is not configured. Set OPENAI_API_KEY." });
  try {
    const text = await transcribeAudio(req.file, String(req.body?.language ?? "en"));
    return res.json({ text, provider: "openai" });
  } catch (error) {
    console.error("Transcription failed", error);
    return res.status(502).json({ error: "Unable to transcribe audio" });
  }
});

app.post("/api/v1/speech/synthesize", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Voice AI is not configured. Set OPENAI_API_KEY." });
  try {
    const audioBase64 = await synthesizeSpeech(text);
    return res.json({ audioBase64, mimeType: "audio/mpeg", provider: "openai" });
  } catch (error) {
    console.error("Speech synthesis failed", error);
    return res.status(502).json({ error: "Unable to synthesize speech" });
  }
});

app.post("/api/v1/voice/turn", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Voice AI is not configured. Set OPENAI_API_KEY." });

  const userId = String(req.body?.userId ?? "demo-user");
  const level = String(req.body?.level ?? "A1").toUpperCase();
  const goal = req.body?.goal ? String(req.body.goal) : undefined;

  try {
    const transcript = await transcribeAudio(req.file, String(req.body?.language ?? "en"));
    const ai = await generateTutorReply(transcript, { level, goal, mistakes: listOpenMistakes(userId) });
    if (!ai) return res.status(503).json({ error: "Tutor AI unavailable" });

    const correction = ai.correction ? String(ai.correction) : null;
    if (correction) recordMistake({ userId, category: String(ai.category ?? "grammar"), source: "voice", originalText: transcript, correctedText: correction });

    const reply = String(ai.reply ?? "Tell me more.");
    const audioBase64 = await synthesizeSpeech(reply);
    return res.json({ transcript, reply, correction, score: Number(ai.score ?? 85), reviewQueued: Boolean(correction), audioBase64, mimeType: "audio/mpeg", provider: "openai" });
  } catch (error) {
    console.error("Voice turn failed", error);
    return res.status(502).json({ error: "Unable to process voice turn" });
  }
});

app.listen(port, () => console.log(`StudyOS English API listening on port ${port}`));
