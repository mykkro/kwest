import { S } from '../strings';
import { doorSegment, type Layout } from '../world/layout';
import { closestPointOnSegment } from './collision';

export type Target = { kind: 'qmark'; id: number } | { kind: 'door'; id: number };

export const REACH = { qmark: 2.2, door: 1.8, minCos: 0.6 } as const;

interface Candidate {
  target: Target;
  x: number;
  y: number;
  reach: number;
}

export function findTarget(
  px: number,
  py: number,
  heading: number,
  layout: Layout,
  isQmarkDone: (id: number) => boolean,
  isDoorOpen: (id: number) => boolean,
): Target | null {
  const candidates: Candidate[] = [];
  for (const q of layout.qmarks) {
    if (!isQmarkDone(q.id)) candidates.push({ target: { kind: 'qmark', id: q.id }, x: q.x, y: q.y, reach: REACH.qmark });
  }
  for (const d of layout.doors) {
    if (isDoorOpen(d.id)) continue;
    const c = closestPointOnSegment(px, py, doorSegment(d));
    candidates.push({ target: { kind: 'door', id: d.id }, x: c.x, y: c.y, reach: REACH.door });
  }
  const fx = Math.cos(heading), fy = Math.sin(heading);
  let best: Target | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dx = c.x - px, dy = c.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > c.reach || dist >= bestDist) continue;
    if (dist > 0.3 && (dx * fx + dy * fy) / dist < REACH.minCos) continue;
    best = c.target;
    bestDist = dist;
  }
  return best;
}

/** HUD prompt for the current target; locked doors name their colour. */
export function promptFor(target: Target | null, layout: Layout): string | null {
  if (!target) return null;
  if (target.kind === 'qmark') return S.promptQmark;
  const kind = layout.doors[target.id].kind;
  return kind === 'grey' ? S.promptDoor : S.promptLocked[kind];
}
