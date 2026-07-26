import { err, ok } from 'neverthrow';
import type { Result } from 'neverthrow';
import { z } from 'zod';

import { domainError, type DomainError } from '../../../shared/DomainError';
import { ValueObject } from '../../../shared/ValueObject';
import { FieldColor, type FieldColorValue } from './FieldColor';
import { SelectOptionId } from './SelectOptionId';
import { SelectOptionName } from './SelectOptionName';

const selectOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  // An explicitly omitted color is the "no color" choice (plain-text rendering) — it
  // must never be backfilled here. Kept in sync with the v1 equivalents:
  // packages/core/src/models/field/derivate/abstract/select-option.schema.ts and
  // .../select.field.abstract.ts, and apps/nestjs-backend's prepareSelectOptions().
  color: z.string().optional(),
});

export class SelectOption extends ValueObject {
  private constructor(
    private readonly idValue: SelectOptionId,
    private readonly nameValue: SelectOptionName,
    private readonly colorValue: FieldColor | undefined
  ) {
    super();
  }

  static create(raw: unknown): Result<SelectOption, DomainError> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const option = raw as { id?: unknown; name?: unknown; color?: unknown };
      if (
        (option.id === undefined || typeof option.id === 'string') &&
        typeof option.name === 'string' &&
        (option.color === undefined || option.color === null || typeof option.color === 'string')
      ) {
        return SelectOptionName.create(option.name).andThen((name) => {
          const idResult = option.id ? SelectOptionId.create(option.id) : SelectOptionId.generate();
          return idResult.andThen((id) => {
            if (option.color == null) {
              return ok(new SelectOption(id, name, undefined));
            }
            return FieldColor.create(option.color).map(
              (color) => new SelectOption(id, name, color)
            );
          });
        });
      }
    }

    const parsed = selectOptionSchema.safeParse(raw);
    if (!parsed.success) return err(domainError.validation({ message: 'Invalid SelectOption' }));

    return SelectOptionName.create(parsed.data.name).andThen((name) => {
      const idResult = parsed.data.id
        ? SelectOptionId.create(parsed.data.id)
        : SelectOptionId.generate();
      return idResult.andThen((id) => {
        if (parsed.data.color == null) {
          return ok(new SelectOption(id, name, undefined));
        }
        return FieldColor.create(parsed.data.color).map(
          (color) => new SelectOption(id, name, color)
        );
      });
    });
  }

  equals(other: SelectOption): boolean {
    const colorsEqual =
      this.colorValue === undefined || other.colorValue === undefined
        ? this.colorValue === other.colorValue
        : this.colorValue.equals(other.colorValue);
    return (
      this.idValue.equals(other.idValue) && this.nameValue.equals(other.nameValue) && colorsEqual
    );
  }

  id(): SelectOptionId {
    return this.idValue;
  }

  name(): SelectOptionName {
    return this.nameValue;
  }

  color(): FieldColor | undefined {
    return this.colorValue;
  }

  toDto(): { id: string; name: string; color?: FieldColorValue } {
    return {
      id: this.idValue.toString(),
      name: this.nameValue.toString(),
      ...(this.colorValue ? { color: this.colorValue.toString() } : {}),
    };
  }
}
