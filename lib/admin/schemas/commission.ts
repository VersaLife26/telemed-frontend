import { z } from "zod";

/**
 * Schema for the commission rule set stored at
 * `system_configs` key `commission_rules`.
 *
 * The V2 docs give the shape as `{specialty: "GP", commission: 20}`. This
 * schema keeps that and adds the guards a finance admin editing raw JSON
 * actually needs:
 *
 *  - **A 0-100 range on the percentage.** Not a formality: a stray decimal
 *    turning 20 into 200 would make every payout negative.
 *  - **No duplicate specialties.** A duplicate key in this list is silently
 *    resolved by whichever rule the backend happens to read first, which means
 *    the rule an admin edited may not be the rule that applies.
 *  - **Integer cents for the bounds**, because money is never a float
 *    (AGENT-BRIEF section 3).
 */

export const commissionRuleSchema = z.object({
  specialty: z
    .string()
    .min(1, "specialty is required")
    .max(64, "specialty must be 64 characters or fewer"),
  commission_percent: z
    .number()
    .min(0, "commission_percent cannot be negative")
    .max(100, "commission_percent cannot exceed 100"),
  min_commission_cents: z
    .number()
    .int("min_commission_cents must be whole cents")
    .min(0)
    .optional(),
  max_commission_cents: z
    .number()
    .int("max_commission_cents must be whole cents")
    .min(0)
    .optional(),
});

export const commissionRuleSetSchema = z
  .object({
    default_commission_percent: z
      .number()
      .min(0, "default_commission_percent cannot be negative")
      .max(100, "default_commission_percent cannot exceed 100"),
    rules: z.array(commissionRuleSchema),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.rules.forEach((rule, index) => {
      const key = rule.specialty.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", index, "specialty"],
          message: `duplicate rule for "${rule.specialty}" - only one of them would ever apply`,
        });
      }
      seen.add(key);

      if (
        rule.min_commission_cents !== undefined &&
        rule.max_commission_cents !== undefined &&
        rule.min_commission_cents > rule.max_commission_cents
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", index, "min_commission_cents"],
          message: "min_commission_cents is greater than max_commission_cents",
        });
      }
    });
  });

export type ParsedCommissionRuleSet = z.infer<typeof commissionRuleSetSchema>;

export interface JsonProblem {
  path: string;
  message: string;
}

/** Parses and validates, returning problems rather than throwing. */
export function parseCommissionRules(
  raw: string,
): { ok: true; value: ParsedCommissionRuleSet } | { ok: false; problems: JsonProblem[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    return {
      ok: false,
      problems: [
        {
          path: "(document)",
          message: cause instanceof Error ? cause.message : "not valid JSON",
        },
      ],
    };
  }

  const result = commissionRuleSetSchema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };

  return {
    ok: false,
    problems: result.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  };
}

/** Canonical formatting, so a diff shows real edits and not whitespace churn. */
export function formatCommissionRules(value: ParsedCommissionRuleSet): string {
  const ordered = {
    default_commission_percent: value.default_commission_percent,
    rules: [...value.rules]
      .sort((a, b) => a.specialty.localeCompare(b.specialty))
      .map((rule) => ({
        specialty: rule.specialty,
        commission_percent: rule.commission_percent,
        ...(rule.min_commission_cents !== undefined
          ? { min_commission_cents: rule.min_commission_cents }
          : {}),
        ...(rule.max_commission_cents !== undefined
          ? { max_commission_cents: rule.max_commission_cents }
          : {}),
      })),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
