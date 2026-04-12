import Dexie, { type Table } from 'dexie';
import { version as appVersion } from '../../package.json';
import i18n from '../i18n/i18n';
import { getLocale, lookupBarcode, fetchAndCompressImage } from './utils';
import { isSyncEnabled } from './syncConfig';
import type {
  Product,
  StorageLocation,
  ConsumptionLog,
  NotificationSchedule,
  SyncEntityType,
  SyncOperation,
} from '../types';

export interface SyncQueueRow {
  id?: number;
  entityType: SyncEntityType;
  entitySyncId: string;
  op: SyncOperation;
  updatedAt: string;
  payload?: Record<string, unknown>;
}

export interface SyncMetaRow {
  key: string;
  value: string;
}

const VALID_REASONS: ConsumptionLog['reason'][] = [
  'verbraucht',
  'abgelaufen',
  'beschadigt',
  'sonstiges',
];

let syncQueueSuppressionDepth = 0;

function createSyncId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function shouldQueueSyncChange(): boolean {
  return syncQueueSuppressionDepth === 0 && isSyncEnabled();
}

function toSyncProductPayload(product: Omit<Product, 'id'>): Record<string, unknown> {
  return {
    ...product,
    // Explicit null for optional fields so JSON serialization preserves intentional clears.
    // Receivers distinguish null (cleared) from absent key (unknown/fallback).
    barcode: product.barcode ?? null,
    photo: product.photo ?? null,
    minStock: product.minStock ?? null,
    notes: product.notes ?? null,
  };
}

function toSyncLocationPayload(location: Omit<StorageLocation, 'id'>): Record<string, unknown> {
  return { ...location };
}

function toSyncLogPayload(log: Omit<ConsumptionLog, 'id'>): Record<string, unknown> {
  return { ...log };
}

function toIso(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return fallback;
  return dt.toISOString();
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function normalizeReason(value: unknown, fallback: ConsumptionLog['reason']): ConsumptionLog['reason'] {
  if (typeof value === 'string' && VALID_REASONS.includes(value as ConsumptionLog['reason'])) {
    return value as ConsumptionLog['reason'];
  }
  return fallback;
}

export class PrepTrackDB extends Dexie {
  products!: Table<Product, number>;
  storageLocations!: Table<StorageLocation, number>;
  consumptionLogs!: Table<ConsumptionLog, number>;
  notificationSchedules!: Table<NotificationSchedule, number>;
  syncQueue!: Table<SyncQueueRow, number>;
  syncMeta!: Table<SyncMetaRow, string>;

  constructor() {
    super('PrepTrackDB');

    this.version(1).stores({
      products:
        '++id, name, barcode, category, storageLocation, expiryDate, archived, createdAt',
      storageLocations: '++id, name',
      consumptionLogs: '++id, productId, consumedAt',
      notificationSchedules: '++id, productId, notifyAt, sent',
    });

    this.version(2).stores({
      products:
        '++id, name, barcode, category, storageLocation, expiryDate, archived, createdAt',
      storageLocations: '++id, name',
      consumptionLogs: '++id, productId, consumedAt',
      notificationSchedules: '++id, productId, notifyAt, sent, [productId+daysBefore]',
    });

    this.version(3)
      .stores({
        products:
          '++id, &syncId, name, barcode, category, storageLocation, expiryDate, archived, createdAt, updatedAt',
        storageLocations: '++id, &syncId, name, createdAt, updatedAt',
        consumptionLogs: '++id, &syncId, productId, productSyncId, consumedAt, updatedAt',
        notificationSchedules: '++id, productId, notifyAt, sent, [productId+daysBefore]',
        syncQueue: '++id, [entityType+entitySyncId], updatedAt',
        syncMeta: '&key',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        const productsTable = tx.table('products') as Table<Product, number>;
        const storageTable = tx.table('storageLocations') as Table<StorageLocation, number>;
        const logsTable = tx.table('consumptionLogs') as Table<ConsumptionLog, number>;
        const syncMetaTable = tx.table('syncMeta') as Table<SyncMetaRow, string>;

        const products = await productsTable.toArray();
        const productSyncById = new Map<number, string>();
        for (const product of products) {
          const next: Product = {
            ...product,
            syncId: product.syncId ?? createSyncId(),
            updatedAt: product.updatedAt ?? product.createdAt ?? now,
          };
          if (product.id !== undefined) {
            productSyncById.set(product.id, next.syncId!);
            await productsTable.put(next);
          }
        }

        const locations = await storageTable.toArray();
        for (const location of locations) {
          const next: StorageLocation = {
            ...location,
            syncId: location.syncId ?? createSyncId(),
            updatedAt: location.updatedAt ?? location.createdAt ?? now,
          };
          await storageTable.put(next);
        }

        const logs = await logsTable.toArray();
        for (const log of logs) {
          const next: ConsumptionLog = {
            ...log,
            syncId: log.syncId ?? createSyncId(),
            productSyncId:
              log.productSyncId ??
              (typeof log.productId === 'number' ? productSyncById.get(log.productId) : undefined),
            updatedAt: log.updatedAt ?? log.consumedAt ?? now,
          };
          await logsTable.put(next);
        }

        await syncMetaTable.put({ key: 'sync_cursor', value: '0' });
        await syncMetaTable.put({ key: 'sync_full_snapshot_pending', value: '0' });
      });
  }
}

export const db = new PrepTrackDB();

async function enqueueSyncChange(row: Omit<SyncQueueRow, 'id'>): Promise<void> {
  if (!shouldQueueSyncChange()) return;
  await db.syncQueue.add(row);
}

export async function withSyncQueueSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  syncQueueSuppressionDepth += 1;
  try {
    return await fn();
  } finally {
    syncQueueSuppressionDepth -= 1;
  }
}

