import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

vi.mock('../../db/index.js', () => ({ default: { query: vi.fn(async () => ({ rows: [] })) } }));
vi.mock('../gitService.js', () => ({ default: {} }));
vi.mock('../changesetService.js', () => ({ default: { getChangeSet: vi.fn() } }));
vi.mock('../projectVerificationService.js', () => ({ default: {} }));
vi.mock('../atlasHostingService.js', () => ({ default: {} }));
import changesetService from '../changesetService.js';
import actionService from '../actionService.js';

const originalDataDir = process.env.ATLAS_DATA_DIR;
let profile;
afterEach(async () => {
  if (originalDataDir === undefined) delete process.env.ATLAS_DATA_DIR;
  else process.env.ATLAS_DATA_DIR = originalDataDir;
  if (profile) await rm(profile, { recursive: true, force: true });
});

it('exports a readable ZIP with review metadata and patch after the archiver upgrade', async () => {
  profile = await mkdtemp(path.join(tmpdir(), 'atlasreview-export-test-'));
  process.env.ATLAS_DATA_DIR = profile;
  changesetService.getChangeSet.mockResolvedValue({
    id: 'change-1', title: 'Example change', reviewData: { findings: [] },
    files: [{ path: 'example.js', before: 'before', after: 'after' }],
  });
  const result = await actionService.executeExport(profile, 'change-1', 'project-1');
  expect(result.success).toBe(true);
  const zip = await readFile(result.data.zipPath);
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end).toBeGreaterThan(0);
  let offset = zip.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    expect(zip.readUInt32LE(offset)).toBe(0x02014b50);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString();
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const content = zip.subarray(start, start + size);
    files[name] = (zip.readUInt16LE(offset + 10) === 8 ? inflateRawSync(content) : content).toString();
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  expect(JSON.parse(files['metadata.json']).changesetId).toBe('change-1');
  expect(JSON.parse(files['review.json'])).toEqual({ findings: [] });
  expect(files['diff.patch']).toContain('+after');
});
