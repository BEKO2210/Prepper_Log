import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  applyConsumptionLogDeleteFromSync: vi.fn(),
  applyConsumptionLogUpsertFromSync: vi.fn(),
  applyProductDeleteFromSync: vi.fn(),
  applyProductUpsertFromSync: vi.fn(),
  applyStorageLocationDeleteFromSync: vi.fn(),
  applyStorageLocationUpsertFromSync: vi.fn(),
  getQueuedSyncChanges: vi.fn(),
  getSyncMetaValue: vi.fn(),
  getSyncQueueCount: vi.fn(),
  queueFullSnapshotForSync: vi.fn(),
  removeQueuedSyncChanges: vi.fn(),
  setSyncMetaValue: vi.fn(),
  withSyncQueueSuppressed: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

const syncConfigMock = vi.hoisted(() => ({
  getSyncConfig: vi.fn(),
  saveSyncConfig: vi.fn(),
}));

vi.mock('./db', () => dbMock);
vi.mock('./syncConfig', () => syncConfigMock);

function mockFetchResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload,
  } as Response;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });

  globalThis.fetch = vi.fn() as typeof fetch;

  dbMock.getQueuedSyncChanges.mockResolvedValue([]);
  dbMock.getSyncQueueCount.mockResolvedValue(0);
  dbMock.getSyncMetaValue.mockImplementation(async (key: string) => {
    if (key === 'sync_cursor') return '0';
    if (key === 'sync_full_snapshot_pending') return '0';
    return undefined;
  });
  syncConfigMock.getSyncConfig.mockReturnValue({
    enabled: true,
    serverUrl: 'http://localhost:8787',
    householdId: 'house-1',
    deviceId: 'device-1',
    deviceToken: 'token-1',
    deviceName: 'Desktop',
    intervalMs: 120000,
  });
  syncConfigMock.saveSyncConfig.mockImplementation((value: unknown) => value);
});

describe('sync runtime', () => {
  it('pairs a device and stores credentials', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({
        householdId: 'house-abc',
        deviceId: 'device-xyz',
        deviceToken: 'token-xyz',
      })
    );

    const { pairSyncDevice } = await import('./sync');

    await pairSyncDevice({
      serverUrl: 'http://192.168.0.20:8787/',
      syncCode: 'HOUSE-1234',
      deviceName: 'Phone',
    });

    expect(syncConfigMock.saveSyncConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        serverUrl: 'http://192.168.0.20:8787',
        householdId: 'house-abc',
        deviceId: 'device-xyz',
        deviceToken: 'token-xyz',
        deviceName: 'Phone',
      })
    );
    expect(dbMock.setSyncMetaValue).toHaveBeenCalledWith('sync_cursor', '0');
    expect(dbMock.setSyncMetaValue).toHaveBeenCalledWith('sync_full_snapshot_pending', '1');
  });

  it('runs pull/push/pull cycle and deduplicates queued changes', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockFetchResponse({
          cursor: 3,
          changes: [
            {
              seq: 3,
              entityType: 'product',
              entityId: 'prod-1',
              op: 'upsert',
              payload: { syncId: 'prod-1', name: 'Reis', quantity: 1 },
              updatedAt: '2026-03-10T12:00:00.000Z',
              updatedByDeviceId: 'device-remote',
            },
          ],
        })
      )
      .mockResolvedValueOnce(mockFetchResponse({ received: 1, applied: 1 }))
      .mockResolvedValueOnce(mockFetchResponse({ cursor: 3, changes: [] }));

    dbMock.getQueuedSyncChanges
      .mockResolvedValueOnce([
        {
          id: 1,
          entityType: 'product',
          entitySyncId: 'prod-1',
          op: 'upsert',
          updatedAt: '2026-03-10T12:00:00.000Z',
          payload: { syncId: 'prod-1', quantity: 1 },
        },
        {
          id: 2,
          entityType: 'product',
          entitySyncId: 'prod-1',
          op: 'upsert',
          updatedAt: '2026-03-10T12:01:00.000Z',
          payload: { syncId: 'prod-1', quantity: 2 },
        },
      ])
      .mockResolvedValueOnce([]);

    const { runSyncNow, subscribeSyncRuntime, getSyncRuntimeState } = await import('./sync');
    const observedStatuses: string[] = [];
    const unsubscribe = subscribeSyncRuntime((state) => {
      observedStatuses.push(state.status);
    });

    await runSyncNow('test');
    unsubscribe();

    expect(dbMock.applyProductUpsertFromSync).toHaveBeenCalledWith(
      expect.objectContaining({ syncId: 'prod-1' })
    );
    expect(dbMock.removeQueuedSyncChanges).toHaveBeenCalledWith([1, 2]);

    const pushCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url, init]) => String(url).includes('/v1/sync/push') && (init as RequestInit).method === 'POST'
    );
    expect(pushCall).toBeDefined();
    const pushBody = JSON.parse((pushCall![1] as RequestInit).body as string);
    expect(pushBody.changes).toHaveLength(1);
    expect(pushBody.changes[0].updatedAt).toBe('2026-03-10T12:01:00.000Z');
    expect(pushBody.changes[0].payload.quantity).toBe(2);

    expect(dbMock.setSyncMetaValue).toHaveBeenCalledWith('sync_cursor', '3');
    expect(observedStatuses).toContain('syncing');
    expect(getSyncRuntimeState().status).toBe('idle');
  });

  it('does not sync while offline and keeps pending count', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });
    dbMock.getSyncQueueCount.mockResolvedValue(7);

    const { runSyncNow, getSyncRuntimeState } = await import('./sync');
    await runSyncNow('offline-check');

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(getSyncRuntimeState().status).toBe('idle');
    expect(getSyncRuntimeState().pendingChanges).toBe(7);
  });
});
