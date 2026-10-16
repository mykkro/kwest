import { expect, test } from '@playwright/test';

type Hook = { askQmark(id: number): void; state(): { mode: string; done: number } };

test('start a game, answer one question, pause with Escape', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?debug');
  await page.getByRole('radio', { name: 'Úroveň 1' }).check();
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

test('?test=Z2 preselects the set', async ({ page }) => {
  await page.goto('./?test=Z2');
  await expect(page.getByRole('radio', { name: 'Úroveň 2' })).toBeChecked();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Hrát' })).toBeEnabled();
});

test('answering questions keeps playing; reaching the exit shows results', async ({ page }) => {
  await page.goto('./?debug');
  await page.getByRole('radio', { name: 'Úroveň 1' }).check();
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

test.describe('review fixes', () => {
  async function start(page: import('@playwright/test').Page) {
    await page.goto('./?debug');
    await page.getByRole('radio', { name: 'Úroveň 1' }).check();
    await page.getByRole('button', { name: 'Hrát' }).click();
    await expect(page.getByTestId('progress')).toHaveText('0/30');
  }

  test('Enter or Space pressed while a question is open does not answer it', async ({ page }) => {
    await start(page);
    await page.evaluate(() => (window as unknown as { __cq: Hook }).__cq.askQmark(0));
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.keyboard.press('NumpadEnter');
    await page.waitForTimeout(200);
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('progress')).toHaveText('0/30');
    await page.keyboard.press('Digit1');
    await expect(page.getByTestId('progress')).toHaveText('1/30');
  });

  test('a refused pointer lock during play shows "Klikni pro pokračování"', async ({ page }) => {
    await start(page);
    await page.evaluate(() => document.dispatchEvent(new Event('pointerlockerror')));
    await expect(page.locator('.hud-lock-hint')).toHaveText('Klikni pro pokračování');
    await expect(page.locator('.hud-lock-hint')).toBeVisible();
  });

  test('Escape right after the pause menu opens does not close it', async ({ page }) => {
    await start(page);
    await page.locator('#scene').click();
    await page.keyboard.press('Escape');
    const cont = page.getByRole('button', { name: 'Pokračovat' });
    await expect(cont).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cont).toBeVisible();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await expect(cont).toBeHidden();
  });
});

test('the game is called Kwest', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Kwest');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kwest');
});

test('minimap is visible by default and toggles with the button and M', async ({ page }) => {
  // Simulate a refused mouse capture (keyboard-only play): while the mouse is captured, clicks go to the canvas.
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = () => Promise.reject(new Error('blocked'));
  });
  await page.goto('./?debug');
  await page.getByRole('radio', { name: 'Úroveň 1' }).check();
  await page.getByRole('button', { name: 'Hrát' }).click();
  const map = page.locator('canvas.minimap');
  const button = page.getByRole('button', { name: 'Mapa (M)' });
  await expect(map).toBeVisible();
  await expect(button).toBeVisible();
  await button.click();
  await expect(map).toBeHidden();
  await button.click();
  await expect(map).toBeVisible();
  await page.keyboard.press('KeyM');
  await expect(map).toBeHidden();
});

test('answering all silver question marks flashes a big silver-door banner', async ({ page }) => {
  await page.goto('./?debug');
  await page.getByRole('radio', { name: 'Úroveň 1' }).check();
  await page.getByRole('button', { name: 'Hrát' }).click();
  for (let id = 0; id < 18; id++) {
    await page.evaluate((i) => (window as unknown as { __cq: Hook }).__cq.askQmark(i), id);
    await page.keyboard.press('Digit1');
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  const flash = page.locator('.hud-flash');
  await expect(flash).toBeVisible();
  await expect(flash).toHaveText('Stříbrné dveře se otevírají!');
  await expect(flash).toHaveClass(/silver/);
});
