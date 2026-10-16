import { describe, expect, it } from 'vitest';
import { findTarget } from '../src/game/interaction';
import { LAYOUT } from '../src/world/layout';

const none = () => false;
const entrance = LAYOUT.doors.find((d) => d.y === -35)!;
const q0 = LAYOUT.qmarks[0];

describe('findTarget', () => {
  it('targets the closed door in front of the player', () => {
    expect(findTarget(0, -36.5, Math.PI / 2, LAYOUT, none, none)).toEqual({ kind: 'door', id: entrance.id });
  });
  it('ignores the door when facing away or when it is open', () => {
    expect(findTarget(0, -36.5, -Math.PI / 2, LAYOUT, none, none)).toBeNull();
    expect(findTarget(0, -36.5, Math.PI / 2, LAYOUT, none, (id) => id === entrance.id)).toBeNull();
  });
  it('ignores targets out of reach', () => {
    expect(findTarget(0, -39.5, Math.PI / 2, LAYOUT, none, none)).toBeNull();
  });
  it('targets a question mark within reach and skips answered ones', () => {
    const px = q0.x - 1.5, py = q0.y;
    expect(findTarget(px, py, 0, LAYOUT, none, none)).toEqual({ kind: 'qmark', id: q0.id });
    expect(findTarget(px, py, 0, LAYOUT, (id) => id === q0.id, none)).toBeNull();
  });
});
