import type { Segment } from '../world/layout';
import { resolveCircle } from './collision';

export interface InputState {
  forward: number;
  strafe: number;
  turn: number;
  lookDX: number;
  lookDY: number;
}

export const PLAYER = {
  radius: 0.3,
  eyeHeight: 1.6,
  speed: 4,
  turnSpeed: 2.2,
  mouseSensitivity: 0.0025,
  maxPitch: 1.2,
} as const;

const MAX_STEP = 0.1; // metres per collision sub-step; must stay below PLAYER.radius

export class Player {
  pitch = 0;

  constructor(public x: number, public y: number, public heading: number) {}

  update(dt: number, input: InputState, colliders: readonly Segment[]): void {
    this.heading -= input.lookDX * PLAYER.mouseSensitivity + input.turn * PLAYER.turnSpeed * dt;
    this.pitch = Math.max(
      -PLAYER.maxPitch,
      Math.min(PLAYER.maxPitch, this.pitch - input.lookDY * PLAYER.mouseSensitivity),
    );

    let f = input.forward, s = input.strafe;
    const len = Math.hypot(f, s);
    if (len > 1) {
      f /= len;
      s /= len;
    }
    const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
    const rx = fy, ry = -fx;
    const dx = (fx * f + rx * s) * PLAYER.speed * dt;
    const dy = (fy * f + ry * s) * PLAYER.speed * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_STEP));
    for (let i = 0; i < steps; i++) {
      const p = resolveCircle(this.x + dx / steps, this.y + dy / steps, PLAYER.radius, colliders);
      this.x = p.x;
      this.y = p.y;
    }
  }
}
