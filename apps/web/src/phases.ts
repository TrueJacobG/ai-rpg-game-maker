export const PHASES = {
  listen: { label: 'LISTEN', icon: '👂', hint: 'The master is telling the story' },
  debate: { label: 'DEBATE', icon: '💬', hint: 'Discuss it among yourselves' },
  answer: { label: 'ANSWER', icon: '🎙️', hint: 'Say your answer out loud' },
  roll: { label: 'ROLL', icon: '🎲', hint: 'Dice are rolling' },
  break: { label: 'BREAK', icon: '☕', hint: 'Short break' },
} as const;

export type Phase = keyof typeof PHASES;
