import {
  applyConsumptionLogDeleteFromSync,
  applyConsumptionLogUpsertFromSync,
  applyProductDeleteFromSync,
  applyProductUpsertFromSync,
  applyStorageLocationDeleteFromSync,
  applyStorageLocationUpsertFromSync,
  getQueuedSyncChanges,
  getSyncMetaValue,
  getSyncQueueCount,
  queueFullSnapshotForSync,
  removeQueuedSyncChanges,
  setSyncMetaValue,
  withSyncQueueSuppressed,
} from './db';
import { getSyncConfig, saveSyncConfig } from './syncConfig';
import type { SyncEntityType, SyncOperation } from '../types';

interface PairResponse {
  householdId: string;
  deviceId: string;
  deviceToken: string;
}

interface PushRequestChange {
  entityType: SyncEntityType;
  entityId: string;
  op: SyncOperation;
  updatedAt: string;
  payload?: Record<string, unknown>;
}

interface PullResponseChange {
  seq: number;
  entityType: SyncEntityType;
  entityId: string;
  op: SyncOperation;
  updatedAt: string;
  updatedByDeviceId: string;
  payload?: Record<string, unknown> | null;
}

interface PullResponse {
  cursor: number;
  changes: PullResponseChange[];
}

export interface SyncRuntimeState {
  status: 'disabled' | 'idle' | 'syncing' | 'error';
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  pendingChanges: number;
}

const runtimeState: SyncRuntimeState = {
  status: 'disabled',
  pendingChanges: 0,
};

const listeners = new Set<(state: SyncRuntimeState) => void>();
let syncInterval: ReturnType<typeof setInterval> | null = null;
let onlineHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let inFlightSync: Promise<void> | null = null;

function emitRuntimeState(partial: Partial<SyncRuntimeState>): void {
  Object.assign(runtimeState, partial);
  const snapshot = { ...runtimeState };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function buildAuthHeaders(cfg: ReturnType<typeof getSyncConfig>): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.deviceToken}`,
    'x-household-id': cfg.householdId,
    'Content-Type': 'application/json',
  };
}

function dedupeQueueChanges(
  rows: Awaited<ReturnType<typeof getQueuedSyncChanges>>
): { changes: PushRequestChange[]; consumedIds: number[] } {
  const byKey = new Map<
    string,
    { rowId: number; change: PushRequestChange; consumedIds: number[] }
  >();

  for (const row of rows) {
    if (row.id === undefined) continue;
    const key = `${row.entityType}:${row.entitySyncId}`;
    const change: PushRequestChange = {
      entityType: row.entityType,
      entityId: row.entitySyncId,
      op: row.op,
      updatedAt: row.updatedAt,
      payload: row.payload,
    };

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        rowId: row.id,
        change,
        consumedIds: [row.id],
      });
      continue;
    }

    existing.consumedIds.push(row.id);
    if (row.id > existing.rowId) {
      existing.rowId = row.id;
      existing.change = change;
    }
  }

  const entries = Array.from(byKey.values()).sort((a, b) => a.rowId - b.rowId);
  return {
    changes: entries.map((entry) => entry.change),
    consumedIds: entries.flatMap((entry) => entry.consumedIds),
  };
}

async function applyPulledChanges(changes: PullResponseChange[]): Promise<void> {
  await withSyncQueueSuppressed(async () => {
    for (const change of changes) {
      const entityId = change.entityId;
      if (!entityId) continue;

      if (change.entityType === 'product') {
        if (change.op === 'delete') {
          await applyProductDeleteFromSync(entityId);
        } else if (change.payload && typeof change.payload === 'object') {
          await applyProductUpsertFromSync(change.payload);
        }
        continue;
      }

      if (change.entityType === 'storageLocation') {
        if (change.op === 'delete') {
          await applyStorageLocationDeleteFromSync(entityId);
        } else if (change.payload && typeof change.payload === 'object') {
          await applyStorageLocationUpsertFromSync(change.payload);
        }
        continue;
      }

      if (change.entityType === 'consumptionLog') {
        if (change.op === 'delete') {
          await applyConsumptionLogDeleteFromSync(entityId);
        } else if (change.payload && typeof change.payload === 'object') {
          await applyConsumptionLogUpsertFromSync(change.payload);
        }
      }
    }
  });
}

async function pullChanges(cursor: number): Promise<PullResponse> {
  const cfg = getSyncConfig();
  const res = await fetch(
    `${cfg.serverUrl}/v1/sync/pull?cursor=${encodeURIComponent(String(cursor))}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(cfg),
    }
  );

  if (!res.ok) {
    throw new Error(`Pull fehlgeschlagen (${res.status})`);
  }

  const payload = (await res.json()) as Partial<PullResponse>;
  return {
    cursor:
      typeof payload.cursor === 'number' && Number.isFinite(payload.cursor)
        ? payload.cursor
        : cursor,
    changes: Array.isArray(payload.changes)
      ? payload.changes.filter(
          (item): item is PullResponseChange =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof item.entityType === 'string' &&
            typeof item.entityId === 'string' &&
            typeof item.op === 'string'
        )
      : [],
  };
}

async function pushChanges(changes: PushRequestChange[]): Promise<void> {
  if (changes.length === 0) return;
  const cfg = getSyncConfig();
  const res = await fetch(`${cfg.serverUrl}/v1/sync/push`, {
    method: 'POST',
    headers: buildAuthHeaders(cfg),
    body: JSON.stringify({ changes }),
  });
  if (!res.ok) {
    throw new Error(`Push fehlgeschlagen (${res.status})`);
  }
}

