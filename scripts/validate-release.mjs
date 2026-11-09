import { readFileSync, existsSync, appendFileSync } from 'node:fs';
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

const planPath = `release-plans/${tag}.json`;
let prebuilt = false;
if (existsSync(planPath)) {
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  if (plan.release !== tag || plan.mode !== 'prebuilt-platform-release') throw new Error('Invalid prebuilt release plan.');
  prebuilt = true;
  console.log('Prebuilt platform release: use the versioned plan and partial-release assembler. Automatic rebuild and draft creation are skipped.');
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `prebuilt=${prebuilt}\n`);
