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

export function recordMistake(input: Omit<Mistake, 'id' | 'count' | 'resolved' | 'lastSeenAt'>) {
  const existing = mistakes.find((item) => item.userId === input.userId && item.category === input.category && item.originalText === input.originalText);
  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = new Date().toISOString();
    return existing;
  }

  const item: Mistake = {
    ...input,
    id: crypto.randomUUID(),
    count: 1,
    resolved: false,
    lastSeenAt: new Date().toISOString()
  };
  mistakes.push(item);
  return item;
}

export function listOpenMistakes(userId: string) {
  return mistakes
    .filter((item) => item.userId === userId && !item.resolved)
    .sort((a, b) => b.count - a.count || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function resolveMistake(userId: string, id: string) {
  const item = mistakes.find((mistake) => mistake.id === id && mistake.userId === userId);
  if (!item) return null;
  item.resolved = true;
  return item;
}
