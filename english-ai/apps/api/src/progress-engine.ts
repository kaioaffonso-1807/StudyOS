export type Skill = 'speaking' | 'listening' | 'grammar' | 'vocabulary' | 'pronunciation';
export type SkillScores = Record<Skill, number>;

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export function updateSkillScores(scores: SkillScores, skill: Skill, performance: number): SkillScores {
  const safe = Math.max(0, Math.min(100, performance));
  const next = { ...scores };
  next[skill] = Math.round((scores[skill] * 0.8 + safe * 0.2) * 10) / 10;
  return next;
}

export function calculateOverall(scores: SkillScores) {
  const values = Object.values(scores);
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function calculateCEFR(currentLevel: string, scores: SkillScores) {
  const overall = calculateOverall(scores);
  const index = Math.max(0, LEVELS.indexOf(currentLevel as typeof LEVELS[number]));
  const thresholds = [0, 35, 50, 65, 80];
  let target = 0;
  for (let i = 0; i < thresholds.length; i += 1) if (overall >= thresholds[i]) target = i;
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(index, target))];
}

export function progressSnapshot(scores: SkillScores, currentLevel: string) {
  return { scores, overall: calculateOverall(scores), cefrLevel: calculateCEFR(currentLevel, scores), nextLevel: LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(calculateCEFR(currentLevel, scores) as typeof LEVELS[number]) + 1)] };
}
