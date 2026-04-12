const SYNC_CONFIG_KEY = 'preptrack-sync-config';

export interface SyncConfig {
  enabled: boolean;
  serverUrl: string;
  householdId: string;
  deviceId: string;
  deviceToken: string;
  deviceName: string;
  intervalMs: number;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  serverUrl: '',
  householdId: '',
  deviceId: '',
  deviceToken: '',
  deviceName: '',
  intervalMs: 2 * 60 * 1000,
};

function normalizeServerUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function readRawConfig(): Partial<SyncConfig> {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function getSyncConfig(): SyncConfig {
  const raw = readRawConfig();
  return {
    enabled: raw.enabled === true,
    serverUrl: normalizeServerUrl(raw.serverUrl ?? ''),
    householdId: String(raw.householdId ?? ''),
    deviceId: String(raw.deviceId ?? ''),
    deviceToken: String(raw.deviceToken ?? ''),
    deviceName: String(raw.deviceName ?? ''),
    intervalMs:
      typeof raw.intervalMs === 'number' && Number.isFinite(raw.intervalMs) && raw.intervalMs >= 10_000
        ? raw.intervalMs
        : DEFAULT_SYNC_CONFIG.intervalMs,
  };
}

export function saveSyncConfig(next: Partial<SyncConfig>): SyncConfig {
  const merged = {
    ...getSyncConfig(),
    ...next,
  };

  const normalized: SyncConfig = {
    ...merged,
    serverUrl: normalizeServerUrl(merged.serverUrl),
  };

  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearSyncPairing(): SyncConfig {
  return saveSyncConfig({
    enabled: false,
    householdId: '',
    deviceId: '',
    deviceToken: '',
  });
}

export function isSyncEnabled(): boolean {
  const cfg = getSyncConfig();
  return (
    cfg.enabled &&
    cfg.serverUrl.length > 0 &&
    cfg.householdId.length > 0 &&
    cfg.deviceId.length > 0 &&
    cfg.deviceToken.length > 0
  );
}
