export interface Vec2 { x: number; y: number }
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export type Group = 'silver' | 'gold';
export type DoorKind = 'grey' | Group;
export interface Region { id: string; rect: Rect }
export interface Door { id: number; kind: DoorKind; x: number; y: number; axis: 'x' | 'y' }
export interface QMarkSpot { id: number; group: Group; x: number; y: number }
export interface Torch { x: number; y: number; nx: number; ny: number }
export interface Chamfer { a: Vec2; b: Vec2 }
export interface Segment { ax: number; ay: number; bx: number; by: number }
export interface WallSegment extends Segment { nx: number; ny: number }
export interface Layout {
  regions: Region[];
  doors: Door[];
  qmarks: QMarkSpot[];
  torches: Torch[];
  chamfers: Chamfer[];
  start: Vec2;
  startHeading: number;
  exit: Vec2;
  bounds: Rect;
}

export const WALL_HEIGHT = 4.5;
export const DOOR_WIDTH = 4;

export function rotate(p: Vec2, quarterTurns: number): Vec2 {
  let { x, y } = p;
  const n = ((quarterTurns % 4) + 4) % 4;
  for (let i = 0; i < n; i++) [x, y] = [-y, x];
  return { x: x + 0, y: y + 0 }; // "+ 0" turns -0 into 0
}

