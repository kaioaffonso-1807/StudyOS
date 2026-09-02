import express from "express";
import multer from "multer";
import { buildDailyPlan, type LearningProfile } from "./learning-engine.js";
import { buildAdaptiveLesson, type AdaptiveInput, type Skill } from "./adaptive-engine.js";
import { generateTutorReply } from "./ai-tutor.js";
import { getLearnerMemory, recordConversation, recordLearnerTurn, updateLearnerMemory } from "./memory.js";
import { listOpenMistakes, recordMistake, resolveMistake } from "./store.js";
import { synthesizeSpeech, transcribeAudio } from "./speech.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
app.use(express.json({ limit: "20mb" }));

const defaultProfile: LearningProfile = { cefrLevel: "A1", speaking: 28, listening: 35, grammar: 36, vocabulary: 42, pronunciation: 30 };

app.get("/health", (_req, res) => res.json({ ok: true, service: "studyos-english-api", aiEnabled: Boolean(process.env.OPENAI_API_KEY), voiceEnabled: Boolean(process.env.OPENAI_API_KEY), realtimeEnabled: Boolean(process.env.OPENAI_API_KEY), adaptiveEngine: true }));

app.get("/api/v1/lessons/daily", (req, res) => {
  const level = String(req.query.level ?? defaultProfile.cefrLevel).toUpperCase();
  const minutes = Math.max(5, Math.min(60, Number(req.query.minutes ?? 10)));
  res.json({ plan: buildDailyPlan({ ...defaultProfile, cefrLevel: level }, minutes) });
});

app.get("/api/v1/users/:userId/lesson/today", (req, res) => {
  const userId = req.params.userId;
  const level = String(req.query.level ?? defaultProfile.cefrLevel).toUpperCase();
  const dailyMinutes = Math.max(5, Math.min(60, Number(req.query.minutes ?? 10)));
  const memory = getLearnerMemory(userId);
  const mistakes = listOpenMistakes(userId);
  const scores: Record<Skill, number> = { speaking: defaultProfile.speaking, listening: defaultProfile.listening, grammar: defaultProfile.grammar, vocabulary: defaultProfile.vocabulary, pronunciation: defaultProfile.pronunciation };
  const input: AdaptiveInput = { level, goal: memory.goals.at(-1), dailyMinutes, scores, mistakes, interests: memory.interests };
  res.json({ lesson: buildAdaptiveLesson(input), memory, mistakes });
});

app.post("/api/v1/placement/submit", (req, res) => {
  const score = Math.max(0, Math.min(100, Number(req.body?.score ?? 0)));
  const level = score >= 80 ? "B2" : score >= 60 ? "B1" : score >= 40 ? "A2" : "A1";
  res.json({ score, level, nextStep: "Start your personalized daily lesson." });
});

app.get("/api/v1/users/:userId/memory", (req, res) => res.json({ memory: getLearnerMemory(req.params.userId) }));
app.patch("/api/v1/users/:userId/memory", (req, res) => res.json({ memory: updateLearnerMemory(req.params.userId, req.body ?? {}) }));
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

async function handleTutorTurn(userId: string, message: string, level: string, goal?: string) {
  const memory = getLearnerMemory(userId);
  recordLearnerTurn(userId);
  const ai = await generateTutorReply(message, { level, goal, mistakes: listOpenMistakes(userId), memory });
  if (ai) {
    const correction = ai.correction ? String(ai.correction) : null;
    if (correction) recordMistake({ userId, category: String(ai.category ?? "grammar"), source: "conversation", originalText: message, correctedText: correction });
    return { reply: String(ai.reply ?? "Tell me more."), correction, score: Number(ai.score ?? 85), reviewQueued: Boolean(correction), provider: "openai" as const };
  }
  const correction = /yesterday.*\bgo\b|\bi go\b/i.test(message) ? "Yesterday, I went to..." : null;
  if (correction) recordMistake({ userId, category: "grammar", source: "conversation", originalText: message, correctedText: correction });
  return { reply: correction ? `Good job. A natural correction is: "${correction}". Now try saying the whole sentence.` : "Nice! Tell me a little more about that.", correction, score: correction ? 78 : 88, reviewQueued: Boolean(correction), provider: "fallback" as const };
}

