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
