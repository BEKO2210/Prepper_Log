import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, shouldApplyChange } from './server.js';

async function setupServer() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preptrack-sync-test-'));
  const dbPath = path.join(tempDir, 'sync.db');
  const { app } = await createServer({
    dbPath,
    logger: false,
  });
  return { app, tempDir };
}

async function pairDevice(app, syncCode, deviceName) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/pair',
    payload: { syncCode, deviceName },
  });
  expect(res.statusCode).toBe(200);
  return res.json();
}

function authHeaders(deviceToken, householdId) {
  return {
    authorization: `Bearer ${deviceToken}`,
    'x-household-id': householdId,
  };
}

const openServers = [];

afterEach(async () => {
  while (openServers.length > 0) {
    const { app, tempDir } = openServers.pop();
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('shouldApplyChange', () => {
  it('accepts newer updates and rejects older ones', () => {
    const current = {
      updated_at: '2026-03-10T10:00:00.000Z',
      updated_by_device_id: 'device-a',
    };

    expect(shouldApplyChange(current, '2026-03-10T10:00:01.000Z', 'device-b')).toBe(true);
    expect(shouldApplyChange(current, '2026-03-10T09:59:59.000Z', 'device-b')).toBe(false);
  });

  it('uses device id as deterministic tie-breaker', () => {
    const current = {
      updated_at: '2026-03-10T10:00:00.000Z',
      updated_by_device_id: 'device-b',
    };

    expect(shouldApplyChange(current, '2026-03-10T10:00:00.000Z', 'device-a')).toBe(false);
    expect(shouldApplyChange(current, '2026-03-10T10:00:00.000Z', 'device-c')).toBe(true);
  });
});

describe('sync backend integration', () => {
  it('pairs multiple devices into the same household for the same sync code', async () => {
    const ctx = await setupServer();
    openServers.push(ctx);

    const first = await pairDevice(ctx.app, 'HOUSEHOLD-1234', 'Desktop');
    const second = await pairDevice(ctx.app, 'HOUSEHOLD-1234', 'Phone');

    expect(first.householdId).toBe(second.householdId);
    expect(first.deviceId).not.toBe(second.deviceId);
    expect(first.deviceToken).not.toBe(second.deviceToken);
  });

  it('requires authentication for sync endpoints', async () => {
    const ctx = await setupServer();
    openServers.push(ctx);

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/sync/pull?cursor=0',
    });
    expect(res.statusCode).toBe(401);
  });

  it('supports push and pull with last-write-wins behavior', async () => {
    const ctx = await setupServer();
    openServers.push(ctx);

    const desktop = await pairDevice(ctx.app, 'SYNC-CODE-1', 'Desktop');
    const phone = await pairDevice(ctx.app, 'SYNC-CODE-1', 'Phone');

    const firstPush = await ctx.app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: authHeaders(desktop.deviceToken, desktop.householdId),
      payload: {
        changes: [
          {
            entityType: 'product',
            entityId: 'prod-1',
            op: 'upsert',
            updatedAt: '2026-03-10T12:00:00.000Z',
            payload: { syncId: 'prod-1', name: 'Reis', quantity: 1 },
          },
        ],
      },
    });
    expect(firstPush.statusCode).toBe(200);
    expect(firstPush.json().applied).toBe(1);

    const initialPull = await ctx.app.inject({
      method: 'GET',
      url: '/v1/sync/pull?cursor=0',
      headers: authHeaders(phone.deviceToken, phone.householdId),
    });
    expect(initialPull.statusCode).toBe(200);
    const initialPayload = initialPull.json();
    expect(initialPayload.changes).toHaveLength(1);
    expect(initialPayload.changes[0].payload.quantity).toBe(1);

    const staleUpdate = await ctx.app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: authHeaders(phone.deviceToken, phone.householdId),
      payload: {
        changes: [
          {
            entityType: 'product',
            entityId: 'prod-1',
            op: 'upsert',
            updatedAt: '2026-03-10T11:59:59.000Z',
            payload: { syncId: 'prod-1', name: 'Reis', quantity: 99 },
          },
        ],
      },
    });
    expect(staleUpdate.statusCode).toBe(200);
    expect(staleUpdate.json().applied).toBe(0);

    const newerUpdate = await ctx.app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: authHeaders(phone.deviceToken, phone.householdId),
      payload: {
        changes: [
          {
            entityType: 'product',
            entityId: 'prod-1',
            op: 'upsert',
            updatedAt: '2026-03-10T12:05:00.000Z',
            payload: { syncId: 'prod-1', name: 'Reis', quantity: 2 },
          },
        ],
      },
    });
    expect(newerUpdate.statusCode).toBe(200);
    expect(newerUpdate.json().applied).toBe(1);

    const secondPull = await ctx.app.inject({
      method: 'GET',
      url: `/v1/sync/pull?cursor=${initialPayload.cursor}`,
      headers: authHeaders(desktop.deviceToken, desktop.householdId),
    });
    expect(secondPull.statusCode).toBe(200);
    const secondPayload = secondPull.json();
    expect(secondPayload.changes).toHaveLength(1);
    expect(secondPayload.changes[0].payload.quantity).toBe(2);
  });

  it('propagates deletes as tombstone changes', async () => {
    const ctx = await setupServer();
    openServers.push(ctx);

    const deviceA = await pairDevice(ctx.app, 'SYNC-CODE-DELETE', 'Desktop');
    const deviceB = await pairDevice(ctx.app, 'SYNC-CODE-DELETE', 'Phone');

    await ctx.app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: authHeaders(deviceA.deviceToken, deviceA.householdId),
      payload: {
        changes: [
          {
            entityType: 'product',
            entityId: 'prod-delete',
            op: 'upsert',
            updatedAt: '2026-03-10T10:00:00.000Z',
            payload: { syncId: 'prod-delete', name: 'Wasser', quantity: 4 },
          },
        ],
      },
    });

    const firstPull = await ctx.app.inject({
      method: 'GET',
      url: '/v1/sync/pull?cursor=0',
      headers: authHeaders(deviceB.deviceToken, deviceB.householdId),
    });
    const firstCursor = firstPull.json().cursor;

    const deletePush = await ctx.app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: authHeaders(deviceA.deviceToken, deviceA.householdId),
      payload: {
        changes: [
          {
            entityType: 'product',
            entityId: 'prod-delete',
            op: 'delete',
            updatedAt: '2026-03-10T11:00:00.000Z',
          },
        ],
      },
    });
    expect(deletePush.statusCode).toBe(200);
    expect(deletePush.json().applied).toBe(1);

    const afterDeletePull = await ctx.app.inject({
      method: 'GET',
      url: `/v1/sync/pull?cursor=${firstCursor}`,
      headers: authHeaders(deviceB.deviceToken, deviceB.householdId),
    });
    expect(afterDeletePull.statusCode).toBe(200);
    const payload = afterDeletePull.json();
    expect(payload.changes).toHaveLength(1);
    expect(payload.changes[0].op).toBe('delete');
    expect(payload.changes[0].payload).toBeNull();
  });

  it('rejects oversized push batches', async () => {
    const ctx = await setupServer();
    openServers.push(ctx);

    const paired = await pairDevice(ctx.app, 'SYNC-CODE-LIMIT', 'Desktop');
    const changes = Array.from({ length: 1001 }, (_, i) => ({
      entityType: 'product',
      entityId: `prod-${i}`,
      op: 'upsert',
      updatedAt: '2026-03-10T12:00:00.000Z',
      payload: { syncId: `prod-${i}`, name: `Item ${i}`, quantity: 1 },
    }));

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/sync/push',
      headers: authHeaders(paired.deviceToken, paired.householdId),
      payload: { changes },
    });

    expect(res.statusCode).toBe(400);
  });
});
