import { loadMistakes, saveMistake, resolveMistakeDb, databaseEnabled } from "./database.js";

export type Mistake = {
  id: string;
  userId: string;
  category: string;
  source: string;
  originalText?: string;
  correctedText?: string;
  count: number;
  resolved: boolean;
  lastSeenAt: string;
};

const mistakes: Mistake[] = [];

export async function recordMistake(input: Omit<Mistake, 'id' | 'count' | 'resolved' | 'lastSeenAt'>) {
  if (databaseEnabled()) return saveMistake(input);
  const existing = mistakes.find((item) => item.userId === input.userId && item.category === input.category && item.originalText === input.originalText);
  if (existing) { existing.count += 1; existing.lastSeenAt = new Date().toISOString(); return existing; }
  const item: Mistake = { ...input, id: crypto.randomUUID(), count: 1, resolved: false, lastSeenAt: new Date().toISOString() };
  mistakes.push(item); return item;
}

export async function listOpenMistakes(userId: string) {
  if (databaseEnabled()) return loadMistakes(userId);
  return mistakes.filter((item) => item.userId === userId && !item.resolved).sort((a, b) => b.count - a.count || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function resolveMistake(userId: string, id: string) {
  if (databaseEnabled()) return resolveMistakeDb(userId, id);
  const item = mistakes.find((mistake) => mistake.id === id && mistake.userId === userId);
  if (!item) return null; item.resolved = true; return item;
}
