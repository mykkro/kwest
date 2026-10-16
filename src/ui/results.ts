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
