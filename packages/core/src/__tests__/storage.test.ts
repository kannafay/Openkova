import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageAdapter } from '../storage.js';

let tmpDir: string;
let adapter: LocalStorageAdapter;

const SESSION_1 = '11111111-1111-4111-8111-111111111111';
const SESSION_2 = '22222222-2222-4222-8222-222222222222';
const SESSION_3 = '33333333-3333-4333-8333-333333333333';
const UNKNOWN_SESSION = '44444444-4444-4444-8444-444444444444';
const IMAGE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png';
const IMAGE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png';
const IMAGE_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc.png';
const IMAGE_DELETE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd.png';
const MISSING_IMAGE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.png';

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openkova-test-'));
  adapter = new LocalStorageAdapter(tmpDir);
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('save and get round-trips a buffer', async () => {
  const data = Buffer.from('hello png');
  await adapter.save(SESSION_1, IMAGE_1, data);
  const result = await adapter.get(SESSION_1, IMAGE_1);
  assert.ok(result !== null);
  assert.deepEqual(result, data);
});

test('get returns null for missing image', async () => {
  const result = await adapter.get(SESSION_1, MISSING_IMAGE);
  assert.equal(result, null);
});

test('list returns saved image ids', async () => {
  await adapter.save(SESSION_2, IMAGE_A, Buffer.from('a'));
  await adapter.save(SESSION_2, IMAGE_B, Buffer.from('b'));
  const list = await adapter.list(SESSION_2);
  assert.ok(list.includes(IMAGE_A));
  assert.ok(list.includes(IMAGE_B));
  assert.equal(list.length, 2);
});

test('list returns empty array for unknown session', async () => {
  const list = await adapter.list(UNKNOWN_SESSION);
  assert.deepEqual(list, []);
});

test('delete removes the file', async () => {
  await adapter.save(SESSION_3, IMAGE_DELETE, Buffer.from('x'));
  await adapter.setFilename(SESSION_3, IMAGE_DELETE, 'named-output.png');
  await adapter.delete(SESSION_3, IMAGE_DELETE);
  const result = await adapter.get(SESSION_3, IMAGE_DELETE);
  assert.equal(result, null);
  assert.equal(await adapter.getFilename(SESSION_3, IMAGE_DELETE), null);
});

test('stores a safe download filename separately from the image id', async () => {
  await adapter.setFilename(SESSION_1, IMAGE_1, 'order-1599.png');
  assert.equal(await adapter.getFilename(SESSION_1, IMAGE_1), 'order-1599.png');
  assert.equal(await adapter.findImageIdByFilename(SESSION_1, 'order-1599.png'), IMAGE_1);
  assert.equal(await adapter.findImageIdByFilename(SESSION_1, 'missing.png'), null);
  assert.ok((await adapter.list(SESSION_1)).includes(IMAGE_1));
});

test('rejects unsafe public filenames', async () => {
  await assert.rejects(
    adapter.setFilename(SESSION_1, IMAGE_1, '../outside.png'),
    /Invalid output filename/,
  );
  await assert.rejects(
    adapter.findImageIdByFilename(SESSION_1, '..\\outside.png'),
    /Invalid output filename/,
  );
});

test('cleanup deletes sessions older than 24 hours and keeps newer sessions', async () => {
  const expiredSession = '55555555-5555-4555-8555-555555555555';
  const recentSession = '66666666-6666-4666-8666-666666666666';
  const imageId = 'ffffffff-ffff-4fff-8fff-ffffffffffff.png';
  const oneDayMs = 24 * 60 * 60 * 1000;

  await adapter.save(expiredSession, imageId, Buffer.from('expired'));
  await adapter.save(recentSession, imageId, Buffer.from('recent'));

  const expiredAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const recentAt = new Date(Date.now() - 23 * 60 * 60 * 1000);
  await fs.utimes(path.join(tmpDir, expiredSession), expiredAt, expiredAt);
  await fs.utimes(path.join(tmpDir, recentSession), recentAt, recentAt);

  const deleted = await adapter.cleanup(oneDayMs);

  assert.equal(deleted, 1);
  assert.deepEqual(await adapter.list(expiredSession), []);
  assert.deepEqual(await adapter.list(recentSession), [imageId]);
});
