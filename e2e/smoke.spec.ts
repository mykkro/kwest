import { expect, test } from '@playwright/test';

type Hook = { askQmark(id: number): void; state(): { mode: string; done: number } };

test('start a game, answer one question, pause with Escape', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?debug');
  await page.getByRole('radio', { name: 'Základní škola – úroveň 1' }).check();
  await page.getByRole('button', { name: 'Hrát' }).click();
  await expect(page.getByTestId('progress')).toHaveText('0/30');

  await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.askQmark(0));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button').first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('progress')).toHaveText('1/30');

  // Escape while walking (no pointer lock in headless) opens the pause menu and stops the timer.
  await page.locator('#scene').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Pokračovat' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.state().mode)).toBe('paused');
  const t1 = await page.locator('.hud-time').textContent();
  await page.waitForTimeout(1500);
  expect(await page.locator('.hud-time').textContent()).toBe(t1);
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  expect(await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.state().mode)).toBe('play');

  expect(errors).toEqual([]);
});

test('?test=S2 preselects the set', async ({ page }) => {
  await page.goto('./?test=S2');
  await expect(page.getByRole('radio', { name: 'Speciální škola – úroveň 2' })).toBeChecked();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Hrát' })).toBeEnabled();
});

test('answering questions keeps playing; reaching the exit shows results', async ({ page }) => {
  await page.goto('./?debug');
  await page.getByRole('radio', { name: 'Základní škola – úroveň 1' }).check();
  await page.getByRole('button', { name: 'Hrát' }).click();
  for (const id of [0, 1, 2]) {
    await page.evaluate((i) => (window as unknown as { __cq: Hook }).__cq.askQmark(i), id);
    await page.getByRole('dialog').getByRole('button').first().click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.state())).toEqual({ mode: 'play', done: 3 });
  await page.evaluate(() => (window as unknown as { __cq: { teleport(x: number, y: number): void } }).__cq.teleport(0, 0.5));
  await expect(page.getByRole('heading', { name: 'Výsledky' })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(4); // header + 3 answers
});
