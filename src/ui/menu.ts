import type { QuestionSet, SetIndexEntry, ValidationResult } from '../data/questionSet';
import { S } from '../strings';
import { helpContent } from './pauseMenu';

export interface MenuEntry {
  entry: SetIndexEntry;
  result: ValidationResult;
}

export interface CategoryGroup {
  category: string;
  entries: MenuEntry[];
}

/** Groups sets by theme, keeping the order in which themes first appear in index.json. */
export function groupByCategory(entries: readonly MenuEntry[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const e of entries) {
    let g = groups.find((x) => x.category === e.entry.category);
    if (!g) groups.push((g = { category: e.entry.category, entries: [] }));
    g.entries.push(e);
  }
  return groups;
}

const fullName = (entry: SetIndexEntry) => `${entry.category} – ${entry.name}`;

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
    this.sets = document.createElement('div');
    this.sets.className = 'sets-area';
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
    this.selected = null;
    this.playButton.disabled = true;
    const pre = entries.find((e) => e.entry.id === preselectId && e.result.ok);
    if (pre) {
      // Link with ?test=<id>: show only that set, already selected.
      const box = this.fieldset(S.selectedSet);
      box.appendChild(this.setRow(pre, fullName(pre.entry), 'set', true));
      this.sets.appendChild(box);
      return;
    }
    const groups = groupByCategory(entries);
    if (groups.length === 0) return;
    const themes = this.fieldset(S.chooseTheme);
    themes.classList.add('themes');
    const levels = this.fieldset(S.chooseLevel);
    const showLevels = (group: CategoryGroup) => {
      levels.replaceChildren(levels.firstElementChild!); // keep the legend
      this.selected = null;
      this.playButton.disabled = true;
      for (const e of group.entries) levels.appendChild(this.setRow(e, e.entry.name, 'set', false));
    };
    groups.forEach((group, i) => {
      const row = document.createElement('label');
      row.className = 'theme';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'theme';
      radio.checked = i === 0;
      radio.addEventListener('change', () => showLevels(group));
      const name = document.createElement('span');
      name.textContent = group.category;
      row.append(radio, name);
      themes.appendChild(row);
    });
    this.sets.append(themes, levels);
    showLevels(groups[0]);
  }

  private fieldset(legendText: string): HTMLFieldSetElement {
    const box = document.createElement('fieldset');
    box.className = 'sets';
    const legend = document.createElement('legend');
    legend.textContent = legendText;
    box.appendChild(legend);
    return box;
  }

  /** One selectable set; the results screen shows "<theme> – <level>". */
  private setRow({ entry, result }: MenuEntry, label: string, group: string, checked: boolean): HTMLElement {
    const row = document.createElement('label');
    row.className = 'set';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = group;
    radio.disabled = !result.ok;
    const name = document.createElement('span');
    name.textContent = label;
    row.append(radio, name);
    if (!result.ok) {
      const err = document.createElement('small');
      err.className = 'error';
      err.textContent = `(${S.unavailable}: ${result.error})`;
      row.appendChild(err);
      return row;
    }
    const set = { ...result.set, name: fullName(entry) };
    radio.addEventListener('change', () => this.select(set));
    if (checked) {
      radio.checked = true;
      this.select(set);
    }
    return row;
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