app.post("/api/v1/conversations", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const userId = String(req.body?.userId ?? "demo-user");
  const level = String(req.body?.level ?? "A1").toUpperCase();
  const goal = req.body?.goal ? String(req.body.goal) : undefined;
  if (!message) return res.status(400).json({ error: "message is required" });
  try {
    const result = await handleTutorTurn(userId, message, level, goal);
    updateLearnerMemory(userId, { goals: goal ? [goal] : [], preferredTopics: req.body?.topic ? [String(req.body.topic)] : [] });
    recordConversation(userId);
    return res.json({ ...result, memory: getLearnerMemory(userId) });
  } catch (error) { console.error("AI tutor unavailable", error); return res.status(502).json({ error: "Tutor AI unavailable" }); }
});

app.post("/api/v1/speech/transcribe", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Voice AI is not configured. Set OPENAI_API_KEY." });
  try { return res.json({ text: await transcribeAudio(req.file, String(req.body?.language ?? "en")), provider: "openai" }); }
  catch (error) { console.error("Transcription failed", error); return res.status(502).json({ error: "Unable to transcribe audio" }); }
});

app.post("/api/v1/speech/synthesize", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Voice AI is not configured. Set OPENAI_API_KEY." });
  try { return res.json({ audioBase64: await synthesizeSpeech(text), mimeType: "audio/mpeg", provider: "openai" }); }
  catch (error) { console.error("Speech synthesis failed", error); return res.status(502).json({ error: "Unable to synthesize speech" }); }
});

app.post("/api/v1/voice/turn", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Voice AI is not configured. Set OPENAI_API_KEY." });
  const userId = String(req.body?.userId ?? "demo-user");
  const level = String(req.body?.level ?? "A1").toUpperCase();
  const goal = req.body?.goal ? String(req.body.goal) : undefined;
  try {
    const transcript = await transcribeAudio(req.file, String(req.body?.language ?? "en"));
    const result = await handleTutorTurn(userId, transcript, level, goal);
    recordConversation(userId);
    return res.json({ transcript, ...result, audioBase64: await synthesizeSpeech(result.reply), mimeType: "audio/mpeg" });
  } catch (error) { console.error("Voice turn failed", error); return res.status(502).json({ error: "Unable to process voice turn" }); }
});

app.post("/api/v1/realtime/call", async (req, res) => {
  const sdp = String(req.body?.sdp ?? "");
  const level = String(req.body?.level ?? "A1").toUpperCase();
  const goal = req.body?.goal ? String(req.body.goal) : "general conversation";
  if (!sdp) return res.status(400).json({ error: "sdp is required" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Realtime AI is not configured. Set OPENAI_API_KEY." });
  const instructions = ["You are StudyOS English AI, a patient personal English tutor.", `Student CEFR level: ${level}.`, `Student goal: ${goal}.`, "Speak mostly in English. Adapt vocabulary and speed to the student's level.", "Keep turns short and natural. Correct one important mistake after the student speaks, then continue the conversation.", "Never shame the student. Encourage them to repeat corrected sentences when useful."].join(" ");
  try {
    const form = new FormData();
    form.append("sdp", new Blob([sdp], { type: "application/sdp" }), "offer.sdp");
    form.append("session", JSON.stringify({ type: "realtime", model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime", audio: { input: { turn_detection: { type: "semantic_vad", eagerness: "medium" } }, output: { voice: process.env.OPENAI_REALTIME_VOICE ?? "marin" } }, instructions }));
    const response = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    const answer = await response.text();
    if (!response.ok) return res.status(response.status).type("application/sdp").send(answer);
    return res.status(201).type("application/sdp").send(answer);
  } catch (error) { console.error("Realtime call failed", error); return res.status(502).json({ error: "Unable to create realtime call" }); }
});

app.listen(port, () => console.log(`StudyOS English API listening on port ${port}`));
