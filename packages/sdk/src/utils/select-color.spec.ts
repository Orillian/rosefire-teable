import { Colors } from '@teable/core';
import { getDisplayChoiceMap, getSelectColorPairs } from './select-color';

// P2: an omitted select-choice color renders the choice as plain text ("no
// color") - getSelectColorPairs/getDisplayChoiceMap must resolve that to a
// neutral pair (no pill background), not fall back to a random/default color.
describe('getSelectColorPairs', () => {
  it('returns a neutral (undefined) pair when color is undefined', () => {
    expect(getSelectColorPairs(undefined)).toEqual({
      color: undefined,
      backgroundColor: undefined,
    });
  });

  it('returns a neutral (undefined) pair when color is undefined regardless of theme', () => {
    expect(getSelectColorPairs(undefined, 'dark')).toEqual({
      color: undefined,
      backgroundColor: undefined,
    });
  });

  it('resolves a real color pair for a known light-theme color', () => {
    const pair = getSelectColorPairs(Colors.Blue, 'light');
    expect(pair.color).toBeDefined();
    expect(pair.backgroundColor).toBeDefined();
  });

  it('resolves a real color pair for a known dark-theme color', () => {
    const pair = getSelectColorPairs(Colors.Blue, 'dark');
    expect(pair.color).toBeDefined();
    expect(pair.backgroundColor).toBeDefined();
  });
});

describe('getDisplayChoiceMap', () => {
  it('keeps a colorless choice unresolved (no pill background) alongside a colored one', () => {
    const map = getDisplayChoiceMap([
      { id: 'choA', name: 'Todo', color: Colors.Blue },
      { id: 'choB', name: 'Done' },
    ]);

    expect(map['Todo']).toMatchObject({ id: 'choA', name: 'Todo' });
    expect(map['Todo'].color).toBeDefined();
    expect(map['Todo'].backgroundColor).toBeDefined();

    expect(map['Done']).toEqual({
      id: 'choB',
      name: 'Done',
      color: undefined,
      backgroundColor: undefined,
    });
  });
});
