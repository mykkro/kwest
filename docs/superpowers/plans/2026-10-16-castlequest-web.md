# CastleQuest NG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static browser remake of CastleQuest: a first-person torch-lit castle maze in which students collect 30 question marks, answer Czech multiple-choice questions, unlock silver and gold doors and reach the exit.

**Architecture:**
- **Pure TypeScript core, with no Three.js or DOM code, all unit-tested with Vitest:** question data and validation, maze layout data, game rules, session timer and answers, collision, player movement, targeting, and the game-logic event machine.
- **Three.js rendering layer:** procedural textures, geometry generated from the layout, and props. It mirrors the logic state.
- **HTML/CSS overlays** for the menu, HUD, question dialog, pause menu, minimap and results.
- Vite builds everything into a relocatable static `dist/`.

**Tech Stack:** TypeScript 5.9, Vite 8, Three.js 0.186, Vitest 5, Playwright 1.64, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-16-castlequest-web-design.md`

**Spec refinements adopted in this plan (all inside the spec's "tuned during implementation" latitude):**
- **Collision is circle-vs-line-segment, not axis-aligned boxes.** The octagonal central room has diagonal walls, and segments handle both.
- **All walls share one uniform height `WALL_HEIGHT = 4.5` m.** This replaces the spec's corridors 4 m / rooms 5 m, because it avoids step geometry at the junctions.
- **Every door lies on an integer grid line.** For example, the silver doors sit at distance 21 from the centre.

## Global Constraints

- Dependencies: `three@^0.186.1`, `vite@^8.3.4`, `vitest@^5.0.5`, `typescript@~5.9.3`, `@types/three@^0.186.0`, `@types/node`, `@playwright/test@^1.64.1`. Node 24.
- `base: './'` in Vite. **No runtime requests to external CDNs or servers.** Data is loaded only from `./tests/…`.
- **Nothing from `legacy/` is shipped, converted, traced or committed.** `legacy/` stays in `.gitignore`.
- All UI text is Czech and lives in `src/strings.ts`.
- **User-provided text (question sets, player name) is inserted with `textContent`, never `innerHTML`.**
- **Plan coordinates:** metres, x = east, y = north, origin = exit. **Heading:** radians counter-clockwise from +x (north = π/2). **Three.js mapping:** `(x, height, -y)`.
- Game rules: 18 silver question marks unlock 4 silver doors; 12 gold question marks unlock 4 gold doors. Grey doors open on use. Each question is answered once. Wrong answers count toward unlocking.
- Renderer pixel ratio ≤ 1.5. At most 8 real lights in the scene: 6 torch-pool lights + 1 portal light + 1 hemisphere light.
- Commit after every task. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Long frames** (a slow PC, or returning to the tab with a big `dt`) must not let the player tunnel through walls or closed doors. Pinned in Task 6 (`dt = 0.5` test).
2. **Pressing Esc or losing pointer lock while walking** must open the pause menu and stop the timer. Pinned in Task 12 (e2e Escape step).
3. **Hiding the tab while a question is open** must stop the timer and resume it exactly once. Repeated pause/resume calls are idempotent. Pinned in Task 5.
4. **Mistakes in a teacher-written set:** answers that repeat with different case or whitespace, a non-integer `correct`, more than 30 questions. These give a clear Czech error, or 30 random questions are used. Pinned in Task 2.
5. **Mashing E / Enter:** while the dialog is open, or on an already answered question mark, this never asks twice or counts twice. Pinned in Task 7.

---

## File Map

```
package.json, tsconfig.json, vite.config.ts, index.html, playwright.config.ts, README.md
src/main.ts                 app boot + screen flow (menu → game → results)
src/style.css               all styles incl. print stylesheet
src/strings.ts              Czech strings, plural forms, time formatting
src/data/questionSet.ts     types, validation, loading index + sets
src/data/shuffle.ts         seedable RNG, shuffle, prepared questions
src/world/layout.ts         maze data, floor grid, wall segments, reachability, regionAt
src/world/textures.ts       canvas-generated textures
src/world/builder.ts        layout → wall/floor/ceiling meshes
src/world/props.ts          doors, question marks, torches + light pool, portal, bursts
src/game/rules.ts           answered set, door groups
src/game/session.ts         timer, question queue, answer records, result
src/game/collision.ts       circle-vs-segment resolution
src/game/player.ts          first-person movement
src/game/interaction.ts     target picking
src/game/logic.ts           GameLogic event machine
src/game/input.ts           keyboard/mouse/pointer-lock → InputState + actions
src/game/game.ts            renderer, loop, modes, wiring logic ↔ props ↔ UI handlers
src/ui/hud.ts, questionDialog.ts, pauseMenu.ts, minimap.ts, menu.ts, results.ts
public/tests/index.json, Z1..Z3.json, S1..S3.json
docs/otazky.md
tests/*.test.ts, tests/helpers.ts
e2e/smoke.spec.ts
```

---

### Task 1: Project scaffold + Czech strings

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/style.css`, `src/main.ts`, `src/strings.ts`
- Test: `tests/strings.test.ts`

**Interfaces:**
- Produces: `S` (string table), `remainingQuestions(n: number): string`, `formatTime(ms: number): string` from `src/strings.ts`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "castlequest-ng",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm i three@^0.186.1 && npm i -D typescript@~5.9.3 vite@^8.3.4 vitest@^5.0.5 @types/three@^0.186.0 @types/node`
Expected: installs without errors. `package-lock.json` is created.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "e2e", "*.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CastleQuest</title>
  </head>
  <body>
    <canvas id="scene"></canvas>
    <div id="ui"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/style.css` (base styles; later tasks append)**

```css
:root {
  --bg: #0b0907;
  --panel: rgba(20, 16, 12, 0.92);
  --text: #f1e8d8;
  --muted: #b9ab93;
  --accent: #e0a84a;
  --silver: #d8dee8;
  --gold: #ffc94a;
  --good: #6fdc8c;
  --bad: #ff6b6b;
  font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); overflow: hidden; }
#scene { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
#ui { position: fixed; inset: 0; pointer-events: none; }
.hidden { display: none !important; }
.panel {
  pointer-events: auto; background: var(--panel); border: 1px solid #5a4630; border-radius: 12px;
  padding: 24px 28px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6); max-width: min(720px, calc(100vw - 32px));
}
.overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: auto; background: rgba(0, 0, 0, 0.45); }
button {
  font: inherit; font-size: 1.05rem; color: var(--text); background: #3a2c1d; border: 1px solid #7a5c3a;
  border-radius: 8px; padding: 10px 18px; cursor: pointer;
}
button:hover, button:focus-visible { background: #57402a; outline: 2px solid var(--accent); outline-offset: 1px; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
h1, h2 { margin: 0 0 12px; color: var(--accent); }
```

- [ ] **Step 7: Create placeholder `src/main.ts`**

```ts
import './style.css';
```

- [ ] **Step 8: Write the failing test `tests/strings.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatTime, remainingQuestions } from '../src/strings';

describe('remainingQuestions', () => {
  it('uses the singular form for 1', () => {
    expect(remainingQuestions(1)).toBe('Zbývá poslední otázka!');
  });
  it('uses "otázky" for 2–4', () => {
    expect(remainingQuestions(2)).toBe('Zbývají ještě 2 otázky!');
    expect(remainingQuestions(4)).toBe('Zbývají ještě 4 otázky!');
  });
  it('uses "otázek" for 5 and more', () => {
    expect(remainingQuestions(5)).toBe('Zbývá ještě 5 otázek!');
    expect(remainingQuestions(12)).toBe('Zbývá ještě 12 otázek!');
    expect(remainingQuestions(18)).toBe('Zbývá ještě 18 otázek!');
  });
});

describe('formatTime', () => {
  it('formats m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_000)).toBe('1:05');
    expect(formatTime(3_599_999)).toBe('59:59');
    expect(formatTime(3_600_000)).toBe('60:00');
  });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `npx vitest run tests/strings.test.ts`
Expected: FAIL. The module `../src/strings` cannot be resolved.

- [ ] **Step 10: Create `src/strings.ts`**

```ts
export const S = {
  title: 'CastleQuest',
  play: 'Hrát',
  chooseSet: 'Vyber sadu otázek',
  selectedSet: 'Sada otázek',
  nameLabel: 'Jméno (nepovinné)',
  anonymous: 'Bez jména',
  loadingSets: 'Načítám sady otázek…',
  indexLoadError: 'Nepodařilo se načíst seznam sad otázek.',
  setLoadError: 'Soubor se nepodařilo načíst.',
  unavailable: 'nedostupná',
  goal:
    'Najdi a zodpověz všechny otazníky. Stříbrné otazníky otevřou stříbrné dveře do vnitřního okruhu, ' +
    'zlaté otazníky otevřou zlaté dveře do středové místnosti. Tam najdeš východ.',
  controls: [
    'Klikni do hry a rozhlížej se myší.',
    'W A S D nebo šipky – chůze',
    'E, Enter nebo mezerník – použít (otazník, dveře)',
    'M – mapa, Esc – pauza, F1 nebo H – nápověda',
    'Bez myši: šipky vlevo a vpravo otáčejí pohledem.',
  ],
  gameStart: 'Hra začíná! Najdi všechny otazníky.',
  correct: 'Správně!',
  wrong: 'Špatně!',
  silverOpen: 'Dveře do vnitřního okruhu se otevírají!',
  goldOpen: 'Dveře do středové místnosti se otevírají!',
  promptQmark: 'E – otázka',
  promptDoor: 'E – otevřít dveře',
  promptLocked: 'E – zamčené dveře',
  questionTitle: 'Otázka',
  closeHint: 'Klávesy 1–4 vyberou odpověď, Esc zavře bez odpovědi.',
  pauseTitle: 'Pauza',
  clickToContinue: 'Klikni pro pokračování',
  continue: 'Pokračovat',
  help: 'Nápověda',
  quit: 'Ukončit hru',
  quitConfirm: 'Opravdu ukončit hru? Výsledky se neuloží.',
  resultsTitle: 'Výsledky',
  name: 'Jméno',
  set: 'Sada',
  date: 'Datum',
  time: 'Čas',
  score: 'Správně',
  question: 'Otázka',
  yourAnswer: 'Tvoje odpověď',
  correctAnswer: 'Správná odpověď',
  playAgain: 'Hrát znovu',
  print: 'Vytisknout / uložit PDF',
  noWebGL:
    'Tvůj prohlížeč nepodporuje WebGL 2. Zkus prohlížeč aktualizovat nebo v nastavení zapnout hardwarovou akceleraci.',
} as const;

export function remainingQuestions(n: number): string {
  if (n === 1) return 'Zbývá poslední otázka!';
  if (n >= 2 && n <= 4) return `Zbývají ještě ${n} otázky!`;
  return `Zbývá ještě ${n} otázek!`;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 11: Run the tests and the build**

Run: `npx vitest run && npm run build`
Expected: 4 tests PASS. The build writes `dist/index.html` and `dist/assets/*`.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src tests
git commit -m "chore: scaffold Vite + TypeScript project with Czech strings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Question data — validation, loading, shuffling

**Files:**
- Create: `src/data/questionSet.ts`, `src/data/shuffle.ts`, `tests/helpers.ts`
- Test: `tests/questionSet.test.ts`, `tests/shuffle.test.ts`

**Interfaces:**
- Produces (`questionSet.ts`):
  - `interface Question { q: string; answers: string[]; correct: number }`
  - `interface QuestionSet { id: string; name: string; school?: string; level?: number; questions: Question[] }`
  - `interface SetIndexEntry { id: string; name: string; file: string }`
  - `type ValidationResult = { ok: true; set: QuestionSet } | { ok: false; error: string }`
  - `type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>`
  - `const QUESTIONS_PER_GAME = 30`
  - `validateSet(data: unknown): ValidationResult`
  - `loadIndex(baseUrl: string, fetchFn?: FetchLike): Promise<SetIndexEntry[]>`
  - `loadSet(baseUrl: string, entry: SetIndexEntry, fetchFn?: FetchLike): Promise<ValidationResult>`
- Produces (`shuffle.ts`):
  - `type Rng = () => number`
  - `mulberry32(seed: number): Rng`
  - `shuffle<T>(items: readonly T[], rng: Rng): T[]`
  - `interface PreparedQuestion { q: string; answers: string[]; correct: number }`
  - `prepareQuestion(question: Question, rng: Rng): PreparedQuestion`
  - `pickQuestions(questions: readonly Question[], count: number, rng: Rng): PreparedQuestion[]`
- Produces (`tests/helpers.ts`): `makeSet(count?: number, id?: string): QuestionSet`

- [ ] **Step 1: Create `tests/helpers.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `tests/questionSet.test.ts`**

```ts
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/questionSet.test.ts`
Expected: FAIL. The module `../src/data/questionSet` is not found.

- [ ] **Step 4: Create `src/data/questionSet.ts`**

```ts
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
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/questionSet.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 6: Write the failing test `tests/shuffle.test.ts`**

```ts
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
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run tests/shuffle.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 8: Create `src/data/shuffle.ts`**

```ts
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
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/data tests
git commit -m "feat: question set validation, loading and shuffling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: New question content (6 sets) + teacher guide

**Files:**
- Create: `public/tests/index.json`, `public/tests/Z1.json`, `Z2.json`, `Z3.json`, `S1.json`, `S2.json`, `S3.json`, `docs/otazky.md`
- Test: `tests/shippedSets.test.ts`

**Interfaces:**
- Consumes: `validateSet` from Task 2.
- Produces: the shipped data files that later tasks load from `./tests/`.

**Content rules** (from spec §6.2). Every set has exactly 30 questions: 5 for each of six topics, in this order:
1. Computer parts and devices
2. Keyboard and mouse
3. Files, folders and programs
4. The internet, web and email
5. Safety and privacy online (passwords, strangers, personal data, cyberbullying)
6. Healthy and polite computer use

Further rules:
- Exactly one clearly correct answer, and plausible but clearly wrong distractors.
- No trick questions, no brand trivia beyond well-known basics, and no outdated technology as a correct answer.
- **Original text only.** Do not copy or paraphrase questions from `legacy/CastleQuest/tests/*.xml`.
- The position of the correct answer in the file doesn't matter, because answers are shuffled at runtime.

Audiences:

| Set | Audience | Language level |
|-----|----------|----------------|
| Z1 | primary school, grades 3–5 | simple, concrete |
| Z2 | primary school, grades 6–7 | everyday terms (prohlížeč, složka, příloha) |
| Z3 | primary school, grades 8–9 | more abstract (zálohování, phishing, dvoufázové ověření, cloud) |
| S1 | special school, beginner | very short sentences, everyday objects, no jargon |
| S2 | special school, intermediate | short sentences, basic terms explained by context |
| S3 | special school, advanced | like Z1–Z2 in difficulty, still short wording |

Calibration examples. Use these as the first question of the matching topic:

```json
// Z1 – topic 1
{ "q": "Které zařízení ukazuje obraz z počítače?", "answers": ["monitor", "klávesnice", "myš", "reproduktor"], "correct": 0 }
// Z2 – topic 4
{ "q": "Jak se jmenuje program, ve kterém si prohlížíme webové stránky?", "answers": ["webový prohlížeč", "textový editor", "kalkulačka", "antivirus"], "correct": 0 }
// Z3 – topic 5
{ "q": "Přijde ti e-mail „z banky“ s odkazem a žádostí o heslo. Co to nejspíš je?", "answers": ["podvod (phishing)", "běžná zpráva od banky", "aktualizace systému", "reklama na spoření"], "correct": 0 }
// S1 – topic 2
{ "q": "Čím píšeme písmena do počítače?", "answers": ["klávesnicí", "monitorem", "sluchátky", "tiskárnou"], "correct": 0 }
// S2 – topic 6
{ "q": "Co uděláš, když tě při práci na počítači bolí oči?", "answers": ["udělám si přestávku", "přiblížím se k obrazovce", "zhasnu světlo", "budu hrát dál"], "correct": 0 }
// S3 – topic 3
{ "q": "Kam si v počítači uložíš svou fotku, abys ji později našel?", "answers": ["do složky", "do koše", "do tiskárny", "do reproduktoru"], "correct": 0 }
```

- [ ] **Step 1: Write the failing test `tests/shippedSets.test.ts`**

```ts
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
  it('index lists the six sets in order', () => {
    expect(index.map((e) => e.id)).toEqual(['Z1', 'Z2', 'Z3', 'S1', 'S2', 'S3']);
  });
  it('each set is valid, matches its index entry and has exactly 30 questions', () => {
    sets.forEach((set, i) => {
      expect(set.id).toBe(index[i].id);
      expect(set.name).toBe(index[i].name);
      expect(set.questions).toHaveLength(30);
    });
  });
  it('no question repeats within a school type', () => {
    for (const school of ['Z', 'S']) {
      const texts = sets.filter((s) => s.id.startsWith(school)).flatMap((s) => s.questions.map((q) => q.q));
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/shippedSets.test.ts`
Expected: FAIL with ENOENT for `public/tests/index.json`.

- [ ] **Step 3: Create `public/tests/index.json`**

```json
[
  { "id": "Z1", "name": "Základní škola – úroveň 1", "file": "Z1.json" },
  { "id": "Z2", "name": "Základní škola – úroveň 2", "file": "Z2.json" },
  { "id": "Z3", "name": "Základní škola – úroveň 3", "file": "Z3.json" },
  { "id": "S1", "name": "Speciální škola – úroveň 1", "file": "S1.json" },
  { "id": "S2", "name": "Speciální škola – úroveň 2", "file": "S2.json" },
  { "id": "S3", "name": "Speciální škola – úroveň 3", "file": "S3.json" }
]
```

- [ ] **Step 4: Write the six set files**

Each file has this structure. `name` must equal the index entry, `school` is `"Z"` or `"S"`, and `level` is 1–3:

```json
{
  "id": "Z1",
  "name": "Základní škola – úroveň 1",
  "school": "Z",
  "level": 1,
  "questions": [
    { "q": "…", "answers": ["…", "…", "…", "…"], "correct": 0 }
  ]
}
```

Write 30 original questions per file following the content rules and calibration examples above: 5 per topic, in topic order. Save as UTF-8 without BOM.

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/shippedSets.test.ts`
Expected: PASS (3 tests). If validation fails, the error names the file and question number.

- [ ] **Step 6: Create `docs/otazky.md`**

````markdown
# Jak napsat vlastní sadu otázek

Sady otázek jsou soubory JSON ve složce `tests/` (ve zdrojích `public/tests/`).

## 1. Vytvoř soubor sady

Například `tests/M1.json`:

```json
{
  "id": "M1",
  "name": "Matematika – 5. třída",
  "questions": [
    { "q": "Kolik je 7 × 8?", "answers": ["56", "54", "48", "64"], "correct": 0 }
  ]
}
```

- `id` – krátký jedinečný kód sady (písmena a čísla).
- `name` – název, který uvidí žák v nabídce.
- `questions` – **alespoň 30 otázek**. Je-li jich víc, hra jich pokaždé náhodně vybere 30.
- `q` – text otázky.
- `answers` – **přesně 4 různé odpovědi**.
- `correct` – pořadí správné odpovědi: **0 = první, 1 = druhá, 2 = třetí, 3 = čtvrtá**.

Pořadí odpovědí se ve hře zamíchá, takže na pozici správné odpovědi v souboru nezáleží.

## 2. Přidej sadu do seznamu

Do `tests/index.json` přidej řádek:

```json
{ "id": "M1", "name": "Matematika – 5. třída", "file": "M1.json" }
```

## 3. Odkaz přímo na sadu

`https://adresa-hry/?test=M1` otevře hru s předvybranou sadou M1.

## Zásady dobrých otázek

- Jedna odpověď je jednoznačně správná, ostatní jsou věrohodné, ale jasně špatné.
- Žádné chytáky a dvojí zápory.
- Krátké věty, slova přiměřená věku žáků.
- Soubor ukládej v kódování UTF-8.

Když je v sadě chyba, hra ji v nabídce označí jako nedostupnou a napíše, ve které otázce chyba je.
````

- [ ] **Step 7: Commit**

```bash
git add public/tests docs/otazky.md tests/shippedSets.test.ts
git commit -m "content: six new Czech question sets and teacher guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Maze layout data

**Files:**
- Create: `src/world/layout.ts`
- Test: `tests/layout.test.ts`

**Interfaces:**
- Produces:
  - Types: `Vec2 {x,y}`, `Rect {x0,y0,x1,y1}`, `Group = 'silver'|'gold'`, `DoorKind = 'grey'|Group`, `Region {id, rect}`, `Door {id, kind, x, y, axis: 'x'|'y'}`, `QMarkSpot {id, group, x, y}`, `Torch {x, y, nx, ny}`, `Chamfer {a, b}`, `Segment {ax, ay, bx, by}`, `WallSegment extends Segment {nx, ny}`, `Layout {regions, doors, qmarks, torches, chamfers, start, startHeading, exit, bounds}`
  - Constants: `WALL_HEIGHT = 4.5`, `DOOR_WIDTH = 4`, `LAYOUT: Layout`
  - Functions: `rotate(p, quarterTurns): Vec2`, `rotateRect(r, quarterTurns): Rect`, `buildLayout(): Layout`, `class FloorGrid { minX; minY; width; height; isFloor(cx, cy): boolean }`, `wallSegments(grid): WallSegment[]`, `chamferSegments(layout): WallSegment[]`, `allWalls(layout, grid): WallSegment[]`, `doorSegment(door): Segment`, `regionAt(layout, x, y): Region | undefined`, `cellKey(cx, cy): string`, `reachableCells(layout, grid, isDoorOpen: (door: Door) => boolean): Set<string>`
- Door `axis` is the direction the 4 m panel spans. Door ids equal their index in `layout.doors`. Question-mark ids equal their index in `layout.qmarks`: silver 0–17, then gold 18–29.

Layout, with the north side defined and rotated four times about the origin. All rectangles are integer metres:

| Region | Rect (north side) |
|---|---|
| outer corner | 23,23 → 33,33 |
| outer middle room | −5,23 → 5,33 |
| outer corridors | 5,26 → 23,30 and −23,26 → −5,30 |
| outer→inner link (silver door at y=21) | −2,20 → 2,23 |
| inner corner | 12,12 → 20,20 |
| inner middle room | −4,12 → 4,20 |
| inner corridors | 4,14 → 12,18 and −12,14 → −4,18 |
| inner→centre link (gold door at y=10) | −2,8 → 2,12 |
| centre (once) | −8,−8 → 8,8, with chamfer (4,8)→(8,4) per side |
| entrance (once) | −2,−40 → 2,−33, with a grey door at y=−35; start (0,−38.5) facing north |

- [ ] **Step 1: Write the failing test `tests/layout.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  DOOR_WIDTH, FloorGrid, LAYOUT, allWalls, cellKey, chamferSegments, reachableCells, regionAt, rotate, wallSegments,
  type Door,
} from '../src/world/layout';
import { closestPointOnSegmentForTest } from './layoutHelpers';

const grid = new FloorGrid(LAYOUT);
const cellOf = (p: { x: number; y: number }) => cellKey(Math.floor(p.x), Math.floor(p.y));

describe('rotate', () => {
  it('turns counter-clockwise by quarter turns without -0', () => {
    expect(rotate({ x: 1, y: 0 }, 1)).toEqual({ x: 0, y: 1 });
    expect(rotate({ x: 3, y: 2 }, 2)).toEqual({ x: -3, y: -2 });
    expect(rotate({ x: 0, y: 5 }, 3)).toEqual({ x: 5, y: 0 });
  });
});

describe('LAYOUT contents', () => {
  it('has 18 silver and 12 gold question marks with index ids', () => {
    expect(LAYOUT.qmarks.filter((q) => q.group === 'silver')).toHaveLength(18);
    expect(LAYOUT.qmarks.filter((q) => q.group === 'gold')).toHaveLength(12);
    LAYOUT.qmarks.forEach((q, i) => expect(q.id).toBe(i));
    expect(LAYOUT.qmarks.slice(0, 18).every((q) => q.group === 'silver')).toBe(true);
  });
  it('has 33 grey, 4 silver and 4 gold doors with index ids', () => {
    const count = (k: Door['kind']) => LAYOUT.doors.filter((d) => d.kind === k).length;
    expect([count('grey'), count('silver'), count('gold')]).toEqual([33, 4, 4]);
    LAYOUT.doors.forEach((d, i) => expect(d.id).toBe(i));
  });
  it('places start, exit, question marks and torches on floor', () => {
    expect(grid.isFloor(Math.floor(LAYOUT.start.x), Math.floor(LAYOUT.start.y))).toBe(true);
    expect(grid.isFloor(Math.floor(LAYOUT.exit.x), Math.floor(LAYOUT.exit.y))).toBe(true);
    for (const q of LAYOUT.qmarks) expect(grid.isFloor(Math.floor(q.x), Math.floor(q.y)), `qmark ${q.id}`).toBe(true);
    for (const t of LAYOUT.torches) {
      expect(grid.isFloor(Math.floor(t.x + t.nx * 0.5), Math.floor(t.y + t.ny * 0.5))).toBe(true);
    }
  });
  it('keeps question marks at least 0.8 m from walls and torches within 0.25 m of a wall', () => {
    const walls = allWalls(LAYOUT, grid);
    const nearest = (x: number, y: number) =>
      Math.min(...walls.map((s) => { const c = closestPointOnSegmentForTest(x, y, s); return Math.hypot(x - c.x, y - c.y); }));
    for (const q of LAYOUT.qmarks) expect(nearest(q.x, q.y), `qmark ${q.id}`).toBeGreaterThanOrEqual(0.8);
    for (const t of LAYOUT.torches) expect(nearest(t.x, t.y)).toBeLessThanOrEqual(0.25);
  });
  it('puts every door on integer grid lines inside an opening that it seals', () => {
    const half = DOOR_WIDTH / 2;
    for (const d of LAYOUT.doors) {
      expect(Number.isInteger(d.x) && Number.isInteger(d.y), `door ${d.id}`).toBe(true);
      const spanCells: [number, number][] = [];
      for (let k = -half; k < half; k++) {
        if (d.axis === 'x') spanCells.push([d.x + k, d.y - 1], [d.x + k, d.y]);
        else spanCells.push([d.x - 1, d.y + k], [d.x, d.y + k]);
      }
      expect(spanCells.every(([cx, cy]) => grid.isFloor(cx, cy)), `door ${d.id} opening`).toBe(true);
      const sides: [number, number][][] =
        d.axis === 'x'
          ? [[[d.x - half - 1, d.y - 1], [d.x + half, d.y - 1]], [[d.x - half - 1, d.y], [d.x + half, d.y]]]
          : [[[d.x - 1, d.y - half - 1], [d.x - 1, d.y + half]], [[d.x, d.y - half - 1], [d.x, d.y + half]]];
      expect(sides.some((ends) => ends.every(([cx, cy]) => !grid.isFloor(cx, cy))), `door ${d.id} sealed`).toBe(true);
    }
  });
});

describe('walls', () => {
  it('every grid wall has floor in front and solid behind', () => {
    const walls = wallSegments(grid);
    expect(walls.length).toBeGreaterThan(50);
    for (const s of walls) {
      const mx = (s.ax + s.bx) / 2, my = (s.ay + s.by) / 2;
      expect(grid.isFloor(Math.floor(mx + s.nx * 0.5), Math.floor(my + s.ny * 0.5))).toBe(true);
      expect(grid.isFloor(Math.floor(mx - s.nx * 0.5), Math.floor(my - s.ny * 0.5))).toBe(false);
    }
  });
  it('chamfer normals point toward the exit', () => {
    const ch = chamferSegments(LAYOUT);
    expect(ch).toHaveLength(4);
    for (const s of ch) {
      const mx = (s.ax + s.bx) / 2, my = (s.ay + s.by) / 2;
      expect(s.nx * (LAYOUT.exit.x - mx) + s.ny * (LAYOUT.exit.y - my)).toBeGreaterThan(0);
      expect(Math.hypot(s.nx, s.ny)).toBeCloseTo(1);
    }
  });
});

describe('reachability', () => {
  const reach = (open: (d: Door) => boolean) => reachableCells(LAYOUT, grid, open);
  it('with all doors closed only the entrance before its door is reachable', () => {
    const cells = reach(() => false);
    expect(cells.size).toBe(5 * 4); // x -2..1, rows y -40..-36 (entrance floor south of the door at y=-35)
  });
  it('grey doors open: all silver reachable, no gold, no exit', () => {
    const cells = reach((d) => d.kind === 'grey');
    for (const q of LAYOUT.qmarks) expect(cells.has(cellOf(q)), `qmark ${q.id}`).toBe(q.group === 'silver');
    expect(cells.has(cellOf(LAYOUT.exit))).toBe(false);
  });
  it('silver open too: gold reachable, exit not', () => {
    const cells = reach((d) => d.kind !== 'gold');
    for (const q of LAYOUT.qmarks) expect(cells.has(cellOf(q))).toBe(true);
    expect(cells.has(cellOf(LAYOUT.exit))).toBe(false);
  });
  it('all open: exit reachable', () => {
    expect(reach(() => true).has(cellOf(LAYOUT.exit))).toBe(true);
  });
});

describe('regionAt', () => {
  it('finds regions by point', () => {
    expect(regionAt(LAYOUT, 0, 0)?.id).toBe('center');
    expect(regionAt(LAYOUT, 0, -38)?.id).toBe('entrance');
    expect(regionAt(LAYOUT, 28, 28)?.id).toBe('outer-corner-n');
    expect(regionAt(LAYOUT, 0, -28)?.id).toBe('outer-mid-s');
    expect(regionAt(LAYOUT, 22, 0)?.id).toBe('link-outer-e');
    expect(regionAt(LAYOUT, 22, 10)).toBeUndefined();
  });
});
```

Also create `tests/layoutHelpers.ts`. This is local geometry for the test only, so the test doesn't depend on Task 6:

```ts
import type { Segment } from '../src/world/layout';

export function closestPointOnSegmentForTest(px: number, py: number, s: Segment) {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2));
  return { x: s.ax + t * dx, y: s.ay + t * dy };
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/layout.test.ts`
Expected: FAIL. The module `../src/world/layout` is not found.

- [ ] **Step 3: Create `src/world/layout.ts`**

```ts
export interface Vec2 { x: number; y: number }
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export type Group = 'silver' | 'gold';
export type DoorKind = 'grey' | Group;
export interface Region { id: string; rect: Rect }
export interface Door { id: number; kind: DoorKind; x: number; y: number; axis: 'x' | 'y' }
export interface QMarkSpot { id: number; group: Group; x: number; y: number }
export interface Torch { x: number; y: number; nx: number; ny: number }
export interface Chamfer { a: Vec2; b: Vec2 }
export interface Segment { ax: number; ay: number; bx: number; by: number }
export interface WallSegment extends Segment { nx: number; ny: number }
export interface Layout {
  regions: Region[];
  doors: Door[];
  qmarks: QMarkSpot[];
  torches: Torch[];
  chamfers: Chamfer[];
  start: Vec2;
  startHeading: number;
  exit: Vec2;
  bounds: Rect;
}

export const WALL_HEIGHT = 4.5;
export const DOOR_WIDTH = 4;

export function rotate(p: Vec2, quarterTurns: number): Vec2 {
  let { x, y } = p;
  const n = ((quarterTurns % 4) + 4) % 4;
  for (let i = 0; i < n; i++) [x, y] = [-y, x];
  return { x: x + 0, y: y + 0 }; // "+ 0" turns -0 into 0
}

export function rotateRect(r: Rect, quarterTurns: number): Rect {
  const a = rotate({ x: r.x0, y: r.y0 }, quarterTurns);
  const b = rotate({ x: r.x1, y: r.y1 }, quarterTurns);
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

const SIDES = ['n', 'w', 's', 'e'] as const; // quarter turns 0..3, counter-clockwise from north

export function buildLayout(): Layout {
  const regions: Region[] = [];
  const doors: Omit<Door, 'id'>[] = [];
  const silver: Vec2[] = [];
  const gold: Vec2[] = [];
  const torches: Torch[] = [];
  const chamfers: Chamfer[] = [];

  for (let q = 0; q < 4; q++) {
    const s = SIDES[q];
    const R = (x0: number, y0: number, x1: number, y1: number) => rotateRect({ x0, y0, x1, y1 }, q);
    const P = (x: number, y: number) => rotate({ x, y }, q);
    const door = (kind: DoorKind, x: number, y: number, axis: 'x' | 'y') => {
      const p = P(x, y);
      const rotated: 'x' | 'y' = q % 2 === 0 ? axis : axis === 'x' ? 'y' : 'x';
      doors.push({ kind, x: p.x, y: p.y, axis: rotated });
    };
    const torch = (x: number, y: number, nx: number, ny: number) => {
      const p = P(x, y);
      const n = rotate({ x: nx, y: ny }, q);
      torches.push({ x: p.x, y: p.y, nx: n.x, ny: n.y });
    };

    regions.push(
      { id: `outer-corner-${s}`, rect: R(23, 23, 33, 33) },
      { id: `outer-mid-${s}`, rect: R(-5, 23, 5, 33) },
      { id: `outer-corr-${s}-a`, rect: R(5, 26, 23, 30) },
      { id: `outer-corr-${s}-b`, rect: R(-23, 26, -5, 30) },
      { id: `link-outer-${s}`, rect: R(-2, 20, 2, 23) },
      { id: `inner-corner-${s}`, rect: R(12, 12, 20, 20) },
      { id: `inner-mid-${s}`, rect: R(-4, 12, 4, 20) },
      { id: `inner-corr-${s}-a`, rect: R(4, 14, 12, 18) },
      { id: `inner-corr-${s}-b`, rect: R(-12, 14, -4, 18) },
      { id: `link-inner-${s}`, rect: R(-2, 8, 2, 12) },
    );

    for (const x of [5, 23, -5, -23]) door('grey', x, 28, 'y');
    for (const x of [4, 12, -4, -12]) door('grey', x, 16, 'y');
    door('silver', 0, 21, 'x');
    door('gold', 0, 10, 'x');

    silver.push(P(28, 28));
    const mid: [number, number][] = q === 2 ? [[-3, 31], [3, 31]] : [[-3, 31], [3, 31], [-3, 25], [3, 25]];
    for (const [x, y] of mid) silver.push(P(x, y));
    gold.push(P(16, 16), P(-3, 19), P(3, 19));

    torch(28, 32.8, 0, -1);
    torch(32.8, 28, -1, 0);
    torch(-3, 32.8, 0, -1);
    torch(3, 32.8, 0, -1);
    torch(14, 29.8, 0, -1);
    torch(-14, 29.8, 0, -1);
    torch(16, 19.8, 0, -1);
    torch(8, 17.8, 0, -1);
    torch(-8, 17.8, 0, -1);
    torch(5.86, 5.86, -Math.SQRT1_2, -Math.SQRT1_2);

    chamfers.push({ a: P(4, 8), b: P(8, 4) });
  }

  regions.push({ id: 'center', rect: { x0: -8, y0: -8, x1: 8, y1: 8 } });
  regions.push({ id: 'entrance', rect: { x0: -2, y0: -40, x1: 2, y1: -33 } });
  doors.push({ kind: 'grey', x: 0, y: -35, axis: 'x' });
  torches.push({ x: 1.8, y: -37, nx: -1, ny: 0 });

  const bounds = regions.reduce(
    (b, { rect: r }) => ({
      x0: Math.min(b.x0, r.x0), y0: Math.min(b.y0, r.y0), x1: Math.max(b.x1, r.x1), y1: Math.max(b.y1, r.y1),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  );

  return {
    regions,
    doors: doors.map((d, id) => ({ id, ...d })),
    qmarks: [
      ...silver.map((p, i) => ({ id: i, group: 'silver' as const, ...p })),
      ...gold.map((p, i) => ({ id: silver.length + i, group: 'gold' as const, ...p })),
    ],
    torches,
    chamfers,
    start: { x: 0, y: -38.5 },
    startHeading: Math.PI / 2,
    exit: { x: 0, y: 0 },
    bounds,
  };
}

export const LAYOUT: Layout = buildLayout();

export class FloorGrid {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
  private readonly cells: Uint8Array;

  constructor(layout: Layout) {
    const b = layout.bounds;
    this.minX = b.x0;
    this.minY = b.y0;
    this.width = b.x1 - b.x0;
    this.height = b.y1 - b.y0;
    this.cells = new Uint8Array(this.width * this.height);
    for (const { rect } of layout.regions) {
      for (let y = rect.y0; y < rect.y1; y++) {
        for (let x = rect.x0; x < rect.x1; x++) this.cells[(y - this.minY) * this.width + (x - this.minX)] = 1;
      }
    }
  }

  isFloor(cx: number, cy: number): boolean {
    const ix = cx - this.minX, iy = cy - this.minY;
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return false;
    return this.cells[iy * this.width + ix] === 1;
  }
}

/** Walls along grid edges between floor and solid cells, merged into maximal straight runs. */
export function wallSegments(grid: FloorGrid): WallSegment[] {
  const out: WallSegment[] = [];
  const { minX, minY, width, height } = grid;
  for (let gy = minY; gy <= minY + height; gy++) {
    let run: WallSegment | null = null;
    for (let cx = minX; cx < minX + width; cx++) {
      const south = grid.isFloor(cx, gy - 1), north = grid.isFloor(cx, gy);
      const ny = south && !north ? -1 : north && !south ? 1 : 0;
      if (ny !== 0 && run && run.ny === ny && run.bx === cx) run.bx = cx + 1;
      else {
        if (run) out.push(run);
        run = ny !== 0 ? { ax: cx, ay: gy, bx: cx + 1, by: gy, nx: 0, ny } : null;
      }
    }
    if (run) out.push(run);
  }
  for (let gx = minX; gx <= minX + width; gx++) {
    let run: WallSegment | null = null;
    for (let cy = minY; cy < minY + height; cy++) {
      const west = grid.isFloor(gx - 1, cy), east = grid.isFloor(gx, cy);
      const nx = west && !east ? -1 : east && !west ? 1 : 0;
      if (nx !== 0 && run && run.nx === nx && run.by === cy) run.by = cy + 1;
      else {
        if (run) out.push(run);
        run = nx !== 0 ? { ax: gx, ay: cy, bx: gx, by: cy + 1, nx, ny: 0 } : null;
      }
    }
    if (run) out.push(run);
  }
  return out;
}

