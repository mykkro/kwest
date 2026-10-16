import { chromium } from '@playwright/test';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
await p.goto('http://localhost:4173/?debug');
await p.getByRole('radio', { name: 'Úroveň 1' }).check();
await p.getByRole('button', { name: 'Hrát' }).click();
for (const [x, y] of [[0, -30], [28, -28], [-28, -28], [0, 28]]) { await p.evaluate(([a, c]) => window.__cq.teleport(a, c), [x, y]); await p.waitForTimeout(400); }
await p.evaluate(() => window.__cq.teleport(0, -30));
await p.waitForTimeout(600);
await p.locator('canvas.minimap').screenshot({ path: process.argv[2] });
await b.close();
