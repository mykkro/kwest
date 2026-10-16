import { QUESTIONS_PER_GAME, type QuestionSet } from '../data/questionSet';
import { pickQuestions, type PreparedQuestion, type Rng } from '../data/shuffle';

export interface AnswerRecord {
  question: string;
  answers: string[];
  chosen: number;
  correct: number;
  isCorrect: boolean;
}

export interface SessionResult {
  playerName: string;
  setId: string;
  setName: string;
  date: Date;
  elapsedMs: number;
  correctCount: number;
  total: number;
  records: AnswerRecord[];
}

export interface SessionOptions {
  set: QuestionSet;
  playerName: string;
  rng: Rng;
  now?: () => number;
  questionCount?: number;
}

export class Session {
  readonly questions: PreparedQuestion[];
  private readonly records: AnswerRecord[] = [];
  private readonly now: () => number;
  private readonly startDate = new Date();
  private accumulated = 0;
  private runningSince: number | null;

  constructor(private readonly opts: SessionOptions) {
    this.now = opts.now ?? (() => performance.now());
    this.questions = pickQuestions(opts.set.questions, opts.questionCount ?? QUESTIONS_PER_GAME, opts.rng);
    this.runningSince = this.now();
  }

  currentQuestion(): PreparedQuestion | undefined {
    return this.questions[this.records.length];
  }

  answer(choice: number): AnswerRecord {
    const q = this.currentQuestion();
    if (!q) throw new Error('No questions left');
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) throw new Error(`Bad choice ${choice}`);
    const record: AnswerRecord = {
      question: q.q,
      answers: q.answers,
      chosen: choice,
      correct: q.correct,
      isCorrect: choice === q.correct,
    };
    this.records.push(record);
    return record;
  }

  get paused(): boolean {
    return this.runningSince === null;
  }

  pause(): void {
    if (this.runningSince === null) return;
    this.accumulated += this.now() - this.runningSince;
    this.runningSince = null;
  }

  resume(): void {
    if (this.runningSince !== null) return;
    this.runningSince = this.now();
  }

  elapsedMs(): number {
    return this.accumulated + (this.runningSince === null ? 0 : this.now() - this.runningSince);
  }

  result(): SessionResult {
    return {
      playerName: this.opts.playerName,
      setId: this.opts.set.id,
      setName: this.opts.set.name,
      date: this.startDate,
      elapsedMs: this.elapsedMs(),
      correctCount: this.records.filter((r) => r.isCorrect).length,
      total: this.questions.length,
      records: this.records.slice(),
    };
  }
}
