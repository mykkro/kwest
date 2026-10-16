import type { Segment } from '../world/layout';

export function closestPointOnSegment(px: number, py: number, s: Segment): { x: number; y: number } {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2));
  return { x: s.ax + t * dx, y: s.ay + t * dy };
}

/** Pushes a circle out of every segment it overlaps. */
export function resolveCircle(
  x: number,
  y: number,
  radius: number,
  segments: readonly Segment[],
  iterations = 4,
): { x: number; y: number } {
  for (let i = 0; i < iterations; i++) {
    let moved = false;
    for (const s of segments) {
      const c = closestPointOnSegment(x, y, s);
      let ox = x - c.x, oy = y - c.y;
      const d = Math.hypot(ox, oy);
      if (d >= radius) continue;
      if (d < 1e-9) {
        const len = Math.hypot(s.bx - s.ax, s.by - s.ay) || 1;
        ox = -(s.by - s.ay) / len;
        oy = (s.bx - s.ax) / len;
      } else {
        ox /= d;
        oy /= d;
      }
      x += ox * (radius - d);
      y += oy * (radius - d);
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y };
}
