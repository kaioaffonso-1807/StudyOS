import { databaseEnabled, loadMemory, saveMemory } from "./database.js";

export type LearnerMemory = {
  userId: string;
  interests: string[];
  goals: string[];
  vocabulary: string[];
  preferredTopics: string[];
  conversationCount: number;
  totalTurns: number;
  lastActiveAt: string;
};

const memories = new Map<string, LearnerMemory>();

export async function getLearnerMemory(userId: string): Promise<LearnerMemory> {
  const cached = memories.get(userId);
  if (cached) return cached;
  if (databaseEnabled()) {
    const stored = await loadMemory(userId);
    if (stored) { memories.set(userId, stored); return stored; }
  }
  const created: LearnerMemory = { userId, interests: [], goals: [], vocabulary: [], preferredTopics: [], conversationCount: 0, totalTurns: 0, lastActiveAt: new Date().toISOString() };
  memories.set(userId, created);
  if (databaseEnabled()) await saveMemory(created);
  return created;
}

export async function updateLearnerMemory(userId: string, patch: Partial<Omit<LearnerMemory, 'userId'>>) {
  const memory = await getLearnerMemory(userId);
  if (patch.interests) memory.interests = unique([...memory.interests, ...patch.interests]).slice(-30);
  if (patch.goals) memory.goals = unique([...memory.goals, ...patch.goals]).slice(-10);
  if (patch.vocabulary) memory.vocabulary = unique([...memory.vocabulary, ...patch.vocabulary]).slice(-100);
  if (patch.preferredTopics) memory.preferredTopics = unique([...memory.preferredTopics, ...patch.preferredTopics]).slice(-20);
  if (typeof patch.conversationCount === 'number') memory.conversationCount = patch.conversationCount;
  if (typeof patch.totalTurns === 'number') memory.totalTurns = patch.totalTurns;
  memory.lastActiveAt = new Date().toISOString();
  if (databaseEnabled()) await saveMemory(memory);
  return memory;
}

export async function recordLearnerTurn(userId: string) {
  return updateLearnerMemory(userId, { totalTurns: (await getLearnerMemory(userId)).totalTurns + 1 });
}

export async function recordConversation(userId: string) {
  return updateLearnerMemory(userId, { conversationCount: (await getLearnerMemory(userId)).conversationCount + 1 });
}

function unique(items: string[]) { return [...new Set(items.map((item) => item.trim()).filter(Boolean))]; }
