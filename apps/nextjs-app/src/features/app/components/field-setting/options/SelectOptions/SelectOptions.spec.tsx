import type { ISelectFieldOptions } from '@teable/core';
import { Colors } from '@teable/core';
import { render, screen, userEvent, within } from '@/test-utils';
import { SelectOptions } from './SelectOptions';

// react-virtuoso does not render virtualized rows in jsdom (it needs real layout
// measurements), so tests can never reach the ChoiceItem rows. Replace it with a
// simple synchronous list so the real ChoiceItem/ColorPicker wiring can be
// exercised end-to-end.
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    totalCount,
    itemContent,
  }: {
    totalCount: number;
    itemContent: (index: number) => React.ReactNode;
  }) => (
    <div data-testid="virtuoso-mock">
      {Array.from({ length: totalCount }, (_, index) => (
        <div key={index}>{itemContent(index)}</div>
      ))}
    </div>
  ),
}));

describe('SelectOptions no-color persistence', () => {
  it('emits choices with the color key removed after picking the no-color swatch', async () => {
    const onChange = vi.fn();
    const options: Partial<ISelectFieldOptions> = {
      choices: [
        { id: 'choAAA', name: 'Todo', color: Colors.BlueLight1 },
        { id: 'choBBB', name: 'Done', color: Colors.GreenBright },
      ],
    };

    render(<SelectOptions isMultiple={false} options={options} onChange={onChange} />);

    // open the first choice's color popover
    const colorSwatchTriggers = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('rounded-full'));
    expect(colorSwatchTriggers.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(colorSwatchTriggers[0]);

    // the no-color swatch is the first button rendered inside the popover content
    const popover = screen.getByRole('dialog');
    const noColorSwatch = within(popover).getAllByRole('button')[0];
    await userEvent.click(noColorSwatch);

    expect(onChange).toHaveBeenCalled();
    const lastCallArg = onChange.mock.calls.at(-1)?.[0] as Partial<ISelectFieldOptions>;
    const updatedChoice = lastCallArg.choices?.find((c) => c.id === 'choAAA');
    const untouchedChoice = lastCallArg.choices?.find((c) => c.id === 'choBBB');

    // the removal must survive JSON transport: no "color" key at all, not just
    // an explicit `color: undefined` that a naive dirty-check could miss.
    expect(JSON.parse(JSON.stringify(updatedChoice))).toEqual({ id: 'choAAA', name: 'Todo' });
    // the other choice's color must be left alone
    expect(untouchedChoice?.color).toBe(Colors.GreenBright);
  });
});