export function chamferSegments(layout: Layout): WallSegment[] {
  return layout.chamfers.map(({ a, b }) => {
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.hypot(nx, ny);
    nx /= len;
    ny /= len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (nx * (layout.exit.x - mx) + ny * (layout.exit.y - my) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny };
  });
}

export function allWalls(layout: Layout, grid: FloorGrid): WallSegment[] {
  return [...wallSegments(grid), ...chamferSegments(layout)];
}

export function doorSegment(door: Door): Segment {
  const h = DOOR_WIDTH / 2;
  return door.axis === 'x'
    ? { ax: door.x - h, ay: door.y, bx: door.x + h, by: door.y }
    : { ax: door.x, ay: door.y - h, bx: door.x, by: door.y + h };
}

export function regionAt(layout: Layout, x: number, y: number): Region | undefined {
  return layout.regions.find(({ rect: r }) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1);
}

export function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function edgeKey(ax: number, ay: number, bx: number, by: number): string {
  return ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
}

export function reachableCells(layout: Layout, grid: FloorGrid, isDoorOpen: (door: Door) => boolean): Set<string> {
  const blocked = new Set<string>();
  const half = DOOR_WIDTH / 2;
  for (const d of layout.doors) {
    if (isDoorOpen(d)) continue;
    for (let k = -half; k < half; k++) {
      blocked.add(d.axis === 'x' ? edgeKey(d.x + k, d.y - 1, d.x + k, d.y) : edgeKey(d.x - 1, d.y + k, d.x, d.y + k));
    }
  }
  const start = { x: Math.floor(layout.start.x), y: Math.floor(layout.start.y) };
  const seen = new Set<string>([cellKey(start.x, start.y)]);
  const stack = [start];
  while (stack.length > 0) {
    const c = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      const key = cellKey(nx, ny);
      if (seen.has(key) || !grid.isFloor(nx, ny) || blocked.has(edgeKey(c.x, c.y, nx, ny))) continue;
      seen.add(key);
      stack.push({ x: nx, y: ny });
    }
  }
  return seen;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/layout.ts tests/layout.test.ts tests/layoutHelpers.ts
