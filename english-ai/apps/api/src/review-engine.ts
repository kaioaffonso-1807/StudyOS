export type ReviewItem = {
  id: string;
  prompt: string;
  answer?: string;
  correction?: string;
  category: string;
  repetitions: number;
  ease: number;
  intervalDays: number;
  dueAt: string;
};

export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

const DAY = 24 * 60 * 60 * 1000;

export function nextReview(item: ReviewItem, grade: ReviewGrade, now = new Date()): ReviewItem {
  const repetitions = grade < 3 ? 0 : item.repetitions + 1;
  const ease = Math.max(1.3, item.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  const intervalDays = grade < 3
    ? 0.04
    : repetitions === 1
      ? 1
      : repetitions === 2
        ? 3
        : Math.max(1, Math.round(item.intervalDays * ease));

  return {
    ...item,
    repetitions,
    ease: Math.round(ease * 100) / 100,
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * DAY).toISOString(),
  };
}

export function isDue(item: ReviewItem, now = new Date()) {
  return new Date(item.dueAt).getTime() <= now.getTime();
}

export function createReviewItem(input: Omit<ReviewItem, 'id' | 'repetitions' | 'ease' | 'intervalDays' | 'dueAt'>, now = new Date()): ReviewItem {
  return {
    ...input,
    id: crypto.randomUUID(),
    repetitions: 0,
    ease: 2.5,
    intervalDays: 0,
    dueAt: now.toISOString(),
  };
}
