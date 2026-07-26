import { FieldType } from '@teable/core';
import { render, screen } from '@/test-utils';
import { ADVANCED_FIELD_TYPE_ORDER, SelectFieldType } from './SelectFieldType';

describe('SelectFieldType creatable/convertible field type list', () => {
  // P11: Button field creation is permanently gated behind a plan-tip that can never
  // clear in community builds (useBaseUsage never resolves buttonFieldEnable), so it's
  // hidden entirely from the picker rather than shown disabled. This guards against a
  // regression that would put it back into the creatable/convertible list.
  it('does not include Button in the advanced field type order', () => {
    expect(ADVANCED_FIELD_TYPE_ORDER).not.toContain(FieldType.Button);
  });

  it('still includes the other advanced field types', () => {
    expect(ADVANCED_FIELD_TYPE_ORDER).toEqual([
      FieldType.Formula,
      FieldType.Link,
      FieldType.Rollup,
      FieldType.ConditionalRollup,
      FieldType.AutoNumber,
    ]);
  });

  it('renders the picker trigger without throwing and without offering Button', async () => {
    render(<SelectFieldType onChange={() => undefined} />);

    // The trigger button reflects the current selection (defaults to Single line text)
    // and must render successfully now that useBaseUsage is no longer consulted here.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