git commit -m "feat: maze layout data with grid walls and reachability

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rules and session

**Files:**
- Create: `src/game/rules.ts`, `src/game/session.ts`
- Test: `tests/rules.test.ts`, `tests/session.test.ts`

**Interfaces:**
- Consumes: `Group`, `LAYOUT` (Task 4); `QuestionSet`, `QUESTIONS_PER_GAME` (Task 2); `Rng`, `pickQuestions`, `PreparedQuestion` (Task 2); `makeSet` (tests).
- Produces (`rules.ts`):
  - `type RuleEvent = { type: 'answered'; qmarkId: number; correct: boolean } | { type: 'groupComplete'; group: Group }`
  - `class Rules`, constructed as `new Rules(qmarks: readonly { id: number; group: Group }[])`, with:
    - `isDone(id): boolean`
    - getters `doneCount`, `total`
    - `remaining(group): number`
    - `isGroupComplete(group): boolean`
    - `markAnswered(id, correct): RuleEvent[]`, which throws on an unknown id and returns `[]` if the id is already done
- Produces (`session.ts`):
  - `interface AnswerRecord { question: string; answers: string[]; chosen: number; correct: number; isCorrect: boolean }`
  - `interface SessionResult { playerName: string; setId: string; setName: string; date: Date; elapsedMs: number; correctCount: number; total: number; records: AnswerRecord[] }`
  - `class Session`, constructed as `new Session({ set, playerName, rng, now?, questionCount? })`, with:
    - `readonly questions: PreparedQuestion[]`
    - `currentQuestion(): PreparedQuestion | undefined`
    - `answer(choice: number): AnswerRecord`
    - `pause()`, `resume()`, getter `paused`
    - `elapsedMs()`
    - `result(): SessionResult`

- [ ] **Step 1: Write the failing test `tests/rules.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { Rules } from '../src/game/rules';
import { LAYOUT } from '../src/world/layout';

const silverIds = LAYOUT.qmarks.filter((q) => q.group === 'silver').map((q) => q.id);
const goldIds = LAYOUT.qmarks.filter((q) => q.group === 'gold').map((q) => q.id);

describe('Rules', () => {
  it('starts with nothing done', () => {
    const r = new Rules(LAYOUT.qmarks);
    expect(r.total).toBe(30);
    expect(r.doneCount).toBe(0);
    expect(r.remaining('silver')).toBe(18);
    expect(r.remaining('gold')).toBe(12);
  });
  it('completes the silver group on the 18th answer, wrong answers included', () => {
    const r = new Rules(LAYOUT.qmarks);
    silverIds.slice(0, 17).forEach((id, i) => {
      expect(r.markAnswered(id, i % 2 === 0)).toEqual([{ type: 'answered', qmarkId: id, correct: i % 2 === 0 }]);
    });
    expect(r.isGroupComplete('silver')).toBe(false);
    expect(r.markAnswered(silverIds[17], false)).toEqual([
      { type: 'answered', qmarkId: silverIds[17], correct: false },
      { type: 'groupComplete', group: 'silver' },
    ]);
    expect(r.remaining('silver')).toBe(0);
    expect(r.remaining('gold')).toBe(12);
  });
  it('completes the gold group independently', () => {
    const r = new Rules(LAYOUT.qmarks);
    const events = goldIds.flatMap((id) => r.markAnswered(id, true));
    expect(events.filter((e) => e.type === 'groupComplete')).toEqual([{ type: 'groupComplete', group: 'gold' }]);
  });
  it('ignores a second answer for the same question mark', () => {
    const r = new Rules(LAYOUT.qmarks);
    r.markAnswered(0, true);
    expect(r.markAnswered(0, false)).toEqual([]);
    expect(r.doneCount).toBe(1);
  });
  it('throws on unknown ids', () => {
    expect(() => new Rules(LAYOUT.qmarks).markAnswered(99, true)).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/rules.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Create `src/game/rules.ts`**

```ts
import type { Group } from '../world/layout';

export type RuleEvent =
  | { type: 'answered'; qmarkId: number; correct: boolean }
  | { type: 'groupComplete'; group: Group };

export class Rules {
  private readonly groupOf = new Map<number, Group>();
  private readonly done = new Set<number>();

  constructor(qmarks: readonly { id: number; group: Group }[]) {
    for (const q of qmarks) this.groupOf.set(q.id, q.group);
  }

  isDone(id: number): boolean {
    return this.done.has(id);
  }

  get doneCount(): number {
    return this.done.size;
  }

  get total(): number {
    return this.groupOf.size;
  }

  remaining(group: Group): number {
    let n = 0;
    for (const [id, g] of this.groupOf) if (g === group && !this.done.has(id)) n++;
    return n;
  }

  isGroupComplete(group: Group): boolean {
    return this.remaining(group) === 0;
  }

