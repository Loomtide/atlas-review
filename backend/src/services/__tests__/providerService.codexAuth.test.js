import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { expect, it, vi } from 'vitest';

vi.mock('child_process', async (original) => ({ ...(await original()), spawn: vi.fn() }));
import { spawn } from 'child_process';
import { testCodexAuth } from '../providerService.js';

function cli(write) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new Writable({ write });
  child.kill = vi.fn(() => { child.emit('close', 1); return true; });
  spawn.mockReturnValueOnce(child);
  return child;
}

it('returns a failed auth probe without an uncaught EPIPE when the CLI closes stdin', async () => {
  const child = cli((_data, _encoding, done) => {
    done(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
  });
  await expect(testCodexAuth('codex')).resolves.toBe(false);
  expect(child.kill).toHaveBeenCalledWith('SIGTERM');
});

it('still accepts a successful CLI auth probe', async () => {
  const child = cli((_data, _encoding, done) => {
    done();
    queueMicrotask(() => child.emit('close', 0));
  });
  await expect(testCodexAuth('codex')).resolves.toBe(true);
});
