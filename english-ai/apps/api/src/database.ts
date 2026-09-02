import pg from "pg";
import type { SkillScores } from "./progress-engine.js";
import type { LearnerMemory } from "./memory.js";
import type { Mistake } from "./store.js";

const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } })
  : null;

export type StoredProfile = { level: string; scores: SkillScores };
export function databaseEnabled() { return Boolean(pool); }

async function ensureUser(externalUserId: string) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO users (external_id, email) VALUES ($1, $2)
     ON CONFLICT (external_id) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [externalUserId, `${externalUserId}@studyos.local`]
  );
  return result.rows[0].id as string;
}

export async function loadProfile(externalUserId: string): Promise<StoredProfile | null> {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT lp.cefr_level, lp.speaking_score, lp.listening_score, lp.grammar_score, lp.vocabulary_score, lp.pronunciation_score
       FROM users u JOIN learning_profiles lp ON lp.user_id = u.id WHERE u.external_id = $1`,
    [externalUserId]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { level: String(row.cefr_level), scores: { speaking: Number(row.speaking_score), listening: Number(row.listening_score), grammar: Number(row.grammar_score), vocabulary: Number(row.vocabulary_score), pronunciation: Number(row.pronunciation_score) } };
}

export async function saveProfile(externalUserId: string, profile: StoredProfile): Promise<void> {
  if (!pool) return;
  const userId = await ensureUser(externalUserId);
  await pool.query(
    `INSERT INTO learning_profiles (user_id, cefr_level, speaking_score, listening_score, grammar_score, vocabulary_score, pronunciation_score, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (user_id) DO UPDATE SET cefr_level=EXCLUDED.cefr_level, speaking_score=EXCLUDED.speaking_score, listening_score=EXCLUDED.listening_score, grammar_score=EXCLUDED.grammar_score, vocabulary_score=EXCLUDED.vocabulary_score, pronunciation_score=EXCLUDED.pronunciation_score, updated_at=now()`,
    [userId, profile.level, profile.scores.speaking, profile.scores.listening, profile.scores.grammar, profile.scores.vocabulary, profile.scores.pronunciation]
  );
}

export async function loadMemory(externalUserId: string): Promise<LearnerMemory | null> {
  if (!pool) return null;
  const userId = await ensureUser(externalUserId);
  const result = await pool.query(`SELECT goal, interests, preferred_topics, learned_vocabulary, conversation_count, total_turns, last_active_at FROM learner_memory WHERE user_id=$1`, [userId]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { userId: externalUserId, interests: row.interests ?? [], goals: row.goal ? [row.goal] : [], vocabulary: row.learned_vocabulary ?? [], preferredTopics: row.preferred_topics ?? [], conversationCount: Number(row.conversation_count), totalTurns: Number(row.total_turns), lastActiveAt: new Date(row.last_active_at).toISOString() };
}

export async function saveMemory(memory: LearnerMemory): Promise<void> {
  if (!pool) return;
  const userId = await ensureUser(memory.userId);
  await pool.query(
    `INSERT INTO learner_memory (user_id, goal, interests, preferred_topics, learned_vocabulary, conversation_count, total_turns, last_active_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (user_id) DO UPDATE SET goal=EXCLUDED.goal, interests=EXCLUDED.interests, preferred_topics=EXCLUDED.preferred_topics, learned_vocabulary=EXCLUDED.learned_vocabulary, conversation_count=EXCLUDED.conversation_count, total_turns=EXCLUDED.total_turns, last_active_at=EXCLUDED.last_active_at, updated_at=now()`,
    [userId, memory.goals.at(-1) ?? null, memory.interests, memory.preferredTopics, memory.vocabulary, memory.conversationCount, memory.totalTurns, memory.lastActiveAt]
  );
}

export async function loadMistakes(externalUserId: string): Promise<Mistake[]> {
  if (!pool) return [];
  const userId = await ensureUser(externalUserId);
  const result = await pool.query(`SELECT id, category, source, original_text, corrected_text, count, resolved, last_seen_at FROM mistakes WHERE user_id=$1 AND resolved=false ORDER BY count DESC, last_seen_at DESC`, [userId]);
  return result.rows.map((row) => ({ id: String(row.id), userId: externalUserId, category: String(row.category), source: String(row.source), originalText: row.original_text ?? undefined, correctedText: row.corrected_text ?? undefined, count: Number(row.count), resolved: Boolean(row.resolved), lastSeenAt: new Date(row.last_seen_at).toISOString() }));
}

export async function saveMistake(input: Omit<Mistake, "id" | "count" | "resolved" | "lastSeenAt">): Promise<Mistake> {
  if (!pool) throw new Error("database disabled");
  const userId = await ensureUser(input.userId);
  const existing = await pool.query(`SELECT id, count FROM mistakes WHERE user_id=$1 AND category=$2 AND original_text IS NOT DISTINCT FROM $3 AND resolved=false LIMIT 1`, [userId, input.category, input.originalText ?? null]);
  if (existing.rowCount) {
    const result = await pool.query(`UPDATE mistakes SET count=count+1, last_seen_at=now(), corrected_text=$2 WHERE id=$1 RETURNING id, count, last_seen_at`, [existing.rows[0].id, input.correctedText ?? null]);
    const row = result.rows[0];
    return { ...input, id: String(row.id), count: Number(row.count), resolved: false, lastSeenAt: new Date(row.last_seen_at).toISOString() };
  }
  const result = await pool.query(`INSERT INTO mistakes (user_id, category, source, original_text, corrected_text) VALUES ($1,$2,$3,$4,$5) RETURNING id,count,resolved,last_seen_at`, [userId,input.category,input.source,input.originalText ?? null,input.correctedText ?? null]);
  const row = result.rows[0];
  return { ...input, id: String(row.id), count: Number(row.count), resolved: Boolean(row.resolved), lastSeenAt: new Date(row.last_seen_at).toISOString() };
}

export async function resolveMistakeDb(externalUserId: string, id: string): Promise<Mistake | null> {
  if (!pool) return null;
  const userId = await ensureUser(externalUserId);
  const result = await pool.query(`UPDATE mistakes SET resolved=true WHERE id=$1 AND user_id=$2 RETURNING id,category,source,original_text,corrected_text,count,resolved,last_seen_at`, [id,userId]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { id:String(row.id), userId:externalUserId, category:String(row.category), source:String(row.source), originalText:row.original_text ?? undefined, correctedText:row.corrected_text ?? undefined, count:Number(row.count), resolved:Boolean(row.resolved), lastSeenAt:new Date(row.last_seen_at).toISOString() };
}

export async function createConversation(externalUserId: string, topic: string, level: string) {
  if (!pool) return null;
  const userId = await ensureUser(externalUserId);
  const result = await pool.query(`INSERT INTO conversations (user_id, topic, cefr_level) VALUES ($1,$2,$3) RETURNING id`, [userId,topic,level]);
  return String(result.rows[0].id);
}

export async function saveConversationMessage(externalUserId: string, conversationId: string, role: "user" | "assistant" | "system", content: string, metadata: Record<string, unknown> = {}) {
  if (!pool) return;
  await pool.query(`INSERT INTO conversation_messages (conversation_id, role, content, metadata) VALUES ($1,$2,$3,$4)`, [conversationId,role,content,JSON.stringify(metadata)]);
}

export async function recordLearningEvent(externalUserId: string, skill: string, performance: number, source: string, metadata: Record<string, unknown> = {}) {
  if (!pool) return;
  const userId = await ensureUser(externalUserId);
  await pool.query(`INSERT INTO learning_events (user_id, skill, performance, source, metadata) VALUES ($1,$2,$3,$4,$5)`, [userId,skill,performance,source,JSON.stringify(metadata)]);
}

export async function closeDatabase() { if (pool) await pool.end(); }
