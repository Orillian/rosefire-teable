import { FieldType } from '@teable/core';
import type * as SdkHooks from '@teable/sdk/hooks';
import { fireEvent } from '@testing-library/react';
import { render, screen, userEvent, within } from '@/test-utils';
import { KanbanStackHeader } from './KanbanStackHeader';

vi.mock('@teable/sdk/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof SdkHooks>();
  return {
    ...actual,
    useTableId: () => 'tblTest0000000001',
    useViewId: () => 'viwTest0000000001',
  };
});

const convert = vi.fn();

const choices = [
  { id: 'choAAA', name: 'Todo', color: 'blueLight1' },
  { id: 'choBBB', name: 'Done', color: 'greenBright' },
];

vi.mock('../hooks', () => ({
  useKanban: () => ({
    stackField: {
      type: FieldType.SingleSelect,
      isLookup: false,
      options: { choices },
      convert,
    },
    permission: {
      stackCreatable: true,
      stackEditable: true,
      stackDeletable: true,
      stackDraggable: true,
      cardCreatable: true,
      cardEditable: true,
      cardDeletable: true,
      cardDraggable: true,
      cardCommentCreatable: true,
    },
  }),
}));

describe('KanbanStackHeader stack color persistence', () => {
  beforeEach(() => {
    convert.mockClear();
  });

  it('saves a color-only edit even when the stack name is left untouched', async () => {
    const setEditMode = vi.fn();
    render(
      <KanbanStackHeader stack={{ id: 'stk1', data: 'Todo', count: 0 }} setEditMode={setEditMode} />
    );

    // enter rename mode (the title click path calls onStackRename)
    await userEvent.click(screen.getByText('Todo'));

    // pick the "no color" swatch without touching the name input
    const swatchTrigger = screen
      .getAllByRole('button')
      .find((btn) => btn.className.includes('rounded-full') && btn.className.includes('border-2'));
    expect(swatchTrigger).toBeDefined();
    await userEvent.click(swatchTrigger!);

    const popover = screen.getByRole('dialog');
    const noColorSwatch = within(popover).getAllByRole('button')[0];
    await userEvent.click(noColorSwatch);

    // commit via Enter on the name input, exactly like the reported flow: color
    // changed, text never touched
    const nameInput = screen.getByDisplayValue('Todo');
    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter' });

    expect(convert).toHaveBeenCalledTimes(1);
    const payload = convert.mock.calls[0][0];
    const savedChoices = payload.options.choices as Array<{
      id: string;
      name: string;
      color?: string;
    }>;
    const todoChoice = savedChoices.find((c) => c.id === 'choAAA');

    // the removal must survive JSON transport: no "color" key at all
    expect(JSON.parse(JSON.stringify(todoChoice))).toEqual({ id: 'choAAA', name: 'Todo' });
  });
});
