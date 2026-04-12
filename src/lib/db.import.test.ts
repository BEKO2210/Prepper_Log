import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('importData sync linkage', () => {
  beforeEach(async () => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: indexedDB,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'IDBKeyRange', {
      value: IDBKeyRange,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it('derives productSyncId for imported legacy logs before queueing sync changes', async () => {
    const { saveSyncConfig } = await import('./syncConfig');
    saveSyncConfig({
      enabled: true,
      serverUrl: 'http://localhost:8787',
      householdId: 'house-1',
      deviceId: 'device-1',
      deviceToken: 'token-1',
      deviceName: 'Desktop',
    });

    const { db, importData } = await import('./db');
    await db.delete();
    await db.open();

    const payload = {
      version: 'legacy',
      exportedAt: '2026-03-12T10:00:00.000Z',
      products: [
        {
          id: 42,
          name: 'Reis',
          category: 'lebensmittel',
          storageLocation: 'Keller',
          quantity: 3,
          unit: 'Stück',
          expiryDate: '2027-01-01T00:00:00.000Z',
          expiryPrecision: 'day',
          archived: false,
          createdAt: '2026-03-10T10:00:00.000Z',
          updatedAt: '2026-03-10T10:00:00.000Z',
        },
      ],
      storageLocations: [],
      consumptionLogs: [
        {
          id: 9,
          productId: 42,
          productName: 'Reis',
          quantity: 1,
          unit: 'Stück',
          consumedAt: '2026-03-11T09:00:00.000Z',
          reason: 'verbraucht',
        },
      ],
    };

    await importData(JSON.stringify(payload));

    const logs = await db.consumptionLogs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].productSyncId).toBeTypeOf('string');
    expect(logs[0].productSyncId?.length).toBeGreaterThan(0);
    expect(typeof logs[0].productId).toBe('number');

    const queueRows = await db.syncQueue.toArray();
    const logSyncRow = queueRows.find(
      (row) => row.entityType === 'consumptionLog' && row.op === 'upsert'
    );
    expect(logSyncRow).toBeDefined();
    expect(logSyncRow?.payload?.productSyncId).toBe(logs[0].productSyncId);
    expect(logSyncRow?.payload?.productId).toBe(logs[0].productId);
  });
});
