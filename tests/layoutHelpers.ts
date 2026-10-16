import type { Segment } from '../src/world/layout';

export function closestPointOnSegmentForTest(px: number, py: number, s: Segment) {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2));
  return { x: s.ax + t * dx, y: s.ay + t * dy };
}