export async function getSyncMetaValue(key: string): Promise<string | undefined> {
  const row = await db.syncMeta.get(key);
  return row?.value;
}

export async function setSyncMetaValue(key: string, value: string): Promise<void> {
  await db.syncMeta.put({ key, value });
}

export async function getQueuedSyncChanges(limit = 500): Promise<SyncQueueRow[]> {
  return db.syncQueue.orderBy('id').limit(limit).toArray();
}

export async function removeQueuedSyncChanges(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.syncQueue.bulkDelete(ids);
}

export async function getSyncQueueCount(): Promise<number> {
  return db.syncQueue.count();
}

export async function queueFullSnapshotForSync(resetQueue = false): Promise<void> {
  if (!isSyncEnabled()) return;
  if (resetQueue) {
    await db.syncQueue.clear();
  }

  const [products, locations, logs] = await Promise.all([
    db.products.toArray(),
    db.storageLocations.toArray(),
    db.consumptionLogs.toArray(),
  ]);

  const batch: Omit<SyncQueueRow, 'id'>[] = [];

  for (const product of products) {
    if (!product.syncId) continue;
    const { id: _id, ...payload } = product;
    batch.push({
      entityType: 'product',
      entitySyncId: product.syncId,
      op: 'upsert',
      updatedAt: product.updatedAt,
      payload: toSyncProductPayload(payload),
    });
  }

  for (const location of locations) {
    if (!location.syncId) continue;
    const { id: _id, ...payload } = location;
    batch.push({
      entityType: 'storageLocation',
      entitySyncId: location.syncId,
      op: 'upsert',
      updatedAt: location.updatedAt ?? location.createdAt,
      payload: toSyncLocationPayload(payload),
    });
  }

  for (const log of logs) {
    if (!log.syncId) continue;
    const { id: _id, ...payload } = log;
    batch.push({
      entityType: 'consumptionLog',
      entitySyncId: log.syncId,
      op: 'upsert',
      updatedAt: log.updatedAt ?? log.consumedAt,
      payload: toSyncLogPayload(payload),
    });
  }

  if (batch.length > 0) {
    await db.syncQueue.bulkAdd(batch);
  }
}

