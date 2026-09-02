import pg from "pg";
import type { SkillScores } from "./progress-engine.js";

const { Pool } = pg;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } })
  : null;

export type StoredProfile = { level: string; scores: SkillScores };

export function databaseEnabled() {
  return Boolean(pool);
}

export async function loadProfile(externalUserId: string): Promise<StoredProfile | null> {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT lp.cefr_level, lp.speaking_score, lp.listening_score, lp.grammar_score, lp.vocabulary_score, lp.pronunciation_score
       FROM users u
       JOIN learning_profiles lp ON lp.user_id = u.id
      WHERE u.external_id = $1`,
    [externalUserId]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    level: String(row.cefr_level),
    scores: {
      speaking: Number(row.speaking_score),
      listening: Number(row.listening_score),
      grammar: Number(row.grammar_score),
      vocabulary: Number(row.vocabulary_score),
      pronunciation: Number(row.pronunciation_score)
    }
  };
}

export async function saveProfile(externalUserId: string, profile: StoredProfile): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO users (external_id, email)
     VALUES ($1, $2)
     ON CONFLICT (external_id) DO UPDATE SET updated_at = now()`,
    [externalUserId, `${externalUserId}@studyos.local`]
  );
  await pool.query(
    `INSERT INTO learning_profiles (user_id, cefr_level, speaking_score, listening_score, grammar_score, vocabulary_score, pronunciation_score, updated_at)
     SELECT id, $2, $3, $4, $5, $6, $7, now() FROM users WHERE external_id = $1
     ON CONFLICT (user_id) DO UPDATE SET
       cefr_level = EXCLUDED.cefr_level,
       speaking_score = EXCLUDED.speaking_score,
       listening_score = EXCLUDED.listening_score,
       grammar_score = EXCLUDED.grammar_score,
       vocabulary_score = EXCLUDED.vocabulary_score,
       pronunciation_score = EXCLUDED.pronunciation_score,
       updated_at = now()`,
    [externalUserId, profile.level, profile.scores.speaking, profile.scores.listening, profile.scores.grammar, profile.scores.vocabulary, profile.scores.pronunciation]
  );
}

export async function closeDatabase() {
  if (pool) await pool.end();
}
