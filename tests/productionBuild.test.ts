import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const outDir = mkdtempSync(join(tmpdir(), 'cq-build-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('production build', () => {
  it('does not contain the ?debug test hook', async () => {
    await build({ logLevel: 'silent', mode: 'production', build: { outDir, emptyOutDir: true } });
    const js = readdirSync(join(outDir, 'assets')).filter((f) => f.endsWith('.js'));
    const code = js.map((f) => readFileSync(join(outDir, 'assets', f), 'utf8')).join('\n');
    expect(code).not.toContain('__cq');
  }, 60_000);
});
