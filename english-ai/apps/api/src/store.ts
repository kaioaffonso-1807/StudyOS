import { loadMistakes, saveMistake, resolveMistakeDb, databaseEnabled, createReview, loadDueReviews, gradeReviewDb } from "./database.js";
import { createReviewItem, nextReview, type ReviewItem } from "./review-engine.js";

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
  if (databaseEnabled()) {
    const item = await saveMistake(input);
    if (item.correctedText) {
      const review = createReviewItem({ prompt: item.originalText ?? 'Correct this sentence.', answer: item.originalText, correction: item.correctedText, category: item.category });
      await createReview(input.userId, review);
    }
    return item;
  }
  const existing = mistakes.find((item) => item.userId === input.userId && item.category === input.category && item.originalText === input.originalText);
  if (existing) { existing.count += 1; existing.lastSeenAt = new Date().toISOString(); return existing; }
  const item: Mistake = { ...input, id: crypto.randomUUID(), count: 1, resolved: false, lastSeenAt: new Date().toISOString() };
  mistakes.push(item);
  const review = createReviewItem({ prompt: item.originalText ?? 'Correct this sentence.', answer: item.originalText, correction: item.correctedText, category: item.category });
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

export async function listDueReviews(userId: string, now = new Date()) {
  if (databaseEnabled()) return loadDueReviews(userId, now);
  return (reviews.get(userId) ?? []).filter((item) => new Date(item.dueAt).getTime() <= now.getTime()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function gradeReview(userId: string, reviewId: string, grade: 0 | 1 | 2 | 3 | 4 | 5, now = new Date()) {
  if (databaseEnabled()) {
    const due = await loadDueReviews(userId, now);
    const item = due.find((review) => review.id === reviewId);
    if (!item) return null;
    return gradeReviewDb(userId, reviewId, nextReview(item, grade, now));
  }
  const items = reviews.get(userId) ?? [];
  const index = items.findIndex((item) => item.id === reviewId);
  if (index < 0) return null;
  const updated = nextReview(items[index], grade, now);
  items[index] = updated;
  reviews.set(userId, items);
  return updated;
}
