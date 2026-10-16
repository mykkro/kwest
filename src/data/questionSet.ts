import { S } from '../strings';

export interface Question {
  q: string;
  answers: string[];
  correct: number;
}

export interface QuestionSet {
  id: string;
  name: string;
  school?: string;
  level?: number;
  questions: Question[];
}

export interface SetIndexEntry {
  id: string;
  name: string;
  file: string;
}

export type ValidationResult = { ok: true; set: QuestionSet } | { ok: false; error: string };
export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export const QUESTIONS_PER_GAME = 30;

const defaultFetch: FetchLike = (url) => fetch(url);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function validateSet(data: unknown): ValidationResult {
  const fail = (error: string): ValidationResult => ({ ok: false, error });
  if (!isObject(data)) return fail('Soubor není platná sada otázek.');
  const id = text(data.id);
  const name = text(data.name);
  if (!id) return fail('Chybí id sady.');
  if (!name) return fail('Chybí název sady (name).');
  const raw = Array.isArray(data.questions) ? data.questions : [];
  if (raw.length < QUESTIONS_PER_GAME) {
    return fail(`Sada má jen ${raw.length} otázek, potřeba je alespoň ${QUESTIONS_PER_GAME}.`);
  }
  const questions: Question[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const label = `Otázka ${i + 1}`;
    if (!isObject(item) || !text(item.q)) return fail(`${label}: chybí text otázky.`);
    if (!Array.isArray(item.answers) || item.answers.length !== 4) return fail(`${label}: musí mít přesně 4 odpovědi.`);
    const answers = item.answers.map(text);
    if (answers.some((a) => !a)) return fail(`${label}: odpověď nesmí být prázdná.`);
    if (new Set(answers.map((a) => a.toLocaleLowerCase('cs'))).size !== 4) {
      return fail(`${label}: odpovědi se nesmí opakovat.`);
    }
    const correct = item.correct;
    if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct > 3) {
      return fail(`${label}: correct musí být celé číslo 0–3.`);
    }
    questions.push({ q: text(item.q), answers, correct });
  }
  const set: QuestionSet = { id, name, questions };
  if (typeof data.school === 'string') set.school = data.school;
  if (typeof data.level === 'number') set.level = data.level;
  return { ok: true, set };
}

export async function loadIndex(baseUrl: string, fetchFn: FetchLike = defaultFetch): Promise<SetIndexEntry[]> {
  const res = await fetchFn(`${baseUrl}tests/index.json`);
  if (!res.ok) throw new Error('index.json not available');
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('index.json is not an array');
  return data.filter(
    (e): e is SetIndexEntry =>
      isObject(e) && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.file === 'string',
  );
}

export async function loadSet(
  baseUrl: string,
  entry: SetIndexEntry,
  fetchFn: FetchLike = defaultFetch,
): Promise<ValidationResult> {
  try {
    const res = await fetchFn(`${baseUrl}tests/${entry.file}`);
    if (!res.ok) return { ok: false, error: S.setLoadError };
    return validateSet(await res.json());
  } catch {
    return { ok: false, error: S.setLoadError };
  }
}
