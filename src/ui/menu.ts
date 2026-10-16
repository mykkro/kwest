import type { QuestionSet, SetIndexEntry, ValidationResult } from '../data/questionSet';
import { S } from '../strings';
import { helpContent } from './pauseMenu';

export interface MenuEntry {
  entry: SetIndexEntry;
  result: ValidationResult;
}

export class Menu {
  private readonly el: HTMLElement;
  private readonly sets: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly playButton: HTMLButtonElement;
  private selected: QuestionSet | null = null;

  constructor(root: HTMLElement, private readonly onPlay: (set: QuestionSet, playerName: string) => void) {
    this.el = document.createElement('div');
    this.el.className = 'overlay menu-overlay hidden';
    const panel = document.createElement('div');
    panel.className = 'panel menu';
    const title = document.createElement('h1');
    title.textContent = S.title;
    const label = document.createElement('label');
    label.className = 'name';
    label.textContent = S.nameLabel;
    this.nameInput = document.createElement('input');
    this.nameInput.maxLength = 40;
    this.nameInput.autocomplete = 'off';
    label.appendChild(this.nameInput);
    this.sets = document.createElement('fieldset');
    this.sets.className = 'sets';
    this.playButton = document.createElement('button');
    this.playButton.className = 'play';
    this.playButton.textContent = S.play;
    this.playButton.disabled = true;
    this.playButton.addEventListener('click', () => {
      if (this.selected) this.onPlay(this.selected, this.nameInput.value.trim());
    });
    panel.append(title, helpContent(), label, this.sets, this.playButton);
    this.el.appendChild(panel);
    root.appendChild(this.el);
  }

  show(): void {
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  setLoading(): void {
    this.setStatus(S.loadingSets);
  }

  setError(text: string): void {
    this.setStatus(text, true);
  }

  setSets(entries: MenuEntry[], preselectId?: string): void {
    this.sets.replaceChildren();
    const pre = entries.find((e) => e.entry.id === preselectId && e.result.ok);
    const legend = document.createElement('legend');
    legend.textContent = pre ? S.selectedSet : S.chooseSet;
    this.sets.appendChild(legend);
    for (const { entry, result } of pre ? [pre] : entries) {
      const row = document.createElement('label');
      row.className = 'set';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'set';
      radio.disabled = !result.ok;
      const name = document.createElement('span');
      name.textContent = entry.name;
      row.append(radio, name);
      if (!result.ok) {
        const err = document.createElement('small');
        err.className = 'error';
        err.textContent = `(${S.unavailable}: ${result.error})`;
        row.appendChild(err);
      } else {
        radio.addEventListener('change', () => this.select(result.set));
      }
      this.sets.appendChild(row);
      if (pre) {
        radio.checked = true;
        if (result.ok) this.select(result.set);
      }
    }
  }

  private select(set: QuestionSet): void {
    this.selected = set;
    this.playButton.disabled = false;
  }

  private setStatus(text: string, isError = false): void {
    const p = document.createElement('p');
    p.className = isError ? 'error' : 'muted';
    p.textContent = text;
    this.sets.replaceChildren(p);
    this.selected = null;
    this.playButton.disabled = true;
  }
}
