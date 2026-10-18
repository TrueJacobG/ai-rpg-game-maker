import { describe, expect, it } from 'vitest';
import { buildDecisionEvent, DECISION_TEMPLATES, slotKey } from './decision';

describe('slotKey', () => {
  it.each([
    ['Who', 'who'],
    ['How much', 'how_much'],
    ['  Where  ', 'where'],
    ['Gdzie?', 'gdzie'],
    ['Łódź', 'lodz'],
    ['Żółć', 'zolc'],
    ['Plan B', 'plan_b'],
    ['2nd plan', 'slot_2nd_plan'],
  ])('turns %j into %j', (label, expected) => {
    expect(slotKey(label)).toBe(expected);
  });

  it.each(['', '   ', '123', '!!!'])('finds no key in %j', (label) => {
    expect(slotKey(label)).toBeNull();
  });
});

describe('buildDecisionEvent', () => {
  it('builds a start_decision event from a prompt and comma separated slots', () => {
    const result = buildDecisionEvent('How do you escape?', 'Who, Where, How much', 'd1');
    expect(result).toEqual({
      status: 'success',
      data: {
        type: 'start_decision',
        decision: {
          id: 'd1',
          prompt: 'How do you escape?',
          slots: [
            { key: 'who', label: 'Who' },
            { key: 'where', label: 'Where' },
            { key: 'how_much', label: 'How much' },
          ],
        },
      },
    });
  });

  it('ignores empty entries between commas', () => {
    const result = buildDecisionEvent('Q?', 'Who,, Where ,', 'd1');
    expect(result).toMatchObject({
      status: 'success',
      data: { decision: { slots: [{ key: 'who' }, { key: 'where' }] } },
    });
  });

  it.each([
    ['an empty prompt', '', 'Who', 'Write the question'],
    ['a blank prompt', '   ', 'Who', 'Write the question'],
    ['no slots', 'Q?', '', 'Add at least one slot'],
    ['only separators', 'Q?', ' , ,', 'Add at least one slot'],
    ['a slot without letters', 'Q?', 'Who, 123', 'Slot names need letters'],
    ['duplicate slots', 'Q?', 'Who, who', 'Slot names must be different'],
    ['more than ten slots', 'Q?', 'a,b,c,d,e,f,g,h,i,j,k', 'Use at most 10 slots'],
    ['a prompt over 500 characters', 'x'.repeat(501), 'Who', 'Question is too long'],
  ])('rejects %s', (_label, prompt, slots, message) => {
    expect(buildDecisionEvent(prompt, slots, 'd1')).toEqual({ status: 'error', error: message });
  });
});

describe('DECISION_TEMPLATES', () => {
  it.each(DECISION_TEMPLATES)('$name builds a valid decision', (template) => {
    expect(buildDecisionEvent(template.prompt, template.slots, 'd1').status).toBe('success');
  });
});
