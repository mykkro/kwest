import type { Question } from './questionSet';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface PreparedQuestion {
  q: string;
  answers: string[];
  correct: number;
}

export function prepareQuestion(question: Question, rng: Rng): PreparedQuestion {
  const order = shuffle(
    question.answers.map((_, i) => i),
    rng,
  );
  return {
    q: question.q,
    answers: order.map((i) => question.answers[i]),
    correct: order.indexOf(question.correct),
  };
}

export function pickQuestions(questions: readonly Question[], count: number, rng: Rng): PreparedQuestion[] {
  return shuffle(questions, rng)
    .slice(0, count)
    .map((q) => prepareQuestion(q, rng));
}
