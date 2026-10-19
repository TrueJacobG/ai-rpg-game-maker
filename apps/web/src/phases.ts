export const PHASES = {
  listen: { label: 'LISTEN', hint: 'The master is telling the story' },
  debate: { label: 'DEBATE', hint: 'Discuss it among yourselves' },
  answer: { label: 'ANSWER', hint: 'Say your answer out loud' },
  roll: { label: 'ROLL', hint: 'Dice are rolling' },
  break: { label: 'BREAK', hint: 'Short break' },
} as const;

export type Phase = keyof typeof PHASES;