  markAnswered(id: number, correct: boolean): RuleEvent[] {
    const group = this.groupOf.get(id);
    if (!group) throw new Error(`Unknown question mark ${id}`);
    if (this.done.has(id)) return [];
    this.done.add(id);
    const events: RuleEvent[] = [{ type: 'answered', qmarkId: id, correct }];
    if (this.isGroupComplete(group)) events.push({ type: 'groupComplete', group });
    return events;
  }
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run tests/rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test `tests/session.test.ts`**

```ts
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
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 7: Create `src/game/session.ts`**

```ts
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
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/game tests/rules.test.ts tests/session.test.ts
git commit -m "feat: door-group rules and timed answer session

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Collision, player movement, targeting

**Files:**
- Create: `src/game/collision.ts`, `src/game/player.ts`, `src/game/interaction.ts`
- Test: `tests/player.test.ts`, `tests/interaction.test.ts`

**Interfaces:**
- Consumes: `Segment`, `Layout`, `LAYOUT`, `FloorGrid`, `allWalls`, `doorSegment` (Task 4).
- Produces:
  - `closestPointOnSegment(px, py, s: Segment): {x, y}`
  - `resolveCircle(x, y, radius, segments: readonly Segment[], iterations?): {x, y}`
  - `interface InputState { forward: number; strafe: number; turn: number; lookDX: number; lookDY: number }`
  - `const PLAYER = { radius: 0.3, eyeHeight: 1.6, speed: 4, turnSpeed: 2.2, mouseSensitivity: 0.0025, maxPitch: 1.2 }`
  - `class Player`, constructed as `new Player(x, y, heading)`, with fields `x`, `y`, `heading`, `pitch` and method `update(dt, input, colliders)`
  - `type Target = { kind: 'qmark'; id: number } | { kind: 'door'; id: number }`
  - `const REACH = { qmark: 2.2, door: 1.8, minCos: 0.6 }`
  - `findTarget(px, py, heading, layout, isQmarkDone: (id) => boolean, isDoorOpen: (id) => boolean): Target | null`
- Conventions:
  - `strafe` > 0 means right.
  - `turn` > 0 means turn right, so heading decreases.
  - `lookDX` > 0 (mouse moves right) means turn right.
  - `lookDY` > 0 (mouse moves down) means look down.

- [ ] **Step 1: Write the failing test `tests/player.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { closestPointOnSegment } from '../src/game/collision';
import { PLAYER, Player, type InputState } from '../src/game/player';
import { FloorGrid, LAYOUT, allWalls, doorSegment, type Segment } from '../src/world/layout';

const idle: InputState = { forward: 0, strafe: 0, turn: 0, lookDX: 0, lookDY: 0 };
const run = (p: Player, input: Partial<InputState>, seconds: number, colliders: Segment[], dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) p.update(dt, { ...idle, ...input }, colliders);
};
const wall: Segment = { ax: -10, ay: 0, bx: 10, by: 0 };

describe('Player movement', () => {
  it('walks forward at PLAYER.speed', () => {
    const p = new Player(0, 0, Math.PI / 2);
    run(p, { forward: 1 }, 1, []);
    expect(p.y).toBeCloseTo(PLAYER.speed, 1);
    expect(p.x).toBeCloseTo(0, 5);
  });
  it('does not move faster diagonally', () => {
    const p = new Player(0, 0, 0);
    run(p, { forward: 1, strafe: 1 }, 1, []);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(PLAYER.speed, 1);
  });
  it('strafes to the right of the heading', () => {
    const p = new Player(0, 0, Math.PI / 2); // facing north, right is east
    run(p, { strafe: 1 }, 0.5, []);
    expect(p.x).toBeGreaterThan(1.9);
  });
  it('stops at radius distance in front of a wall', () => {
    const p = new Player(0, -1, Math.PI / 2);
    run(p, { forward: 1 }, 1, [wall]);
    expect(p.y).toBeCloseTo(-PLAYER.radius, 3);
  });
  it('slides along a wall when walking into it at an angle', () => {
    const p = new Player(0, -1, Math.PI / 4);
    run(p, { forward: 1 }, 1, [wall]);
    expect(p.y).toBeCloseTo(-PLAYER.radius, 3);
    expect(p.x).toBeGreaterThan(2);
  });
  it('never comes closer than its radius when walking around a wall end', () => {
    const end: Segment = { ax: 0, ay: 0, bx: 10, by: 0 };
    const p = new Player(-0.5, -2, Math.PI / 2 - 0.2);
    for (let i = 0; i < 120; i++) {
      p.update(1 / 60, { ...idle, forward: 1 }, [end]);
      const c = closestPointOnSegment(p.x, p.y, end);
      expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeGreaterThanOrEqual(PLAYER.radius - 1e-6);
    }
  });
  it('does not tunnel through a thin door even with a huge time step', () => {
    const door = LAYOUT.doors.find((d) => d.y === -35)!;
    const p = new Player(0, -36.5, Math.PI / 2);
    p.update(0.5, { ...idle, forward: 1 }, [doorSegment(door)]);
    expect(p.y).toBeLessThan(-35);
  });
  it('is stopped by the closed entrance door inside the real layout', () => {
    const walls = allWalls(LAYOUT, new FloorGrid(LAYOUT));
    const door = LAYOUT.doors.find((d) => d.y === -35)!;
    const p = new Player(LAYOUT.start.x, LAYOUT.start.y, LAYOUT.startHeading);
    run(p, { forward: 1 }, 3, [...walls, doorSegment(door)]);
    expect(p.y).toBeCloseTo(-35 - PLAYER.radius, 2);
    const q = new Player(LAYOUT.start.x, LAYOUT.start.y, LAYOUT.startHeading);
    run(q, { forward: 1 }, 2, walls);
    expect(q.y).toBeGreaterThan(-33);
  });
  it('turns with mouse and keys and clamps pitch', () => {
    const p = new Player(0, 0, 1);
    p.update(1 / 60, { ...idle, lookDX: 100 }, []);
    expect(p.heading).toBeCloseTo(1 - 100 * PLAYER.mouseSensitivity);
    p.update(0.5, { ...idle, turn: 1 }, []);
    expect(p.heading).toBeCloseTo(1 - 100 * PLAYER.mouseSensitivity - PLAYER.turnSpeed * 0.5);
    p.update(1 / 60, { ...idle, lookDY: -100000 }, []);
    expect(p.pitch).toBe(PLAYER.maxPitch);
    p.update(1 / 60, { ...idle, lookDY: 100000 }, []);
    expect(p.pitch).toBe(-PLAYER.maxPitch);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/player.test.ts`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Create `src/game/collision.ts`**

```ts
import type { Segment } from '../world/layout';

export function closestPointOnSegment(px: number, py: number, s: Segment): { x: number; y: number } {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2));
  return { x: s.ax + t * dx, y: s.ay + t * dy };
}

/** Pushes a circle out of every segment it overlaps. */
export function resolveCircle(
  x: number,
  y: number,
  radius: number,
  segments: readonly Segment[],
  iterations = 4,
): { x: number; y: number } {
  for (let i = 0; i < iterations; i++) {
    let moved = false;
    for (const s of segments) {
      const c = closestPointOnSegment(x, y, s);
      let ox = x - c.x, oy = y - c.y;
      const d = Math.hypot(ox, oy);
      if (d >= radius) continue;
      if (d < 1e-9) {
        const len = Math.hypot(s.bx - s.ax, s.by - s.ay) || 1;
        ox = -(s.by - s.ay) / len;
        oy = (s.bx - s.ax) / len;
      } else {
        ox /= d;
        oy /= d;
      }
      x += ox * (radius - d);
      y += oy * (radius - d);
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y };
}
```

- [ ] **Step 4: Create `src/game/player.ts`**

```ts
import type { Segment } from '../world/layout';
import { resolveCircle } from './collision';

export interface InputState {
  forward: number;
  strafe: number;
  turn: number;
  lookDX: number;
  lookDY: number;
}

export const PLAYER = {
  radius: 0.3,
  eyeHeight: 1.6,
  speed: 4,
  turnSpeed: 2.2,
  mouseSensitivity: 0.0025,
  maxPitch: 1.2,
} as const;

const MAX_STEP = 0.1; // metres per collision sub-step; must stay below PLAYER.radius

export class Player {
  pitch = 0;

  constructor(public x: number, public y: number, public heading: number) {}

  update(dt: number, input: InputState, colliders: readonly Segment[]): void {
    this.heading -= input.lookDX * PLAYER.mouseSensitivity + input.turn * PLAYER.turnSpeed * dt;
    this.pitch = Math.max(
      -PLAYER.maxPitch,
      Math.min(PLAYER.maxPitch, this.pitch - input.lookDY * PLAYER.mouseSensitivity),
    );

    let f = input.forward, s = input.strafe;
    const len = Math.hypot(f, s);
    if (len > 1) {
      f /= len;
      s /= len;
    }
    const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
    const rx = fy, ry = -fx;
    const dx = (fx * f + rx * s) * PLAYER.speed * dt;
    const dy = (fy * f + ry * s) * PLAYER.speed * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_STEP));
    for (let i = 0; i < steps; i++) {
      const p = resolveCircle(this.x + dx / steps, this.y + dy / steps, PLAYER.radius, colliders);
      this.x = p.x;
      this.y = p.y;
    }
  }
}
```

- [ ] **Step 5: Run the player tests**

Run: `npx vitest run tests/player.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test `tests/interaction.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { findTarget } from '../src/game/interaction';
import { LAYOUT } from '../src/world/layout';

const none = () => false;
const entrance = LAYOUT.doors.find((d) => d.y === -35)!;
const q0 = LAYOUT.qmarks[0];

describe('findTarget', () => {
  it('targets the closed door in front of the player', () => {
    expect(findTarget(0, -36.5, Math.PI / 2, LAYOUT, none, none)).toEqual({ kind: 'door', id: entrance.id });
  });
  it('ignores the door when facing away or when it is open', () => {
    expect(findTarget(0, -36.5, -Math.PI / 2, LAYOUT, none, none)).toBeNull();
    expect(findTarget(0, -36.5, Math.PI / 2, LAYOUT, none, (id) => id === entrance.id)).toBeNull();
  });
  it('ignores targets out of reach', () => {
    expect(findTarget(0, -39.5, Math.PI / 2, LAYOUT, none, none)).toBeNull();
  });
  it('targets a question mark within reach and skips answered ones', () => {
    const px = q0.x - 1.5, py = q0.y;
    expect(findTarget(px, py, 0, LAYOUT, none, none)).toEqual({ kind: 'qmark', id: q0.id });
    expect(findTarget(px, py, 0, LAYOUT, (id) => id === q0.id, none)).toBeNull();
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run tests/interaction.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 8: Create `src/game/interaction.ts`**

```ts
import { doorSegment, type Layout } from '../world/layout';
import { closestPointOnSegment } from './collision';

export type Target = { kind: 'qmark'; id: number } | { kind: 'door'; id: number };

export const REACH = { qmark: 2.2, door: 1.8, minCos: 0.6 } as const;

interface Candidate {
  target: Target;
  x: number;
  y: number;
  reach: number;
}

export function findTarget(
  px: number,
  py: number,
  heading: number,
  layout: Layout,
  isQmarkDone: (id: number) => boolean,
  isDoorOpen: (id: number) => boolean,
): Target | null {
  const candidates: Candidate[] = [];
  for (const q of layout.qmarks) {
    if (!isQmarkDone(q.id)) candidates.push({ target: { kind: 'qmark', id: q.id }, x: q.x, y: q.y, reach: REACH.qmark });
  }
  for (const d of layout.doors) {
    if (isDoorOpen(d.id)) continue;
    const c = closestPointOnSegment(px, py, doorSegment(d));
    candidates.push({ target: { kind: 'door', id: d.id }, x: c.x, y: c.y, reach: REACH.door });
  }
  const fx = Math.cos(heading), fy = Math.sin(heading);
  let best: Target | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dx = c.x - px, dy = c.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > c.reach || dist >= bestDist) continue;
    if (dist > 0.3 && (dx * fx + dy * fy) / dist < REACH.minCos) continue;
    best = c.target;
    bestDist = dist;
  }
  return best;
}
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/game tests/player.test.ts tests/interaction.test.ts
git commit -m "feat: circle-vs-segment collision, player controller, targeting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: GameLogic event machine

**Files:**
- Create: `src/game/logic.ts`
- Test: `tests/logic.test.ts`

**Interfaces:**
- Consumes: `Rules` (Task 5), `Session`/`SessionResult` (Task 5), `PreparedQuestion` (Task 2), `Layout`/`Segment`/`doorSegment` (Task 4), `Target` (Task 6), `S`/`remainingQuestions` (Task 1).
- Produces:
  - `const EXIT_RADIUS = 1.2`
  - `type LogicEvent` =
    - `{ type: 'message'; text: string; tone: 'info'|'good'|'bad' }`
    - `| { type: 'progress'; done: number; total: number }`
    - `| { type: 'ask'; qmarkId: number; question: PreparedQuestion }`
    - `| { type: 'qmarkCollected'; qmarkId: number }`
    - `| { type: 'doorOpening'; doorId: number }`
    - `| { type: 'exit'; result: SessionResult }`
  - `class GameLogic`, constructed as `new GameLogic(layout, session, emit: (e: LogicEvent) => void)`, with:
    - `readonly rules`
    - `isDoorOpen(id)`, `isQmarkDone(id)`
    - getters `awaitingAnswer: number | null` and `finished: boolean`
    - `closedDoorColliders(): Segment[]`
    - `use(target: Target | null)`
    - `answerQuestion(choice: number | null)`
    - `checkExit(x, y)`

- [ ] **Step 1: Write the failing test `tests/logic.test.ts`**

```ts
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
    expect(ofType(events, 'message').at(-1)!.text).toBe('Dveře do vnitřního okruhu se otevírají!');
    expect(logic.closedDoorColliders()).toHaveLength(closedBefore - 4);
    silverDoors.forEach((id) => expect(logic.isDoorOpen(id)).toBe(true));
  });
  it('a locked door reports how many questions remain', () => {
    const { logic, events } = setup();
    const gold = LAYOUT.doors.find((d) => d.kind === 'gold')!;
    logic.use({ kind: 'door', id: gold.id });
    expect(events).toEqual([{ type: 'message', text: 'Zbývá ještě 12 otázek!', tone: 'info' }]);
    expect(logic.isDoorOpen(gold.id)).toBe(false);
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/logic.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Create `src/game/logic.ts`**

```ts
import type { PreparedQuestion } from '../data/shuffle';
import { S, remainingQuestions } from '../strings';
import { doorSegment, type Layout, type Segment } from '../world/layout';
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
    else this.emit({ type: 'message', text: remainingQuestions(this.rules.remaining(door.kind)), tone: 'info' });
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
        this.emit({ type: 'message', text: ev.group === 'silver' ? S.silverOpen : S.goldOpen, tone: 'info' });
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
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/logic.ts tests/logic.test.ts
git commit -m "feat: GameLogic event machine for questions, doors and exit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rendering shell — textures, world geometry, input, game loop

**Files:**
- Create: `src/world/textures.ts`, `src/world/builder.ts`, `src/game/input.ts`, `src/game/game.ts`
- Modify: `src/main.ts` (temporary debug boot, replaced in Task 11)

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces:
  - `textures.ts`: `makeStoneTexture()`, `makeFloorTexture()`, `makeWoodTexture()`, `makeDoorTexture(kind: DoorKind)`, `makeGlowTexture(inner: string)`. Each returns `THREE.CanvasTexture`.
  - `builder.ts`: `buildWorld(layout: Layout, grid: FloorGrid): { group: THREE.Group; walls: WallSegment[] }`
  - `input.ts`:
    - `type Action = 'use' | 'map' | 'pause' | 'help'`
    - `class Input`, constructed as `new Input(canvas)`, with:
      - property `enabled`
      - getter `pointerLocked`
      - `requestPointerLock()`, `exitPointerLock()`
      - `onAction(fn: (a: Action) => void)`
      - `onPointerLockChange(fn: (locked: boolean) => void)`
      - `sample(): InputState`
  - `game.ts`:
    - `interface Pose { x: number; y: number; heading: number }`
    - `interface GameHandlers`, with:
      - `onEvent(e: LogicEvent): void`
      - `onPauseRequest(): void`
      - `onToggleMap(): void`
      - `onHelp(): void`
      - `onPrompt(text: string | null): void`
      - `onFrame(pose: Pose): void`
    - `class Game`, constructed as `new Game(canvas)`, with:
      - `readonly layout`
      - getter `logic: GameLogic | null`
      - getter `mode: 'demo'|'play'|'question'|'paused'|'ended'`
      - `startDemo()`, `startGame(session, handlers)`, `pause()`, `resume()`
      - `answer(choice: number | null)`
      - `pose(): Pose`

This task has no unit tests, because it is rendering and DOM glue. It is verified by the type-check, the build and a manual run.

- [ ] **Step 1: Create `src/world/textures.ts`**

```ts
import * as THREE from 'three';
import { mulberry32, type Rng } from '../data/shuffle';
import type { DoorKind } from './layout';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const shade = (base: readonly number[], k: number) =>
  `rgb(${base.map((c) => Math.max(0, Math.min(255, Math.round(c * k)))).join(',')})`;

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rng() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
}

export function makeStoneTexture(): THREE.CanvasTexture {
  const size = 512, rowH = 64, blockW = 128;
  const [c, ctx] = makeCanvas(size, size);
  const rng = mulberry32(1);
  ctx.fillStyle = '#2b2622';
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < size / rowH; row++) {
    const offset = row % 2 === 0 ? 0 : blockW / 2;
    for (let x = offset; x < size; x += blockW) {
      ctx.fillStyle = shade([112, 102, 90], 0.75 + rng() * 0.4);
      ctx.fillRect(x + 3, row * rowH + 3, blockW - 6, rowH - 6);
      if (x + blockW > size) ctx.fillRect(x - size + 3, row * rowH + 3, blockW - 6, rowH - 6);
    }
  }
  speckle(ctx, size, size, rng, 6000, 0.12);
  return toTexture(c);
}

export function makeFloorTexture(): THREE.CanvasTexture {
  const size = 512, n = 4, cell = size / n;
  const [c, ctx] = makeCanvas(size, size);
  const rng = mulberry32(2);
  ctx.fillStyle = '#1e1b18';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const inset = 4 + rng() * 4;
      ctx.fillStyle = shade([92, 88, 80], 0.7 + rng() * 0.45);
      ctx.fillRect(i * cell + inset, j * cell + inset, cell - 2 * inset, cell - 2 * inset);
    }
  }
  speckle(ctx, size, size, rng, 8000, 0.1);
  return toTexture(c);
}

export function makeWoodTexture(): THREE.CanvasTexture {
  const w = 256, h = 512, plank = 32;
  const [c, ctx] = makeCanvas(w, h);
  const rng = mulberry32(3);
  for (let x = 0; x < w; x += plank) {
    ctx.fillStyle = shade([84, 58, 36], 0.7 + rng() * 0.4);
    ctx.fillRect(x, 0, plank, h);
    ctx.strokeStyle = 'rgba(30,18,10,0.35)';
    for (let g = 0; g < 6; g++) {
      const gx = x + 3 + rng() * (plank - 6);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 3, h / 3, gx - 3, (2 * h) / 3, gx, h);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, 0, 2, h);
  }
  return toTexture(c);
}

