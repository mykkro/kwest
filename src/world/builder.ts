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
