type TutorContext = {
  level: string;
  goal?: string;
  mistakes?: Array<{ category: string; originalText?: string; correctedText?: string; count: number }>;
};

export async function generateTutorReply(message: string, context: TutorContext) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  const system = [
    "You are StudyOS English AI, a patient English tutor.",
    `Student CEFR level: ${context.level}.`,
    context.goal ? `Student goal: ${context.goal}.` : "",
    "Reply naturally in English, keep the conversation moving, and correct only the most useful mistake.",
    "Return JSON with keys: reply, correction, category, score. score must be 0-100.",
    JSON.stringify({ recentMistakes: context.mistakes ?? [] })
  ].filter(Boolean).join("\\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: [{ role: "system", content: system }, { role: "user", content: message }] })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json() as { output_text?: string };
  const text = data.output_text ?? "";
  try { return JSON.parse(text); } catch { return { reply: text, correction: null, category: null, score: 85 }; }
}
