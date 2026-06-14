import type { Product, ProductCategory } from '../types';
import { getExpiryStatus } from './utils';

export interface HouseholdConfig {
  persons: number;
  days: number;
}

export const DEFAULT_HOUSEHOLD: HouseholdConfig = { persons: 2, days: 10 };

// BBK-Empfehlung: 2 Liter Trinkwasser pro Person und Tag.
export const WATER_LITERS_PER_PERSON_DAY = 2;

// Grundkategorien für die Basis-Abdeckung (BBK-Notvorrat-Logik).
export const ESSENTIAL_CATEGORIES: ProductCategory[] = [
  'wasser',
  'lebensmittel',
  'konserven',
  'medizin',
  'hygiene',
];

export interface CategoryCoverage {
  key: ProductCategory;
  present: boolean;
}

export interface PreparednessResult {
  score: number; // 0..100
  waterLiters: number; // verfügbare, nicht abgelaufene Liter
  waterDays: number; // ganze Tage Wasser für den Haushalt
  waterTargetLiters: number;
  waterDeficitLiters: number;
  coverage: CategoryCoverage[];
  essentialCovered: number;
  essentialTotal: number;
  freshRatio: number; // Anteil aktiver Produkte, die nicht abgelaufen sind
  targetDays: number;
}

export type ShoppingReason = 'lowStock' | 'water';

export interface ShoppingItem {
  name: string;
  needed: number;
  unit: string;
  category: ProductCategory;
  reason: ShoppingReason;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Wandelt eine Menge in Liter um — nur eindeutige Einheiten zählen. */
function toLiters(quantity: number, unit: string): number {
  switch (unit) {
    case 'Liter':
      return quantity;
    case 'ml':
      return quantity / 1000;
    default:
      return 0; // Unbekannte Gebindegröße — nicht zählbar
  }
}

function isExpired(product: Product): boolean {
  return getExpiryStatus(product.expiryDate) === 'expired';
}

/** Berechnet Wasser-Reichweite, Basis-Abdeckung und Krisenfestigkeit-Score. */
export function computePreparedness(
  products: Product[],
  household: HouseholdConfig
): PreparednessResult {
  const persons = Math.max(1, Math.round(household.persons));
  const targetDays = Math.max(1, Math.round(household.days));

  const active = products.filter((p) => !p.archived);
  const fresh = active.filter((p) => !isExpired(p));

  const waterLiters = round1(
    fresh
      .filter((p) => p.category === 'wasser')
      .reduce((sum, p) => sum + toLiters(p.quantity, p.unit), 0)
  );

  const dailyNeed = persons * WATER_LITERS_PER_PERSON_DAY;
  const waterTargetLiters = dailyNeed * targetDays;
  const waterDays = Math.floor(waterLiters / dailyNeed);
  const waterDeficitLiters = round1(Math.max(0, waterTargetLiters - waterLiters));

  const coverage: CategoryCoverage[] = ESSENTIAL_CATEGORIES.map((key) => ({
    key,
    present: fresh.some((p) => p.category === key),
  }));
  const essentialCovered = coverage.filter((c) => c.present).length;
  const essentialTotal = ESSENTIAL_CATEGORIES.length;

  const freshRatio = active.length > 0 ? fresh.length / active.length : 1;

  const waterScore = clamp01(waterDays / targetDays);
  const categoryScore = essentialCovered / essentialTotal;
  const freshScore = freshRatio;

  const score = Math.round(
    100 * (0.45 * waterScore + 0.35 * categoryScore + 0.2 * freshScore)
  );

  return {
    score,
    waterLiters,
    waterDays,
    waterTargetLiters,
    waterDeficitLiters,
    coverage,
    essentialCovered,
    essentialTotal,
    freshRatio,
    targetDays,
  };
}

/** Erzeugt eine Einkaufsliste aus Unterbestand und Wasser-Defizit. */
export function computeShoppingList(
  products: Product[],
  household: HouseholdConfig
): ShoppingItem[] {
  const active = products.filter((p) => !p.archived);

  const lowStock: ShoppingItem[] = active
    .filter((p) => typeof p.minStock === 'number' && p.minStock > 0 && p.quantity < p.minStock)
    .map((p) => ({
      name: p.name,
      needed: round1(p.minStock! - p.quantity),
      unit: p.unit,
      category: p.category,
      reason: 'lowStock' as const,
    }));

  const result = computePreparedness(products, household);
  const items = [...lowStock];

  if (result.waterDeficitLiters > 0) {
    items.push({
      name: 'Wasser',
      needed: Math.ceil(result.waterDeficitLiters),
      unit: 'Liter',
      category: 'wasser',
      reason: 'water',
    });
  }

  return items;
}
