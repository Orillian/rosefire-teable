import {
  selectFieldChoiceSchema,
  selectFieldOptionsSchema,
  selectFieldOptionsRoSchema,
} from './select-option.schema';

// P2: select-choice `color` became optional here (an omitted color renders
// the choice as plain text / "no color" - see packages/sdk/src/utils/select-color.ts).
// This is the schema consulted by options.schema.ts / field-unions.schema.ts for the
// single-select and multiple-select "vo" (full) field options.
describe('select-option.schema (optional color round-trip)', () => {
  it('accepts a choice with no color at all on the single-choice schema', () => {
    const result = selectFieldChoiceSchema.safeParse({ id: 'choA', name: 'Todo' });
    expect(result.success).toBe(true);
    result.success && expect(result.data).toEqual({ id: 'choA', name: 'Todo' });
    result.success && expect(result.data.color).toBeUndefined();
  });

  it('accepts a choice with an explicit color on the single-choice schema', () => {
    const result = selectFieldChoiceSchema.safeParse({
      id: 'choA',
      name: 'Todo',
      color: 'blueLight1',
    });
    expect(result.success).toBe(true);
    result.success && expect(result.data.color).toBe('blueLight1');
  });

  it('round-trips full (vo) options with a mix of colored and colorless choices', () => {
    const options = {
      choices: [
        { id: 'choA', name: 'Todo', color: 'blueLight1' },
        { id: 'choB', name: 'Done' },
      ],
    };

    const result = selectFieldOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
    result.success && expect(result.data).toEqual(options);
  });

  it('round-trips ro options with a colorless choice (id optional on ro)', () => {
    const options = {
      choices: [{ name: 'Todo' }],
    };

    const result = selectFieldOptionsRoSchema.safeParse(options);
    expect(result.success).toBe(true);
    result.success && expect(result.data).toEqual(options);
    result.success && expect(result.data.choices[0].color).toBeUndefined();
  });

  it('still fails full (vo) options when a choice is missing its id', () => {
    const result = selectFieldOptionsSchema.safeParse({
      choices: [{ name: 'Todo', color: 'blueLight1' }],
    });
    expect(result.success).toBe(false);
  });
});
