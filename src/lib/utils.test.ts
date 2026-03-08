import { describe, it, expect } from 'vitest';
import { getExpiryStatus, getDaysUntilExpiry, getStatusLabel, formatDaysUntil, computeStats } from './utils';
import type { Product } from '../types';

describe('getExpiryStatus', () => {
  it('returns "expired" for past dates', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getExpiryStatus(yesterday.toISOString())).toBe('expired');
  });

  it('returns "critical" for dates within 7 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
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

describe('formatDaysUntil', () => {
  it('formats negative days as expired', () => {
    expect(formatDaysUntil(-3)).toBe('3 Tage abgelaufen');
  });

  it('formats today', () => {
    expect(formatDaysUntil(0)).toBe('Heute');
  });

  it('formats tomorrow', () => {
    expect(formatDaysUntil(1)).toBe('Morgen');
  });

  it('formats multiple days', () => {
    expect(formatDaysUntil(5)).toBe('5 Tage');
  });
});

describe('computeStats', () => {
  it('returns zero stats for empty array', () => {
    const stats = computeStats([]);
    expect(stats.totalProducts).toBe(0);
    expect(stats.expiredCount).toBe(0);
    expect(stats.totalCategories).toBe(0);
  });

  it('excludes archived products', () => {
    const products: Product[] = [
      {
        id: 1,
        name: 'Test',
        barcode: '',
        category: 'konserven',
        storageLocation: 'keller',
        quantity: 5,
        unit: 'Stück',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        archived: true,
        expiryPrecision: 'day',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const stats = computeStats(products);
    expect(stats.totalProducts).toBe(0);
  });

  it('counts low stock products', () => {
    const products: Product[] = [
      {
        id: 1,
        name: 'Low Stock',
        barcode: '',
        category: 'wasser',
        storageLocation: 'keller',
        quantity: 1,
        unit: 'Liter',
        minStock: 5,
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        archived: false,
        expiryPrecision: 'day',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const stats = computeStats(products);
    expect(stats.lowStockCount).toBe(1);
  });
});
