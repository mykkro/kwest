import { describe, expect, it } from 'vitest';
import { joystickVector } from '../src/ui/touchControls';

const R = 60;

describe('joystickVector', () => {
  it('is idle at the centre and inside the dead zone', () => {
    expect(joystickVector(0, 0, R)).toEqual({ forward: 0, strafe: 0 });
    expect(joystickVector(4, -5, R)).toEqual({ forward: 0, strafe: 0 });
  });
  it('maps dragging up to forward and right to strafing right', () => {
    const up = joystickVector(0, -R, R);
    expect(up.forward).toBeCloseTo(1);
    expect(up.strafe).toBeCloseTo(0);
    const right = joystickVector(R, 0, R);
    expect(right.strafe).toBeCloseTo(1);
    expect(right.forward).toBeCloseTo(0);
    expect(joystickVector(0, R, R).forward).toBeCloseTo(-1);
  });
  it('clamps drags beyond the stick radius to full speed', () => {
    const v = joystickVector(3 * R, -3 * R, R);
    expect(Math.hypot(v.forward, v.strafe)).toBeCloseTo(1);
  });
  it('scales partial drags proportionally', () => {
    expect(joystickVector(0, -R / 2, R).forward).toBeGreaterThan(0.3);
    expect(joystickVector(0, -R / 2, R).forward).toBeLessThan(0.7);
  });
});