export function rotateRect(r: Rect, quarterTurns: number): Rect {
  const a = rotate({ x: r.x0, y: r.y0 }, quarterTurns);
  const b = rotate({ x: r.x1, y: r.y1 }, quarterTurns);
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

const SIDES = ['n', 'w', 's', 'e'] as const; // quarter turns 0..3, counter-clockwise from north

export function buildLayout(): Layout {
  const regions: Region[] = [];
  const doors: Omit<Door, 'id'>[] = [];
  const silver: Vec2[] = [];
  const gold: Vec2[] = [];
  const torches: Torch[] = [];
  const chamfers: Chamfer[] = [];

  for (let q = 0; q < 4; q++) {
    const s = SIDES[q];
    const R = (x0: number, y0: number, x1: number, y1: number) => rotateRect({ x0, y0, x1, y1 }, q);
    const P = (x: number, y: number) => rotate({ x, y }, q);
    const door = (kind: DoorKind, x: number, y: number, axis: 'x' | 'y') => {
      const p = P(x, y);
      const rotated: 'x' | 'y' = q % 2 === 0 ? axis : axis === 'x' ? 'y' : 'x';
      doors.push({ kind, x: p.x, y: p.y, axis: rotated });
    };
    const torch = (x: number, y: number, nx: number, ny: number) => {
      const p = P(x, y);
      const n = rotate({ x: nx, y: ny }, q);
      torches.push({ x: p.x, y: p.y, nx: n.x, ny: n.y });
    };

    regions.push(
      { id: `outer-corner-${s}`, rect: R(23, 23, 33, 33) },
      { id: `outer-mid-${s}`, rect: R(-5, 23, 5, 33) },
      { id: `outer-corr-${s}-a`, rect: R(5, 26, 23, 30) },
      { id: `outer-corr-${s}-b`, rect: R(-23, 26, -5, 30) },
      { id: `link-outer-${s}`, rect: R(-2, 20, 2, 23) },
      { id: `inner-corner-${s}`, rect: R(12, 12, 20, 20) },
      { id: `inner-mid-${s}`, rect: R(-4, 12, 4, 20) },
      { id: `inner-corr-${s}-a`, rect: R(4, 14, 12, 18) },
      { id: `inner-corr-${s}-b`, rect: R(-12, 14, -4, 18) },
      { id: `link-inner-${s}`, rect: R(-2, 8, 2, 12) },
    );

    for (const x of [5, 23, -5, -23]) door('grey', x, 28, 'y');
    for (const x of [4, 12, -4, -12]) door('grey', x, 16, 'y');
    door('silver', 0, 21, 'x');
    door('gold', 0, 10, 'x');

    silver.push(P(28, 28));
    const mid: [number, number][] = q === 2 ? [[-3, 31], [3, 31]] : [[-3, 31], [3, 31], [-3, 25], [3, 25]];
    for (const [x, y] of mid) silver.push(P(x, y));
    gold.push(P(16, 16), P(-3, 19), P(3, 19));

    torch(28, 32.8, 0, -1);
    torch(32.8, 28, -1, 0);
    torch(-3, 32.8, 0, -1);
    torch(3, 32.8, 0, -1);
    torch(14, 29.8, 0, -1);
    torch(-14, 29.8, 0, -1);
    torch(16, 19.8, 0, -1);
    torch(8, 17.8, 0, -1);
    torch(-8, 17.8, 0, -1);
    torch(5.86, 5.86, -Math.SQRT1_2, -Math.SQRT1_2);

    chamfers.push({ a: P(4, 8), b: P(8, 4) });
  }

  regions.push({ id: 'center', rect: { x0: -8, y0: -8, x1: 8, y1: 8 } });
  regions.push({ id: 'entrance', rect: { x0: -2, y0: -40, x1: 2, y1: -33 } });
  doors.push({ kind: 'grey', x: 0, y: -35, axis: 'x' });
  torches.push({ x: 1.8, y: -37, nx: -1, ny: 0 });

  const bounds = regions.reduce(
    (b, { rect: r }) => ({
      x0: Math.min(b.x0, r.x0), y0: Math.min(b.y0, r.y0), x1: Math.max(b.x1, r.x1), y1: Math.max(b.y1, r.y1),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  );

  return {
    regions,
    doors: doors.map((d, id) => ({ id, ...d })),
    qmarks: [
      ...silver.map((p, i) => ({ id: i, group: 'silver' as const, ...p })),
      ...gold.map((p, i) => ({ id: silver.length + i, group: 'gold' as const, ...p })),
    ],
    torches,
    chamfers,
    start: { x: 0, y: -38.5 },
    startHeading: Math.PI / 2,
    exit: { x: 0, y: 0 },
    bounds,
  };
}

export const LAYOUT: Layout = buildLayout();

export class FloorGrid {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
  private readonly cells: Uint8Array;

  constructor(layout: Layout) {
    const b = layout.bounds;
    this.minX = b.x0;
    this.minY = b.y0;
    this.width = b.x1 - b.x0;
    this.height = b.y1 - b.y0;
    this.cells = new Uint8Array(this.width * this.height);
    for (const { rect } of layout.regions) {
      for (let y = rect.y0; y < rect.y1; y++) {
        for (let x = rect.x0; x < rect.x1; x++) this.cells[(y - this.minY) * this.width + (x - this.minX)] = 1;
      }
    }
  }

  isFloor(cx: number, cy: number): boolean {
    const ix = cx - this.minX, iy = cy - this.minY;
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return false;
    return this.cells[iy * this.width + ix] === 1;
  }
}

/** Walls along grid edges between floor and solid cells, merged into maximal straight runs. */
export function wallSegments(grid: FloorGrid): WallSegment[] {
  const out: WallSegment[] = [];
  const { minX, minY, width, height } = grid;
  for (let gy = minY; gy <= minY + height; gy++) {
    let run: WallSegment | null = null;
    for (let cx = minX; cx < minX + width; cx++) {
      const south = grid.isFloor(cx, gy - 1), north = grid.isFloor(cx, gy);
      const ny = south && !north ? -1 : north && !south ? 1 : 0;
      if (ny !== 0 && run && run.ny === ny && run.bx === cx) run.bx = cx + 1;
      else {
        if (run) out.push(run);
        run = ny !== 0 ? { ax: cx, ay: gy, bx: cx + 1, by: gy, nx: 0, ny } : null;
      }
    }
    if (run) out.push(run);
  }
  for (let gx = minX; gx <= minX + width; gx++) {
    let run: WallSegment | null = null;
    for (let cy = minY; cy < minY + height; cy++) {
      const west = grid.isFloor(gx - 1, cy), east = grid.isFloor(gx, cy);
      const nx = west && !east ? -1 : east && !west ? 1 : 0;
      if (nx !== 0 && run && run.nx === nx && run.by === cy) run.by = cy + 1;
      else {
        if (run) out.push(run);
        run = nx !== 0 ? { ax: gx, ay: cy, bx: gx, by: cy + 1, nx, ny: 0 } : null;
      }
    }
    if (run) out.push(run);
  }
  return out;
}

export function chamferSegments(layout: Layout): WallSegment[] {
  return layout.chamfers.map(({ a, b }) => {
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.hypot(nx, ny);
    nx /= len;
    ny /= len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (nx * (layout.exit.x - mx) + ny * (layout.exit.y - my) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny };
  });
}

export function allWalls(layout: Layout, grid: FloorGrid): WallSegment[] {
  return [...wallSegments(grid), ...chamferSegments(layout)];
}

export function doorSegment(door: Door): Segment {
  const h = DOOR_WIDTH / 2;
  return door.axis === 'x'
    ? { ax: door.x - h, ay: door.y, bx: door.x + h, by: door.y }
    : { ax: door.x, ay: door.y - h, bx: door.x, by: door.y + h };
}

export function regionAt(layout: Layout, x: number, y: number): Region | undefined {
  return layout.regions.find(({ rect: r }) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1);
}

export function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function edgeKey(ax: number, ay: number, bx: number, by: number): string {
  return ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
}

export function reachableCells(layout: Layout, grid: FloorGrid, isDoorOpen: (door: Door) => boolean): Set<string> {
  const blocked = new Set<string>();
  const half = DOOR_WIDTH / 2;
  for (const d of layout.doors) {
    if (isDoorOpen(d)) continue;
    for (let k = -half; k < half; k++) {
      blocked.add(d.axis === 'x' ? edgeKey(d.x + k, d.y - 1, d.x + k, d.y) : edgeKey(d.x - 1, d.y + k, d.x, d.y + k));
    }
  }
  const start = { x: Math.floor(layout.start.x), y: Math.floor(layout.start.y) };
  const seen = new Set<string>([cellKey(start.x, start.y)]);
  const stack = [start];
  while (stack.length > 0) {
    const c = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      const key = cellKey(nx, ny);
      if (seen.has(key) || !grid.isFloor(nx, ny) || blocked.has(edgeKey(c.x, c.y, nx, ny))) continue;
      seen.add(key);
      stack.push({ x: nx, y: ny });
    }
  }
  return seen;
}
