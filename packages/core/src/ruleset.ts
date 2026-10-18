import { z } from 'zod';
import { failure, type Result, success } from './result';

const key = z.string().regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, digits and underscores');
const label = z.string().min(1);

const attributeSchema = z.strictObject({ key, label });
const skillSchema = z.strictObject({ key, label, attribute: key });
const difficultySchema = z.strictObject({ key, label, target: z.number().int().min(1) });

export type RulesetIssue = { path: string; message: string };

const addDuplicateKeyIssues = (
  entries: readonly { key: string }[],
  listName: string,
  ctx: z.RefinementCtx,
) => {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.key)) {
      ctx.addIssue({
        code: 'custom',
        path: [listName, index, 'key'],
        message: `Duplicate key "${entry.key}"`,
      });
    }
    seen.add(entry.key);
  });
};

const rulesetSchema = z
  .strictObject({
    attributes: z.array(attributeSchema).min(1),
    skills: z.array(skillSchema),
    difficulties: z.array(difficultySchema).min(1),
  })
  .superRefine((ruleset, ctx) => {
    addDuplicateKeyIssues(ruleset.attributes, 'attributes', ctx);
    addDuplicateKeyIssues(ruleset.skills, 'skills', ctx);
    addDuplicateKeyIssues(ruleset.difficulties, 'difficulties', ctx);

    const attributeKeys = new Set(ruleset.attributes.map((attribute) => attribute.key));
    ruleset.skills.forEach((skill, index) => {
      if (attributeKeys.has(skill.attribute)) return;
      ctx.addIssue({
        code: 'custom',
        path: ['skills', index, 'attribute'],
        message: `Unknown attribute "${skill.attribute}"`,
      });
    });
  });

export type Ruleset = z.infer<typeof rulesetSchema>;

export const parseRuleset = (input: unknown): Result<Ruleset, RulesetIssue[]> => {
  const parsed = rulesetSchema.safeParse(input);
  if (parsed.success) return success(parsed.data);
  return failure(
    parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
};
