import { describe, expect, it } from 'vitest';
import { groupByCategory, type MenuEntry } from '../src/ui/menu';

const entry = (id: string, category: string): MenuEntry => ({
  entry: { id, name: `Úroveň ${id.slice(-1)}`, file: `${id}.json`, category },
  result: { ok: false, error: 'x' },
});

describe('groupByCategory', () => {
  it('groups sets by theme, keeping the order of first appearance', () => {
    const groups = groupByCategory([entry('A1', 'Angličtina'), entry('Z1', 'Počítače'), entry('A2', 'Angličtina')]);
    expect(groups.map((g) => g.category)).toEqual(['Angličtina', 'Počítače']);
    expect(groups[0].entries.map((e) => e.entry.id)).toEqual(['A1', 'A2']);
    expect(groups[1].entries.map((e) => e.entry.id)).toEqual(['Z1']);
  });
  it('returns no groups for no sets', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
