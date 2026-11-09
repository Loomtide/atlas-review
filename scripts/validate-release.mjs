import { readFileSync } from 'node:fs';
if (process.env.GITHUB_REF_TYPE !== 'tag') throw new Error('Select a release tag, not a branch.');
const tag = process.env.GITHUB_REF_NAME;
if (!/^v\d+\.\d+\.\d+(?:-(?:beta|alpha|rc)\.\d+)?$/.test(tag)) throw new Error('Invalid version tag.');
const version = tag.slice(1);
for (const file of ['apps/desktop/package.json', 'apps/desktop/src-tauri/tauri.conf.json', 'apps/desktop/package-lock.json']) {
  if (JSON.parse(readFileSync(file, 'utf8')).version !== version) throw new Error(`Tag does not match ${file}`);
}
const cargo = readFileSync('apps/desktop/src-tauri/Cargo.toml', 'utf8');
if (!cargo.includes(`version = "${version}"`)) throw new Error('Tag does not match Cargo.toml');
const lock = readFileSync('apps/desktop/src-tauri/Cargo.lock', 'utf8');
if (!lock.includes(`name = "atlasengine-desktop"\nversion = "${version}"`)) throw new Error('Tag does not match Cargo.lock');
console.log(`Validated release ${tag}`);