const DOOR_TINT: Record<DoorKind, readonly number[]> = {
  grey: [120, 116, 110],
  silver: [190, 198, 208],
  gold: [212, 166, 58],
};

export function makeDoorTexture(kind: DoorKind): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = makeCanvas(size, size);
  const rng = mulberry32(4);
  const base = DOOR_TINT[kind];
  for (let x = 0; x < size; x += 32) {
    ctx.fillStyle = shade(base, 0.55 + rng() * 0.2);
    ctx.fillRect(x, 0, 32, size);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, 0, 2, size);
  }
  for (const y of [28, 128, 228]) {
    ctx.fillStyle = shade(base, 1.05);
    ctx.fillRect(0, y - 10, size, 20);
    ctx.fillStyle = shade(base, 0.5);
    for (let x = 12; x < size; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  speckle(ctx, size, size, rng, 2500, 0.1);
  return toTexture(c, false);
}

export function makeGlowTexture(inner: string): THREE.CanvasTexture {
  const s = 128;
  const [c, ctx] = makeCanvas(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return toTexture(c, false);
}
```

- [ ] **Step 2: Create `src/world/builder.ts`**

```ts
import * as THREE from 'three';
import { WALL_HEIGHT, allWalls, type FloorGrid, type Layout, type WallSegment } from './layout';
import { makeFloorTexture, makeStoneTexture, makeWoodTexture } from './textures';

const WALL_TEX_M = 2; // metres per wall texture repeat
const FLOOR_TEX_M = 4;

export interface BuiltWorld {
  group: THREE.Group;
  walls: WallSegment[];
}

function wallGeometry(walls: readonly WallSegment[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const H = WALL_HEIGHT;
  for (const w of walls) {
    let { ax, ay, bx, by } = w;
    // Front face normal of the quad is cross(b - a, up) = (by - ay, 0, bx - ax) in three space;
    // it must point along (nx, 0, -ny), otherwise flip the segment direction.
    if ((by - ay) * w.nx + (bx - ax) * -w.ny < 0) {
      [ax, bx] = [bx, ax];
      [ay, by] = [by, ay];
    }
    const len = Math.hypot(bx - ax, by - ay);
    const base = pos.length / 3;
    pos.push(ax, 0, -ay, bx, 0, -by, bx, H, -by, ax, H, -ay);
    for (let i = 0; i < 4; i++) nor.push(w.nx, 0, -w.ny);
    const u = len / WALL_TEX_M, v = H / WALL_TEX_M;
    uv.push(0, 0, u, 0, u, v, 0, v);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function plane(layout: Layout, height: number, facingUp: boolean): THREE.BufferGeometry {
  const b = layout.bounds;
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2);
  g.translate((b.x0 + b.x1) / 2, height, -(b.y0 + b.y1) / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / FLOOR_TEX_M, (uv.getY(i) * h) / FLOOR_TEX_M);
  return g;
}

export function buildWorld(layout: Layout, grid: FloorGrid): BuiltWorld {
  const walls = allWalls(layout, grid);
  const group = new THREE.Group();
  const mat = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
  group.add(new THREE.Mesh(wallGeometry(walls), mat(makeStoneTexture())));
  group.add(new THREE.Mesh(plane(layout, 0, true), mat(makeFloorTexture())));
  group.add(new THREE.Mesh(plane(layout, WALL_HEIGHT, false), mat(makeWoodTexture())));
  return { group, walls };
}
```

- [ ] **Step 3: Create `src/game/input.ts`**

```ts
import type { InputState } from './player';

export type Action = 'use' | 'map' | 'pause' | 'help';

const ACTIONS: Record<string, Action> = {
  KeyE: 'use', Enter: 'use', NumpadEnter: 'use', Space: 'use',
  KeyM: 'map', Escape: 'pause', F1: 'help', KeyH: 'help',
};
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  private readonly keys = new Set<string>();
  private dx = 0;
  private dy = 0;
  private active = false;
  private readonly actionListeners: ((a: Action) => void)[] = [];
  private lockListener: ((locked: boolean) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.active && this.pointerLocked) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => this.lockListener?.(this.pointerLocked));
  }

  get enabled(): boolean {
    return this.active;
  }

  set enabled(v: boolean) {
    this.active = v;
    this.clear();
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestPointerLock(): void {
    try {
      const r = this.canvas.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => undefined);
    } catch {
      // refused (no user gesture, unsupported) – keyboard-only play still works
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  onAction(fn: (a: Action) => void): void {
    this.actionListeners.push(fn);
  }

  onPointerLockChange(fn: (locked: boolean) => void): void {
    this.lockListener = fn;
  }

  sample(): InputState {
    const k = (code: string) => this.keys.has(code);
    const locked = this.pointerLocked;
    const forward = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const arrows = (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0);
    const strafe = Math.max(-1, Math.min(1, (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0) + (locked ? arrows : 0)));
    const state: InputState = { forward, strafe, turn: locked ? 0 : arrows, lookDX: this.dx, lookDY: this.dy };
    this.dx = this.dy = 0;
    return state;
  }

  private clear(): void {
    this.keys.clear();
    this.dx = this.dy = 0;
  }

  private readonly keyDown = (e: KeyboardEvent): void => {
    if (!this.active) return;
    const action = ACTIONS[e.code];
    if (action || MOVE_KEYS.has(e.code)) e.preventDefault();
    if (action && !e.repeat) this.actionListeners.forEach((fn) => fn(action));
    if (MOVE_KEYS.has(e.code)) this.keys.add(e.code);
  };
}
```

- [ ] **Step 4: Create `src/game/game.ts`**

```ts
import * as THREE from 'three';
import { S } from '../strings';
import { buildWorld } from '../world/builder';
import { FloorGrid, LAYOUT, type Layout, type Segment, type WallSegment } from '../world/layout';
import { Input } from './input';
import { findTarget, type Target } from './interaction';
import { GameLogic, type LogicEvent } from './logic';
import { PLAYER, Player } from './player';
import type { Session } from './session';

export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export interface GameHandlers {
  onEvent(e: LogicEvent): void;
  onPauseRequest(): void;
  onToggleMap(): void;
  onHelp(): void;
  onPrompt(text: string | null): void;
  onFrame(pose: Pose): void;
}

export type GameMode = 'demo' | 'play' | 'question' | 'paused' | 'ended';

const DEMO_RADIUS = 5;

export class Game {
  readonly layout: Layout;
  readonly grid: FloorGrid;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  readonly input: Input;
  private readonly walls: WallSegment[];
  private colliders: Segment[] = [];
  private player: Player;
  private currentMode: GameMode = 'demo';
  private gameLogic: GameLogic | null = null;
  private session: Session | null = null;
  private handlers: GameHandlers | null = null;
  private target: Target | null = null;
  private promptText: string | null = null;
  private resumeWithLock = false;
  private demoAngle = 0;
  private lastFrame = performance.now();

  constructor(canvas: HTMLCanvasElement, layout: Layout = LAYOUT) {
    this.layout = layout;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color(0x050403);
    this.scene.fog = new THREE.FogExp2(0x050403, 0.06);
    this.scene.add(new THREE.HemisphereLight(0x8a7a66, 0x1a1410, 0.35));
    this.grid = new FloorGrid(layout);
    const world = buildWorld(layout, this.grid);
    this.walls = world.walls;
    this.scene.add(world.group);
    this.camera.rotation.order = 'YXZ';
    this.player = new Player(layout.start.x, layout.start.y, layout.startHeading);

    this.input = new Input(canvas);
    this.input.onAction((a) => {
      if (a === 'use' && this.currentMode === 'play') this.gameLogic?.use(this.target);
      else if (a === 'map') this.handlers?.onToggleMap();
      else if (a === 'pause') this.handlers?.onPauseRequest();
      else if (a === 'help') this.handlers?.onHelp();
    });
    this.input.onPointerLockChange((locked) => {
      if (!locked && this.currentMode === 'play') {
        this.resumeWithLock = true;
        this.handlers?.onPauseRequest();
      }
    });
    canvas.addEventListener('click', () => {
      if (this.currentMode === 'play') this.input.requestPointerLock();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.currentMode === 'play') this.handlers?.onPauseRequest();
        else if (this.currentMode === 'question') this.session?.pause();
      } else if (this.currentMode === 'question') this.session?.resume();
    });
    window.addEventListener('resize', this.resize);
    this.resize();
    this.renderer.setAnimationLoop(this.frame);
  }

  get logic(): GameLogic | null {
    return this.gameLogic;
  }

  get mode(): GameMode {
    return this.currentMode;
  }

  pose(): Pose {
    return { x: this.player.x, y: this.player.y, heading: this.player.heading };
  }

  startDemo(): void {
    this.currentMode = 'demo';
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.gameLogic = null;
    this.session = null;
    this.handlers = null;
    this.resetWorld();
  }

  startGame(session: Session, handlers: GameHandlers): void {
    this.session = session;
    this.handlers = handlers;
    this.gameLogic = new GameLogic(this.layout, session, this.handleLogic);
    this.resetWorld();
    this.player = new Player(this.layout.start.x, this.layout.start.y, this.layout.startHeading);
    this.refreshColliders();
    this.target = null;
    this.promptText = null;
    handlers.onPrompt(null);
    this.resumeWithLock = false;
    this.currentMode = 'play';
    this.input.enabled = true;
    this.input.requestPointerLock();
  }

  pause(): void {
    if (this.currentMode !== 'play') return;
    this.resumeWithLock = this.resumeWithLock || this.input.pointerLocked;
    this.currentMode = 'paused';
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.session?.pause();
  }

  resume(): void {
    if (this.currentMode !== 'paused') return;
    this.currentMode = 'play';
    this.input.enabled = true;
    this.session?.resume();
    if (this.resumeWithLock) this.input.requestPointerLock();
    this.resumeWithLock = false;
  }

  answer(choice: number | null): void {
    if (this.currentMode !== 'question' || !this.gameLogic) return;
    this.gameLogic.answerQuestion(choice);
    this.currentMode = 'play';
    this.input.enabled = true;
    if (this.resumeWithLock) this.input.requestPointerLock();
    this.resumeWithLock = false;
  }

  /** Hook for Task 9: reset doors/question marks to their initial state. */
  protected resetWorld(): void {}

  /** Hook for Task 9: visual reaction to logic events. */
  protected onLogicVisual(_e: LogicEvent): void {}

  /** Hook for Task 9: per-frame prop animation. */
  protected updateProps(_dt: number, _viewer: { x: number; y: number }, _highlight: number | null): void {}

  private readonly handleLogic = (e: LogicEvent): void => {
    if (e.type === 'ask') {
      this.currentMode = 'question';
      this.resumeWithLock = this.input.pointerLocked;
      this.input.enabled = false;
      this.input.exitPointerLock();
      this.setPrompt(null);
    } else if (e.type === 'doorOpening') {
      this.refreshColliders();
    } else if (e.type === 'exit') {
      this.currentMode = 'ended';
      this.input.enabled = false;
      this.input.exitPointerLock();
      this.setPrompt(null);
    }
    this.onLogicVisual(e);
    this.handlers?.onEvent(e);
  };

  private refreshColliders(): void {
    this.colliders = [...this.walls, ...(this.gameLogic?.closedDoorColliders() ?? [])];
  }

  private setPrompt(text: string | null): void {
    if (text === this.promptText) return;
    this.promptText = text;
    this.handlers?.onPrompt(text);
  }

  private updateTarget(logic: GameLogic): void {
    const t = findTarget(
      this.player.x, this.player.y, this.player.heading, this.layout,
      (id) => logic.isQmarkDone(id), (id) => logic.isDoorOpen(id),
    );
    this.target = t;
    if (!t) this.setPrompt(null);
    else if (t.kind === 'qmark') this.setPrompt(S.promptQmark);
    else this.setPrompt(this.layout.doors[t.id].kind === 'grey' ? S.promptDoor : S.promptLocked);
  }

  private readonly resize = (): void => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private readonly frame = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    if (this.currentMode === 'demo') {
      this.demoAngle += dt * 0.12;
      this.camera.position.set(DEMO_RADIUS * Math.cos(this.demoAngle), 2, -DEMO_RADIUS * Math.sin(this.demoAngle));
      this.camera.lookAt(0, 1.5, 0);
    } else {
      if (this.currentMode === 'play' && this.gameLogic) {
        this.player.update(dt, this.input.sample(), this.colliders);
        this.gameLogic.checkExit(this.player.x, this.player.y);
        if (this.currentMode === 'play') this.updateTarget(this.gameLogic);
      }
      this.camera.position.set(this.player.x, PLAYER.eyeHeight, -this.player.y);
      this.camera.rotation.set(this.player.pitch, this.player.heading - Math.PI / 2, 0);
      if (this.currentMode === 'play' || this.currentMode === 'question') this.handlers?.onFrame(this.pose());
    }
    const highlight = this.currentMode === 'play' && this.target?.kind === 'qmark' ? this.target.id : null;
    this.updateProps(dt, { x: this.camera.position.x, y: -this.camera.position.z }, highlight);
    this.renderer.render(this.scene, this.camera);
  };
}
```

- [ ] **Step 5: Replace `src/main.ts` with a temporary debug boot**

```ts
import './style.css';
import { loadIndex, loadSet } from './data/questionSet';
import { mulberry32 } from './data/shuffle';
import { Game } from './game/game';
import { Session } from './game/session';

