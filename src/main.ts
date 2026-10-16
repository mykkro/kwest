import './style.css';
import { loadIndex, loadSet } from './data/questionSet';
import { mulberry32 } from './data/shuffle';
import { Game } from './game/game';
import { Session } from './game/session';
import { Hud } from './ui/hud';
import { Minimap } from './ui/minimap';
import { PauseMenu } from './ui/pauseMenu';
import { QuestionDialog } from './ui/questionDialog';

// TEMPORARY (replaced in Task 11): click to play set Z1 with the real in-game UI.
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;
const game = new Game(canvas);
const hud = new Hud(ui);
const dialog = new QuestionDialog(ui);
const minimap = new Minimap(ui, game.layout);
const pause = new PauseMenu(ui, {
  onContinue: () => { pause.close(); game.resume(); },
  onQuit: () => { pause.close(); hud.show(false); minimap.setVisible(false); game.startDemo(); },
});
const base = import.meta.env.BASE_URL;
const [entry] = await loadIndex(base);
const r = await loadSet(base, entry);
canvas.addEventListener('click', () => {
  if (game.mode !== 'demo' || !r.ok) return;
  const session = new Session({ set: r.set, playerName: '', rng: mulberry32(Date.now() >>> 0) });
  hud.show(true);
  hud.setProgress(0, 30);
  minimap.reset();
  game.startGame(session, {
    onEvent: (e) => {
      if (e.type === 'message') hud.message(e.text, e.tone);
      else if (e.type === 'progress') hud.setProgress(e.done, e.total);
      else if (e.type === 'ask') dialog.open(e.question, (game.logic?.rules.doneCount ?? 0) + 1, (c) => game.answer(c));
      else if (e.type === 'exit') console.log('result', e.result);
    },
    onPauseRequest: () => { if (!pause.isOpen && !dialog.isOpen) { game.pause(); pause.open(); } },
    onToggleMap: () => minimap.toggle(),
    onHelp: () => { game.pause(); pause.open(true); },
    onPrompt: (t) => hud.setPrompt(t),
    onFrame: (pose) => { hud.setTime(session.elapsedMs()); if (game.logic) minimap.update(pose, game.logic); },
  });
});
