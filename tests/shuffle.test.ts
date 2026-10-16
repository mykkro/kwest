import { describe, expect, it } from 'vitest';
import { mulberry32, pickQuestions, prepareQuestion, shuffle } from '../src/data/shuffle';
import { makeSet } from './helpers';

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });
});

describe('prepareQuestion', () => {
  it('keeps the correct answer text under every seed', () => {
    const q = { q: 'Co je myš?', answers: ['zařízení', 'zvíře', 'barva', 'hra'], correct: 0 };
    const orders = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const p = prepareQuestion(q, mulberry32(seed));
      expect(p.answers[p.correct]).toBe('zařízení');
      expect([...p.answers].sort()).toEqual([...q.answers].sort());
      orders.add(p.answers.join('|'));
    }
    expect(orders.size).toBeGreaterThan(10);
  });
});

describe('pickQuestions', () => {
  it('picks the requested number of distinct questions from a larger set', () => {
    const set = makeSet(40);
    const picked = pickQuestions(set.questions, 30, mulberry32(3));
    expect(picked).toHaveLength(30);
    expect(new Set(picked.map((p) => p.q)).size).toBe(30);
  });
});
