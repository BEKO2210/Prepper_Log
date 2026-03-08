import Dexie, { type Table } from 'dexie';
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
  await db.products.delete(id);
  await db.consumptionLogs.where('productId').equals(id).delete();
  await db.notificationSchedules.where('productId').equals(id).delete();
}

export async function archiveProduct(id: number): Promise<void> {
  await db.products.update(id, {
    archived: true,
    updatedAt: new Date().toISOString(),
  });
}

export async function getActiveProducts(): Promise<Product[]> {
  return db.products.where('archived').equals(0).toArray();
}

export async function getArchivedProducts(): Promise<Product[]> {
  return db.products.where('archived').equals(1).toArray();
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

  const data = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    products,
    storageLocations,
    consumptionLogs,
  };

  return JSON.stringify(data, null, 2);
}

export async function exportCSV(): Promise<string> {
  const products = await db.products.toArray();
  const headers = [
    'Name',
    'Barcode',
    'Kategorie',
    'Lagerort',
    'Menge',
    'Einheit',
    'MHD',
    'Mindestbestand',
    'Archiviert',
    'Erstellt',
  ];

  const rows = products.map((p) => [
    `"${p.name}"`,
    p.barcode || '',
    p.category,
    `"${p.storageLocation}"`,
    p.quantity,
    p.unit,
    p.expiryDate,
    p.minStock ?? '',
    p.archived ? 'Ja' : 'Nein',
    p.createdAt,
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function importData(jsonString: string): Promise<number> {
  const data = JSON.parse(jsonString);

  if (!data.version || !data.products) {
    throw new Error('Ungültiges Importformat');
  }

  let imported = 0;

  await db.transaction(
    'rw',
    db.products,
    db.storageLocations,
    db.consumptionLogs,
    async () => {
      if (data.storageLocations?.length) {
        for (const loc of data.storageLocations) {
          const existing = await db.storageLocations
            .where('name')
            .equals(loc.name)
            .first();
          if (!existing) {
            await db.storageLocations.add({
              name: loc.name,
              createdAt: loc.createdAt || new Date().toISOString(),
            });
          }
        }
      }

      if (data.products?.length) {
        for (const product of data.products) {
          const { id: _id, ...productData } = product;
          await db.products.add(productData);
          imported++;
        }
      }

      if (data.consumptionLogs?.length) {
        for (const log of data.consumptionLogs) {
          const { id: _id, ...logData } = log;
          await db.consumptionLogs.add(logData);
        }
      }
    }
  );

  return imported;
}
