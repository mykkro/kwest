import { describe, expect, it } from 'vitest';
import { discoveredQmarks } from '../src/ui/minimap';
import { LAYOUT, regionAt } from '../src/world/layout';

describe('discoveredQmarks', () => {
  const regionOf = (id: number) => regionAt(LAYOUT, LAYOUT.qmarks[id].x, LAYOUT.qmarks[id].y)!.id;

  it('shows nothing before any room is visited', () => {
    expect(discoveredQmarks(LAYOUT, new Set(), () => false)).toEqual([]);
  });
  it('shows unanswered marks in visited rooms only', () => {
    const room = regionOf(0);
    const shown = discoveredQmarks(LAYOUT, new Set([room]), () => false);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((q) => regionOf(q.id) === room)).toBe(true);
    expect(shown.map((q) => q.id)).toContain(0);
  });
  it('hides answered marks', () => {
    const shown = discoveredQmarks(LAYOUT, new Set([regionOf(0)]), (id) => id === 0);
    expect(shown.map((q) => q.id)).not.toContain(0);
  });
});
