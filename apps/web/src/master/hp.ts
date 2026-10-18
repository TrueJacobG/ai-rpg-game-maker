import type { Character } from '@ai-rpg/core/character';

export const withHp = (character: Character, change: number): Character => ({
  ...character,
  hp: {
    ...character.hp,
    current: Math.min(character.hp.max, Math.max(0, character.hp.current + change)),
  },
});
