import { describe, expect, it } from 'vitest';
import {
  DOOR_WIDTH, FloorGrid, LAYOUT, allWalls, cellKey, chamferSegments, reachableCells, regionAt, rotate, wallSegments,
  type Door,
} from '../src/world/layout';
import { closestPointOnSegmentForTest } from './layoutHelpers';

const grid = new FloorGrid(LAYOUT);
const cellOf = (p: { x: number; y: number }) => cellKey(Math.floor(p.x), Math.floor(p.y));

describe('rotate', () => {
  it('turns counter-clockwise by quarter turns without -0', () => {
    expect(rotate({ x: 1, y: 0 }, 1)).toEqual({ x: 0, y: 1 });
    expect(rotate({ x: 3, y: 2 }, 2)).toEqual({ x: -3, y: -2 });
    expect(rotate({ x: 0, y: 5 }, 3)).toEqual({ x: 5, y: 0 });
  });
});

describe('LAYOUT contents', () => {
  it('has 18 silver and 12 gold question marks with index ids', () => {
    expect(LAYOUT.qmarks.filter((q) => q.group === 'silver')).toHaveLength(18);
    expect(LAYOUT.qmarks.filter((q) => q.group === 'gold')).toHaveLength(12);
    LAYOUT.qmarks.forEach((q, i) => expect(q.id).toBe(i));
    expect(LAYOUT.qmarks.slice(0, 18).every((q) => q.group === 'silver')).toBe(true);
  });
  it('has 33 grey, 4 silver and 4 gold doors with index ids', () => {
    const count = (k: Door['kind']) => LAYOUT.doors.filter((d) => d.kind === k).length;
    expect([count('grey'), count('silver'), count('gold')]).toEqual([33, 4, 4]);
    LAYOUT.doors.forEach((d, i) => expect(d.id).toBe(i));
  });
  it('places start, exit, question marks and torches on floor', () => {
    expect(grid.isFloor(Math.floor(LAYOUT.start.x), Math.floor(LAYOUT.start.y))).toBe(true);
    expect(grid.isFloor(Math.floor(LAYOUT.exit.x), Math.floor(LAYOUT.exit.y))).toBe(true);
    for (const q of LAYOUT.qmarks) expect(grid.isFloor(Math.floor(q.x), Math.floor(q.y)), `qmark ${q.id}`).toBe(true);
    for (const t of LAYOUT.torches) {
      expect(grid.isFloor(Math.floor(t.x + t.nx * 0.5), Math.floor(t.y + t.ny * 0.5))).toBe(true);
    }
  });
  it('keeps question marks at least 0.8 m from walls and torches within 0.25 m of a wall', () => {
    const walls = allWalls(LAYOUT, grid);
    const nearest = (x: number, y: number) =>
      Math.min(...walls.map((s) => { const c = closestPointOnSegmentForTest(x, y, s); return Math.hypot(x - c.x, y - c.y); }));
    for (const q of LAYOUT.qmarks) expect(nearest(q.x, q.y), `qmark ${q.id}`).toBeGreaterThanOrEqual(0.8);
    for (const t of LAYOUT.torches) expect(nearest(t.x, t.y)).toBeLessThanOrEqual(0.25);
  });
  it('puts every door on integer grid lines inside an opening that it seals', () => {
    const half = DOOR_WIDTH / 2;
    for (const d of LAYOUT.doors) {
      expect(Number.isInteger(d.x) && Number.isInteger(d.y), `door ${d.id}`).toBe(true);
      const spanCells: [number, number][] = [];
      for (let k = -half; k < half; k++) {
        if (d.axis === 'x') spanCells.push([d.x + k, d.y - 1], [d.x + k, d.y]);
        else spanCells.push([d.x - 1, d.y + k], [d.x, d.y + k]);
      }
      expect(spanCells.every(([cx, cy]) => grid.isFloor(cx, cy)), `door ${d.id} opening`).toBe(true);
      const sides: [number, number][][] =
        d.axis === 'x'
          ? [[[d.x - half - 1, d.y - 1], [d.x + half, d.y - 1]], [[d.x - half - 1, d.y], [d.x + half, d.y]]]
          : [[[d.x - 1, d.y - half - 1], [d.x - 1, d.y + half]], [[d.x, d.y - half - 1], [d.x, d.y + half]]];
      expect(sides.some((ends) => ends.every(([cx, cy]) => !grid.isFloor(cx, cy))), `door ${d.id} sealed`).toBe(true);
    }
  });
});

describe('walls', () => {
  it('every grid wall has floor in front and solid behind', () => {
    const walls = wallSegments(grid);
    expect(walls.length).toBeGreaterThan(50);
    for (const s of walls) {
      const mx = (s.ax + s.bx) / 2, my = (s.ay + s.by) / 2;
      expect(grid.isFloor(Math.floor(mx + s.nx * 0.5), Math.floor(my + s.ny * 0.5))).toBe(true);
      expect(grid.isFloor(Math.floor(mx - s.nx * 0.5), Math.floor(my - s.ny * 0.5))).toBe(false);
    }
  });
  it('chamfer normals point toward the exit', () => {
    const ch = chamferSegments(LAYOUT);
    expect(ch).toHaveLength(4);
    for (const s of ch) {
      const mx = (s.ax + s.bx) / 2, my = (s.ay + s.by) / 2;
      expect(s.nx * (LAYOUT.exit.x - mx) + s.ny * (LAYOUT.exit.y - my)).toBeGreaterThan(0);
      expect(Math.hypot(s.nx, s.ny)).toBeCloseTo(1);
    }
  });
});

describe('reachability', () => {
  const reach = (open: (d: Door) => boolean) => reachableCells(LAYOUT, grid, open);
  it('with all doors closed only the entrance before its door is reachable', () => {
    const cells = reach(() => false);
    expect(cells.size).toBe(5 * 4); // x -2..1, rows y -40..-36 (entrance floor south of the door at y=-35)
  });
  it('grey doors open: all silver reachable, no gold, no exit', () => {
    const cells = reach((d) => d.kind === 'grey');
    for (const q of LAYOUT.qmarks) expect(cells.has(cellOf(q)), `qmark ${q.id}`).toBe(q.group === 'silver');
    expect(cells.has(cellOf(LAYOUT.exit))).toBe(false);
  });
  it('silver open too: gold reachable, exit not', () => {
    const cells = reach((d) => d.kind !== 'gold');
    for (const q of LAYOUT.qmarks) expect(cells.has(cellOf(q))).toBe(true);
    expect(cells.has(cellOf(LAYOUT.exit))).toBe(false);
  });
  it('all open: exit reachable', () => {
    expect(reach(() => true).has(cellOf(LAYOUT.exit))).toBe(true);
  });
});

describe('regionAt', () => {
  it('finds regions by point', () => {
    expect(regionAt(LAYOUT, 0, 0)?.id).toBe('center');
    expect(regionAt(LAYOUT, 0, -38)?.id).toBe('entrance');
    expect(regionAt(LAYOUT, 28, 28)?.id).toBe('outer-corner-n');
    expect(regionAt(LAYOUT, 0, -28)?.id).toBe('outer-mid-s');
    expect(regionAt(LAYOUT, 22, 0)?.id).toBe('link-outer-e');
    expect(regionAt(LAYOUT, 22, 10)).toBeUndefined();
  });
});
