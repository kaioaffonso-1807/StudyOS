export type Skill = 'speaking' | 'listening' | 'grammar' | 'vocabulary' | 'pronunciation';

export type AdaptiveInput = {
  level: string;
  goal?: string;
  dailyMinutes: number;
  scores: Record<Skill, number>;
  mistakes: Array<{ category: string; originalText?: string; correctedText?: string; count: number }>;
  interests?: string[];
};

const skillWeight: Record<Skill, number> = {
  speaking: 1.35,
  listening: 1.15,
  grammar: 1,
  vocabulary: 1,
  pronunciation: 1.2
};

function weakestSkill(scores: Record<Skill, number>): Skill {
  return (Object.keys(skillWeight) as Skill[]).sort((a, b) => (scores[a] / skillWeight[a]) - (scores[b] / skillWeight[b]))[0];
}

function topMistake(mistakes: AdaptiveInput['mistakes']) {
  return [...mistakes].sort((a, b) => b.count - a.count)[0];
}

export function buildAdaptiveLesson(input: AdaptiveInput) {
  const primarySkill = weakestSkill(input.scores);
  const repeatedMistake = topMistake(input.mistakes);
  const topic = input.interests?.[0] || (input.goal?.toLowerCase().includes('travel') ? 'travel' : 'daily life');
  const minutes = Math.max(5, Math.min(60, input.dailyMinutes));
  const speakingMinutes = Math.max(3, Math.round(minutes * 0.4));
  const reviewMinutes = Math.max(2, Math.round(minutes * 0.25));
  const reinforcementMinutes = Math.max(2, minutes - speakingMinutes - reviewMinutes);

  return {
    title: `Personal English · ${topic}`,
    level: input.level,
    minutes,
    primarySkill,
    focus: repeatedMistake ? `${repeatedMistake.category}: ${repeatedMistake.correctedText ?? repeatedMistake.originalText ?? 'recent mistake'}` : primarySkill,
    reason: repeatedMistake
      ? `You have repeated this ${repeatedMistake.category} pattern ${repeatedMistake.count} time(s).` 
      : `${primarySkill} is currently your highest-priority skill gap.`,
    activities: [
      { id: 'warmup', type: 'conversation', title: `Warm-up: ${topic}`, skill: 'speaking', minutes: speakingMinutes, instruction: `Have a short ${input.level} conversation about ${topic}.` },
      { id: 'targeted-practice', type: 'targeted-practice', title: 'Fix your weak point', skill: primarySkill, minutes: reinforcementMinutes, instruction: repeatedMistake?.correctedText ? `Practice: ${repeatedMistake.correctedText}` : `Practice ${primarySkill} with short real-world prompts.` },
      { id: 'review', type: 'review', title: 'Smart review', skill: primarySkill, minutes: reviewMinutes, instruction: 'Recall the key phrases without looking, then use them in a new sentence.' }
    ]
  };
}
