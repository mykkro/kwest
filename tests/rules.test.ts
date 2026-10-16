import { describe, expect, it } from 'vitest';
import { Rules } from '../src/game/rules';
import { LAYOUT } from '../src/world/layout';

const silverIds = LAYOUT.qmarks.filter((q) => q.group === 'silver').map((q) => q.id);
const goldIds = LAYOUT.qmarks.filter((q) => q.group === 'gold').map((q) => q.id);

describe('Rules', () => {
  it('starts with nothing done', () => {
    const r = new Rules(LAYOUT.qmarks);
    expect(r.total).toBe(30);
    expect(r.doneCount).toBe(0);
    expect(r.remaining('silver')).toBe(18);
    expect(r.remaining('gold')).toBe(12);
  });
  it('completes the silver group on the 18th answer, wrong answers included', () => {
    const r = new Rules(LAYOUT.qmarks);
    silverIds.slice(0, 17).forEach((id, i) => {
      expect(r.markAnswered(id, i % 2 === 0)).toEqual([{ type: 'answered', qmarkId: id, correct: i % 2 === 0 }]);
    });
    expect(r.isGroupComplete('silver')).toBe(false);
    expect(r.markAnswered(silverIds[17], false)).toEqual([
      { type: 'answered', qmarkId: silverIds[17], correct: false },
      { type: 'groupComplete', group: 'silver' },
    ]);
    expect(r.remaining('silver')).toBe(0);
    expect(r.remaining('gold')).toBe(12);
  });
  it('completes the gold group independently', () => {
    const r = new Rules(LAYOUT.qmarks);
    const events = goldIds.flatMap((id) => r.markAnswered(id, true));
    expect(events.filter((e) => e.type === 'groupComplete')).toEqual([{ type: 'groupComplete', group: 'gold' }]);
  });
  it('ignores a second answer for the same question mark', () => {
    const r = new Rules(LAYOUT.qmarks);
    r.markAnswered(0, true);
    expect(r.markAnswered(0, false)).toEqual([]);
    expect(r.doneCount).toBe(1);
  });
  it('throws on unknown ids', () => {
    expect(() => new Rules(LAYOUT.qmarks).markAnswered(99, true)).toThrow();
  });
});
