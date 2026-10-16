import * as THREE from 'three';
import { S } from '../strings';
import { buildWorld } from '../world/builder';
import { FloorGrid, LAYOUT, type Layout, type Segment, type WallSegment } from '../world/layout';
import { Input } from './input';
import { findTarget, type Target } from './interaction';
import { GameLogic, type LogicEvent } from './logic';
import { PLAYER, Player } from './player';
import type { Session } from './session';

export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export interface GameHandlers {
  onEvent(e: LogicEvent): void;
  onPauseRequest(): void;
  onToggleMap(): void;
  onHelp(): void;
  onPrompt(text: string | null): void;
  onFrame(pose: Pose): void;
}

export type GameMode = 'demo' | 'play' | 'question' | 'paused' | 'ended';

const DEMO_RADIUS = 5;

export class Game {
  readonly layout: Layout;
  readonly grid: FloorGrid;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  readonly input: Input;
  private readonly walls: WallSegment[];
  private colliders: Segment[] = [];
  private player: Player;
  private currentMode: GameMode = 'demo';
  private gameLogic: GameLogic | null = null;
  private session: Session | null = null;
  private handlers: GameHandlers | null = null;
  private target: Target | null = null;
  private promptText: string | null = null;
  private resumeWithLock = false;
  private demoAngle = 0;
  private lastFrame = performance.now();