export async function pairSyncDevice(params: {
  serverUrl: string;
  syncCode: string;
  deviceName: string;
}): Promise<void> {
  const serverUrl = params.serverUrl.trim().replace(/\/+$/, '');
  if (!serverUrl) {
    throw new Error('Server URL fehlt.');
  }
  if (!params.syncCode.trim()) {
    throw new Error('Sync-Code fehlt.');
  }
  if (!params.deviceName.trim()) {
    throw new Error('Gerätename fehlt.');
  }

  const res = await fetch(`${serverUrl}/v1/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      syncCode: params.syncCode.trim(),
      deviceName: params.deviceName.trim(),
    }),
  });

  if (!res.ok) {
    throw new Error(`Pairing fehlgeschlagen (${res.status})`);
  }

  const payload = (await res.json()) as Partial<PairResponse>;
  if (!payload.deviceToken || !payload.deviceId || !payload.householdId) {
    throw new Error('Ungültige Pairing-Antwort vom Server.');
  }

  saveSyncConfig({
    enabled: true,
    serverUrl,
    householdId: payload.householdId,
    deviceId: payload.deviceId,
    deviceToken: payload.deviceToken,
    deviceName: params.deviceName.trim(),
  });

  await setSyncMetaValue('sync_cursor', '0');
  await setSyncMetaValue('sync_full_snapshot_pending', '1');

  emitRuntimeState({
    status: 'idle',
    lastError: undefined,
  });
}

export async function runSyncNow(reason = 'manual'): Promise<void> {
  if (inFlightSync) {
    return inFlightSync;
  }

  const cfg = getSyncConfig();
  if (!cfg.enabled) {
    emitRuntimeState({ status: 'disabled', pendingChanges: 0 });
    return;
  }

  if (!cfg.serverUrl || !cfg.deviceToken || !cfg.householdId) {
    emitRuntimeState({
      status: 'error',
      lastError: 'Sync ist aktiviert, aber unvollständig konfiguriert.',
    });
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const pending = await getSyncQueueCount();
    emitRuntimeState({
      status: 'idle',
      pendingChanges: pending,
    });
    return;
  }

  inFlightSync = (async () => {
    const startedAt = new Date().toISOString();
    emitRuntimeState({
      status: 'syncing',
      lastAttemptAt: startedAt,
    });

    try {
      let cursorRaw = await getSyncMetaValue('sync_cursor');
      let cursor = Number.parseInt(cursorRaw ?? '0', 10);
      if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

      const firstPull = await pullChanges(cursor);
      if (firstPull.changes.length > 0) {
        await applyPulledChanges(firstPull.changes);
      }
      cursor = firstPull.cursor;
      await setSyncMetaValue('sync_cursor', String(cursor));

      const fullSnapshotPending = (await getSyncMetaValue('sync_full_snapshot_pending')) === '1';
      if (fullSnapshotPending) {
        await queueFullSnapshotForSync(true);
        await setSyncMetaValue('sync_full_snapshot_pending', '0');
      }

      while (true) {
        const queued = await getQueuedSyncChanges(500);
        if (queued.length === 0) break;

        const deduped = dedupeQueueChanges(queued);
        if (deduped.changes.length === 0) {
          await removeQueuedSyncChanges(deduped.consumedIds);
          continue;
        }

        await pushChanges(deduped.changes);
        await removeQueuedSyncChanges(deduped.consumedIds);
      }

      const secondPull = await pullChanges(cursor);
      if (secondPull.changes.length > 0) {
        await applyPulledChanges(secondPull.changes);
      }
      cursor = secondPull.cursor;
      await setSyncMetaValue('sync_cursor', String(cursor));

      const pending = await getSyncQueueCount();
      emitRuntimeState({
        status: 'idle',
        pendingChanges: pending,
        lastSuccessAt: new Date().toISOString(),
        lastError: undefined,
      });
    } catch (error) {
      const pending = await getSyncQueueCount();
      const message =
        error instanceof Error ? error.message : `Sync fehlgeschlagen (${reason})`;
      emitRuntimeState({
        status: 'error',
        pendingChanges: pending,
        lastError: message,
      });
      throw error;
    } finally {
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}

export function getSyncRuntimeState(): SyncRuntimeState {
  return { ...runtimeState };
}

export function subscribeSyncRuntime(
  listener: (state: SyncRuntimeState) => void
): () => void {
  listeners.add(listener);
  listener({ ...runtimeState });
  return () => {
    listeners.delete(listener);
  };
}

export function startSyncEngine(): () => void {
  if (syncInterval) {
    return () => undefined;
  }

  const cfg = getSyncConfig();
  emitRuntimeState({
    status: cfg.enabled ? 'idle' : 'disabled',
  });

  void runSyncNow('startup').catch(() => undefined);

  syncInterval = setInterval(() => {
    void runSyncNow('interval').catch(() => undefined);
  }, cfg.intervalMs);

  onlineHandler = () => {
    void runSyncNow('online').catch(() => undefined);
  };
  window.addEventListener('online', onlineHandler);

  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      void runSyncNow('visibility').catch(() => undefined);
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  return () => {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler);
      onlineHandler = null;
    }
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  };
}
