import './style.css';
import { loadIndex, loadSet } from './data/questionSet';
import { mulberry32 } from './data/shuffle';
import { Game } from './game/game';
import { Session } from './game/session';

// TEMPORARY (replaced in Task 11): walk the maze with set Z1, auto-answer with choice 0.
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const game = new Game(canvas);
const base = import.meta.env.BASE_URL;
const [entry] = await loadIndex(base);
const r = await loadSet(base, entry);
if (r.ok) {
  canvas.addEventListener('click', () => {
    if (game.mode !== 'demo') return;
    game.startGame(new Session({ set: r.set, playerName: '', rng: mulberry32(Date.now() >>> 0) }), {
      onEvent: (e) => {
        console.log(e);
        if (e.type === 'ask') setTimeout(() => game.answer(0));
      },
      onPauseRequest: () => game.pause(),
      onToggleMap: () => undefined,
      onHelp: () => undefined,
      onPrompt: (t) => console.log('prompt', t),
      onFrame: () => undefined,
    });
  });
}
