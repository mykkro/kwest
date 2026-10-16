import { describe, expect, it } from 'vitest';
import { loadIndex, loadSet, validateSet, type FetchLike } from '../src/data/questionSet';
import { makeSet } from './helpers';

const withQuestion = (patch: Record<string, unknown>) => {
  const set = makeSet() as unknown as { questions: Record<string, unknown>[] };
  set.questions[4] = { ...set.questions[4], ...patch };
  return set;
};
const error = (data: unknown) => {
  const r = validateSet(data);
  return r.ok ? null : r.error;
};

describe('validateSet', () => {
  it('accepts a valid set', () => {
    const r = validateSet(makeSet());
    expect(r.ok).toBe(true);
  });
  it('rejects non-objects', () => {
    expect(error(null)).toBe('Soubor není platná sada otázek.');
    expect(error([1, 2])).toBe('Soubor není platná sada otázek.');
  });
  it('requires id and name', () => {
    expect(error({ ...makeSet(), id: '' })).toBe('Chybí id sady.');
    expect(error({ ...makeSet(), name: '  ' })).toBe('Chybí název sady (name).');
  });
  it('requires at least 30 questions', () => {
    expect(error(makeSet(29))).toBe('Sada má jen 29 otázek, potřeba je alespoň 30.');
  });
  it('requires question text', () => {
    expect(error(withQuestion({ q: ' ' }))).toBe('Otázka 5: chybí text otázky.');
  });
  it('requires exactly 4 answers', () => {
    expect(error(withQuestion({ answers: ['a', 'b', 'c'] }))).toBe('Otázka 5: musí mít přesně 4 odpovědi.');
  });
  it('rejects empty answers', () => {
    expect(error(withQuestion({ answers: ['a', ' ', 'c', 'd'] }))).toBe('Otázka 5: odpověď nesmí být prázdná.');
  });
  it('rejects duplicate answers ignoring case and surrounding whitespace', () => {
    expect(error(withQuestion({ answers: ['Myš', 'klávesnice', ' myš ', 'monitor'] }))).toBe(
      'Otázka 5: odpovědi se nesmí opakovat.',
    );
  });
  it('requires correct to be an integer 0–3', () => {
    const msg = 'Otázka 5: correct musí být celé číslo 0–3.';
    expect(error(withQuestion({ correct: 4 }))).toBe(msg);
    expect(error(withQuestion({ correct: 1.5 }))).toBe(msg);
    expect(error(withQuestion({ correct: '1' }))).toBe(msg);
  });
  it('trims texts in the returned set', () => {
    const r = validateSet(withQuestion({ q: '  Co je myš?  ' }));
    expect(r.ok && r.set.questions[4].q).toBe('Co je myš?');
  });
});

const fakeFetch =
  (files: Record<string, unknown>): FetchLike =>
  async (url) => {
    if (!(url in files)) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => files[url] };
  };

describe('loading', () => {
  const entry = { id: 'T1', name: 'Test', file: 'T1.json' };
  it('loads the index and drops malformed entries', async () => {
    const f = fakeFetch({ './tests/index.json': [entry, { id: 5 }, null] });
    expect(await loadIndex('./', f)).toEqual([entry]);
  });
  it('throws when the index is missing', async () => {
    await expect(loadIndex('./', fakeFetch({}))).rejects.toThrow();
  });
  it('loads and validates a set', async () => {
    const r = await loadSet('./', entry, fakeFetch({ './tests/T1.json': makeSet() }));
    expect(r.ok).toBe(true);
  });
  it('reports a missing set file instead of throwing', async () => {
    expect(await loadSet('./', entry, fakeFetch({}))).toEqual({ ok: false, error: 'Soubor se nepodařilo načíst.' });
  });
});