// Seed default storage locations on first run
export async function seedDefaults(): Promise<void> {
  const count = await db.storageLocations.count();
  if (count === 0) {
    const now = new Date().toISOString();
    await db.storageLocations.bulkAdd([
      { syncId: createSyncId(), name: 'Keller', createdAt: now, updatedAt: now },
      { syncId: createSyncId(), name: 'Garage', createdAt: now, updatedAt: now },
      { syncId: createSyncId(), name: 'Küche', createdAt: now, updatedAt: now },
      { syncId: createSyncId(), name: 'Dachboden', createdAt: now, updatedAt: now },
      { syncId: createSyncId(), name: 'Vorratsraum', createdAt: now, updatedAt: now },
      { syncId: createSyncId(), name: 'Bunker', createdAt: now, updatedAt: now },
      { syncId: createSyncId(), name: 'Auto', createdAt: now, updatedAt: now },
      { syncId: createSyncId(), name: 'Gartenhaus', createdAt: now, updatedAt: now },
    ]);
  }
}

// Product CRUD
export async function addProduct(product: Omit<Product, 'id'>): Promise<number> {
  const now = new Date().toISOString();
  const next: Omit<Product, 'id'> = {
    ...product,
    syncId: product.syncId ?? createSyncId(),
    createdAt: product.createdAt ?? now,
    updatedAt: product.updatedAt ?? now,
  };

  const id = await db.products.add(next);
  await enqueueSyncChange({
    entityType: 'product',
    entitySyncId: next.syncId!,
    op: 'upsert',
    updatedAt: next.updatedAt,
    payload: toSyncProductPayload(next),
  });
  return id;
}

export async function updateProduct(
  id: number,
  changes: Partial<Product>
): Promise<number> {
  const existing = await db.products.get(id);
  if (!existing) return 0;

  const now = new Date().toISOString();
  const next: Omit<Product, 'id'> = {
    ...existing,
    ...changes,
    syncId: existing.syncId ?? createSyncId(),
    updatedAt: changes.updatedAt ?? now,
  };

  const updated = await db.products.update(id, next);
  if (updated) {
    await enqueueSyncChange({
      entityType: 'product',
      entitySyncId: next.syncId!,
      op: 'upsert',
      updatedAt: next.updatedAt,
      payload: toSyncProductPayload(next),
    });
  }
  return updated;
}

export async function deleteProduct(id: number): Promise<void> {
  const product = await db.products.get(id);
  if (!product) return;

  const relatedLogs = await db.consumptionLogs.where('productId').equals(id).toArray();
  const now = new Date().toISOString();

  await db.transaction(
    'rw',
    db.products,
    db.consumptionLogs,
    db.notificationSchedules,
    async () => {
      await db.products.delete(id);
      await db.consumptionLogs.where('productId').equals(id).delete();
      await db.notificationSchedules.where('productId').equals(id).delete();
    }
  );

  if (product.syncId) {
    await enqueueSyncChange({
      entityType: 'product',
      entitySyncId: product.syncId,
      op: 'delete',
      updatedAt: now,
    });
  }

  const logDeletes = relatedLogs
    .filter((log) => typeof log.syncId === 'string' && log.syncId.length > 0)
    .map((log) =>
      enqueueSyncChange({
        entityType: 'consumptionLog',
        entitySyncId: log.syncId!,
        op: 'delete',
        updatedAt: now,
      })
    );

  await Promise.all(logDeletes);
}

export async function archiveProduct(id: number): Promise<void> {
  await updateProduct(id, {
    archived: true,
  });
}

export async function getActiveProducts(): Promise<Product[]> {
  return db.products.filter((p) => !p.archived).toArray();
}

export async function getArchivedProducts(): Promise<Product[]> {
  return db.products.filter((p) => p.archived).toArray();
}

