import { z } from '../../../../zod';

// Select field options (for single and multiple select)
export const selectFieldChoiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Optional: an omitted color renders the choice as plain text ("no color"),
  // additive change — all pre-existing choices already carry a color and are
  // unaffected. See packages/sdk/src/utils/select-color.ts.
  color: z.string().optional(),
});

export const selectFieldChoiceRoSchema = selectFieldChoiceSchema.partial({ id: true });

export type ISelectFieldChoice = z.infer<typeof selectFieldChoiceSchema>;

export const selectFieldOptionsSchema = z.object({
  choices: z.array(selectFieldChoiceSchema),
  defaultValue: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .nullable(),
  preventAutoNewOptions: z.boolean().optional(),
});

export const selectFieldOptionsRoSchema = z.object({
  choices: z.array(selectFieldChoiceRoSchema),
  // null is used to explicitly clear the default value (since undefined is stripped during JSON serialization)
  defaultValue: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .nullable(),
  preventAutoNewOptions: z.boolean().optional(),
});

export type ISelectFieldOptions = z.infer<typeof selectFieldOptionsSchema>;
export type ISelectFieldOptionsRo = z.infer<typeof selectFieldOptionsRoSchema>;
