import type { Group } from '../world/layout';

export type RuleEvent =
  | { type: 'answered'; qmarkId: number; correct: boolean }
  | { type: 'groupComplete'; group: Group };

export class Rules {
  private readonly groupOf = new Map<number, Group>();
  private readonly done = new Set<number>();

  constructor(qmarks: readonly { id: number; group: Group }[]) {
    for (const q of qmarks) this.groupOf.set(q.id, q.group);
  }

  isDone(id: number): boolean {
    return this.done.has(id);
  }

  get doneCount(): number {
    return this.done.size;
  }

  get total(): number {
    return this.groupOf.size;
  }

  remaining(group: Group): number {
    let n = 0;
    for (const [id, g] of this.groupOf) if (g === group && !this.done.has(id)) n++;
    return n;
  }

  isGroupComplete(group: Group): boolean {
    return this.remaining(group) === 0;
  }

  markAnswered(id: number, correct: boolean): RuleEvent[] {
    const group = this.groupOf.get(id);
    if (!group) throw new Error(`Unknown question mark ${id}`);
    if (this.done.has(id)) return [];
    this.done.add(id);
    const events: RuleEvent[] = [{ type: 'answered', qmarkId: id, correct }];
    if (this.isGroupComplete(group)) events.push({ type: 'groupComplete', group });
    return events;
  }
}
