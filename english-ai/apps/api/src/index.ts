import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "studyos-english-api" });
});

app.get("/api/v1/lessons/daily", (req, res) => {
  const level = String(req.query.level ?? "A1").toUpperCase();
  res.json({
    level,
    lesson: {
      id: `daily-${level.toLowerCase()}`,
      title: level === "A1" ? "Introduce yourself" : "Daily English practice",
      focus: ["speaking", "vocabulary", "grammar"],
      activities: [
        { type: "warmup", prompt: "Tell me your name and where you are from." },
        { type: "conversation", prompt: "Have a short conversation about your day." },
        { type: "review", prompt: "Review the mistakes from today's practice." }
      ]
    }
  });
});

app.post("/api/v1/placement/submit", (req, res) => {
  const score = Number(req.body?.score ?? 0);
  const level = score >= 80 ? "B2" : score >= 60 ? "B1" : score >= 40 ? "A2" : "A1";
  res.json({ score, level, nextStep: "Start your personalized daily lesson." });
});

app.post("/api/v1/conversations", (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const correction = message.toLowerCase().includes("yesterday") && message.toLowerCase().includes("go")
    ? "Yesterday, I went to..."
    : null;

  res.json({
    reply: correction
      ? "Good job. Keep going! A natural correction is: \"Yesterday, I went to...\""
      : "Nice! Tell me a little more about that.",
    correction,
    score: correction ? 78 : 88
  });
});

app.listen(port, () => {
  console.log(`StudyOS English API listening on http://localhost:${port}`);
});
