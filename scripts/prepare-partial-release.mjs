import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export function verifyUpdaterSignature(bytes, encodedSignature, encodedPublicKey) {
  const packet = (encoded) => Buffer.from(Buffer.from(encoded.trim(), 'base64').toString().trim().split('\n')[1] || '', 'base64');
  const key = packet(encodedPublicKey);
  const sig = packet(encodedSignature);
  if (key.length !== 42 || sig.length !== 74 || !key.subarray(2, 10).equals(sig.subarray(2, 10))) {
    throw new Error('Updater signature key does not match the application public key.');
  }
  const algorithm = sig.subarray(0, 2).toString();
  if (!['Ed', 'ED'].includes(algorithm)) throw new Error('Unsupported updater signature algorithm.');
  const publicKey = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]),
    format: 'der', type: 'spki',
  });
  const message = algorithm === 'ED' ? createHash('blake2b512').update(bytes).digest() : bytes;
  if (!verify(null, message, publicKey, sig.subarray(10))) throw new Error('Invalid updater signature.');
}

export function validateRetainedFeed(plan, feed) {
  if (plan.mode !== 'prebuilt-platform-release' || plan.automaticUpdates !== 'retain-previous-manifest') {
    throw new Error('A partial release must explicitly preserve the previous shared updater feed.');
  }
  if (`v${feed.version}` !== plan.previousRelease) throw new Error('Unexpected retained updater version.');
  for (const [platform, entry] of Object.entries(plan.platforms)) {
    if (entry.origin === 'previous' && (entry.version !== feed.version || !feed.platforms?.[platform]?.signature)) {
      throw new Error(`The shared updater feed must not advertise a new version for retained ${platform}.`);
    }
  }
}

export function assemblePartialRelease({ plan, currentDir, previousDir, outputDir, publicKey, tagCommit }) {
  if (!/^v\d+\.\d+\.\d+$/.test(plan.release)) throw new Error('Invalid partial release tag.');
  if (!/^[a-f0-9]{40}$/.test(tagCommit || '')) throw new Error('A full release tag commit is required.');
  if (existsSync(outputDir) && readdirSync(outputDir).length) throw new Error('Output directory must be empty.');
  const feedBytes = readFileSync(join(previousDir, 'stable.json'));
  const feed = JSON.parse(feedBytes);
  validateRetainedFeed(plan, feed);
  const previousSource = readJson(join(previousDir, 'SOURCE.json'));
  const currentSource = readJson(join(currentDir, 'MAC_BUILD.json'));
  if (previousSource.tag !== plan.previousRelease) throw new Error('Previous source tag mismatch.');
  const sums = (dir) => new Map(readFileSync(join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n').map((line) => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) throw new Error('Malformed input checksum file.');
    return [match[2], match[1]];
  }));
  const checksums = { current: sums(currentDir), previous: sums(previousDir) };
  const roots = { current: currentDir, previous: previousDir };
  const checked = (origin, name) => {
    if (basename(name) !== name) throw new Error('Artifact names must not contain paths.');
    const bytes = readFileSync(join(roots[origin], name));
    if (checksums[origin].get(name) !== hash(bytes)) throw new Error(`Checksum mismatch: ${name}`);
    return bytes;
  };
  checked('previous', 'stable.json');
  checked('previous', 'SOURCE.json');
  checked('current', 'MAC_BUILD.json');
  mkdirSync(outputDir, { recursive: true });
  const records = {};
  const usedNames = new Set();
  const copy = (origin, name, destination = name) => {
    if (usedNames.has(destination) || basename(destination) !== destination) throw new Error(`Duplicate or invalid output: ${destination}`);
    const bytes = checked(origin, name);
    writeFileSync(join(outputDir, destination), bytes);
    usedNames.add(destination);
    return { name: destination, sha256: hash(bytes), bytes: bytes.length };
  };
  for (const [platform, entry] of Object.entries(plan.platforms)) {
    const sourceCommit = entry.origin === 'current' ? currentSource.source_commit : previousSource.commit;
    if (entry.sourceCommit !== sourceCommit) throw new Error(`Source commit mismatch for ${platform}.`);
    if (entry.origin === 'current' && (entry.version !== currentSource.version || `v${entry.version}` !== plan.release)) {
      throw new Error('Current build version mismatch.');
    }
    const artifacts = [];
    for (const file of entry.files) {
      if (file.updater) {
        const signature = checked(entry.origin, file.name + '.sig').toString().trim();
        verifyUpdaterSignature(checked(entry.origin, file.name), signature, publicKey);
        if (entry.origin === 'previous') {
          const retained = feed.platforms[platform];
          if (retained.signature !== signature || !new URL(retained.url).pathname.endsWith(`/releases/download/${plan.previousRelease}/${file.name}`)) {
            throw new Error(`The retained feed does not match the original ${platform} payload.`);
          }
        }
      }
      artifacts.push(copy(entry.origin, file.name));
      if (file.updater) artifacts.push(copy(entry.origin, file.name + '.sig'));
      for (const alias of file.aliases || []) artifacts.push(copy(entry.origin, file.name, alias));
    }
    for (const notice of entry.notices || []) artifacts.push(copy(entry.origin, notice));
    records[platform] = {
      version: entry.version, source_commit: sourceCommit,
      source_release: entry.origin === 'previous' ? plan.previousRelease : null,
      build_origin: entry.origin === 'previous' ? 'unchanged previous release' : 'verified local Mac build',
      artifacts,
    };
  }
  copy('current', 'MAC_BUILD.json', 'MAC_BUILD_VERIFICATION.json');
  copy('previous', 'SOURCE.json', `SOURCE-${plan.previousRelease}.json`);
  copy('previous', 'Node-LICENSE.txt', `Node-LICENSE-${plan.previousRelease}.txt`);
  copyFileSync(join(previousDir, 'stable.json'), join(outputDir, 'stable.json'));
  const source = {
    repository: 'Loomtide/atlas-review', tag: plan.release, release_tag_commit: tagCommit,
    platforms: records,
    automatic_updates: { policy: plan.automaticUpdates, version: feed.version, source_release: plan.previousRelease,
      note: 'New Mac builds are manual downloads until all platforms can share a truthful updater version.' },
  };
  writeFileSync(join(outputDir, 'SOURCE.json'), JSON.stringify(source, null, 2) + '\n');
  writeFileSync(join(outputDir, 'SHA256SUMS'), readdirSync(outputDir).filter((name) => name !== 'SHA256SUMS').sort()
    .map((name) => `${hash(readFileSync(join(outputDir, name)))}  ${name}`).join('\n') + '\n');
  return source;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const required = (flag) => {
    const index = args.indexOf(flag);
    if (index < 0 || !args[index + 1]) throw new Error(`Missing ${flag}`);
    return args[index + 1];
  };
  const config = readJson('apps/desktop/src-tauri/tauri.conf.json');
  const result = assemblePartialRelease({ plan: readJson(required('--plan')),
    currentDir: resolve(required('--current-dir')), previousDir: resolve(required('--previous-dir')),
    outputDir: resolve(required('--output-dir')), tagCommit: required('--tag-commit'),
    publicKey: config.plugins.updater.pubkey });
  console.log(`Prepared ${result.tag}: verified platform signatures, source commits, checksums, and retained updater feed.`);
}
