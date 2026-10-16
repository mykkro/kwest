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
      l.intensity = 14 * (0.85 + 0.15 * Math.sin(this.t * 13 + i * 1.7) * Math.sin(this.t * 7.3 + i));
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
