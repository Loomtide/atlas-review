#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
if (!args.includes('--version') || !args.includes('--artifacts-dir')) {
  throw new Error('Provide --version and --artifacts-dir. All three supported platforms are required.');
}
const version = value('--version');
const artifacts = resolve(value('--artifacts-dir'));
const configured = JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'), 'utf8')).version;
if (version !== configured) throw new Error('Version must match the committed application version.');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw new Error('Commit source changes before preparing a release.');
const sha = git('rev-parse', 'HEAD');
if (git('rev-list', '-n', '1', `v${version}`) !== sha) {
  throw new Error('The release tag must point to the current commit. Push it before preparing the draft.');
}
const temp = mkdtempSync(join(tmpdir(), 'atlasreview-release-'));
try {
  execFileSync(process.execPath, [join(root, 'scripts/prepare-release.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      GH_REPO: 'Loomtide/atlas-review',
      GITHUB_REF_NAME: `v${version}`,
      GITHUB_SHA: sha,
      RELEASE_ARTIFACTS_DIR: artifacts,
      RELEASE_NOTES_PATH: join(temp, 'notes.md'),
    },
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log('Created a draft release. Inspect all builds and test upgrades before publishing.');
