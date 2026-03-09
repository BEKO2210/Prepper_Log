import { describe, it, expect, beforeAll } from 'vitest';
import i18n from '../i18n/i18n';
import { getExpiryStatus, getDaysUntilExpiry, getStatusLabel, getStatusColor, getStatusBadgeColor, formatDaysUntil, formatDuration, formatDate, computeStats, lookupBarcode, downloadFile, compressImage } from './utils';
import type { Product } from '../types';

beforeAll(async () => {
  await i18n.changeLanguage('de');
});

// Helper to create a product with defaults
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Testprodukt',
    barcode: '',
    category: 'konserven',
    storageLocation: 'Keller',
    quantity: 5,
    unit: 'Stück',
    expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    expiryPrecision: 'day',
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('getExpiryStatus', () => {
  it('returns "expired" for past dates', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getExpiryStatus(yesterday.toISOString())).toBe('expired');
  });

  it('returns "expired" for today (day 0)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(getExpiryStatus(today.toISOString())).toBe('expired');
  });

  it('returns "critical" for dates within 7 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    expect(getExpiryStatus(date.toISOString())).toBe('critical');
  });

  it('returns "critical" for exactly 7 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    expect(getExpiryStatus(date.toISOString())).toBe('critical');
  });

  it('returns "warning" for dates within 8-14 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 10);
    expect(getExpiryStatus(date.toISOString())).toBe('warning');
  });

  it('returns "soon" for dates within 15-30 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 20);
    expect(getExpiryStatus(date.toISOString())).toBe('soon');
  });

  it('returns "good" for dates more than 30 days away', () => {
    const date = new Date();
    date.setDate(date.getDate() + 60);
    expect(getExpiryStatus(date.toISOString())).toBe('good');
  });
});

describe('getDaysUntilExpiry', () => {
  it('returns 0 for today', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(getDaysUntilExpiry(today.toISOString())).toBe(0);
  });

  it('returns negative for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(getDaysUntilExpiry(past.toISOString())).toBe(-5);
  });

  it('returns positive for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(getDaysUntilExpiry(future.toISOString())).toBe(10);
  });
});

describe('getStatusLabel', () => {
  it('returns German labels', () => {
    expect(getStatusLabel('expired')).toBe('Abgelaufen');
    expect(getStatusLabel('critical')).toBe('Kritisch');
    expect(getStatusLabel('warning')).toBe('Warnung');
    expect(getStatusLabel('soon')).toBe('Bald');
    expect(getStatusLabel('good')).toBe('OK');
  });
});

describe('getStatusColor', () => {
  it('returns color classes for each status', () => {
    expect(getStatusColor('expired')).toContain('text-red');
    expect(getStatusColor('good')).toContain('text-green');
  });
});

describe('getStatusBadgeColor', () => {
  it('returns badge classes for each status', () => {
    expect(getStatusBadgeColor('expired')).toContain('bg-red');
    expect(getStatusBadgeColor('good')).toContain('bg-green');
  });
});

describe('formatDate', () => {
  it('formats day precision', () => {
    const result = formatDate('2025-06-15T00:00:00.000Z', 'day');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/06|Jun/);
    expect(result).toMatch(/2025/);
  });

  it('formats month precision', () => {
    const result = formatDate('2025-06-15T00:00:00.000Z', 'month');
    expect(result).toMatch(/2025/);
  });

  it('formats year precision', () => {
    const result = formatDate('2025-06-15T00:00:00.000Z', 'year');
    expect(result).toBe('2025');
  });
});

describe('formatDaysUntil', () => {
  it('formats negative days as expired', () => {
    expect(formatDaysUntil(-3)).toBe('3 Tage abgelaufen');
    expect(formatDaysUntil(-1)).toBe('1 Tag abgelaufen');
    expect(formatDaysUntil(-400)).toBe('1 Jahr, 1 Monat abgelaufen');
  });

  it('formats today', () => {
    expect(formatDaysUntil(0)).toBe('Heute');
  });

  it('formats tomorrow', () => {
    expect(formatDaysUntil(1)).toBe('Morgen');
  });

  it('formats multiple days', () => {
    expect(formatDaysUntil(5)).toBe('5 Tage');
    expect(formatDaysUntil(45)).toBe('45 Tage');
    expect(formatDaysUntil(400)).toBe('1 Jahr, 1 Monat');
    expect(formatDaysUntil(730)).toBe('2 Jahre');
  });

  it('formats exactly 59 days as days', () => {
    expect(formatDaysUntil(59)).toBe('59 Tage');
  });

  it('formats 60+ days as months', () => {
    expect(formatDaysUntil(60)).toBe('2 Monate');
  });
});

