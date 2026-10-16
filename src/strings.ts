export const S = {
  title: 'CastleQuest',
  play: 'Hrát',
  chooseSet: 'Vyber sadu otázek',
  selectedSet: 'Sada otázek',
  nameLabel: 'Jméno (nepovinné)',
  anonymous: 'Bez jména',
  loadingSets: 'Načítám sady otázek…',
  indexLoadError: 'Nepodařilo se načíst seznam sad otázek.',
  setLoadError: 'Soubor se nepodařilo načíst.',
  unavailable: 'nedostupná',
  goal:
    'Najdi a zodpověz všechny otazníky. Stříbrné otazníky otevřou stříbrné dveře do vnitřního okruhu, ' +
    'zlaté otazníky otevřou zlaté dveře do středové místnosti. Tam najdeš východ.',
  controls: [
    'Klikni do hry a rozhlížej se myší.',
    'W A S D nebo šipky – chůze',
    'E, Enter nebo mezerník – použít (otazník, dveře)',
    'M – mapa, Esc – pauza, F1 nebo H – nápověda',
    'Bez myši: šipky vlevo a vpravo otáčejí pohledem.',
  ],
  gameStart: 'Hra začíná! Najdi všechny otazníky.',
  correct: 'Správně!',
  wrong: 'Špatně!',
  silverOpen: 'Dveře do vnitřního okruhu se otevírají!',
  goldOpen: 'Dveře do středové místnosti se otevírají!',
  promptQmark: 'E – otázka',
  promptDoor: 'E – otevřít dveře',
  promptLocked: 'E – zamčené dveře',
  questionTitle: 'Otázka',
  closeHint: 'Klávesy 1–4 vyberou odpověď, Esc zavře bez odpovědi.',
  pauseTitle: 'Pauza',
  clickToContinue: 'Klikni pro pokračování',
  continue: 'Pokračovat',
  help: 'Nápověda',
  quit: 'Ukončit hru',
  quitConfirm: 'Opravdu ukončit hru? Výsledky se neuloží.',
  resultsTitle: 'Výsledky',
  name: 'Jméno',
  set: 'Sada',
  date: 'Datum',
  time: 'Čas',
  score: 'Správně',
  question: 'Otázka',
  yourAnswer: 'Tvoje odpověď',
  correctAnswer: 'Správná odpověď',
  playAgain: 'Hrát znovu',
  print: 'Vytisknout / uložit PDF',
  noWebGL:
    'Tvůj prohlížeč nepodporuje WebGL 2. Zkus prohlížeč aktualizovat nebo v nastavení zapnout hardwarovou akceleraci.',
} as const;

export function remainingQuestions(n: number): string {
  if (n === 1) return 'Zbývá poslední otázka!';
  if (n >= 2 && n <= 4) return `Zbývají ještě ${n} otázky!`;
  return `Zbývá ještě ${n} otázek!`;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
