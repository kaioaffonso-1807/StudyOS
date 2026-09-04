import OpenAI from "openai";

const transcriptionModel = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
const ttsModel = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";

function requireApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

function client() { return new OpenAI({ apiKey: requireApiKey() }); }

export async function transcribeAudio(file: { buffer: Buffer; originalname: string; mimetype: string }, language = "en") {
  const openai = client();
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || "audio/webm" });
  const audioFile = new File([blob], file.originalname || "speech.webm", { type: file.mimetype || "audio/webm" });
  const result = await openai.audio.transcriptions.create({ file: audioFile, model: transcriptionModel, language });
  return result.text;
}

export async function synthesizeSpeech(text: string) {
  const openai = client();
  const response = await openai.audio.speech.create({
    model: ttsModel,
    voice: process.env.OPENAI_TTS_VOICE ?? "alloy",
    input: text.slice(0, 4096),
    response_format: "mp3"
  });
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}
