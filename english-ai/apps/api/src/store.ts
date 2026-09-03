import { loadMistakes, saveMistake, resolveMistakeDb, databaseEnabled } from "./database.js";
import { createReviewItem, type ReviewItem } from "./review-engine.js";

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
const reviews = new Map<string, ReviewItem[]>();

export async function recordMistake(input: Omit<Mistake, 'id' | 'count' | 'resolved' | 'lastSeenAt'>) {
  if (databaseEnabled()) return saveMistake(input);
  const existing = mistakes.find((item) => item.userId === input.userId && item.category === input.category && item.originalText === input.originalText);
  if (existing) { existing.count += 1; existing.lastSeenAt = new Date().toISOString(); return existing; }
  const item: Mistake = { ...input, id: crypto.randomUUID(), count: 1, resolved: false, lastSeenAt: new Date().toISOString() };
  mistakes.push(item);
  const review = createReviewItem({ id: item.id, prompt: item.originalText ?? 'Correct this sentence.', answer: item.originalText, correction: item.correctedText, category: item.category });
  reviews.set(input.userId, [...(reviews.get(input.userId) ?? []), review]);
  return item;
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

export function listDueReviews(userId: string, now = new Date()) {
  return (reviews.get(userId) ?? []).filter((item) => new Date(item.dueAt).getTime() <= now.getTime()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function gradeReview(userId: string, reviewId: string, grade: 0 | 1 | 2 | 3 | 4 | 5, now = new Date()) {
  const items = reviews.get(userId) ?? [];
  const index = items.findIndex((item) => item.id === reviewId);
  if (index < 0) return null;
  const updated = items[index] = (awaitableNextReview(items[index], grade, now));
  reviews.set(userId, items);
  return updated;
}

function awaitableNextReview(item: ReviewItem, grade: 0 | 1 | 2 | 3 | 4 | 5, now: Date) {
  const { nextReview } = requireReviewEngine();
  return nextReview(item, grade, now);
}

function requireReviewEngine() {
  return { nextReview: requireNextReview };
}

import { nextReview as requireNextReview } from "./review-engine.js";
