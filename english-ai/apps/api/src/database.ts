import pg from "pg";
import type { SkillScores } from "./progress-engine.js";
import type { LearnerMemory } from "./memory.js";
import type { Mistake } from "./store.js";
const { Pool } = pg;
const ssl = process.env.DATABASE_SSL === "false"
  ? false
  : process.env.DATABASE_SSL_CA
    ? { ca: process.env.DATABASE_SSL_CA, rejectUnauthorized: true }
    : { rejectUnauthorized: true };
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl }) : null;
export type StoredProfile = { level: string; scores: SkillScores };
export function databaseEnabled() { return Boolean(pool); }
export async function databaseReady() { if (!pool) return false; try { await pool.query("SELECT 1"); return true; } catch { return false; } }
async function ensureUser(externalUserId: string) { if (!pool) return null; const r = await pool.query(`INSERT INTO users (external_id,email) VALUES ($1,$2) ON CONFLICT (external_id) DO UPDATE SET updated_at=now() RETURNING id`, [externalUserId,`${externalUserId}@studyos.local`]); return r.rows[0].id as string; }
export async function loadProfile(id:string):Promise<StoredProfile|null>{if(!pool)return null;const r=await pool.query(`SELECT cefr_level,speaking_score,listening_score,grammar_score,vocabulary_score,pronunciation_score FROM learning_profiles lp JOIN users u ON u.id=lp.user_id WHERE u.external_id=$1`,[id]);if(!r.rowCount)return null;const x=r.rows[0];return{level:String(x.cefr_level),scores:{speaking:Number(x.speaking_score),listening:Number(x.listening_score),grammar:Number(x.grammar_score),vocabulary:Number(x.vocabulary_score),pronunciation:Number(x.pronunciation_score)}}}
export async function saveProfile(id:string,p:StoredProfile){if(!pool)return;const uid=await ensureUser(id);await pool.query(`INSERT INTO learning_profiles(user_id,cefr_level,speaking_score,listening_score,grammar_score,vocabulary_score,pronunciation_score,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(user_id) DO UPDATE SET cefr_level=EXCLUDED.cefr_level,speaking_score=EXCLUDED.speaking_score,listening_score=EXCLUDED.listening_score,grammar_score=EXCLUDED.grammar_score,vocabulary_score=EXCLUDED.vocabulary_score,pronunciation_score=EXCLUDED.pronunciation_score,updated_at=now()`,[uid,p.level,p.scores.speaking,p.scores.listening,p.scores.grammar,p.scores.vocabulary,p.scores.pronunciation])}
export async function loadMemory(id:string):Promise<LearnerMemory|null>{if(!pool)return null;const uid=await ensureUser(id);const r=await pool.query(`SELECT goal,interests,preferred_topics,learned_vocabulary,conversation_count,total_turns,last_active_at FROM learner_memory WHERE user_id=$1`,[uid]);if(!r.rowCount)return null;const x=r.rows[0];return{userId:id,interests:x.interests??[],goals:x.goal?[x.goal]:[],vocabulary:x.learned_vocabulary??[],preferredTopics:x.preferred_topics??[],conversationCount:Number(x.conversation_count),totalTurns:Number(x.total_turns),lastActiveAt:new Date(x.last_active_at).toISOString()}}
export async function saveMemory(m:LearnerMemory){if(!pool)return;const uid=await ensureUser(m.userId);await pool.query(`INSERT INTO learner_memory(user_id,goal,interests,preferred_topics,learned_vocabulary,conversation_count,total_turns,last_active_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(user_id) DO UPDATE SET goal=EXCLUDED.goal,interests=EXCLUDED.interests,preferred_topics=EXCLUDED.preferred_topics,learned_vocabulary=EXCLUDED.learned_vocabulary,conversation_count=EXCLUDED.conversation_count,total_turns=EXCLUDED.total_turns,last_active_at=EXCLUDED.last_active_at,updated_at=now()`,[uid,m.goals.at(-1)??null,m.interests,m.preferredTopics,m.vocabulary,m.conversationCount,m.totalTurns,m.lastActiveAt])}
export async function loadMistakes(id:string):Promise<Mistake[]>{if(!pool)return[];const uid=await ensureUser(id);const r=await pool.query(`SELECT id,category,source,original_text,corrected_text,count,resolved,last_seen_at FROM mistakes WHERE user_id=$1 AND resolved=false ORDER BY count DESC,last_seen_at DESC`,[uid]);return r.rows.map(x=>({id:String(x.id),userId:id,category:String(x.category),source:String(x.source),originalText:x.original_text??undefined,correctedText:x.corrected_text??undefined,count:Number(x.count),resolved:Boolean(x.resolved),lastSeenAt:new Date(x.last_seen_at).toISOString()}))}
export async function saveMistake(input:Omit<Mistake,"id"|"count"|"resolved"|"lastSeenAt">):Promise<Mistake>{if(!pool)throw new Error("database disabled");const uid=await ensureUser(input.userId);const e=await pool.query(`SELECT id FROM mistakes WHERE user_id=$1 AND category=$2 AND original_text IS NOT DISTINCT FROM $3 AND resolved=false LIMIT 1`,[uid,input.category,input.originalText??null]);const r=e.rowCount?await pool.query(`UPDATE mistakes SET count=count+1,last_seen_at=now(),corrected_text=$2 WHERE id=$1 RETURNING id,count,last_seen_at`,[e.rows[0].id,input.correctedText??null]):await pool.query(`INSERT INTO mistakes(user_id,category,source,original_text,corrected_text) VALUES($1,$2,$3,$4,$5) RETURNING id,count,last_seen_at,resolved`,[uid,input.category,input.source,input.originalText??null,input.correctedText??null]);const x=r.rows[0];return{...input,id:String(x.id),count:Number(x.count),resolved:Boolean(x.resolved??false),lastSeenAt:new Date(x.last_seen_at).toISOString()}}
export async function resolveMistakeDb(id:string,mistakeId:string):Promise<Mistake|null>{if(!pool)return null;const uid=await ensureUser(id);const r=await pool.query(`UPDATE mistakes SET resolved=true WHERE id=$1 AND user_id=$2 RETURNING id,category,source,original_text,corrected_text,count,resolved,last_seen_at`,[mistakeId,uid]);if(!r.rowCount)return null;const x=r.rows[0];return{id:String(x.id),userId:id,category:String(x.category),source:String(x.source),originalText:x.original_text??undefined,correctedText:x.corrected_text??undefined,count:Number(x.count),resolved:true,lastSeenAt:new Date(x.last_seen_at).toISOString()}}
export async function createConversation(id:string,topic:string,level:string){if(!pool)return null;const uid=await ensureUser(id);const r=await pool.query(`INSERT INTO conversations(user_id,topic,cefr_level) VALUES($1,$2,$3) RETURNING id`,[uid,topic,level]);return String(r.rows[0].id)}
export async function getActiveConversation(id:string){if(!pool)return null;const uid=await ensureUser(id);const r=await pool.query(`SELECT id FROM conversations WHERE user_id=$1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,[uid]);return r.rowCount?String(r.rows[0].id):null}
export async function saveConversationMessage(conversationId:string,role:"user"|"assistant"|"system",content:string,metadata:Record<string,unknown>={}){if(!pool)return;await pool.query(`INSERT INTO conversation_messages(conversation_id,role,content,metadata) VALUES($1,$2,$3,$4)`,[conversationId,role,content,JSON.stringify(metadata)])}
export async function recordLearningEvent(id:string,skill:string,performance:number,source:string,metadata:Record<string,unknown>={}){if(!pool)return;const uid=await ensureUser(id);await pool.query(`INSERT INTO learning_events(user_id,skill,performance,source,metadata) VALUES($1,$2,$3,$4,$5)`,[uid,skill,performance,source,JSON.stringify(metadata)])}

export type ExportedUserData = {
  exportedAt: string;
  user: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  memory: Record<string, unknown> | null;
  mistakes: Record<string, unknown>[];
  conversations: Array<{ id: string; topic: string; cefrLevel: string; startedAt: string; endedAt: string | null; messages: Record<string, unknown>[] }>;
  learningEvents: Record<string, unknown>[];
  usage: Record<string, unknown>[];
  billing: { customer: Record<string, unknown> | null; subscriptions: Record<string, unknown>[] };
};

export async function exportUserData(externalUserId: string): Promise<ExportedUserData> {
  if (!pool) throw new Error("database disabled");
  const userResult = await pool.query(`SELECT id,external_id,email,display_name,created_at,updated_at FROM users WHERE external_id=$1`, [externalUserId]);
  if (!userResult.rowCount) return { exportedAt:new Date().toISOString(), user:null, profile:null, memory:null, mistakes:[], conversations:[], learningEvents:[], usage:[], billing:{customer:null,subscriptions:[]} };
  const user = userResult.rows[0];
  const uid = String(user.id);
  const [profile,memory,mistakes,conversations,events,usage,customer,subscriptions] = await Promise.all([
    pool.query(`SELECT cefr_level,speaking_score,listening_score,grammar_score,vocabulary_score,pronunciation_score,created_at,updated_at FROM learning_profiles WHERE user_id=$1`,[uid]),
    pool.query(`SELECT goal,interests,preferred_topics,learned_vocabulary,conversation_count,total_turns,last_active_at,created_at,updated_at FROM learner_memory WHERE user_id=$1`,[uid]),
    pool.query(`SELECT id,category,source,original_text,corrected_text,count,resolved,last_seen_at,created_at FROM mistakes WHERE user_id=$1 ORDER BY last_seen_at DESC`,[uid]),
    pool.query(`SELECT id,topic,cefr_level,started_at,ended_at FROM conversations WHERE user_id=$1 ORDER BY started_at DESC`,[uid]),
    pool.query(`SELECT skill,performance,source,metadata,created_at FROM learning_events WHERE user_id=$1 ORDER BY created_at DESC`,[uid]),
    pool.query(`SELECT usage_date,action,count,updated_at FROM usage_counters WHERE user_id=$1 ORDER BY usage_date DESC,action`,[uid]),
    pool.query(`SELECT provider,provider_customer_id,created_at,updated_at FROM billing_customers WHERE user_id=$1`,[uid]),
    pool.query(`SELECT provider,provider_subscription_id,provider_customer_id,price_id,plan,status,current_period_end,cancel_at_period_end,created_at,updated_at FROM billing_subscriptions WHERE user_id=$1 ORDER BY updated_at DESC`,[uid]),
  ]);
  const conversationIds = conversations.rows.map(r => String(r.id));
  const messageRows = conversationIds.length ? await pool.query(`SELECT conversation_id,role,content,metadata,created_at FROM conversation_messages WHERE conversation_id = ANY($1::uuid[]) ORDER BY created_at`, [conversationIds]) : { rows: [] as any[] };
  const messagesByConversation = new Map<string, Record<string, unknown>[]>();
  for (const row of messageRows.rows) { const key=String(row.conversation_id); const list=messagesByConversation.get(key)??[]; list.push({role:row.role,content:row.content,metadata:row.metadata,createdAt:row.created_at}); messagesByConversation.set(key,list); }
  return {
    exportedAt:new Date().toISOString(),
    user:{id:uid,externalId:user.external_id,email:user.email,displayName:user.display_name,createdAt:user.created_at,updatedAt:user.updated_at},
    profile:profile.rows[0] ? {...profile.rows[0]} : null,
    memory:memory.rows[0] ? {...memory.rows[0]} : null,
    mistakes:mistakes.rows.map(r=>({...r})),
    conversations:conversations.rows.map(r=>({id:String(r.id),topic:String(r.topic),cefrLevel:String(r.cefr_level),startedAt:new Date(r.started_at).toISOString(),endedAt:r.ended_at?new Date(r.ended_at).toISOString():null,messages:messagesByConversation.get(String(r.id))??[]})),
    learningEvents:events.rows.map(r=>({...r})),
    usage:usage.rows.map(r=>({...r})),
    billing:{customer:customer.rows[0]?{...customer.rows[0]}:null,subscriptions:subscriptions.rows.map(r=>({...r}))},
  };
}

export async function deleteUserData(externalUserId: string): Promise<boolean> {
  if (!pool) throw new Error("database disabled");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(`SELECT id FROM users WHERE external_id=$1 FOR UPDATE`,[externalUserId]);
    if (!found.rowCount) { await client.query("COMMIT"); return false; }
    const uid = String(found.rows[0].id);
    await client.query(`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id=$1)`,[uid]);
    await client.query(`DELETE FROM conversations WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM learning_profiles WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM learner_memory WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM mistakes WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM learning_events WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM attempts WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM usage_counters WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM billing_subscriptions WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM billing_customers WHERE user_id=$1`,[uid]);
    await client.query(`DELETE FROM users WHERE id=$1`,[uid]);
    await client.query("COMMIT");
    return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function closeDatabase(){if(pool)await pool.end()}
