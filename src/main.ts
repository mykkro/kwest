import './style.css';
import { loadIndex, loadSet, type QuestionSet } from './data/questionSet';
import { mulberry32 } from './data/shuffle';
import { Game, type GameHandlers } from './game/game';
import { Session } from './game/session';
import { S } from './strings';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { Minimap } from './ui/minimap';
import { PauseMenu } from './ui/pauseMenu';
import { QuestionDialog } from './ui/questionDialog';
import { ResultsScreen } from './ui/results';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;

function showFatal(text: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const h = document.createElement('h1');
  h.textContent = S.title;
  const p = document.createElement('p');
  p.textContent = text;
  panel.append(h, p);
  overlay.appendChild(panel);
  ui.replaceChildren(overlay);
}

function webgl2Available(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function createGame(): Game | null {
  if (!webgl2Available()) return null;
  try {
    return new Game(canvas);
  } catch {
    return null;
  }
}

async function boot(): Promise<void> {
  const created = createGame();
  if (!created) {
    showFatal(S.noWebGL);
    return;
  }
  const game: Game = created; // non-null binding so the hoisted startGame() below type-checks
  const params = new URLSearchParams(location.search);
  const hud = new Hud(ui);
  const minimap = new Minimap(ui, game.layout);
  const dialog = new QuestionDialog(ui);
  let session: Session | null = null;

  const toMenu = () => {
    session = null;
    hud.show(false);
    minimap.setVisible(false);
    results.hide();
    game.startDemo();
    menu.show();
  };
  const pause = new PauseMenu(ui, {
    onContinue: () => { pause.close(); game.resume(); },
    onQuit: () => { pause.close(); toMenu(); },
  });
  const results = new ResultsScreen(ui, () => toMenu());
  const menu = new Menu(ui, (set, name) => startGame(set, name));

  const handlers: GameHandlers = {
    onEvent: (e) => {
      if (e.type === 'message') hud.message(e.text, e.tone);
      else if (e.type === 'progress') hud.setProgress(e.done, e.total);
      else if (e.type === 'ask') {
        dialog.open(e.question, (game.logic?.rules.doneCount ?? 0) + 1, (choice) => game.answer(choice));
      } else if (e.type === 'exit') {
        hud.show(false);
        minimap.setVisible(false);
        results.show(e.result);
      }
    },
    onPauseRequest: () => {
      if (pause.isOpen || dialog.isOpen || game.mode !== 'play') return;
      game.pause();
      pause.open();
    },
    onToggleMap: () => minimap.toggle(),
    onHelp: () => {
      if (game.mode !== 'play') return;
      game.pause();
      pause.open(true);
    },
    onPrompt: (text) => hud.setPrompt(text),
    onFrame: (pose) => {
      if (session) hud.setTime(session.elapsedMs());
      if (game.logic) minimap.update(pose, game.logic);
    },
  };

  function startGame(set: QuestionSet, playerName: string): void {
    menu.hide();
    results.hide();
    session = new Session({ set, playerName, rng: mulberry32((Math.random() * 2 ** 32) >>> 0) });
    hud.show(true);
    hud.setProgress(0, session.questions.length);
    hud.setTime(0);
    minimap.reset();
    minimap.setVisible(false);
    game.startGame(session, handlers);
    hud.message(S.gameStart, 'info');
  }

  if (params.has('debug')) {
    (window as unknown as { __cq: unknown }).__cq = {
      askQmark: (id: number) => game.logic?.use({ kind: 'qmark', id }),
      state: () => ({ mode: game.mode, done: game.logic?.rules.doneCount ?? 0 }),
      teleport: (x: number, y: number) => game.debugTeleport(x, y),
    };
  }

  toMenu();
  menu.setLoading();
  try {
    const base = import.meta.env.BASE_URL;
    const index = await loadIndex(base);
    const entries = await Promise.all(index.map(async (entry) => ({ entry, result: await loadSet(base, entry) })));
    menu.setSets(entries, params.get('test') ?? undefined);
  } catch {
    menu.setError(S.indexLoadError);
  }
}

void boot();
