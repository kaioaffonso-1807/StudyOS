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

export function getLearnerMemory(userId: string): LearnerMemory {
  const existing = memories.get(userId);
  if (existing) return existing;
  const created: LearnerMemory = {
    userId,
    interests: [],
    goals: [],
    vocabulary: [],
    preferredTopics: [],
    conversationCount: 0,
    totalTurns: 0,
    lastActiveAt: new Date().toISOString()
  };
  memories.set(userId, created);
  return created;
}

export function updateLearnerMemory(userId: string, patch: Partial<Omit<LearnerMemory, 'userId'>>) {
  const memory = getLearnerMemory(userId);
  if (patch.interests) memory.interests = unique([...memory.interests, ...patch.interests]).slice(-30);
  if (patch.goals) memory.goals = unique([...memory.goals, ...patch.goals]).slice(-10);
  if (patch.vocabulary) memory.vocabulary = unique([...memory.vocabulary, ...patch.vocabulary]).slice(-100);
  if (patch.preferredTopics) memory.preferredTopics = unique([...memory.preferredTopics, ...patch.preferredTopics]).slice(-20);
  if (typeof patch.conversationCount === 'number') memory.conversationCount = patch.conversationCount;
  if (typeof patch.totalTurns === 'number') memory.totalTurns = patch.totalTurns;
  memory.lastActiveAt = new Date().toISOString();
  return memory;
}

export function recordLearnerTurn(userId: string) {
  const memory = getLearnerMemory(userId);
  memory.totalTurns += 1;
  memory.lastActiveAt = new Date().toISOString();
  return memory;
}

export function recordConversation(userId: string) {
  const memory = getLearnerMemory(userId);
  memory.conversationCount += 1;
  memory.lastActiveAt = new Date().toISOString();
  return memory;
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