// TEMPORARY (replaced in Task 11): walk the maze with set Z1, auto-answer with choice 0.
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const game = new Game(canvas);
const base = import.meta.env.BASE_URL;
const [entry] = await loadIndex(base);
const r = await loadSet(base, entry);
if (r.ok) {
  canvas.addEventListener('click', () => {
    if (game.mode !== 'demo') return;
    game.startGame(new Session({ set: r.set, playerName: '', rng: mulberry32(Date.now() >>> 0) }), {
      onEvent: (e) => {
        console.log(e);
        if (e.type === 'ask') setTimeout(() => game.answer(0));
      },
      onPauseRequest: () => game.pause(),
      onToggleMap: () => undefined,
      onHelp: () => undefined,
      onPrompt: (t) => console.log('prompt', t),
      onFrame: () => undefined,
    });
  });
}
```

Top-level `await` needs a build target of `es2022`, which Task 1 already set.

- [ ] **Step 6: Type-check, test and build**

Run: `npx vitest run && npm run build`
Expected: tests PASS, and the build succeeds with no TypeScript errors.

- [ ] **Step 7: Manual check**

Run: `npm run dev`, then open the printed URL.
Expected:
- The camera slowly circles a dark stone room.
- Clicking starts the game at the entrance and captures the mouse.
- WASD walks, and the mouse looks around.
- The (still invisible) entrance door blocks you at y ≈ −35.3. E in front of it logs `doorOpening` and you can pass.
- You can't walk through walls.
- Esc releases the mouse and logs nothing else. The game is paused: movement stops.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: Three.js rendering shell with procedural textures and walkable maze

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Props — doors, question marks, torches + lights, exit portal

**Files:**
- Create: `src/world/props.ts`
- Modify: `src/game/game.ts` (replace the three hook methods with real prop calls)

**Interfaces:**
- Consumes: `Layout`, `Door`, `Torch`, `WALL_HEIGHT`, `DOOR_WIDTH` (Task 4); textures (Task 8); `LogicEvent` (Task 7).
- Produces: `class WorldProps`, constructed as `new WorldProps(layout, scene)`, with:
  - `reset(): void`
  - `openDoor(id: number): void`
  - `collectQmark(id: number): void`
  - `update(dt: number, viewer: {x, y}, highlight: number | null): void`

- [ ] **Step 1: Create `src/world/props.ts`**

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOOR_WIDTH, WALL_HEIGHT, type Door, type DoorKind, type Group, type Layout, type Torch } from './layout';
import { makeDoorTexture, makeGlowTexture } from './textures';

const DOOR_OPEN_SECONDS = 1;
const QMARK_HEIGHT = 1.3;
const LIGHT_POOL = 6;

const toThree = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);

function additiveSprite(texture: THREE.Texture, color: number, scale: number): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
  );
  s.scale.setScalar(scale);
  return s;
}

function questionMarkGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, 0.62, 0), new THREE.Vector3(-0.16, 0.78, 0), new THREE.Vector3(0, 0.86, 0),
    new THREE.Vector3(0.18, 0.79, 0), new THREE.Vector3(0.22, 0.62, 0), new THREE.Vector3(0.1, 0.46, 0),
    new THREE.Vector3(0, 0.36, 0), new THREE.Vector3(0, 0.22, 0),
  ]);
  const hook = new THREE.TubeGeometry(curve, 48, 0.06, 10, false);
  const dot = new THREE.SphereGeometry(0.075, 16, 12);
  dot.translate(0, 0.06, 0);
  const merged = mergeGeometries([hook, dot]);
  if (!merged) throw new Error('question mark geometry merge failed');
  merged.translate(0, -0.45, 0);
  return merged;
}

class DoorView {
  readonly mesh: THREE.Mesh;
  private offset = 0;
  private opening = false;

  constructor(door: Door, material: THREE.Material) {
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH, WALL_HEIGHT, 0.25), material);
    if (door.axis === 'y') this.mesh.rotation.y = Math.PI / 2;
    this.mesh.position.copy(toThree(door.x, door.y, WALL_HEIGHT / 2));
  }

  reset(): void {
    this.offset = 0;
    this.opening = false;
    this.mesh.position.y = WALL_HEIGHT / 2;
    this.mesh.visible = true;
  }

  open(): void {
    this.opening = true;
  }

  update(dt: number): void {
    if (!this.opening || !this.mesh.visible) return;
    this.offset = Math.min(WALL_HEIGHT, this.offset + (WALL_HEIGHT * dt) / DOOR_OPEN_SECONDS);
    this.mesh.position.y = WALL_HEIGHT / 2 + this.offset;
    if (this.offset >= WALL_HEIGHT) this.mesh.visible = false;
  }
}

class QMarkView {
  readonly root = new THREE.Group();
  private readonly mesh: THREE.Mesh;

  constructor(
    readonly id: number,
    x: number,
    y: number,
    geometry: THREE.BufferGeometry,
    private readonly material: THREE.Material,
    private readonly highlightMaterial: THREE.Material,
    glow: THREE.Sprite,
  ) {
    this.mesh = new THREE.Mesh(geometry, material);
    this.root.add(this.mesh, glow);
    this.root.position.copy(toThree(x, y, QMARK_HEIGHT));
  }

  setHighlighted(on: boolean): void {
    this.mesh.material = on ? this.highlightMaterial : this.material;
  }

  update(t: number): void {
    this.mesh.rotation.y = t * 1.5 + this.id;
    this.root.position.y = QMARK_HEIGHT + 0.08 * Math.sin(t * 2 + this.id);
  }
}

class Burst {
  readonly points: THREE.Points;
  private readonly velocities: Float32Array;
  private life = 0;

  constructor(origin: THREE.Vector3, color: number, texture: THREE.Texture, count = 40) {
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions.set([origin.x, origin.y, origin.z], i * 3);
      const a = Math.random() * Math.PI * 2, up = Math.random() * 2 - 0.5, sp = 1 + Math.random() * 2;
      this.velocities.set([Math.cos(a) * sp, up * sp, Math.sin(a) * sp], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.15, map: texture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
  }

  /** Returns false when finished. */
  update(dt: number): boolean {
    this.life += dt;
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + this.velocities[i * 3] * dt,
        pos.getY(i) + this.velocities[i * 3 + 1] * dt,
        pos.getZ(i) + this.velocities[i * 3 + 2] * dt,
      );
    }
    pos.needsUpdate = true;
    (this.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - this.life / 0.9);
    return this.life < 0.9;
  }
}

class Portal {
  readonly root = new THREE.Group();
  private readonly speeds: Float32Array;

  constructor(x: number, y: number, glow: THREE.Texture, count = 250) {
    const positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.2;
      positions.set([Math.cos(a) * r, Math.random() * 3, Math.sin(a) * r], i * 3);
      this.speeds[i] = 0.4 + Math.random() * 0.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.25, map: glow, color: 0x4aa0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.3, 48),
      new THREE.MeshBasicMaterial({ color: 0x2f6fff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    const light = new THREE.PointLight(0x3a7bff, 12, 10, 2);
    light.position.y = 1.5;
    this.root.add(points, ring, light);
    this.root.position.copy(toThree(x, y, 0));
  }

  update(dt: number): void {
    const points = this.root.children[0] as THREE.Points;
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let h = pos.getY(i) + this.speeds[i] * dt;
      if (h > 3) h -= 3;
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
  }
}

class TorchLights {
  private readonly lights: THREE.PointLight[] = [];
  private timer = 0;
  private t = 0;

  constructor(private readonly torches: readonly Torch[], scene: THREE.Scene) {
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xff9a4a, 0, 14, 2);
      this.lights.push(l);
      scene.add(l);
    }
  }

  update(dt: number, viewer: { x: number; y: number }): void {
    this.t += dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      const nearest = [...this.torches]
        .sort((a, b) => Math.hypot(a.x - viewer.x, a.y - viewer.y) - Math.hypot(b.x - viewer.x, b.y - viewer.y))
        .slice(0, LIGHT_POOL);
      nearest.forEach((tq, i) => this.lights[i].position.copy(toThree(tq.x + tq.nx * 0.4, tq.y + tq.ny * 0.4, 2.7)));
    }
    this.lights.forEach((l, i) => {
      l.intensity = 9 * (0.85 + 0.15 * Math.sin(this.t * 13 + i * 1.7) * Math.sin(this.t * 7.3 + i));
    });
  }
}

const QMARK_MATERIALS: Record<Group, THREE.MeshStandardMaterialParameters> = {
  silver: { color: 0xd8dee8, emissive: 0x5a6a88, metalness: 0.6, roughness: 0.3 },
  gold: { color: 0xffc94a, emissive: 0x8a5a00, metalness: 0.6, roughness: 0.35 },
};

export class WorldProps {
  private readonly doors: DoorView[];
  private readonly qmarks: QMarkView[];
  private readonly flames: THREE.Sprite[] = [];
  private readonly lights: TorchLights;
  private readonly portal: Portal;
  private readonly bursts: Burst[] = [];
  private readonly glow: THREE.Texture;
  private t = 0;
  private highlighted: number | null = null;

  constructor(private readonly layout: Layout, private readonly scene: THREE.Scene) {
    this.glow = makeGlowTexture('rgba(255,255,255,1)');
    const doorMaterials = {} as Record<DoorKind, THREE.Material>;
    for (const kind of ['grey', 'silver', 'gold'] as const) {
      doorMaterials[kind] = new THREE.MeshStandardMaterial({
        map: makeDoorTexture(kind), metalness: kind === 'grey' ? 0.2 : 0.7, roughness: 0.5,
      });
    }
    this.doors = layout.doors.map((d) => new DoorView(d, doorMaterials[d.kind]));
    this.doors.forEach((d) => scene.add(d.mesh));

    const geometry = questionMarkGeometry();
    const highlight = new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xaa1010, metalness: 0.4, roughness: 0.3 });
    const mats = { silver: new THREE.MeshStandardMaterial(QMARK_MATERIALS.silver), gold: new THREE.MeshStandardMaterial(QMARK_MATERIALS.gold) };
    this.qmarks = layout.qmarks.map(
      (q) =>
        new QMarkView(q.id, q.x, q.y, geometry, mats[q.group], highlight,
          additiveSprite(this.glow, q.group === 'silver' ? 0x8899cc : 0xcc8822, 1.6)),
    );
    this.qmarks.forEach((q) => scene.add(q.root));

    const bracketGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.6, roughness: 0.6 });
    for (const torch of layout.torches) {
      const bracket = new THREE.Mesh(bracketGeo, bracketMat);
      bracket.position.copy(toThree(torch.x, torch.y, 2.3));
      const flame = additiveSprite(this.glow, 0xffa850, 0.7);
      flame.position.copy(toThree(torch.x + torch.nx * 0.1, torch.y + torch.ny * 0.1, 2.65));
      this.flames.push(flame);
      scene.add(bracket, flame);
    }
    this.lights = new TorchLights(layout.torches, scene);
    this.portal = new Portal(layout.exit.x, layout.exit.y, this.glow);
    scene.add(this.portal.root);
  }

  reset(): void {
    this.doors.forEach((d) => d.reset());
    this.qmarks.forEach((q) => { q.root.visible = true; q.setHighlighted(false); });
    this.highlighted = null;
  }

  openDoor(id: number): void {
    this.doors[id]?.open();
  }

  collectQmark(id: number): void {
    const q = this.qmarks[id];
    if (!q || !q.root.visible) return;
    q.root.visible = false;
    const color = this.layout.qmarks[id].group === 'silver' ? 0xc8d4ff : 0xffcc55;
    const burst = new Burst(q.root.position.clone(), color, this.glow);
    this.bursts.push(burst);
    this.scene.add(burst.points);
  }

  update(dt: number, viewer: { x: number; y: number }, highlight: number | null): void {
    this.t += dt;
    if (highlight !== this.highlighted) {
      if (this.highlighted !== null) this.qmarks[this.highlighted].setHighlighted(false);
      if (highlight !== null) this.qmarks[highlight].setHighlighted(true);
      this.highlighted = highlight;
    }
    this.doors.forEach((d) => d.update(dt));
    this.qmarks.forEach((q) => q.update(this.t));
    this.flames.forEach((f, i) => f.scale.setScalar(0.6 + 0.12 * Math.sin(this.t * 11 + i * 2.3)));
    this.lights.update(dt, viewer);
    this.portal.update(dt);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      if (!this.bursts[i].update(dt)) {
        this.scene.remove(this.bursts[i].points);
        this.bursts[i].points.geometry.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }
}
```

- [ ] **Step 2: Wire props into `src/game/game.ts`**

Add the import `import { WorldProps } from '../world/props';`, add the field `private readonly props: WorldProps;`, and in the constructor, right after `this.scene.add(world.group);`, add:

```ts
    this.props = new WorldProps(layout, this.scene);
```

Replace the three hook methods (`resetWorld`, `onLogicVisual`, `updateProps`) with:

```ts
  private resetWorld(): void {
    this.props.reset();
  }

  private onLogicVisual(e: LogicEvent): void {
    if (e.type === 'doorOpening') this.props.openDoor(e.doorId);
    else if (e.type === 'qmarkCollected') this.props.collectQmark(e.qmarkId);
  }

  private updateProps(dt: number, viewer: { x: number; y: number }, highlight: number | null): void {
    this.props.update(dt, viewer, highlight);
  }
```

- [ ] **Step 3: Type-check, test and build**

Run: `npx vitest run && npm run build`
Expected: tests PASS, and the build succeeds.

- [ ] **Step 4: Manual check**

Run: `npm run dev`.
Expected:
- The demo shows a blue particle portal and four chamfered walls, with warm flickering light.
- After you click: doors are visible (grey at the entrance).
- E opens a door: it slides up in about 1 s.
- Question marks spin and glow, and turn red when aimed at within reach.
- E on one logs an `ask`, auto-answers, and the mark bursts into particles and disappears.
- Frame rate stays smooth.

