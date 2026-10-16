import { describe, expect, it } from 'vitest';
import { closestPointOnSegment } from '../src/game/collision';
import { PLAYER, Player, type InputState } from '../src/game/player';
import { FloorGrid, LAYOUT, allWalls, doorSegment, type Segment } from '../src/world/layout';

const idle: InputState = { forward: 0, strafe: 0, turn: 0, lookDX: 0, lookDY: 0 };
const run = (p: Player, input: Partial<InputState>, seconds: number, colliders: Segment[], dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) p.update(dt, { ...idle, ...input }, colliders);
};
const wall: Segment = { ax: -10, ay: 0, bx: 10, by: 0 };

describe('Player movement', () => {
  it('walks forward at PLAYER.speed', () => {
    const p = new Player(0, 0, Math.PI / 2);
    run(p, { forward: 1 }, 1, []);
    expect(p.y).toBeCloseTo(PLAYER.speed, 1);
    expect(p.x).toBeCloseTo(0, 5);
  });
  it('does not move faster diagonally', () => {
    const p = new Player(0, 0, 0);
    run(p, { forward: 1, strafe: 1 }, 1, []);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(PLAYER.speed, 1);
  });
  it('strafes to the right of the heading', () => {
    const p = new Player(0, 0, Math.PI / 2); // facing north, right is east
    run(p, { strafe: 1 }, 0.5, []);
    expect(p.x).toBeGreaterThan(1.9);
  });
  it('stops at radius distance in front of a wall', () => {
    const p = new Player(0, -1, Math.PI / 2);
    run(p, { forward: 1 }, 1, [wall]);
    expect(p.y).toBeCloseTo(-PLAYER.radius, 3);
  });
  it('slides along a wall when walking into it at an angle', () => {
    const p = new Player(0, -1, Math.PI / 4);
    run(p, { forward: 1 }, 1, [wall]);
    expect(p.y).toBeCloseTo(-PLAYER.radius, 3);
    expect(p.x).toBeGreaterThan(2);
  });
  it('never comes closer than its radius when walking around a wall end', () => {
    const end: Segment = { ax: 0, ay: 0, bx: 10, by: 0 };
    const p = new Player(-0.5, -2, Math.PI / 2 - 0.2);
    for (let i = 0; i < 120; i++) {
      p.update(1 / 60, { ...idle, forward: 1 }, [end]);
      const c = closestPointOnSegment(p.x, p.y, end);
      expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeGreaterThanOrEqual(PLAYER.radius - 1e-6);
    }
  });
  it('does not tunnel through a thin door even with a huge time step', () => {
    const door = LAYOUT.doors.find((d) => d.y === -35)!;
    const p = new Player(0, -36.5, Math.PI / 2);
    p.update(0.5, { ...idle, forward: 1 }, [doorSegment(door)]);
    expect(p.y).toBeLessThan(-35);
  });
  it('is stopped by the closed entrance door inside the real layout', () => {
    const walls = allWalls(LAYOUT, new FloorGrid(LAYOUT));
    const door = LAYOUT.doors.find((d) => d.y === -35)!;
    const p = new Player(LAYOUT.start.x, LAYOUT.start.y, LAYOUT.startHeading);
    run(p, { forward: 1 }, 3, [...walls, doorSegment(door)]);
    expect(p.y).toBeCloseTo(-35 - PLAYER.radius, 2);
    const q = new Player(LAYOUT.start.x, LAYOUT.start.y, LAYOUT.startHeading);
    run(q, { forward: 1 }, 2, walls);
    expect(q.y).toBeGreaterThan(-33);
  });
  it('turns with mouse and keys and clamps pitch', () => {
    const p = new Player(0, 0, 1);
    p.update(1 / 60, { ...idle, lookDX: 100 }, []);
    expect(p.heading).toBeCloseTo(1 - 100 * PLAYER.mouseSensitivity);
    p.update(0.5, { ...idle, turn: 1 }, []);
    expect(p.heading).toBeCloseTo(1 - 100 * PLAYER.mouseSensitivity - PLAYER.turnSpeed * 0.5);
    p.update(1 / 60, { ...idle, lookDY: -100000 }, []);
    expect(p.pitch).toBe(PLAYER.maxPitch);
    p.update(1 / 60, { ...idle, lookDY: 100000 }, []);
    expect(p.pitch).toBe(-PLAYER.maxPitch);
  });
});
