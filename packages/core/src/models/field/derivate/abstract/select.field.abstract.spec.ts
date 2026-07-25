import { Colors } from '../../colors';
import { selectFieldOptionsRoSchema, selectFieldOptionsSchema } from './select.field.abstract';

describe('select field schema test', () => {
  it('should return true when ro options validate', () => {
    const options = {
      choices: [{ name: 'name' }],
    };

    const result = selectFieldOptionsRoSchema.safeParse(options);
    expect(result.success).toBe(true);
    result.success && expect(result.data).toEqual(options);
  });

  it('should return false when ro options invalidate', () => {
    expect(
      selectFieldOptionsRoSchema.safeParse({
        choices: [{ name: '' }],
      }).success
    ).toBe(false);

    expect(
      selectFieldOptionsRoSchema.safeParse({
        choices: [{ id: 'cho' }],
      }).success
    ).toBe(false);

    expect(
      selectFieldOptionsRoSchema.safeParse({
        choices: [{ name: 'name', color: '#000000' }],
      }).success
    ).toBe(false);
  });

  it('should return false when vo options invalidate', () => {
    const options = {
      choices: [{ name: 'name' }],
    };

    const result = selectFieldOptionsSchema.safeParse(options);
    expect(result.success).toBe(false);
  });

  // P2: color became optional on both the ro and vo (full) schemas here - an
  // omitted color renders the choice as plain text ("no color").
  it('should return true when ro options validate with an explicit valid color', () => {
    const options = {
      choices: [{ name: 'name', color: Colors.Blue }],
    };

    const result = selectFieldOptionsRoSchema.safeParse(options);
    expect(result.success).toBe(true);
    result.success && expect(result.data).toEqual(options);
  });

  it('should return true when vo options validate with an id and no color', () => {
    const options = {
      choices: [{ id: 'cho1', name: 'name' }],
    };

    const result = selectFieldOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
    result.success && expect(result.data).toEqual(options);
    result.success && expect(result.data.choices[0].color).toBeUndefined();
  });

  it('should return true when vo options validate with an id and a valid color', () => {
    const options = {
      choices: [{ id: 'cho1', name: 'name', color: Colors.Blue }],
    };

    const result = selectFieldOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
    result.success && expect(result.data).toEqual(options);
  });
});
