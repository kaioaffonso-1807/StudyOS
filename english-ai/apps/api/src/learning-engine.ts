export type Skill = 'speaking' | 'listening' | 'grammar' | 'vocabulary' | 'pronunciation';

export type LearningProfile = Record<Skill, number> & { cefrLevel: string };

const skillWeights: Record<Skill, number> = {
  speaking: 1.3,
  listening: 1.1,
  grammar: 1,
  vocabulary: 1,
  pronunciation: 1.2
};

export function recommendNextSkill(profile: LearningProfile): Skill {
  return (Object.keys(skillWeights) as Skill[]).sort((a, b) => {
    const scoreA = profile[a] / skillWeights[a];
    const scoreB = profile[b] / skillWeights[b];
    return scoreA - scoreB;
  })[0];
}

export function buildDailyPlan(profile: LearningProfile, minutes = 10) {
  const primary = recommendNextSkill(profile);
  const secondary = (Object.keys(skillWeights) as Skill[])
    .filter((skill) => skill !== primary)
    .sort((a, b) => profile[a] - profile[b])[0];

  return {
    minutes,
    level: profile.cefrLevel,
    primarySkill: primary,
    activities: [
      { type: 'practice', skill: primary, minutes: Math.max(4, Math.round(minutes * 0.5)) },
      { type: 'reinforcement', skill: secondary, minutes: Math.max(2, Math.round(minutes * 0.3)) },
      { type: 'review', skill: primary, minutes: Math.max(2, minutes - Math.max(4, Math.round(minutes * 0.5)) - Math.max(2, Math.round(minutes * 0.3))) }
    ]
  };
}