// Storage Location CRUD
export async function addStorageLocation(name: string): Promise<number> {
  const now = new Date().toISOString();
  const next: Omit<StorageLocation, 'id'> = {
    syncId: createSyncId(),
    name,
    createdAt: now,
    updatedAt: now,
  };
  const id = await db.storageLocations.add(next);
  await enqueueSyncChange({
    entityType: 'storageLocation',
    entitySyncId: next.syncId!,
    op: 'upsert',
    updatedAt: next.updatedAt!,
    payload: toSyncLocationPayload(next),
  });
  return id;
}

export async function deleteStorageLocation(id: number): Promise<void> {
  const location = await db.storageLocations.get(id);
  if (!location) return;
  await db.storageLocations.delete(id);
  if (location.syncId) {
    await enqueueSyncChange({
      entityType: 'storageLocation',
      entitySyncId: location.syncId,
      op: 'delete',
      updatedAt: new Date().toISOString(),
    });
  }
}

// Consumption Log
export async function logConsumption(
  log: Omit<ConsumptionLog, 'id'>
): Promise<number> {
  const now = new Date().toISOString();
  let productSyncId = log.productSyncId;
  if (!productSyncId && typeof log.productId === 'number') {
    const product = await db.products.get(log.productId);
    productSyncId = product?.syncId;
  }

  const next: Omit<ConsumptionLog, 'id'> = {
    ...log,
    syncId: log.syncId ?? createSyncId(),
    productSyncId,
    updatedAt: log.updatedAt ?? now,
  };

  const id = await db.consumptionLogs.add(next);
  await enqueueSyncChange({
    entityType: 'consumptionLog',
    entitySyncId: next.syncId!,
    op: 'upsert',
    updatedAt: next.updatedAt!,
    payload: toSyncLogPayload(next),
  });
  return id;
}

// Remote sync apply helpers
export async function applyProductUpsertFromSync(
  payload: Record<string, unknown>
): Promise<void> {
  const syncId = typeof payload.syncId === 'string' ? payload.syncId : '';
  if (!syncId) return;

  const existing = await db.products.where('syncId').equals(syncId).first();
  const now = new Date().toISOString();

  const next: Omit<Product, 'id'> = {
    syncId,
    name: typeof payload.name === 'string' ? payload.name : existing?.name ?? 'Produkt',
    // For optional fields: null means explicitly cleared; absent key falls back to existing value.
    barcode: 'barcode' in payload ? (typeof payload.barcode === 'string' ? payload.barcode : undefined) : existing?.barcode,
    category:
      typeof payload.category === 'string'
        ? (payload.category as Product['category'])
        : existing?.category ?? 'sonstiges',
    storageLocation:
      typeof payload.storageLocation === 'string'
        ? payload.storageLocation
        : existing?.storageLocation ?? 'Keller',
    quantity: normalizeNumber(payload.quantity, existing?.quantity ?? 1),
    unit: typeof payload.unit === 'string' ? payload.unit : existing?.unit ?? 'Stück',
    expiryDate:
      typeof payload.expiryDate === 'string'
        ? payload.expiryDate
        : existing?.expiryDate ?? now,
    expiryPrecision:
      payload.expiryPrecision === 'month' || payload.expiryPrecision === 'year'
        ? (payload.expiryPrecision as Product['expiryPrecision'])
        : payload.expiryPrecision === 'day'
          ? 'day'
          : existing?.expiryPrecision ?? 'day',
    photo: 'photo' in payload ? (typeof payload.photo === 'string' ? payload.photo : undefined) : existing?.photo,
    minStock: 'minStock' in payload
      ? (typeof payload.minStock === 'number' && Number.isFinite(payload.minStock) ? payload.minStock : undefined)
      : existing?.minStock,
    notes: 'notes' in payload ? (typeof payload.notes === 'string' ? payload.notes : undefined) : existing?.notes,
    archived: typeof payload.archived === 'boolean' ? payload.archived : existing?.archived ?? false,
    createdAt: toIso(payload.createdAt, existing?.createdAt ?? now),
    updatedAt: toIso(payload.updatedAt, existing?.updatedAt ?? now),
  };

  if (existing?.id !== undefined) {
    await db.products.update(existing.id, next);
    return;
  }

  await db.products.add(next);
}