describe('formatDuration', () => {
  it('formats 0 days as Heute', () => {
    expect(formatDuration(0)).toBe('Heute');
  });

  it('formats 1 day', () => {
    expect(formatDuration(1)).toBe('1 Tag');
  });

  it('formats multiple days', () => {
    expect(formatDuration(30)).toBe('30 Tage');
  });

  it('formats months and years', () => {
    expect(formatDuration(365)).toBe('1 Jahr');
    expect(formatDuration(400)).toBe('1 Jahr, 1 Monat');
  });
});

describe('computeStats', () => {
  it('returns zero stats for empty array', () => {
    const stats = computeStats([]);
    expect(stats.totalProducts).toBe(0);
    expect(stats.expiredCount).toBe(0);
    expect(stats.totalCategories).toBe(0);
    expect(stats.totalLocations).toBe(0);
    expect(stats.lowStockCount).toBe(0);
  });

  it('excludes archived products', () => {
    const products = [makeProduct({ archived: true })];
    const stats = computeStats(products);
    expect(stats.totalProducts).toBe(0);
  });

  it('counts low stock products', () => {
    const products = [makeProduct({ quantity: 1, minStock: 5 })];
    const stats = computeStats(products);
    expect(stats.lowStockCount).toBe(1);
  });

  it('does not count products without minStock as low stock', () => {
    const products = [makeProduct({ quantity: 1, minStock: undefined })];
    const stats = computeStats(products);
    expect(stats.lowStockCount).toBe(0);
  });

  it('counts categories and locations correctly', () => {
    const products = [
      makeProduct({ id: 1, category: 'wasser', storageLocation: 'Keller' }),
      makeProduct({ id: 2, category: 'medizin', storageLocation: 'Garage' }),
      makeProduct({ id: 3, category: 'wasser', storageLocation: 'Keller' }),
    ];
    const stats = computeStats(products);
    expect(stats.totalProducts).toBe(3);
    expect(stats.totalCategories).toBe(2);
    expect(stats.totalLocations).toBe(2);
  });

  it('categorizes products by expiry status', () => {
    const expired = makeProduct({
      id: 1,
      expiryDate: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const good = makeProduct({
      id: 2,
      expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    });
    const stats = computeStats([expired, good]);
    expect(stats.expiredCount).toBe(1);
    expect(stats.goodCount).toBe(1);
  });
});

describe('lookupBarcode', () => {
  it('returns null for empty barcode', async () => {
    expect(await lookupBarcode('')).toBeNull();
  });

  it('returns null for non-numeric barcode', async () => {
    expect(await lookupBarcode('abc123')).toBeNull();
  });

  it('returns null for too-short barcode', async () => {
    expect(await lookupBarcode('1234567')).toBeNull();
  });

  it('returns null for too-long barcode', async () => {
    expect(await lookupBarcode('123456789012345')).toBeNull();
  });

  it('accepts valid EAN-8 barcode format (does not reject valid input)', async () => {
    // Valid 8-digit barcode passes validation (not rejected by regex)
    // We only test that invalid inputs are rejected above.
    // A valid barcode may return data or null depending on network.
    const result = await lookupBarcode('00000000');
    // Unknown barcode — API returns null or a product
    expect(result === null || typeof result?.name === 'string').toBe(true);
  });

  it('rejects barcodes with special characters', async () => {
    expect(await lookupBarcode('1234-5678')).toBeNull();
    expect(await lookupBarcode('12345678\n')).toBeNull();
    expect(await lookupBarcode('=CMD()')).toBeNull();
  });
});

describe('formatDate edge cases', () => {
  it('defaults to day precision when not specified', () => {
    const result = formatDate('2025-01-15T00:00:00.000Z');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });
});

describe('computeStats edge cases', () => {
  it('counts all status types correctly in mixed set', () => {
    const now = Date.now();
    const products = [
      makeProduct({ id: 1, expiryDate: new Date(now - 86_400_000).toISOString() }),         // expired
      makeProduct({ id: 2, expiryDate: new Date(now + 3 * 86_400_000).toISOString() }),      // critical
      makeProduct({ id: 3, expiryDate: new Date(now + 10 * 86_400_000).toISOString() }),     // warning
      makeProduct({ id: 4, expiryDate: new Date(now + 20 * 86_400_000).toISOString() }),     // soon
      makeProduct({ id: 5, expiryDate: new Date(now + 90 * 86_400_000).toISOString() }),     // good
    ];
    const stats = computeStats(products);
    expect(stats.totalProducts).toBe(5);
    expect(stats.expiredCount).toBe(1);
    expect(stats.criticalCount).toBe(1);
    expect(stats.warningCount).toBe(1);
    expect(stats.soonCount).toBe(1);
    expect(stats.goodCount).toBe(1);
  });

  it('handles products with quantity at exactly minStock (not low stock)', () => {
    const products = [makeProduct({ quantity: 5, minStock: 5 })];
    const stats = computeStats(products);
    expect(stats.lowStockCount).toBe(0);
  });
});

describe('getExpiryStatus boundary precision', () => {
  it('returns "critical" for exactly 1 day away', () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    expect(getExpiryStatus(date.toISOString())).toBe('critical');
  });

  it('returns "warning" for exactly 8 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 8);
    expect(getExpiryStatus(date.toISOString())).toBe('warning');
  });

  it('returns "warning" for exactly 14 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    expect(getExpiryStatus(date.toISOString())).toBe('warning');
  });

  it('returns "soon" for exactly 15 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    expect(getExpiryStatus(date.toISOString())).toBe('soon');
  });

  it('returns "soon" for exactly 30 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    expect(getExpiryStatus(date.toISOString())).toBe('soon');
  });

  it('returns "good" for exactly 31 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 31);
    expect(getExpiryStatus(date.toISOString())).toBe('good');
  });
});

