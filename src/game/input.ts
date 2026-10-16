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
  private lockListener: ((locked: boolean, selfInitiated: boolean) => void) | null = null;
  private exitRequested = false;
  private lockErrorListener: (() => void) | null = null;

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
    document.addEventListener('pointerlockchange', () => {
      const locked = this.pointerLocked;
      // pointerlockchange is async: an unlock we requested ourselves (dialog, pause) can arrive after
      // the game is already back in play mode, so report it as self-initiated.
      const selfInitiated = !locked && this.exitRequested;
      if (!locked) this.exitRequested = false;
      this.lockListener?.(locked, selfInitiated);
    });
    document.addEventListener('pointerlockerror', () => this.lockErrorListener?.());
  }

  onPointerLockError(fn: () => void): void {
    this.lockErrorListener = fn;
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
    if (!this.pointerLocked) return;
    this.exitRequested = true;
    document.exitPointerLock();
  }

  onAction(fn: (a: Action) => void): void {
    this.actionListeners.push(fn);
  }

  onPointerLockChange(fn: (locked: boolean, selfInitiated: boolean) => void): void {
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
