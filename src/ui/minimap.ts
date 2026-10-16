import type { Pose } from '../game/game';
import { S } from '../strings';
import { regionAt, type Layout, type QMarkSpot } from '../world/layout';

const SCALE = 3; // px per metre
const PAD = 10;
const DOOR_COLOR = { grey: '#9a9a9a', silver: '#dde4f0', gold: '#ffc94a' } as const;

const QMARK_FONT_PX = 13;

/** Unanswered question marks in rooms the player has already visited. */
export function discoveredQmarks(
  layout: Layout,
  visited: ReadonlySet<string>,
  isDone: (id: number) => boolean,
): QMarkSpot[] {
  return layout.qmarks.filter((q) => {
    const r = regionAt(layout, q.x, q.y);
    return !isDone(q.id) && r !== undefined && visited.has(r.id);
  });
}

export interface MinimapState {
  isDoorOpen(id: number): boolean;
  isQmarkDone(id: number): boolean;
}

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly visited = new Set<string>();
  private readonly doorRegions: [string | undefined, string | undefined][];
  private readonly widget: HTMLElement;
  private visible = true; // the map starts shown; the choice is kept across games

  constructor(root: HTMLElement, private readonly layout: Layout) {
    const b = layout.bounds;
    this.widget = document.createElement('div');
    this.widget.className = 'minimap-widget hidden';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = (b.x1 - b.x0) * SCALE + PAD * 2;
    this.canvas.height = (b.y1 - b.y0) * SCALE + PAD * 2;
    this.ctx = this.canvas.getContext('2d')!;
    const button = document.createElement('button');
    button.className = 'minimap-toggle';
    button.textContent = S.mapButton;
    button.addEventListener('click', () => {
      this.toggle();
      button.blur(); // keep Space/Enter for "use" instead of re-pressing this button
    });
    this.widget.append(this.canvas, button);
    root.appendChild(this.widget);
    this.doorRegions = layout.doors.map((d) => {
      const [ox, oy] = d.axis === 'x' ? [0, 0.5] : [0.5, 0];
      return [regionAt(layout, d.x - ox, d.y - oy)?.id, regionAt(layout, d.x + ox, d.y + oy)?.id];
    });
  }

  /** Shows or hides the whole widget (map + button) while a game is running. */
  setActive(on: boolean): void {
    this.widget.classList.toggle('hidden', !on);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.canvas.classList.toggle('hidden', !this.visible);
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
    ctx.font = `bold ${QMARK_FONT_PX}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    for (const q of discoveredQmarks(layout, this.visited, (id) => state.isQmarkDone(id))) {
      ctx.fillStyle = q.group === 'silver' ? '#dde4f0' : '#ffc94a';
      ctx.strokeText('?', px(q.x), py(q.y));
      ctx.fillText('?', px(q.x), py(q.y));
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
