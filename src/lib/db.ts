import Dexie, { type Table } from 'dexie';
import { version as appVersion } from '../../package.json';
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

  // BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';

  const headers = [
    'Name',
    'Barcode',
    'Kategorie',
    'Lagerort',
    'Menge',
    'Einheit',
    'MHD',
    'MHD-Genauigkeit',
    'Mindestbestand',
    'Notizen',
    'Archiviert',
    'Erstellt am',
    'Aktualisiert am',
  ];

  function escCsv(val: string | number | undefined | null): string {
    const s = String(val ?? '');
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function fmtDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const rows = products.map((p) => [
    escCsv(p.name),
    escCsv(p.barcode),
    escCsv(p.category),
    escCsv(p.storageLocation),
    p.quantity,
    escCsv(p.unit),
    fmtDate(p.expiryDate),
    escCsv(p.expiryPrecision === 'day' ? 'Tag' : p.expiryPrecision === 'month' ? 'Monat' : 'Jahr'),
    p.minStock ?? '',
    escCsv(p.notes),
    p.archived ? 'Ja' : 'Nein',
    fmtDate(p.createdAt),
    fmtDate(p.updatedAt),
  ]);

  return BOM + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

export async function exportExcelXML(): Promise<string> {
  const products = await db.products.toArray();

  function esc(val: string | number | undefined | null): string {
    return String(val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const headers = ['Name', 'Barcode', 'Kategorie', 'Lagerort', 'Menge', 'Einheit', 'MHD', 'Mindestbestand', 'Notizen', 'Status', 'Erstellt'];
  const colWidths = [180, 120, 100, 120, 60, 60, 90, 90, 200, 80, 90];

  let rows = '';
  // Header row
  rows += '<Row ss:StyleID="header">';
  for (const h of headers) {
    rows += `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`;
  }
  rows += '</Row>\n';

  // Data rows
  for (const p of products) {
    const isArchived = p.archived;
    const style = isArchived ? 'archived' : 'data';
    rows += `<Row ss:StyleID="${style}">`;
    rows += `<Cell><Data ss:Type="String">${esc(p.name)}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${esc(p.barcode)}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${esc(p.category)}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${esc(p.storageLocation)}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="Number">${p.quantity}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${esc(p.unit)}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${fmtDate(p.expiryDate)}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="Number">${p.minStock ?? 0}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${esc(p.notes)}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${isArchived ? 'Archiviert' : 'Aktiv'}</Data></Cell>`;
    rows += `<Cell><Data ss:Type="String">${fmtDate(p.createdAt)}</Data></Cell>`;
    rows += '</Row>\n';
  }

  const colDefs = colWidths.map((w) => `<Column ss:Width="${w}"/>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2E7D32" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1B5E20"/>
      </Borders>
    </Style>
    <Style ss:ID="data">
      <Font ss:FontName="Calibri" ss:Size="11"/>
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
      </Borders>
    </Style>
    <Style ss:ID="archived">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#999999"/>
      <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="PrepTrack Vorraete">
    <Table>
      ${colDefs}
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;
}

export async function importData(jsonString: string): Promise<number> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('Ungültige JSON-Datei. Bitte eine gültige Backup-Datei wählen.');
  }

  if (!data.products || !Array.isArray(data.products)) {
    throw new Error('Ungültiges Importformat: Keine Produkte gefunden.');
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
        if (!product.name || !product.expiryDate) {
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

        const { id: _id, photo: rawPhoto, ...rest } = product;

        // Clean up photo field - don't import placeholder markers
        const photo = rawPhoto && rawPhoto !== '[FOTO]' ? rawPhoto : undefined;

        // Ensure archived is boolean
        const archived = rest.archived === true || rest.archived === 1;

        await db.products.add({
          ...rest,
          photo,
          archived,
          createdAt: (rest.createdAt as string) || new Date().toISOString(),
          updatedAt: (rest.updatedAt as string) || new Date().toISOString(),
        } as Omit<Product, 'id'>);
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
export class ImportResult {
  imported: number;
  skipped: number;
  message: string;

  constructor(imported: number, skipped: number) {
    this.imported = imported;
    this.skipped = skipped;
    this.message = `${imported} Produkte importiert, ${skipped} übersprungen (Duplikate oder ungültig).`;
  }
}
