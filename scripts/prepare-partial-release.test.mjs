import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { validateRetainedFeed, verifyUpdaterSignature } from './prepare-partial-release.mjs';

const plan = { mode: 'prebuilt-platform-release', previousRelease: 'v0.25.26',
  automaticUpdates: 'retain-previous-manifest', platforms: {
    'darwin-aarch64': { origin: 'current', version: '0.25.27' },
    'windows-x86_64': { origin: 'previous', version: '0.25.26' },
  } };
test('a Mac-only update keeps the old Windows updater version', () => {
  assert.doesNotThrow(() => validateRetainedFeed(plan, { version: '0.25.26',
    platforms: { 'windows-x86_64': { signature: 'existing-signature' } } }));
});
test('rejects advertising the new Mac version for the retained Windows installer', () => {
  assert.throws(() => validateRetainedFeed(plan, { version: '0.25.27',
    platforms: { 'windows-x86_64': { signature: 'existing-signature' } } }));
});
test('checks the updater payload against its preserved Ed25519 public key', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const id = randomBytes(8);
  const bytes = Buffer.from('synthetic installer payload');
  const encode = (packet) => Buffer.from('untrusted comment: test\n' + packet.toString('base64') + '\n').toString('base64');
  const key = encode(Buffer.concat([Buffer.from('Ed'), id, publicKey.export({ type: 'spki', format: 'der' }).subarray(-32)]));
  const signature = encode(Buffer.concat([Buffer.from('Ed'), id, sign(null, bytes, privateKey)]));
  verifyUpdaterSignature(bytes, signature, key);
  assert.throws(() => verifyUpdaterSignature(Buffer.from('changed installer'), signature, key));
});