If the lighting looks too dark or blown out, tune these and note the values used in the commit message:
- `TorchLights` intensity (currently 9)
- the hemisphere intensity (0.35)
- fog density (0.06)

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: doors, question marks, torch light pool and exit portal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: In-game UI — HUD, question dialog, pause/help, minimap

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/questionDialog.ts`, `src/ui/pauseMenu.ts`, `src/ui/minimap.ts`
- Modify: `src/style.css` (append), `src/main.ts` (temporary boot using the real UI)

**Interfaces:**
- Consumes: `S`, `formatTime` (Task 1); `PreparedQuestion` (Task 2); `Layout`, `regionAt` (Task 4); `Pose` (Task 8).
- Produces:
  - `class Hud`, constructed as `new Hud(root)`, with `show(on)`, `setProgress(done, total)`, `setTime(ms)`, `setPrompt(text | null)`, `message(text, tone)`. The progress element has `data-testid="progress"`.
  - `class QuestionDialog`, constructed as `new QuestionDialog(root)`, with `open(question, number, onDone: (choice: number | null) => void)` and getter `isOpen`. It renders `role="dialog"`.
  - `class PauseMenu`, constructed as `new PauseMenu(root, { onContinue, onQuit })`, with `open(showHelp?: boolean)`, `close()` and getter `isOpen`.
  - `class Minimap`, constructed as `new Minimap(root, layout)`, with `toggle()`, `setVisible(on)`, `reset()` and `update(pose, state: { isDoorOpen(id): boolean; isQmarkDone(id): boolean })`.

- [ ] **Step 1: Create `src/ui/hud.ts`**

```ts
import { formatTime } from '../strings';

