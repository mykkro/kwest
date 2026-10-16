import type { PreparedQuestion } from '../data/shuffle';
import { S, remainingQuestions } from '../strings';
import { doorSegment, type Group, type Layout, type Segment } from '../world/layout';
import type { Target } from './interaction';
import { Rules } from './rules';
import type { Session, SessionResult } from './session';

export const EXIT_RADIUS = 1.2;

export type LogicEvent =
  | { type: 'message'; text: string; tone: 'info' | 'good' | 'bad' }
  | { type: 'progress'; done: number; total: number }
  | { type: 'ask'; qmarkId: number; question: PreparedQuestion }
  | { type: 'qmarkCollected'; qmarkId: number }
  | { type: 'doorOpening'; doorId: number }
  | { type: 'flash'; text: string; group: Group }
  | { type: 'exit'; result: SessionResult };

export class GameLogic {
  readonly rules: Rules;
  private readonly openDoors = new Set<number>();
  private pending: number | null = null;
  private done = false;

  constructor(
    private readonly layout: Layout,
    private readonly session: Session,
    private readonly emit: (e: LogicEvent) => void,
  ) {
    this.rules = new Rules(layout.qmarks);
  }

  isDoorOpen(id: number): boolean {
    return this.openDoors.has(id);
  }

  isQmarkDone(id: number): boolean {
    return this.rules.isDone(id);
  }

  get awaitingAnswer(): number | null {
    return this.pending;
  }

  get finished(): boolean {
    return this.done;
  }

  closedDoorColliders(): Segment[] {
    return this.layout.doors.filter((d) => !this.openDoors.has(d.id)).map(doorSegment);
  }

  use(target: Target | null): void {
    if (!target || this.done || this.pending !== null) return;
    if (target.kind === 'qmark') {
      if (this.rules.isDone(target.id)) return;
      const question = this.session.currentQuestion();
      if (!question) return;
      this.pending = target.id;
      this.emit({ type: 'ask', qmarkId: target.id, question });
      return;
    }
    const door = this.layout.doors[target.id];
    if (!door || this.openDoors.has(door.id)) return;
    if (door.kind === 'grey') this.openDoor(door.id);
    else {
      const text = `${S.doorName[door.kind]}: ${remainingQuestions(this.rules.remaining(door.kind))}`;
      this.emit({ type: 'message', text, tone: 'info' });
    }
  }

  answerQuestion(choice: number | null): void {
    const id = this.pending;
    if (id === null) return;
    this.pending = null;
    if (choice === null) return;
    const record = this.session.answer(choice);
    for (const ev of this.rules.markAnswered(id, record.isCorrect)) {
      if (ev.type === 'answered') {
        this.emit({ type: 'message', text: ev.correct ? S.correct : S.wrong, tone: ev.correct ? 'good' : 'bad' });
        this.emit({ type: 'qmarkCollected', qmarkId: id });
        this.emit({ type: 'progress', done: this.rules.doneCount, total: this.rules.total });
      } else {
        for (const d of this.layout.doors) if (d.kind === ev.group) this.openDoor(d.id);
        this.emit({ type: 'flash', text: ev.group === 'silver' ? S.silverOpen : S.goldOpen, group: ev.group });
      }
    }
  }

  checkExit(x: number, y: number): void {
    if (this.done) return;
    if (Math.hypot(x - this.layout.exit.x, y - this.layout.exit.y) > EXIT_RADIUS) return;
    this.done = true;
    this.session.pause();
    this.emit({ type: 'exit', result: this.session.result() });
  }

  private openDoor(id: number): void {
    this.openDoors.add(id);
    this.emit({ type: 'doorOpening', doorId: id });
  }
}
