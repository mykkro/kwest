import { S, formatTime } from '../strings';
import type { Group } from '../world/layout';

const FLASH_MS = 3200;

export class Hud {
  private readonly el: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly time: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly messages: HTMLElement;
  private readonly lockHint: HTMLElement;
  private readonly flashEl: HTMLElement;
  private flashTimer: number | undefined;
  private lastTime = '';

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-top"><span class="hud-progress" data-testid="progress">0/30</span><span class="hud-time">0:00</span></div>
      <div class="hud-messages"></div>
      <div class="hud-crosshair"></div>
      <div class="hud-prompt hidden"></div>
      <div class="hud-lock-hint hidden"></div>
      <div class="hud-flash hidden"></div>`;
    root.appendChild(this.el);
    this.progress = this.el.querySelector('.hud-progress')!;
    this.time = this.el.querySelector('.hud-time')!;
    this.prompt = this.el.querySelector('.hud-prompt')!;
    this.messages = this.el.querySelector('.hud-messages')!;
    this.lockHint = this.el.querySelector('.hud-lock-hint')!;
    this.flashEl = this.el.querySelector('.hud-flash')!;
    this.lockHint.textContent = S.clickToContinue;
  }

  show(on: boolean): void {
    this.el.classList.toggle('hidden', !on);
    if (!on) {
      this.messages.replaceChildren();
      this.flashEl.classList.add('hidden');
    }
  }

  setProgress(done: number, total: number): void {
    this.progress.textContent = `${done}/${total}`;
  }

  setTime(ms: number): void {
    const t = formatTime(ms);
    if (t !== this.lastTime) this.time.textContent = this.lastTime = t;
  }

  /** Big centred banner in the door colour, e.g. when a door group opens. */
  flash(text: string, group: Group): void {
    window.clearTimeout(this.flashTimer);
    this.flashEl.textContent = text;
    this.flashEl.className = `hud-flash ${group}`;
    void this.flashEl.offsetWidth; // restart the CSS animation
    this.flashEl.classList.add('show');
    this.flashTimer = window.setTimeout(() => this.flashEl.classList.add('hidden'), FLASH_MS);
  }

  setLockHint(show: boolean): void {
    this.lockHint.classList.toggle('hidden', !show);
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
