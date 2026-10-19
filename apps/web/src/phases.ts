export const PHASES = {
  listen: { label: 'LISTEN', hint: 'The master is telling the story' },
  debate: { label: 'INTERACTION', hint: 'Talk it over, then answer' },
  answer: { label: 'ANSWER', hint: 'Say your answer out loud' },
  // TODO: [DEPRECATED] roll and break are no longer started from the console; remove with the roll and break session events once no client sends them
  roll: { label: 'ROLL', hint: 'Dice are rolling' },
  break: { label: 'BREAK', hint: 'Short break' },
} as const;

export type Phase = keyof typeof PHASES;

export const ROUND = ['listen', 'debate', 'answer'] as const satisfies readonly Phase[];
