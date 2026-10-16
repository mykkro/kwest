import type { Input } from '../game/input';
import { S } from '../strings';

const DEAD_ZONE = 0.15; // fraction of the stick radius that is ignored
const LOOK_SCALE = 1.6; // touch-drag pixels → mouse-look pixels
const STICK_RADIUS = 56;

/** Converts a joystick drag (screen pixels, y down) into movement input; full speed at the rim. */
export function joystickVector(dx: number, dy: number, radius: number): { forward: number; strafe: number } {
  const len = Math.hypot(dx, dy);
  if (len < radius * DEAD_ZONE) return { forward: 0, strafe: 0 };
  const k = Math.min(len, radius) / radius / len;
  return { forward: -dy * k + 0, strafe: dx * k + 0 };
}

/** Keeps receiving moves after the finger leaves the element; harmless if the pointer is already gone. */
function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // pointer already released or synthetic
  }
}

/** Touch-first device (phone/tablet), or forced with ?touch for testing. */
export function isTouchDevice(search: string = location.search): boolean {
  return new URLSearchParams(search).has('touch') || window.matchMedia('(pointer: coarse)').matches;
}

/** On-screen controls: joystick (left), drag-to-look (right half), Použít / pause buttons. */
export class TouchControls {
  private readonly el: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly useButton: HTMLButtonElement;

  constructor(root: HTMLElement, private readonly input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'touch hidden';
    const look = document.createElement('div');
    look.className = 'touch-look';
    const stick = document.createElement('div');
    stick.className = 'touch-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'touch-knob';
    stick.appendChild(this.knob);
    this.useButton = document.createElement('button');
    this.useButton.className = 'touch-use';
    this.useButton.textContent = S.touchUse;
    const pause = document.createElement('button');
    pause.className = 'touch-pause';
    pause.textContent = 'II';
    pause.setAttribute('aria-label', S.pauseTitle);
    this.el.append(look, stick, this.useButton, pause);
    root.appendChild(this.el);

    this.trackStick(stick);
    this.trackLook(look);
    this.tap(this.useButton, () => this.input.triggerAction('use'));
    this.tap(pause, () => this.input.triggerAction('pause'));
  }

  setActive(on: boolean): void {
    this.el.classList.toggle('hidden', !on);
    if (!on) this.resetStick();
  }

  /** Highlights the Použít button while a question mark or door is in reach. */
  setUseReady(ready: boolean): void {
    this.useButton.classList.toggle('ready', ready);
  }

  private tap(button: HTMLElement, fn: () => void): void {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }

  private trackStick(stick: HTMLElement): void {
    let id: number | null = null;
    let cx = 0, cy = 0;
    stick.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      capture(stick, e.pointerId);
      this.moveStick(e.clientX - cx, e.clientY - cy);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) this.moveStick(e.clientX - cx, e.clientY - cy);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.resetStick();
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  private moveStick(dx: number, dy: number): void {
    const v = joystickVector(dx, dy, STICK_RADIUS);
    this.input.setTouchMove(v.forward, v.strafe);
    const len = Math.hypot(dx, dy);
    const k = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  private resetStick(): void {
    this.input.setTouchMove(0, 0);
    this.knob.style.transform = '';
  }

  private trackLook(area: HTMLElement): void {
    let id: number | null = null;
    let lx = 0, ly = 0;
    area.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      capture(area, e.pointerId);
    });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      this.input.addTouchLook((e.clientX - lx) * LOOK_SCALE, (e.clientY - ly) * LOOK_SCALE);
      lx = e.clientX;
      ly = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === id) id = null;
    };
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
  }
}
