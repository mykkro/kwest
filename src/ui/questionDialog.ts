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
