import { describe, expect, it } from 'vitest';
import { formatTime, remainingQuestions } from '../src/strings';

describe('remainingQuestions', () => {
  it('uses the singular form for 1', () => {
    expect(remainingQuestions(1)).toBe('Zbývá poslední otázka!');
  });
  it('uses "otázky" for 2–4', () => {
    expect(remainingQuestions(2)).toBe('Zbývají ještě 2 otázky!');
    expect(remainingQuestions(4)).toBe('Zbývají ještě 4 otázky!');
  });
  it('uses "otázek" for 5 and more', () => {
    expect(remainingQuestions(5)).toBe('Zbývá ještě 5 otázek!');
    expect(remainingQuestions(12)).toBe('Zbývá ještě 12 otázek!');
    expect(remainingQuestions(18)).toBe('Zbývá ještě 18 otázek!');
  });
});

describe('formatTime', () => {
  it('formats m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_000)).toBe('1:05');
    expect(formatTime(3_599_999)).toBe('59:59');
    expect(formatTime(3_600_000)).toBe('60:00');
  });
});
