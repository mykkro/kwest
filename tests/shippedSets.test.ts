import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateSet, type QuestionSet } from '../src/data/questionSet';

const dir = fileURLToPath(new URL('../public/tests/', import.meta.url));
const readJson = (file: string): unknown => JSON.parse(readFileSync(dir + file, 'utf8'));
const index = readJson('index.json') as { id: string; name: string; file: string }[];

const sets: QuestionSet[] = index.map((entry) => {
  const r = validateSet(readJson(entry.file));
  if (!r.ok) throw new Error(`${entry.file}: ${r.error}`);
  return r.set;
});

describe('shipped question sets', () => {
  it('index lists the three sets in order with their names', () => {
    expect(index.map((e) => e.id)).toEqual(['Z1', 'Z2', 'Z3']);
    expect(index.map((e) => e.name)).toEqual(['Úroveň 1', 'Úroveň 2', 'Úroveň 3']);
  });
  it('each set is valid, matches its index entry and has exactly 30 questions', () => {
    sets.forEach((set, i) => {
      expect(set.id).toBe(index[i].id);
      expect(set.name).toBe(index[i].name);
      expect(set.questions).toHaveLength(30);
    });
  });
  it('no question repeats across the sets', () => {
    const texts = sets.flatMap((s) => s.questions.map((q) => q.q));
    expect(new Set(texts).size).toBe(texts.length);
  });
});
