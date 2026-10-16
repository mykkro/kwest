import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/data/shuffle';
import { Session } from '../src/game/session';
import { makeSet } from './helpers';

function setup(count = 30) {
  let t = 1000;
  const clock = { now: () => t, advance: (ms: number) => { t += ms; } };
  const session = new Session({ set: makeSet(count), playerName: 'Eva', rng: mulberry32(7), now: clock.now });
  return { session, clock };
}

describe('Session', () => {
  it('serves 30 questions in order and records answers', () => {
    const { session } = setup();
    expect(session.questions).toHaveLength(30);
    const q = session.currentQuestion()!;
    const rec = session.answer(q.correct);
    expect(rec).toEqual({ question: q.q, answers: q.answers, chosen: q.correct, correct: q.correct, isCorrect: true });
    expect(session.currentQuestion()).toBe(session.questions[1]);
    const q2 = session.currentQuestion()!;
    expect(session.answer((q2.correct + 1) % 4).isCorrect).toBe(false);
  });
  it('uses only 30 questions from a larger set', () => {
    expect(setup(45).session.questions).toHaveLength(30);
  });
  it('rejects out-of-range choices and answering after the last question', () => {
    const { session } = setup();
    expect(() => session.answer(4)).toThrow();
    expect(() => session.answer(-1)).toThrow();
    for (let i = 0; i < 30; i++) session.answer(0);
    expect(session.currentQuestion()).toBeUndefined();
    expect(() => session.answer(0)).toThrow();
  });
  it('counts only unpaused time; pause and resume are idempotent', () => {
    const { session, clock } = setup();
    clock.advance(5000);
    session.pause();
    session.pause();
    clock.advance(60_000);
    expect(session.elapsedMs()).toBe(5000);
    session.resume();
    session.resume();
    clock.advance(2000);
    expect(session.elapsedMs()).toBe(7000);
    expect(session.paused).toBe(false);
  });
  it('summarises the result', () => {
    const { session, clock } = setup();
    const q = session.currentQuestion()!;
    session.answer(q.correct);
    clock.advance(90_000);
    const r = session.result();
    expect(r.playerName).toBe('Eva');
    expect(r.setId).toBe('T1');
    expect(r.setName).toBe('Test T1');
    expect(r.elapsedMs).toBe(90_000);
    expect(r.correctCount).toBe(1);
    expect(r.total).toBe(30);
    expect(r.records).toHaveLength(1);
    expect(r.date).toBeInstanceOf(Date);
  });
});