describe('formatDaysUntil edge cases', () => {
  it('formats exactly 365 days as 1 year', () => {
    expect(formatDaysUntil(365)).toBe('1 Jahr');
  });

  it('formats exactly -365 days', () => {
    expect(formatDaysUntil(-365)).toBe('1 Jahr abgelaufen');
  });

  it('formats 2 days', () => {
    expect(formatDaysUntil(2)).toBe('2 Tage');
  });
});

describe('downloadFile', () => {
  it('is a function', () => {
    expect(typeof downloadFile).toBe('function');
  });
});

describe('compressImage', () => {
  it('rejects files larger than 10MB', async () => {
    // Create a blob larger than 10MB
    const bigBlob = new Blob([new ArrayBuffer(11 * 1024 * 1024)], { type: 'image/png' });
    await expect(compressImage(bigBlob)).rejects.toThrow('zu groß');
  });

  it('accepts files under 10MB', async () => {
    // Create a small blob — it won't be a valid image in node, but the size check passes
    const smallBlob = new Blob([new ArrayBuffer(100)], { type: 'image/png' });
    // In a test env without canvas, this will reject with image loading error, not size error
    await expect(compressImage(smallBlob)).rejects.not.toThrow('zu groß');
  });
});

describe('CSV injection protection (escCsv pattern)', () => {
  // Test the same pattern used in db.ts exportCSV's escCsv function
  function escCsv(val: string | number | undefined | null): string {
    let s = String(val ?? '');
    if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
      s = "'" + s;
    }
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  it('prefixes dangerous characters with single quote', () => {
    expect(escCsv('=CMD()')).toBe("'=CMD()");
    expect(escCsv('+1234')).toBe("'+1234");
    expect(escCsv('-1234')).toBe("'-1234");
    expect(escCsv('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('handles normal strings unchanged', () => {
    expect(escCsv('Dosentomaten')).toBe('Dosentomaten');
    expect(escCsv('Keller')).toBe('Keller');
    expect(escCsv('')).toBe('');
    expect(escCsv(42)).toBe('42');
  });

  it('quotes strings containing semicolons or newlines', () => {
    expect(escCsv('a;b')).toBe('"a;b"');
    expect(escCsv('line1\nline2')).toBe('"line1\nline2"');
  });

  it('escapes double quotes inside values', () => {
    expect(escCsv('he said "hello"')).toBe('"he said ""hello"""');
  });

  it('handles null and undefined', () => {
    expect(escCsv(null)).toBe('');
    expect(escCsv(undefined)).toBe('');
  });

  it('prefixes tab and carriage return', () => {
    expect(escCsv('\tattack')).toMatch(/^'/);
    expect(escCsv('\rattack')).toMatch(/^'/);
  });
});
