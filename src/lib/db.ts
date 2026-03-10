import Dexie, { type Table } from 'dexie';
import { version as appVersion } from '../../package.json';
import i18n from '../i18n/i18n';
import { getLocale } from './utils';
import type {
  Product,
  StorageLocation,
  ConsumptionLog,
  NotificationSchedule,
} from '../types';

export class PrepTrackDB extends Dexie {
  products!: Table<Product, number>;
  storageLocations!: Table<StorageLocation, number>;
  consumptionLogs!: Table<ConsumptionLog, number>;
  notificationSchedules!: Table<NotificationSchedule, number>;

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
  }
}

export const db = new PrepTrackDB();

// Seed default storage locations on first run
export async function seedDefaults(): Promise<void> {
  const count = await db.storageLocations.count();
  if (count === 0) {
    const now = new Date().toISOString();
    await db.storageLocations.bulkAdd([
      { name: 'Keller', createdAt: now },
      { name: 'Garage', createdAt: now },
      { name: 'Küche', createdAt: now },
      { name: 'Dachboden', createdAt: now },
      { name: 'Vorratsraum', createdAt: now },
      { name: 'Bunker', createdAt: now },
      { name: 'Auto', createdAt: now },
      { name: 'Gartenhaus', createdAt: now },
    ]);
  }
}

// Product CRUD
export async function addProduct(product: Omit<Product, 'id'>): Promise<number> {
  return db.products.add(product);
}

export async function updateProduct(
  id: number,
  changes: Partial<Product>
): Promise<number> {
  return db.products.update(id, {
    ...changes,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await db.transaction('rw', db.products, db.consumptionLogs, db.notificationSchedules, async () => {
    await db.products.delete(id);
    await db.consumptionLogs.where('productId').equals(id).delete();
    await db.notificationSchedules.where('productId').equals(id).delete();
  });
}

export async function archiveProduct(id: number): Promise<void> {
  await db.products.update(id, {
    archived: true,
    updatedAt: new Date().toISOString(),
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
  return db.storageLocations.add({
    name,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteStorageLocation(id: number): Promise<void> {
  await db.storageLocations.delete(id);
}

// Consumption Log
export async function logConsumption(
  log: Omit<ConsumptionLog, 'id'>
): Promise<number> {
  return db.consumptionLogs.add(log);
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
    escCsv(p.expiryPrecision === 'day' ? t('form.precisionDay') : p.expiryPrecision === 'month' ? t('form.precisionMonth') : t('form.precisionYear')),
    escCsv(p.minStock ?? ''),
    escCsv(p.notes),
    escCsv(p.archived ? t('common.yes') : t('common.no')),
    escCsv(fmtDate(p.createdAt)),
    escCsv(fmtDate(p.updatedAt)),
  ]);

  return BOM + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

export async function importData(jsonString: string): Promise<number> {
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

  let imported = 0;
  let skipped = 0;

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
          await db.storageLocations.add({
            name: loc.name,
            createdAt: (loc.createdAt as string) || new Date().toISOString(),
          });
        }
      }

      // Import products (skip duplicates based on name + expiryDate + storageLocation)
      for (const product of products) {
        if (
          !product.name ||
          typeof product.name !== 'string' ||
          !product.expiryDate ||
          typeof product.expiryDate !== 'string' ||
          isNaN(new Date(String(product.expiryDate)).getTime())
        ) {
          skipped++;
          continue;
        }

        // Check for duplicate
        const existingProducts = await db.products
          .where('name')
          .equals(product.name as string)
          .toArray();
        const isDuplicate = existingProducts.some(
          (p) =>
            p.expiryDate === product.expiryDate &&
            p.storageLocation === product.storageLocation
        );

        if (isDuplicate) {
          skipped++;
          continue;
        }

        // Clean up photo field - don't import placeholder markers
        const rawPhoto = product.photo;
        const photo = rawPhoto && rawPhoto !== '[FOTO]' && typeof rawPhoto === 'string' ? rawPhoto : undefined;
        const now = new Date().toISOString();

        // Only import known fields to prevent injection of unexpected data
        await db.products.add({
          name: String(product.name),
          barcode: typeof product.barcode === 'string' ? product.barcode : undefined,
          category: typeof product.category === 'string' ? product.category as Product['category'] : 'sonstiges',
          storageLocation: typeof product.storageLocation === 'string' ? product.storageLocation : 'Keller',
          quantity: typeof product.quantity === 'number' ? product.quantity : 1,
          unit: typeof product.unit === 'string' ? product.unit : 'Stück',
          expiryDate: String(product.expiryDate),
          expiryPrecision: ['day', 'month', 'year'].includes(product.expiryPrecision as string) ? product.expiryPrecision as Product['expiryPrecision'] : 'day',
          photo,
          minStock: typeof product.minStock === 'number' ? product.minStock : undefined,
          notes: typeof product.notes === 'string' ? product.notes : undefined,
          archived: product.archived === true || product.archived === 1,
          createdAt: typeof product.createdAt === 'string' ? product.createdAt : now,
          updatedAt: typeof product.updatedAt === 'string' ? product.updatedAt : now,
        });
        imported++;
      }

      // Import consumption logs
      for (const log of consumptionLogs) {
        if (!log.productId || !log.consumedAt) continue;
        const { id: _id, ...logData } = log;
        await db.consumptionLogs.add(logData as Omit<ConsumptionLog, 'id'>);
      }
    }
  );

  if (skipped > 0) {
    throw new ImportResult(imported, skipped);
  }

  return imported;
}

// Custom class to pass both imported and skipped counts
export class ImportResult extends Error {
  imported: number;
  skipped: number;

  constructor(imported: number, skipped: number) {
    const t = i18n.t.bind(i18n);
    const msg = t('dbErrors.importResult', { imported, skipped });
    super(msg);
    this.name = 'ImportResult';
    this.imported = imported;
    this.skipped = skipped;
  }
}