export async function applyProductDeleteFromSync(syncId: string): Promise<void> {
  const product = await db.products.where('syncId').equals(syncId).first();
  const productLogs = await db.consumptionLogs.where('productSyncId').equals(syncId).toArray();

  await db.transaction(
    'rw',
    db.products,
    db.consumptionLogs,
    db.notificationSchedules,
    async () => {
      if (product?.id !== undefined) {
        await db.products.delete(product.id);
        await db.consumptionLogs.where('productId').equals(product.id).delete();
        await db.notificationSchedules.where('productId').equals(product.id).delete();
      }

      if (productLogs.length > 0) {
        await db.consumptionLogs.bulkDelete(
          productLogs.map((log) => log.id).filter((id): id is number => typeof id === 'number')
        );
      }
    }
  );
}

export async function applyStorageLocationUpsertFromSync(
  payload: Record<string, unknown>
): Promise<void> {
  const syncId = typeof payload.syncId === 'string' ? payload.syncId : '';
  if (!syncId) return;
  const now = new Date().toISOString();
  const incomingName = typeof payload.name === 'string' ? payload.name : '';
  if (!incomingName) return;

  const bySyncId = await db.storageLocations.where('syncId').equals(syncId).first();
  let existing = bySyncId;
  if (!existing) {
    const byName = await db.storageLocations.where('name').equals(incomingName).first();
    existing = byName;
  }

  const next: Omit<StorageLocation, 'id'> = {
    syncId,
    name: incomingName,
    icon: typeof payload.icon === 'string' ? payload.icon : existing?.icon,
    createdAt: toIso(payload.createdAt, existing?.createdAt ?? now),
    updatedAt: toIso(payload.updatedAt, existing?.updatedAt ?? now),
  };

  if (existing?.id !== undefined) {
    await db.storageLocations.update(existing.id, next);
    return;
  }

  await db.storageLocations.add(next);
}

export async function applyStorageLocationDeleteFromSync(syncId: string): Promise<void> {
  const location = await db.storageLocations.where('syncId').equals(syncId).first();
  if (location?.id !== undefined) {
    await db.storageLocations.delete(location.id);
  }
}

export async function applyConsumptionLogUpsertFromSync(
  payload: Record<string, unknown>
): Promise<void> {
  const syncId = typeof payload.syncId === 'string' ? payload.syncId : '';
  if (!syncId) return;
  const now = new Date().toISOString();
  const existing = await db.consumptionLogs.where('syncId').equals(syncId).first();

  const productSyncId =
    typeof payload.productSyncId === 'string'
      ? payload.productSyncId
      : existing?.productSyncId;

  let productId = typeof payload.productId === 'number' ? payload.productId : existing?.productId;
  if (productSyncId) {
    const product = await db.products.where('syncId').equals(productSyncId).first();
    if (product?.id !== undefined) {
      productId = product.id;
    }
  }

  const fallbackReason: ConsumptionLog['reason'] = existing?.reason ?? 'sonstiges';
  const next: Omit<ConsumptionLog, 'id'> = {
    syncId,
    productId,
    productSyncId,
    productName:
      typeof payload.productName === 'string'
        ? payload.productName
        : existing?.productName ?? 'Produkt',
    quantity: normalizeNumber(payload.quantity, existing?.quantity ?? 1),
    unit: typeof payload.unit === 'string' ? payload.unit : existing?.unit ?? 'Stück',
    consumedAt: toIso(payload.consumedAt, existing?.consumedAt ?? now),
    updatedAt: toIso(payload.updatedAt, existing?.updatedAt ?? now),
    reason: normalizeReason(payload.reason, fallbackReason),
  };

  if (existing?.id !== undefined) {
    await db.consumptionLogs.update(existing.id, next);
    return;
  }

  await db.consumptionLogs.add(next);
}

