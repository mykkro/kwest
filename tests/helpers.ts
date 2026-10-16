import type { QuestionSet } from '../src/data/questionSet';

export function makeSet(count = 30, id = 'T1'): QuestionSet {
  return {
    id,
    name: `Test ${id}`,
    questions: Array.from({ length: count }, (_, i) => ({
      q: `Otázka ${i}`,
      answers: [`A${i}`, `B${i}`, `C${i}`, `D${i}`],
      correct: i % 4,
    })),
  };
}
