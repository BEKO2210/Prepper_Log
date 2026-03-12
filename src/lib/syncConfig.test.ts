import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSyncPairing,
  getSyncConfig,
  isSyncEnabled,
  saveSyncConfig,
} from './syncConfig';

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

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe('syncConfig', () => {
  it('returns safe defaults when no config exists', () => {
    const cfg = getSyncConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.serverUrl).toBe('');
    expect(cfg.intervalMs).toBe(120000);
  });

  it('normalizes and persists settings', () => {
    const cfg = saveSyncConfig({
      enabled: true,
      serverUrl: 'http://192.168.0.20:8787/',
      householdId: 'house-1',
      deviceId: 'device-1',
      deviceToken: 'token-1',
      deviceName: 'Phone',
      intervalMs: 60000,
    });

    expect(cfg.serverUrl).toBe('http://192.168.0.20:8787');
    expect(getSyncConfig().serverUrl).toBe('http://192.168.0.20:8787');
  });

  it('marks sync as enabled only when full credentials exist', () => {
    saveSyncConfig({
      enabled: true,
      serverUrl: 'http://localhost:8787',
      householdId: 'house-1',
      deviceId: 'device-1',
      deviceToken: 'token-1',
      deviceName: 'Desktop',
    });
    expect(isSyncEnabled()).toBe(true);

    saveSyncConfig({ deviceToken: '' });
    expect(isSyncEnabled()).toBe(false);
  });

  it('clears pairing credentials', () => {
    saveSyncConfig({
      enabled: true,
      serverUrl: 'http://localhost:8787',
      householdId: 'house-1',
      deviceId: 'device-1',
      deviceToken: 'token-1',
      deviceName: 'Desktop',
    });

    const cleared = clearSyncPairing();
    expect(cleared.enabled).toBe(false);
    expect(cleared.householdId).toBe('');
    expect(cleared.deviceId).toBe('');
    expect(cleared.deviceToken).toBe('');
  });
});