export async function applyConsumptionLogDeleteFromSync(syncId: string): Promise<void> {
  const log = await db.consumptionLogs.where('syncId').equals(syncId).first();
  if (log?.id !== undefined) {
    await db.consumptionLogs.delete(log.id);
  }
}

// Export/Import
export async function exportData(): Promise<string> {
  const [products, storageLocations, consumptionLogs] = await Promise.all([
    db.products.toArray(),
    db.storageLocations.toArray(),
    db.consumptionLogs.toArray(),
  ]);

  // Strip photo data from export to keep file size manageable
  const productsWithoutPhotos = products.map(({ photo, ...rest }) => ({
    ...rest,
    photo: photo ? '[FOTO]' : undefined,
  }));

  const data = {
    version: appVersion,
    exportedAt: new Date().toISOString(),
    products: productsWithoutPhotos,
    storageLocations,
    consumptionLogs,
  };

  return JSON.stringify(data, null, 2);
}

export async function exportCSV(): Promise<string> {
  const products = await db.products.toArray();
  const t = i18n.t.bind(i18n);

  // BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';

  const headers = [
    'Name',
    'Barcode',
    t('form.category'),
    t('form.storageLocation'),
    t('form.quantity'),
    t('form.unit'),
    t('products.mhd'),
    t('form.expiryDate'),
    t('form.minStock'),
    t('form.notes'),
    t('products.archive'),
    t('detail.storedSince'),
    t('detail.lastEdited'),
  ];

  function escCsv(val: string | number | undefined | null): string {
    let s = String(val ?? '');
    // Prevent CSV injection: prefix dangerous first characters
    if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
      s = "'" + s;
    }
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const locale = getLocale();

  function fmtDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const rows = products.map((p) => [
    escCsv(p.name),
    escCsv(p.barcode),
    escCsv(t(`categories.${p.category}`)),
    escCsv(p.storageLocation),
    escCsv(p.quantity),
    escCsv(t(`units.${p.unit}`)),
    escCsv(fmtDate(p.expiryDate)),
    escCsv(
      p.expiryPrecision === 'day'
        ? t('form.precisionDay')
        : p.expiryPrecision === 'month'
          ? t('form.precisionMonth')
          : t('form.precisionYear')
    ),
    escCsv(p.minStock ?? ''),
    escCsv(p.notes),
    escCsv(p.archived ? t('common.yes') : t('common.no')),
    escCsv(fmtDate(p.createdAt)),
    escCsv(fmtDate(p.updatedAt)),
  ]);

  return BOM + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

export interface ImportDataResult {
  imported: number;
  skipped: number;
  /** IDs von importierten Produkten die einen Barcode aber kein Foto haben */
  productsNeedingImages: number[];
}

export async function importData(jsonString: string): Promise<ImportDataResult> {
  const t = i18n.t.bind(i18n);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error(t('dbErrors.invalidJson'));
  }

  if (!data.products || !Array.isArray(data.products)) {
    throw new Error(t('dbErrors.invalidFormat'));
  }

  const products = data.products as Record<string, unknown>[];
  const storageLocations = (data.storageLocations ?? []) as Record<string, unknown>[];
  const consumptionLogs = (data.consumptionLogs ?? []) as Record<string, unknown>[];
  const queuedSyncChanges: Omit<SyncQueueRow, 'id'>[] = [];
  const importedProductSyncIdByLegacyId = new Map<number, string>();
  const localProductIdBySyncId = new Map<string, number>();

  let imported = 0;
  let skipped = 0;
  const productsNeedingImages: number[] = [];

  await db.transaction(
    'rw',
    db.products,
    db.storageLocations,
    db.consumptionLogs,
    async () => {
      // Import storage locations (skip duplicates)
      for (const loc of storageLocations) {
        if (!loc.name || typeof loc.name !== 'string') continue;
        const existing = await db.storageLocations
          .where('name')
          .equals(loc.name)
          .first();
        if (!existing) {
          const now = new Date().toISOString();
          const next: Omit<StorageLocation, 'id'> = {
            syncId: typeof loc.syncId === 'string' ? loc.syncId : createSyncId(),
            name: loc.name,
            createdAt: (loc.createdAt as string) || now,
            updatedAt: (loc.updatedAt as string) || (loc.createdAt as string) || now,
          };
          await db.storageLocations.add(next);
          queuedSyncChanges.push({
            entityType: 'storageLocation',
            entitySyncId: next.syncId!,
            op: 'upsert',
            updatedAt: next.updatedAt!,
            payload: toSyncLocationPayload(next),
          });
        }
      }

      // Import products (skip duplicates based on name + expiryDate + storageLocation)
      for (const product of products) {
        const legacyProductId = typeof product.id === 'number' ? product.id : undefined;
        if (
          !product.name ||
          typeof product.name !== 'string' ||
          !product.expiryDate ||
          typeof product.expiryDate !== 'string' ||
          Number.isNaN(new Date(String(product.expiryDate)).getTime())
        ) {
          skipped++;
          continue;
        }

        // Check for duplicate
        const existingProducts = await db.products
          .where('name')
          .equals(product.name as string)
          .toArray();
        const duplicateProduct = existingProducts.find(
          (p) =>
            p.expiryDate === product.expiryDate &&
            p.storageLocation === product.storageLocation
        );
        const isDuplicate = Boolean(duplicateProduct);

        if (isDuplicate) {
          skipped++;
          if (legacyProductId !== undefined && duplicateProduct?.syncId) {
            importedProductSyncIdByLegacyId.set(legacyProductId, duplicateProduct.syncId);
            if (typeof duplicateProduct.id === 'number') {
              localProductIdBySyncId.set(duplicateProduct.syncId, duplicateProduct.id);
            }
          }
          continue;
        }

        // Clean up photo field - don't import placeholder markers
        const rawPhoto = product.photo;
        const photo =
          rawPhoto && rawPhoto !== '[FOTO]' && typeof rawPhoto === 'string'
            ? rawPhoto
            : undefined;
        const now = new Date().toISOString();

        // Only import known fields to prevent injection of unexpected data
        const next: Omit<Product, 'id'> = {
          syncId: typeof product.syncId === 'string' ? product.syncId : createSyncId(),
          name: String(product.name),
          barcode: typeof product.barcode === 'string' ? product.barcode : undefined,
          category:
            typeof product.category === 'string'
              ? (product.category as Product['category'])
              : 'sonstiges',
          storageLocation:
            typeof product.storageLocation === 'string'
              ? product.storageLocation
              : 'Keller',
          quantity: typeof product.quantity === 'number' ? product.quantity : 1,
          unit: typeof product.unit === 'string' ? product.unit : 'Stück',
          expiryDate: String(product.expiryDate),
          expiryPrecision: ['day', 'month', 'year'].includes(product.expiryPrecision as string)
            ? (product.expiryPrecision as Product['expiryPrecision'])
            : 'day',
          photo,
          minStock: typeof product.minStock === 'number' ? product.minStock : undefined,
          notes: typeof product.notes === 'string' ? product.notes : undefined,
          archived: product.archived === true || product.archived === 1,
          createdAt: typeof product.createdAt === 'string' ? product.createdAt : now,
          updatedAt: typeof product.updatedAt === 'string' ? product.updatedAt : now,
        };
        const insertedProductId = await db.products.add(next);
        if (legacyProductId !== undefined) {
          importedProductSyncIdByLegacyId.set(legacyProductId, next.syncId!);
        }
        if (typeof insertedProductId === 'number') {
          localProductIdBySyncId.set(next.syncId!, insertedProductId);
        }
        imported++;
        queuedSyncChanges.push({
          entityType: 'product',
          entitySyncId: next.syncId!,
          op: 'upsert',
          updatedAt: next.updatedAt,
          payload: toSyncProductPayload(next),
        });
      }

      // Import consumption logs
      for (const log of consumptionLogs) {
        if (!log.consumedAt) continue;
        const now = new Date().toISOString();
        const legacyLogProductId =
          typeof log.productId === 'number' ? log.productId : undefined;
        let resolvedProductSyncId =
          typeof log.productSyncId === 'string' ? log.productSyncId : undefined;
        if (!resolvedProductSyncId && legacyLogProductId !== undefined) {
          resolvedProductSyncId = importedProductSyncIdByLegacyId.get(legacyLogProductId);
        }

        let resolvedLocalProductId: number | undefined;
        if (resolvedProductSyncId) {
          const mappedLocalId = localProductIdBySyncId.get(resolvedProductSyncId);
          if (mappedLocalId !== undefined) {
            resolvedLocalProductId = mappedLocalId;
          } else {
            const existingProduct = await db.products
              .where('syncId')
              .equals(resolvedProductSyncId)
              .first();
            if (typeof existingProduct?.id === 'number') {
              resolvedLocalProductId = existingProduct.id;
              localProductIdBySyncId.set(resolvedProductSyncId, existingProduct.id);
            }
          }
        }

        const next: Omit<ConsumptionLog, 'id'> = {
          syncId: typeof log.syncId === 'string' ? log.syncId : createSyncId(),
          productId: resolvedLocalProductId,
          productSyncId: resolvedProductSyncId,
          productName: typeof log.productName === 'string' ? log.productName : 'Produkt',
          quantity: typeof log.quantity === 'number' ? log.quantity : 1,
          unit: typeof log.unit === 'string' ? log.unit : 'Stück',
          consumedAt: typeof log.consumedAt === 'string' ? log.consumedAt : now,
          updatedAt: typeof log.updatedAt === 'string' ? log.updatedAt : now,
          reason: normalizeReason(log.reason, 'sonstiges'),
        };
        await db.consumptionLogs.add(next);
        queuedSyncChanges.push({
          entityType: 'consumptionLog',
          entitySyncId: next.syncId!,
          op: 'upsert',
          updatedAt: next.updatedAt!,
          payload: toSyncLogPayload(next),
        });
      }
    }
  );

  if (shouldQueueSyncChange() && queuedSyncChanges.length > 0) {
    await db.syncQueue.bulkAdd(queuedSyncChanges);
  }

  if (skipped > 0) {
    throw new ImportResult(imported, skipped, productsNeedingImages);
  }

  return { imported, skipped, productsNeedingImages };
}

