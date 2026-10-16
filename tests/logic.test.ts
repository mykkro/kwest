import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/data/shuffle';
import { GameLogic, type LogicEvent } from '../src/game/logic';
import { Session } from '../src/game/session';
import { LAYOUT } from '../src/world/layout';
import { makeSet } from './helpers';

function setup() {
  const events: LogicEvent[] = [];
  const session = new Session({ set: makeSet(), playerName: '', rng: mulberry32(5) });
  const logic = new GameLogic(LAYOUT, session, (e) => events.push(e));
  const lastAsk = () => events.filter((e): e is Extract<LogicEvent, { type: 'ask' }> => e.type === 'ask').at(-1)!;
  return { events, session, logic, lastAsk };
}
const ofType = <T extends LogicEvent['type']>(events: LogicEvent[], type: T) =>
  events.filter((e): e is Extract<LogicEvent, { type: T }> => e.type === type);

describe('GameLogic', () => {
  it('asks the current session question when a question mark is used', () => {
    const { logic, session, lastAsk } = setup();
    logic.use({ kind: 'qmark', id: 3 });
    expect(lastAsk()).toEqual({ type: 'ask', qmarkId: 3, question: session.currentQuestion() });
    expect(logic.awaitingAnswer).toBe(3);
  });
  it('ignores further use while a question is open (no double ask)', () => {
    const { logic, events } = setup();
    logic.use({ kind: 'qmark', id: 3 });
    logic.use({ kind: 'qmark', id: 4 });
    logic.use({ kind: 'door', id: 0 });
    expect(events).toHaveLength(1);
  });
  it('closing without answering keeps the question mark', () => {
    const { logic, events } = setup();
    logic.use({ kind: 'qmark', id: 3 });
    logic.answerQuestion(null);
    expect(logic.awaitingAnswer).toBeNull();
    expect(logic.isQmarkDone(3)).toBe(false);
    expect(events).toHaveLength(1);
  });
  it('a correct answer collects the mark and reports progress', () => {
    const { logic, events, lastAsk } = setup();
    logic.use({ kind: 'qmark', id: 3 });
    logic.answerQuestion(lastAsk().question.correct);
    expect(events.slice(1)).toEqual([
      { type: 'message', text: 'Správně!', tone: 'good' },
      { type: 'qmarkCollected', qmarkId: 3 },
      { type: 'progress', done: 1, total: 30 },
    ]);
  });
  it('an answered mark cannot be used or counted again', () => {
    const { logic, events, lastAsk } = setup();
    logic.use({ kind: 'qmark', id: 3 });
    logic.answerQuestion(lastAsk().question.correct);
    const before = events.length;
    logic.use({ kind: 'qmark', id: 3 });
    logic.answerQuestion(0);
    expect(events).toHaveLength(before);
    expect(logic.rules.doneCount).toBe(1);
  });
  it('answering all silver marks (even wrongly) opens the four silver doors', () => {
    const { logic, events, lastAsk } = setup();
    const silverDoors = LAYOUT.doors.filter((d) => d.kind === 'silver').map((d) => d.id);
    const closedBefore = logic.closedDoorColliders().length;
    for (const q of LAYOUT.qmarks.filter((m) => m.group === 'silver')) {
      logic.use({ kind: 'qmark', id: q.id });
      logic.answerQuestion((lastAsk().question.correct + 1) % 4);
    }
    expect(ofType(events, 'doorOpening').map((e) => e.doorId).sort((a, b) => a - b)).toEqual(silverDoors);
    expect(ofType(events, 'flash')).toEqual([{ type: 'flash', text: 'Stříbrné dveře se otevírají!', group: 'silver' }]);
    expect(logic.closedDoorColliders()).toHaveLength(closedBefore - 4);
    silverDoors.forEach((id) => expect(logic.isDoorOpen(id)).toBe(true));
  });
  it('a locked door reports how many questions remain', () => {
    const { logic, events } = setup();
    const gold = LAYOUT.doors.find((d) => d.kind === 'gold')!;
    logic.use({ kind: 'door', id: gold.id });
    expect(events).toEqual([{ type: 'message', text: 'Zlaté dveře: Zbývá ještě 12 otázek!', tone: 'info' }]);
    const silver = LAYOUT.doors.find((d) => d.kind === 'silver')!;
    logic.use({ kind: 'door', id: silver.id });
    expect(events.at(-1)).toEqual({ type: 'message', text: 'Stříbrné dveře: Zbývá ještě 18 otázek!', tone: 'info' });
    expect(logic.isDoorOpen(gold.id)).toBe(false);
  });
  it('answering all gold marks flashes the golden-door banner', () => {
    const { logic, events, lastAsk } = setup();
    for (const q of LAYOUT.qmarks.filter((m) => m.group === 'gold')) {
      logic.use({ kind: 'qmark', id: q.id });
      logic.answerQuestion(lastAsk().question.correct);
    }
    expect(ofType(events, 'flash')).toEqual([{ type: 'flash', text: 'Zlaté dveře se otevírají!', group: 'gold' }]);
  });
  it('a grey door opens once', () => {
    const { logic, events } = setup();
    logic.use({ kind: 'door', id: 0 });
    logic.use({ kind: 'door', id: 0 });
    expect(events).toEqual([{ type: 'doorOpening', doorId: 0 }]);
  });
  it('reaching the exit ends the game once and pauses the session', () => {
    const { logic, events, session } = setup();
    logic.checkExit(5, 5);
    expect(events).toHaveLength(0);
    logic.checkExit(0.5, 0.5);
    logic.checkExit(0, 0);
    const exits = ofType(events, 'exit');
    expect(exits).toHaveLength(1);
    expect(exits[0].result.total).toBe(30);
    expect(logic.finished).toBe(true);
    expect(session.paused).toBe(true);
  });
});
