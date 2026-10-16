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
  return kind === 'grey' ? makeWoodenDoorTexture() : makeMetalDoorTexture(DOOR_TINT[kind]);
}

function makeWoodenDoorTexture(): THREE.CanvasTexture {
  const size = 256;
  const [c, ctx] = makeCanvas(size, size);
  const rng = mulberry32(4);
  const base = DOOR_TINT.grey;
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

/** Brushed metal plate with a bevelled frame, four raised panels and rivets. */
function makeMetalDoorTexture(base: readonly number[]): THREE.CanvasTexture {
  const size = 512;
  const [c, ctx] = makeCanvas(size, size);
  const rng = mulberry32(7);
  ctx.fillStyle = shade(base, 0.85);
  ctx.fillRect(0, 0, size, size);
  // brushed streaks
  for (let y = 0; y < size; y++) {
    ctx.fillStyle = shade(base, 0.75 + rng() * 0.35);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, y, size, 1);
  }
  ctx.globalAlpha = 1;
  const bevel = (x: number, y: number, w: number, h: number, depth: number, raised: boolean) => {
    const light = shade(base, 1.35), dark = shade(base, 0.45);
    ctx.fillStyle = raised ? light : dark; // top + left
    ctx.fillRect(x, y, w, depth);
    ctx.fillRect(x, y, depth, h);
    ctx.fillStyle = raised ? dark : light; // bottom + right
    ctx.fillRect(x, y + h - depth, w, depth);
    ctx.fillRect(x + w - depth, y, depth, h);
  };
  const frame = 34;
  bevel(0, 0, size, size, 8, true);
  bevel(frame, frame, size - 2 * frame, size - 2 * frame, 6, false);
  const gap = 18, inner = size - 2 * frame, panel = (inner - 3 * gap) / 2;
  for (const px of [0, 1]) {
    for (const py of [0, 1]) {
      const x = frame + gap + px * (panel + gap), y = frame + gap + py * (panel + gap);
      ctx.fillStyle = shade(base, 1.05);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x, y, panel, panel);
      ctx.globalAlpha = 1;
      bevel(x, y, panel, panel, 7, true);
    }
  }
  // rivets along the frame
  for (let i = 0; i < 8; i++) {
    const t = 30 + (i * (size - 60)) / 7;
    for (const [x, y] of [[t, frame / 2], [t, size - frame / 2], [frame / 2, t], [size - frame / 2, t]]) {
      ctx.fillStyle = shade(base, 0.4);
      ctx.beginPath();
      ctx.arc(x + 1, y + 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(base, 1.4);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