export class Hud {
  private readonly el: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly time: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly messages: HTMLElement;
  private lastTime = '';

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-top"><span class="hud-progress" data-testid="progress">0/30</span><span class="hud-time">0:00</span></div>
      <div class="hud-messages"></div>
      <div class="hud-crosshair"></div>
      <div class="hud-prompt hidden"></div>`;
    root.appendChild(this.el);
    this.progress = this.el.querySelector('.hud-progress')!;
    this.time = this.el.querySelector('.hud-time')!;
    this.prompt = this.el.querySelector('.hud-prompt')!;
    this.messages = this.el.querySelector('.hud-messages')!;
  }

  show(on: boolean): void {
    this.el.classList.toggle('hidden', !on);
    if (!on) this.messages.replaceChildren();
  }

  setProgress(done: number, total: number): void {
    this.progress.textContent = `${done}/${total}`;
  }

  setTime(ms: number): void {
    const t = formatTime(ms);
    if (t !== this.lastTime) this.time.textContent = this.lastTime = t;
  }

  setPrompt(text: string | null): void {
    this.prompt.classList.toggle('hidden', text === null);
    this.prompt.textContent = text ?? '';
  }

  message(text: string, tone: 'info' | 'good' | 'bad'): void {
    const m = document.createElement('div');
    m.className = `hud-message ${tone}`;
    m.textContent = text;
    this.messages.appendChild(m);
    while (this.messages.children.length > 4) this.messages.firstElementChild!.remove();
    setTimeout(() => m.classList.add('fade'), 2500);
    setTimeout(() => m.remove(), 3200);
  }
}
```

- [ ] **Step 2: Create `src/ui/questionDialog.ts`**

```ts
import type { PreparedQuestion } from '../data/shuffle';
import { S } from '../strings';

const KEY_TO_CHOICE: Record<string, number> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3,
};

export class QuestionDialog {
  private readonly el: HTMLElement;
  private onDone: ((choice: number | null) => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'overlay hidden';
    root.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.onDone !== null;
  }

  open(question: PreparedQuestion, number: number, onDone: (choice: number | null) => void): void {
    this.onDone = onDone;
    const panel = document.createElement('div');
    panel.className = 'panel question';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.textContent = `${S.questionTitle} ${number}`;
    const text = document.createElement('p');
    text.className = 'question-text';
    text.textContent = question.q;
    const list = document.createElement('div');
    list.className = 'answers';
    question.answers.forEach((answer, i) => {
      const b = document.createElement('button');
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);
      b.append(key, document.createTextNode(answer));
      b.addEventListener('click', () => this.finish(i));
      list.appendChild(b);
    });
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = S.closeHint;
    panel.append(title, text, list, hint);
    this.el.replaceChildren(panel);
    this.el.classList.remove('hidden');
    window.addEventListener('keydown', this.keyDown, true);
    (list.firstElementChild as HTMLButtonElement | null)?.focus();
  }

  private finish(choice: number | null): void {
    const done = this.onDone;
    if (!done) return;
    this.onDone = null;
    window.removeEventListener('keydown', this.keyDown, true);
    this.el.classList.add('hidden');
    this.el.replaceChildren();
    done(choice);
  }

  // Capture-phase listener; stopImmediatePropagation keeps the key from reaching Input's
  // bubble listener after finish() has re-enabled it (Escape would otherwise open the pause menu).
  private readonly keyDown = (e: KeyboardEvent): void => {
    if (e.code in KEY_TO_CHOICE) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.finish(KEY_TO_CHOICE[e.code]);
    } else if (e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.finish(null);
    }
  };
}
```

- [ ] **Step 3: Create `src/ui/pauseMenu.ts`**

```ts
import { S } from '../strings';

export interface PauseHandlers {
  onContinue(): void;
  onQuit(): void;
}

export function helpContent(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'help';
  const goal = document.createElement('p');
  goal.textContent = S.goal;
  const list = document.createElement('ul');
  for (const line of S.controls) {
    const li = document.createElement('li');
    li.textContent = line;
    list.appendChild(li);
  }
  wrap.append(goal, list);
  return wrap;
}

export class PauseMenu {
  private readonly el: HTMLElement;
  private readonly help: HTMLElement;
  private open_ = false;

  constructor(root: HTMLElement, private readonly handlers: PauseHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'overlay hidden';
    const panel = document.createElement('div');
    panel.className = 'panel pause';
    const title = document.createElement('h2');
    title.textContent = S.pauseTitle;
    const sub = document.createElement('p');
    sub.className = 'muted';
    sub.textContent = S.clickToContinue;
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    const mk = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      buttons.appendChild(b);
      return b;
    };
    mk(S.continue, () => this.handlers.onContinue());
    mk(S.help, () => this.help.classList.toggle('hidden'));
    mk(S.quit, () => {
      if (window.confirm(S.quitConfirm)) this.handlers.onQuit();
    });
    this.help = helpContent();
    this.help.classList.add('hidden');
    panel.append(title, sub, buttons, this.help);
    this.el.appendChild(panel);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.handlers.onContinue();
    });
    root.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.open_;
  }

  open(showHelp = false): void {
    this.open_ = true;
    this.help.classList.toggle('hidden', !showHelp);
    this.el.classList.remove('hidden');
    window.addEventListener('keydown', this.keyDown, true);
    (this.el.querySelector('button') as HTMLButtonElement).focus();
  }

  close(): void {
    this.open_ = false;
    this.el.classList.add('hidden');
    window.removeEventListener('keydown', this.keyDown, true);
  }

  // Capture phase + stopImmediatePropagation: otherwise the re-enabled Input would see the
  // same Escape and immediately pause again.
  private readonly keyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.handlers.onContinue();
    }
  };
}
```

- [ ] **Step 4: Create `src/ui/minimap.ts`**

```ts
import type { Pose } from '../game/game';
import { regionAt, type Layout } from '../world/layout';

const SCALE = 3; // px per metre
const PAD = 10;
const DOOR_COLOR = { grey: '#9a9a9a', silver: '#dde4f0', gold: '#ffc94a' } as const;

export interface MinimapState {
  isDoorOpen(id: number): boolean;
  isQmarkDone(id: number): boolean;
}

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly visited = new Set<string>();
  private readonly doorRegions: [string | undefined, string | undefined][];
  private visible = false;

  constructor(root: HTMLElement, private readonly layout: Layout) {
    const b = layout.bounds;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap hidden';
    this.canvas.width = (b.x1 - b.x0) * SCALE + PAD * 2;
    this.canvas.height = (b.y1 - b.y0) * SCALE + PAD * 2;
    this.ctx = this.canvas.getContext('2d')!;
    root.appendChild(this.canvas);
    this.doorRegions = layout.doors.map((d) => {
      const [ox, oy] = d.axis === 'x' ? [0, 0.5] : [0.5, 0];
      return [regionAt(layout, d.x - ox, d.y - oy)?.id, regionAt(layout, d.x + ox, d.y + oy)?.id];
    });
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.canvas.classList.toggle('hidden', !on);
  }

  reset(): void {
    this.visited.clear();
  }

  update(pose: Pose, state: MinimapState): void {
    const here = regionAt(this.layout, pose.x, pose.y);
    if (here) this.visited.add(here.id);
    if (!this.visible) return;
    const { ctx, layout } = this;
    const b = layout.bounds;
    const px = (x: number) => PAD + (x - b.x0) * SCALE;
    const py = (y: number) => PAD + (b.y1 - y) * SCALE;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = 'rgba(10,8,6,0.75)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#6b5f50';
    for (const r of layout.regions) {
      if (!this.visited.has(r.id)) continue;
      ctx.fillRect(px(r.rect.x0), py(r.rect.y1), (r.rect.x1 - r.rect.x0) * SCALE, (r.rect.y1 - r.rect.y0) * SCALE);
    }
    ctx.lineWidth = 3;
    for (const d of layout.doors) {
      const [a, c] = this.doorRegions[d.id];
      if (state.isDoorOpen(d.id) || !((a && this.visited.has(a)) || (c && this.visited.has(c)))) continue;
      ctx.strokeStyle = DOOR_COLOR[d.kind];
      ctx.beginPath();
      if (d.axis === 'x') { ctx.moveTo(px(d.x - 2), py(d.y)); ctx.lineTo(px(d.x + 2), py(d.y)); }
      else { ctx.moveTo(px(d.x), py(d.y - 2)); ctx.lineTo(px(d.x), py(d.y + 2)); }
      ctx.stroke();
    }
    for (const q of layout.qmarks) {
      const r = regionAt(layout, q.x, q.y);
      if (state.isQmarkDone(q.id) || !r || !this.visited.has(r.id)) continue;
      ctx.fillStyle = q.group === 'silver' ? '#dde4f0' : '#ffc94a';
      ctx.beginPath();
      ctx.arc(px(q.x), py(q.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.visited.has('center')) {
      ctx.fillStyle = '#4aa0ff';
      ctx.beginPath();
      ctx.arc(px(layout.exit.x), py(layout.exit.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const hx = Math.cos(pose.heading), hy = Math.sin(pose.heading);
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.moveTo(px(pose.x + hx * 2), py(pose.y + hy * 2));
    ctx.lineTo(px(pose.x - hx + hy), py(pose.y - hy - hx));
    ctx.lineTo(px(pose.x - hx - hy), py(pose.y - hy + hx));
    ctx.closePath();
    ctx.fill();
  }
}
```

- [ ] **Step 5: Append the in-game styles to `src/style.css`**

```css
.hud { position: fixed; inset: 0; pointer-events: none; }
.hud-top {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 24px;
  background: rgba(0, 0, 0, 0.45); padding: 6px 16px; border-radius: 8px; font-size: 1.2rem; font-variant-numeric: tabular-nums;
}
.hud-progress { color: var(--accent); font-weight: 700; }
.hud-messages { position: absolute; top: 64px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; }
.hud-message { background: rgba(0, 0, 0, 0.6); padding: 6px 14px; border-radius: 6px; font-size: 1.1rem; transition: opacity 0.6s; }
.hud-message.good { color: var(--good); }
.hud-message.bad { color: var(--bad); }
.hud-message.fade { opacity: 0; }
.hud-crosshair { position: absolute; top: 50%; left: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: rgba(255, 255, 255, 0.7); }
.hud-prompt { position: absolute; top: calc(50% + 28px); left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.55); padding: 4px 12px; border-radius: 6px; }
.question { width: 640px; }
.question-text { font-size: 1.35rem; line-height: 1.4; }
.answers { display: grid; gap: 10px; }
.answers button { text-align: left; display: flex; gap: 12px; align-items: center; font-size: 1.15rem; }
.key { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 6px; background: #1a130c; color: var(--accent); font-weight: 700; flex: none; }
.hint, .muted { color: var(--muted); font-size: 0.95rem; }
.buttons { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
.help ul { padding-left: 20px; line-height: 1.6; }
.minimap { position: fixed; right: 16px; bottom: 16px; max-width: 40vw; max-height: 60vh; border: 1px solid #5a4630; border-radius: 8px; }
```

- [ ] **Step 6: Update the temporary `src/main.ts` to use the real UI**

Replace the `startGame` handlers block from Task 8 with this version:

```ts
import './style.css';
import { loadIndex, loadSet } from './data/questionSet';
import { mulberry32 } from './data/shuffle';
import { Game } from './game/game';
import { Session } from './game/session';
import { Hud } from './ui/hud';
import { Minimap } from './ui/minimap';
import { PauseMenu } from './ui/pauseMenu';
import { QuestionDialog } from './ui/questionDialog';

// TEMPORARY (replaced in Task 11): click to play set Z1 with the real in-game UI.
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;
const game = new Game(canvas);
const hud = new Hud(ui);
const dialog = new QuestionDialog(ui);
const minimap = new Minimap(ui, game.layout);
const pause = new PauseMenu(ui, {
  onContinue: () => { pause.close(); game.resume(); },
  onQuit: () => { pause.close(); hud.show(false); minimap.setVisible(false); game.startDemo(); },
});
const base = import.meta.env.BASE_URL;
const [entry] = await loadIndex(base);
const r = await loadSet(base, entry);
canvas.addEventListener('click', () => {
  if (game.mode !== 'demo' || !r.ok) return;
  const session = new Session({ set: r.set, playerName: '', rng: mulberry32(Date.now() >>> 0) });
  hud.show(true);
  hud.setProgress(0, 30);
  minimap.reset();
  game.startGame(session, {
    onEvent: (e) => {
      if (e.type === 'message') hud.message(e.text, e.tone);
      else if (e.type === 'progress') hud.setProgress(e.done, e.total);
      else if (e.type === 'ask') dialog.open(e.question, (game.logic?.rules.doneCount ?? 0) + 1, (c) => game.answer(c));
      else if (e.type === 'exit') console.log('result', e.result);
    },
    onPauseRequest: () => { if (!pause.isOpen && !dialog.isOpen) { game.pause(); pause.open(); } },
    onToggleMap: () => minimap.toggle(),
    onHelp: () => { game.pause(); pause.open(true); },
    onPrompt: (t) => hud.setPrompt(t),
    onFrame: (pose) => { hud.setTime(session.elapsedMs()); if (game.logic) minimap.update(pose, game.logic); },
  });
});
```

- [ ] **Step 7: Type-check, test and build**

Run: `npx vitest run && npm run build`
Expected: PASS and the build succeeds.

- [ ] **Step 8: Manual check**

Run: `npm run dev`. Click to start. Expected:
- The HUD shows 0/30 and a running timer.
- E on a question mark opens the dialog with the mouse released. Keys 1–4 or a click answer it, and you see "Správně!" or "Špatně!" with 1/30. Esc closes without answering and the mark stays.
- M toggles the map, which shows visited rooms, doors, remaining marks and an arrow.
- Esc while walking shows the pause menu and the timer stops. "Pokračovat" resumes and re-captures the mouse.
- F1 opens pause with help.
- "Ukončit hru" asks for confirmation and returns to the demo.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: HUD, question dialog, pause/help menu and minimap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App flow — menu, results, errors, URL preselect, print, debug hook

**Files:**
- Create: `src/ui/menu.ts`, `src/ui/results.ts`
- Modify: `src/main.ts` (final version), `src/style.css` (append)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `class Menu`, constructed as `new Menu(root, onPlay: (set: QuestionSet, playerName: string) => void)`, with `show()`, `hide()`, `setLoading()`, `setError(text)`, `setSets(entries: MenuEntry[], preselectId?: string)`. Each set is a radio input whose accessible name is the set name. The Play button text is `S.play`.
  - `interface MenuEntry { entry: SetIndexEntry; result: ValidationResult }`
  - `class ResultsScreen`, constructed as `new ResultsScreen(root, onPlayAgain: () => void)`, with `show(result: SessionResult)` and `hide()`.
  - Debug hook: with `?debug` in the URL, `window.__cq = { askQmark(id: number): void; state(): { mode: string; done: number } }`.

- [ ] **Step 1: Create `src/ui/menu.ts`**

```ts
import type { QuestionSet, SetIndexEntry, ValidationResult } from '../data/questionSet';
import { S } from '../strings';
import { helpContent } from './pauseMenu';

export interface MenuEntry {
  entry: SetIndexEntry;
  result: ValidationResult;
}

export class Menu {
  private readonly el: HTMLElement;
  private readonly sets: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly playButton: HTMLButtonElement;
  private selected: QuestionSet | null = null;

  constructor(root: HTMLElement, private readonly onPlay: (set: QuestionSet, playerName: string) => void) {
    this.el = document.createElement('div');
    this.el.className = 'overlay menu-overlay hidden';
    const panel = document.createElement('div');
    panel.className = 'panel menu';
    const title = document.createElement('h1');
    title.textContent = S.title;
    const label = document.createElement('label');
    label.className = 'name';
    label.textContent = S.nameLabel;
    this.nameInput = document.createElement('input');
    this.nameInput.maxLength = 40;
    this.nameInput.autocomplete = 'off';
    label.appendChild(this.nameInput);
    this.sets = document.createElement('fieldset');
    this.sets.className = 'sets';
    this.playButton = document.createElement('button');
    this.playButton.className = 'play';
    this.playButton.textContent = S.play;
    this.playButton.disabled = true;
    this.playButton.addEventListener('click', () => {
      if (this.selected) this.onPlay(this.selected, this.nameInput.value.trim());
    });
    panel.append(title, helpContent(), label, this.sets, this.playButton);
    this.el.appendChild(panel);
    root.appendChild(this.el);
  }

  show(): void {
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  setLoading(): void {
    this.setStatus(S.loadingSets);
  }

  setError(text: string): void {
    this.setStatus(text, true);
  }

  setSets(entries: MenuEntry[], preselectId?: string): void {
    this.sets.replaceChildren();
    const pre = entries.find((e) => e.entry.id === preselectId && e.result.ok);
    const legend = document.createElement('legend');
    legend.textContent = pre ? S.selectedSet : S.chooseSet;
    this.sets.appendChild(legend);
    for (const { entry, result } of pre ? [pre] : entries) {
      const row = document.createElement('label');
      row.className = 'set';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'set';
      radio.disabled = !result.ok;
      const name = document.createElement('span');
      name.textContent = entry.name;
      row.append(radio, name);
      if (!result.ok) {
        const err = document.createElement('small');
        err.className = 'error';
        err.textContent = `(${S.unavailable}: ${result.error})`;
        row.appendChild(err);
      } else {
        radio.addEventListener('change', () => this.select(result.set));
      }
      this.sets.appendChild(row);
      if (pre) {
        radio.checked = true;
        if (result.ok) this.select(result.set);
      }
    }
  }

  private select(set: QuestionSet): void {
    this.selected = set;
    this.playButton.disabled = false;
  }

  private setStatus(text: string, isError = false): void {
    const p = document.createElement('p');
    p.className = isError ? 'error' : 'muted';
    p.textContent = text;
    this.sets.replaceChildren(p);
    this.selected = null;
    this.playButton.disabled = true;
  }
}
```

- [ ] **Step 2: Create `src/ui/results.ts`**

```ts
import type { SessionResult } from '../game/session';
import { S, formatTime } from '../strings';

export class ResultsScreen {
  private readonly el: HTMLElement;

  constructor(root: HTMLElement, private readonly onPlayAgain: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'overlay results-overlay hidden';
    root.appendChild(this.el);
  }

  show(result: SessionResult): void {
    const panel = document.createElement('div');
    panel.className = 'panel results';
    const h = document.createElement('h1');
    h.textContent = S.resultsTitle;
    const summary = document.createElement('dl');
    const rows: [string, string][] = [
      [S.name, result.playerName || S.anonymous],
      [S.set, result.setName],
      [S.date, result.date.toLocaleString('cs-CZ')],
      [S.time, formatTime(result.elapsedMs)],
      [S.score, `${result.correctCount} / ${result.total}`],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      summary.append(dt, dd);
    }
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const t of ['#', S.question, S.yourAnswer, S.correctAnswer, '']) {
      const th = document.createElement('th');
      th.textContent = t;
      head.appendChild(th);
    }
    const body = table.createTBody();
    result.records.forEach((r, i) => {
      const tr = body.insertRow();
      tr.className = r.isCorrect ? 'ok' : 'ko';
      for (const t of [String(i + 1), r.question, r.answers[r.chosen], r.answers[r.correct], r.isCorrect ? '✓' : '✗']) {
        tr.insertCell().textContent = t;
      }
    });
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    const again = document.createElement('button');
    again.textContent = S.playAgain;
    again.addEventListener('click', () => this.onPlayAgain());
    const print = document.createElement('button');
    print.textContent = S.print;
    print.addEventListener('click', () => window.print());
    buttons.append(again, print);
    panel.append(h, summary, buttons, table);
    this.el.replaceChildren(panel);
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.el.replaceChildren();
  }
}
```

- [ ] **Step 3: Replace `src/main.ts` with the final version**

```ts
import './style.css';
import { loadIndex, loadSet, type QuestionSet } from './data/questionSet';
import { mulberry32 } from './data/shuffle';
import { Game, type GameHandlers } from './game/game';
import { Session } from './game/session';
import { S } from './strings';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { Minimap } from './ui/minimap';
import { PauseMenu } from './ui/pauseMenu';
import { QuestionDialog } from './ui/questionDialog';
import { ResultsScreen } from './ui/results';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;

function showFatal(text: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const h = document.createElement('h1');
  h.textContent = S.title;
  const p = document.createElement('p');
  p.textContent = text;
  panel.append(h, p);
  overlay.appendChild(panel);
  ui.replaceChildren(overlay);
}

function webgl2Available(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function createGame(): Game | null {
  if (!webgl2Available()) return null;
  try {
    return new Game(canvas);
  } catch {
    return null;
  }
}

async function boot(): Promise<void> {
  const game = createGame();
  if (!game) {
    showFatal(S.noWebGL);
    return;
  }
  const params = new URLSearchParams(location.search);
  const hud = new Hud(ui);
  const minimap = new Minimap(ui, game.layout);
  const dialog = new QuestionDialog(ui);
  let session: Session | null = null;

  const toMenu = () => {
    session = null;
    hud.show(false);
    minimap.setVisible(false);
    results.hide();
    game.startDemo();
    menu.show();
  };
  const pause = new PauseMenu(ui, {
    onContinue: () => { pause.close(); game.resume(); },
    onQuit: () => { pause.close(); toMenu(); },
  });
  const results = new ResultsScreen(ui, () => toMenu());
  const menu = new Menu(ui, (set, name) => startGame(set, name));

  const handlers: GameHandlers = {
    onEvent: (e) => {
      if (e.type === 'message') hud.message(e.text, e.tone);
      else if (e.type === 'progress') hud.setProgress(e.done, e.total);
      else if (e.type === 'ask') {
        dialog.open(e.question, (game.logic?.rules.doneCount ?? 0) + 1, (choice) => game.answer(choice));
      } else if (e.type === 'exit') {
        hud.show(false);
        minimap.setVisible(false);
        results.show(e.result);
      }
    },
    onPauseRequest: () => {
      if (pause.isOpen || dialog.isOpen || game.mode !== 'play') return;
      game.pause();
      pause.open();
    },
    onToggleMap: () => minimap.toggle(),
    onHelp: () => {
      if (game.mode !== 'play') return;
      game.pause();
      pause.open(true);
    },
    onPrompt: (text) => hud.setPrompt(text),
    onFrame: (pose) => {
      if (session) hud.setTime(session.elapsedMs());
      if (game.logic) minimap.update(pose, game.logic);
    },
  };

  function startGame(set: QuestionSet, playerName: string): void {
    menu.hide();
    results.hide();
    session = new Session({ set, playerName, rng: mulberry32((Math.random() * 2 ** 32) >>> 0) });
    hud.show(true);
    hud.setProgress(0, session.questions.length);
    hud.setTime(0);
    minimap.reset();
    minimap.setVisible(false);
    game.startGame(session, handlers);
    hud.message(S.gameStart, 'info');
  }

  if (params.has('debug')) {
    (window as unknown as { __cq: unknown }).__cq = {
      askQmark: (id: number) => game.logic?.use({ kind: 'qmark', id }),
      state: () => ({ mode: game.mode, done: game.logic?.rules.doneCount ?? 0 }),
    };
  }

  toMenu();
  menu.setLoading();
  try {
    const base = import.meta.env.BASE_URL;
    const index = await loadIndex(base);
    const entries = await Promise.all(index.map(async (entry) => ({ entry, result: await loadSet(base, entry) })));
    menu.setSets(entries, params.get('test') ?? undefined);
  } catch {
    menu.setError(S.indexLoadError);
  }
}

void boot();
```

- [ ] **Step 4: Append the menu, results and print styles to `src/style.css`**

```css
.menu-overlay, .results-overlay { background: linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.7)); }
.menu { width: 620px; max-height: calc(100vh - 32px); overflow: auto; }
.menu h1 { font-size: 2.4rem; letter-spacing: 0.04em; }
.name { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
.name input { font: inherit; padding: 8px 10px; border-radius: 6px; border: 1px solid #7a5c3a; background: #1a130c; color: var(--text); }
.sets { border: 1px solid #5a4630; border-radius: 8px; padding: 10px 14px; margin: 12px 0; }
.sets legend { color: var(--accent); padding: 0 6px; }
.set { display: flex; gap: 10px; align-items: baseline; padding: 6px 0; cursor: pointer; flex-wrap: wrap; }
.error { color: var(--bad); }
.play { width: 100%; font-size: 1.3rem; padding: 14px; background: #6a4a22; }
.results { width: 860px; max-height: calc(100vh - 32px); overflow: auto; }
.results dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; }
.results dt { color: var(--muted); }
.results dd { margin: 0; }
.results table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.95rem; }
.results th, .results td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #3a2c1d; vertical-align: top; }
.results tr.ok td:last-child { color: var(--good); }
.results tr.ko td:last-child { color: var(--bad); }

@media print {
  html, body { background: #fff; color: #000; overflow: visible; height: auto; }
  #scene, .hud, .minimap, .menu-overlay, .buttons { display: none !important; }
  #ui, .overlay { position: static; background: none; display: block; }
  .panel { box-shadow: none; border: none; max-width: none; width: auto; max-height: none; overflow: visible; background: #fff; color: #000; }
  .results h1, .results dt { color: #000; }
  .results th, .results td { border-bottom: 1px solid #999; }
}
```

- [ ] **Step 5: Type-check, test and build**

Run: `npx vitest run && npm run build`
Expected: PASS and the build succeeds.

- [ ] **Step 6: Manual check**

Run: `npm run build && npm run preview`, then open http://localhost:4173/.
Expected:
- The menu shows over the circling demo camera. It contains the goal and controls, the name field, and six sets. Play is disabled until a set is chosen.
- Playing starts the game. The menu disappears and the start message shows.
- `?test=S2` shows only "Speciální škola – úroveň 2", preselected, with Play enabled.
- Temporarily rename `dist/tests/Z1.json`: Z1 shows as unavailable with "Soubor se nepodařilo načíst." and the others still work. Restore the file.
- Reach the exit, by opening the gold doors with the `?debug` hook if needed. The results table appears. "Vytisknout / uložit PDF" shows a clean black-on-white print preview. "Hrát znovu" returns to the menu.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: start menu, results screen, URL preselect and error handling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Browser smoke test, README, final verification

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `README.md`

**Interfaces:**
- Consumes: the debug hook `window.__cq` and `data-testid="progress"` (Tasks 10–11).

- [ ] **Step 1: Install Playwright**

Run: `npm i -D @playwright/test@^1.64.1 && npx playwright install chromium`
Expected: the package is installed and the Chromium browser is downloaded.

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173/',
    browserName: 'chromium',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 3: Write `e2e/smoke.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

type Hook = { askQmark(id: number): void; state(): { mode: string; done: number } };

test('start a game, answer one question, pause with Escape', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?debug');
  await page.getByRole('radio', { name: 'Základní škola – úroveň 1' }).check();
  await page.getByRole('button', { name: 'Hrát' }).click();
  await expect(page.getByTestId('progress')).toHaveText('0/30');

  await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.askQmark(0));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button').first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('progress')).toHaveText('1/30');

  // Escape while walking (no pointer lock in headless) opens the pause menu and stops the timer.
  await page.locator('#scene').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Pokračovat' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.state().mode)).toBe('paused');
  const t1 = await page.locator('.hud-time').textContent();
  await page.waitForTimeout(1500);
  expect(await page.locator('.hud-time').textContent()).toBe(t1);
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  expect(await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.state().mode)).toBe('play');

  expect(errors).toEqual([]);
});

test('?test=S2 preselects the set', async ({ page }) => {
  await page.goto('./?test=S2');
  await expect(page.getByRole('radio', { name: 'Speciální škola – úroveň 2' })).toBeChecked();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Hrát' })).toBeEnabled();
});
```

Note on the Escape step:
- If headless Chromium does grant pointer lock on the canvas click, Escape releases the lock. The `pointerlockchange` path then opens the same pause menu, so the assertions hold either way.
- If neither happens because Playwright swallows Escape while locked, call `document.exitPointerLock()` through `page.evaluate` in place of the key press. That exercises the lost-lock path the spec requires.

- [ ] **Step 4: Run the e2e tests**

Run: `npm run e2e`
Expected: 2 tests PASS.

- [ ] **Step 5: Create `README.md`**

````markdown
# CastleQuest NG

Vzdělávací hra v prohlížeči: projdi hradní bludiště, zodpověz otázky, otevři dveře a najdi východ.

## Vývoj

```bash
npm install
npm run dev        # vývojový server
npm test           # unit testy (Vitest)
npm run e2e        # test v prohlížeči (Playwright; poprvé: npx playwright install chromium)
npm run build      # statický web do dist/
```

## Nasazení

Obsah složky `dist/` nahraj na libovolný statický web (i do podsložky). Hra nic neodesílá na server.

## Sady otázek

Viz [docs/otazky.md](docs/otazky.md). Přímý odkaz na sadu: `?test=Z1`.

## Licence a původ

Všechny textury, modely a otázky jsou nové, vytvořené pro tento projekt. Složka `legacy/` (původní hra z roku 2006)
slouží jen jako reference, není součástí repozitáře ani buildu.
````

- [ ] **Step 6: Final verification**

Run: `npx vitest run && npm run build && npm run e2e`
Expected: all unit tests PASS, the build succeeds, and 2 e2e tests PASS.

Then check that no legacy material is tracked:

Run: `git ls-files | grep -i legacy; echo "exit $?"`
Expected: no file paths are printed, then `exit 1`.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e README.md package.json package-lock.json
git commit -m "test: browser smoke test; docs: README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