/**
 * Lädt Produktbilder im Hintergrund per Barcode von Open Food Facts.
 * Ruft für jedes Produkt lookupBarcode auf, holt das Bild und speichert es.
 * @param productIds - IDs der Produkte die ein Bild brauchen
 * @param onProgress - Callback für Fortschritt (geladen, gesamt)
 */
export async function loadImportedImages(
  productIds: number[],
  onProgress?: (loaded: number, total: number) => void
): Promise<number> {
  let loaded = 0;
  const total = productIds.length;

  for (const id of productIds) {
    try {
      const product = await db.products.get(id);
      if (!product?.barcode || product.photo) {
        onProgress?.(++loaded, total);
        continue;
      }

      const result = await lookupBarcode(product.barcode);
      if (result?.imageUrl) {
        const photo = await fetchAndCompressImage(result.imageUrl);
        if (photo) {
          await db.products.update(id, {
            photo,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Einzelnes Bild fehlgeschlagen — weiter mit dem nächsten
    }
    onProgress?.(++loaded, total);
  }

  return loaded;
}

// Custom class to pass both imported and skipped counts
export class ImportResult extends Error {
  imported: number;
  skipped: number;
  productsNeedingImages: number[];

  constructor(imported: number, skipped: number, productsNeedingImages: number[] = []) {
    const t = i18n.t.bind(i18n);
    const msg = t('dbErrors.importResult', { imported, skipped });
    super(msg);
    this.name = 'ImportResult';
    this.imported = imported;
    this.skipped = skipped;
    this.productsNeedingImages = productsNeedingImages;
  }
}
