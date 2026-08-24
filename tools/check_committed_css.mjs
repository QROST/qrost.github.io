#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiler = join(root, 'node_modules/.bin/tailwindcss');
const targets = [
  {
    label: 'root home',
    cwd: root,
    config: 'assets/tailwind.config.js',
    input: 'assets/css/home-input.css',
    expected: 'assets/css/home-built.css',
  },
  ...['china-auto', 'china-housing', 'pharm-companies', 'shelter-cats'].map((demo) => ({
    label: demo,
    cwd: join(root, 'demos', demo),
    config: 'tailwind.config.js',
    input: 'src/tailwind-input.css',
    expected: 'assets/css/tailwind-built.css',
  })),
];
const scratch = mkdtempSync(join(tmpdir(), 'qrost-committed-css-'));

try {
  for (const [index, target] of targets.entries()) {
    const actual = join(scratch, `${index}.css`);
    const result = spawnSync(
      compiler,
      [
        '-c', join(target.cwd, target.config),
        '-i', join(target.cwd, target.input),
        '-o', actual,
        '--minify',
      ],
      { cwd: target.cwd, encoding: 'utf8' },
    );
    if (result.error) {
      console.error(`committed CSS (${target.label}): could not run locked Tailwind compiler: ${result.error.message}`);
      process.exit(1);
    }
    if (result.status !== 0) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      process.exit(result.status ?? 1);
    }
    const expected = join(target.cwd, target.expected);
    if (readFileSync(expected).compare(readFileSync(actual)) !== 0) {
      console.error(`committed CSS (${target.label}): ${target.expected} is stale; rebuild it from ${target.input}`);
      process.exit(1);
    }
    console.log(`committed CSS: OK (${target.label})`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
