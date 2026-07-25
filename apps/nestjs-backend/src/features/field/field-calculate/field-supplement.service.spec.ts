import { FieldType } from '@teable/core';
import type { IFieldRo } from '@teable/core';
import { FieldSupplementService } from './field-supplement.service';

// P2: an explicitly omitted select-choice color is the "no color" choice
// (plain-text rendering). prepareSelectOptions must preserve that absence
// rather than backfilling a random color, otherwise the "no color" picker
// selection would never persist end-to-end. See the comment above
// prepareSelectOptions in field-supplement.service.ts.
//
// prepareSingleSelectField/prepareMultipleSelectField/prepareSelectOptions are
// synchronous, pure transformations that touch none of the service's injected
// dependencies (PrismaService, FieldService, etc.), so we can exercise them
// directly on a prototype instance without going through Nest's DI - the same
// pattern used in field.service.spec.ts for FieldService#getDbTableName.
describe('FieldSupplementService - prepareSelectOptions (no-color preservation)', () => {
  const service = Object.create(FieldSupplementService.prototype) as FieldSupplementService & {
    prepareSingleSelectField: (field: IFieldRo) => {
      options: { choices: Array<{ id: string; name: string; color?: string }> };
    };
    prepareMultipleSelectField: (field: IFieldRo) => {
      options: { choices: Array<{ id: string; name: string; color?: string }> };
    };
  };

  it('preserves an absent color on a single-select choice instead of backfilling one', () => {
    const field = {
      type: FieldType.SingleSelect,
      name: 'Status',
      options: {
        choices: [
          { id: 'choA', name: 'Todo' },
          { id: 'choB', name: 'Done', color: 'blueLight1' },
        ],
      },
    } as IFieldRo;

    const result = service.prepareSingleSelectField(field);
    const todo = result.options.choices.find((c) => c.id === 'choA');
    const done = result.options.choices.find((c) => c.id === 'choB');

    expect(todo?.color).toBeUndefined();
    expect(done?.color).toBe('blueLight1');
  });

  it('preserves an absent color on a multiple-select choice while still generating a missing id', () => {
    const field = {
      type: FieldType.MultipleSelect,
      options: { choices: [{ name: 'Tag1' }] },
    } as IFieldRo;

    const result = service.prepareMultipleSelectField(field);
    const [choice] = result.options.choices;

    expect(choice.id).toBeTruthy();
    expect(choice.color).toBeUndefined();
  });

  it('rejects duplicate choice names regardless of color presence', () => {
    const field = {
      type: FieldType.SingleSelect,
      options: {
        choices: [
          { id: 'choA', name: 'Dup' },
          { id: 'choB', name: 'Dup', color: 'blueLight1' },
        ],
      },
    } as IFieldRo;

    expect(() => service.prepareSingleSelectField(field)).toThrow();
  });
});