  constructor(canvas: HTMLCanvasElement, layout: Layout = LAYOUT) {
    this.layout = layout;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color(0x050403);
    this.scene.fog = new THREE.FogExp2(0x050403, 0.06);
    this.scene.add(new THREE.HemisphereLight(0x8a7a66, 0x1a1410, 0.35));
    this.grid = new FloorGrid(layout);
    const world = buildWorld(layout, this.grid);
    this.walls = world.walls;
    this.scene.add(world.group);
    this.camera.rotation.order = 'YXZ';
    this.player = new Player(layout.start.x, layout.start.y, layout.startHeading);

    this.input = new Input(canvas);
    this.input.onAction((a) => {
      if (a === 'use' && this.currentMode === 'play') this.gameLogic?.use(this.target);
      else if (a === 'map') this.handlers?.onToggleMap();
      else if (a === 'pause') this.handlers?.onPauseRequest();
      else if (a === 'help') this.handlers?.onHelp();
    });
    this.input.onPointerLockChange((locked) => {
      if (!locked && this.currentMode === 'play') {
        this.resumeWithLock = true;
        this.handlers?.onPauseRequest();
      }
    });
    canvas.addEventListener('click', () => {
      if (this.currentMode === 'play') this.input.requestPointerLock();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.currentMode === 'play') this.handlers?.onPauseRequest();
        else if (this.currentMode === 'question') this.session?.pause();
      } else if (this.currentMode === 'question') this.session?.resume();
    });
    window.addEventListener('resize', this.resize);
    this.resize();
    this.renderer.setAnimationLoop(this.frame);
  }

  get logic(): GameLogic | null {
    return this.gameLogic;
  }

  get mode(): GameMode {
    return this.currentMode;
  }

  pose(): Pose {
    return { x: this.player.x, y: this.player.y, heading: this.player.heading };
  }

  startDemo(): void {
    this.currentMode = 'demo';
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.gameLogic = null;
    this.session = null;
    this.handlers = null;
    this.resetWorld();
  }

  startGame(session: Session, handlers: GameHandlers): void {
    this.session = session;
    this.handlers = handlers;
    this.gameLogic = new GameLogic(this.layout, session, this.handleLogic);
    this.resetWorld();
    this.player = new Player(this.layout.start.x, this.layout.start.y, this.layout.startHeading);
    this.refreshColliders();
    this.target = null;
    this.promptText = null;
    handlers.onPrompt(null);
    this.resumeWithLock = false;
    this.currentMode = 'play';
    this.input.enabled = true;
    this.input.requestPointerLock();
  }

  pause(): void {
    if (this.currentMode !== 'play') return;
    this.resumeWithLock = this.resumeWithLock || this.input.pointerLocked;
    this.currentMode = 'paused';
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.session?.pause();
  }

  resume(): void {
    if (this.currentMode !== 'paused') return;
    this.currentMode = 'play';
    this.input.enabled = true;
    this.session?.resume();
    if (this.resumeWithLock) this.input.requestPointerLock();
    this.resumeWithLock = false;
  }

  answer(choice: number | null): void {
    if (this.currentMode !== 'question' || !this.gameLogic) return;
    this.gameLogic.answerQuestion(choice);
    this.currentMode = 'play';
    this.input.enabled = true;
    if (this.resumeWithLock) this.input.requestPointerLock();
    this.resumeWithLock = false;
  }

  /** Hook for Task 9: reset doors/question marks to their initial state. */
  protected resetWorld(): void {}

  /** Hook for Task 9: visual reaction to logic events. */
  protected onLogicVisual(_e: LogicEvent): void {}

  /** Hook for Task 9: per-frame prop animation. */
  protected updateProps(_dt: number, _viewer: { x: number; y: number }, _highlight: number | null): void {}

  private readonly handleLogic = (e: LogicEvent): void => {
    if (e.type === 'ask') {
      this.currentMode = 'question';
      this.resumeWithLock = this.input.pointerLocked;
      this.input.enabled = false;
      this.input.exitPointerLock();
      this.setPrompt(null);
    } else if (e.type === 'doorOpening') {
      this.refreshColliders();
    } else if (e.type === 'exit') {
      this.currentMode = 'ended';
      this.input.enabled = false;
      this.input.exitPointerLock();
      this.setPrompt(null);
    }
    this.onLogicVisual(e);
    this.handlers?.onEvent(e);
  };

  private refreshColliders(): void {
    this.colliders = [...this.walls, ...(this.gameLogic?.closedDoorColliders() ?? [])];
  }

  private setPrompt(text: string | null): void {
    if (text === this.promptText) return;
    this.promptText = text;
    this.handlers?.onPrompt(text);
  }

  private updateTarget(logic: GameLogic): void {
    const t = findTarget(
      this.player.x, this.player.y, this.player.heading, this.layout,
      (id) => logic.isQmarkDone(id), (id) => logic.isDoorOpen(id),
    );
    this.target = t;
    if (!t) this.setPrompt(null);
    else if (t.kind === 'qmark') this.setPrompt(S.promptQmark);
    else this.setPrompt(this.layout.doors[t.id].kind === 'grey' ? S.promptDoor : S.promptLocked);
  }

  private readonly resize = (): void => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private readonly frame = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    if (this.currentMode === 'demo') {
      this.demoAngle += dt * 0.12;
      this.camera.position.set(DEMO_RADIUS * Math.cos(this.demoAngle), 2, -DEMO_RADIUS * Math.sin(this.demoAngle));
      this.camera.lookAt(0, 1.5, 0);
    } else {
      if (this.currentMode === 'play' && this.gameLogic) {
        this.player.update(dt, this.input.sample(), this.colliders);
        this.gameLogic.checkExit(this.player.x, this.player.y);
        if (this.currentMode === 'play') this.updateTarget(this.gameLogic);
      }
      this.camera.position.set(this.player.x, PLAYER.eyeHeight, -this.player.y);
      this.camera.rotation.set(this.player.pitch, this.player.heading - Math.PI / 2, 0);
      if (this.currentMode === 'play' || this.currentMode === 'question') this.handlers?.onFrame(this.pose());
    }
    const highlight = this.currentMode === 'play' && this.target?.kind === 'qmark' ? this.target.id : null;
    this.updateProps(dt, { x: this.camera.position.x, y: -this.camera.position.z }, highlight);
    this.renderer.render(this.scene, this.camera);
  };
}
