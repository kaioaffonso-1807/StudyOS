export type Skill = 'speaking' | 'listening' | 'grammar' | 'vocabulary' | 'pronunciation';

export type AdaptiveReview = {
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

export type AdaptiveInput = {
  level: string;
  goal?: string;
  dailyMinutes: number;
  scores: Record<Skill, number>;
  mistakes: Array<{ category: string; originalText?: string; correctedText?: string; count: number }>;
  interests?: string[];
  reviews?: AdaptiveReview[];
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

function reviewSkill(category: string): Skill {
  const value = category.toLowerCase();
  if (value.includes('pronunciation')) return 'pronunciation';
  if (value.includes('vocab')) return 'vocabulary';
  if (value.includes('listen')) return 'listening';
  if (value.includes('speak')) return 'speaking';
  return 'grammar';
}

export function buildAdaptiveLesson(input: AdaptiveInput) {
  const primarySkill = weakestSkill(input.scores);
  const repeatedMistake = topMistake(input.mistakes);
  const dueReviews = [...(input.reviews ?? [])].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 3);
  const topReview = dueReviews[0];
  const topic = input.interests?.[0] || (input.goal?.toLowerCase().includes('travel') ? 'travel' : 'daily life');
  const minutes = Math.max(5, Math.min(60, input.dailyMinutes));
  const speakingMinutes = Math.max(3, Math.round(minutes * 0.4));
  const reviewMinutes = Math.max(2, Math.round(minutes * 0.25));
  const reinforcementMinutes = Math.max(2, minutes - speakingMinutes - reviewMinutes);
  const reviewSkillTarget = topReview ? reviewSkill(topReview.category) : primarySkill;

  return {
    title: `Personal English · ${topic}`,
    level: input.level,
    minutes,
    primarySkill,
    focus: topReview
      ? `Review: ${topReview.category} · ${topReview.prompt}`
      : repeatedMistake
        ? `${repeatedMistake.category}: ${repeatedMistake.correctedText ?? repeatedMistake.originalText ?? 'recent mistake'}`
        : primarySkill,
    reason: topReview
      ? `You have ${dueReviews.length} review item(s) due. We start with the oldest one.`
      : repeatedMistake
        ? `You have repeated this ${repeatedMistake.category} pattern ${repeatedMistake.count} time(s).`
        : `${primarySkill} is currently your highest-priority skill gap.`,
    activities: [
      { id: 'warmup', type: 'conversation', title: `Warm-up: ${topic}`, skill: 'speaking', minutes: speakingMinutes, instruction: `Have a short ${input.level} conversation about ${topic}.` },
      { id: 'targeted-practice', type: 'targeted-practice', title: 'Fix your weak point', skill: primarySkill, minutes: reinforcementMinutes, instruction: repeatedMistake?.correctedText ? `Practice: ${repeatedMistake.correctedText}` : `Practice ${primarySkill} with short real-world prompts.` },
      {
        id: 'review',
        type: 'review',
        title: topReview ? `Smart review · ${topReview.category}` : 'Smart review',
        skill: reviewSkillTarget,
        minutes: reviewMinutes,
        reviewId: topReview?.id,
        instruction: topReview
          ? `Recall the correction for: "${topReview.prompt}"${topReview.correction ? ` Then produce the corrected version: "${topReview.correction}".` : ''}`
          : 'Recall the key phrases without looking, then use them in a new sentence.'
      }
    ]
  };
}
