import type { Product, ProductCategory } from '../types';
import { getExpiryStatus } from './utils';

export interface HouseholdConfig {
  persons: number;
  days: number;
}

export const DEFAULT_HOUSEHOLD: HouseholdConfig = { persons: 2, days: 10 };

// BBK-Empfehlung: 2 Liter Trinkwasser pro Person und Tag.
export const WATER_LITERS_PER_PERSON_DAY = 2;

// BBK-Empfehlung: ca. 2200 kcal pro Person und Tag (Notvorrat-Energiebedarf).
export const KCAL_PER_PERSON_DAY = 2200;

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
  /** Zieldeckung 0..1, aus Litern — deckt sich mit dem angezeigten Defizit. */
  waterProgress: number;
  /** Frische Wasserprodukte, deren Einheit keine Literzahl hergibt (z. B. Flasche). */
  waterUncountedCount: number;
  coverage: CategoryCoverage[];
  essentialCovered: number;
  essentialTotal: number;
  freshRatio: number; // Anteil aktiver Produkte, die nicht abgelaufen sind
  targetDays: number;
  // Energie / Ernährungs-Reichweite (nur aussagekräftig, wenn kcal-Daten gepflegt sind)
  hasEnergyData: boolean;
  foodKcal: number; // verfügbare, nicht abgelaufene kcal
  foodTargetKcal: number;
  foodDays: number; // ganze Tage Ernährung für den Haushalt
  /** Zieldeckung 0..1, aus kcal. */
  foodProgress: number;
  survivalDays: number | null; // min(Wasser, Ernährung) — null ohne kcal-Daten
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

  const freshWater = fresh.filter((p) => p.category === 'wasser');
  const waterLiters = round1(
    freshWater.reduce((sum, p) => sum + toLiters(p.quantity, p.unit), 0)
  );
  // Gebinde ohne Literangabe (Flasche, Dose, Karton …) fliessen nicht in die
  // Rechnung ein. Ohne diesen Zaehler steht in der App "0 Tage Wasser",
  // obwohl der Keller voll ist — der Hinweis erklaert die Luecke.
  const waterUncountedCount = freshWater.filter((p) => toLiters(p.quantity, p.unit) === 0).length;

  const dailyNeed = persons * WATER_LITERS_PER_PERSON_DAY;
  const waterTargetLiters = dailyNeed * targetDays;
  const waterDays = Math.floor(waterLiters / dailyNeed);
  const waterDeficitLiters = round1(Math.max(0, waterTargetLiters - waterLiters));
  const waterProgress = waterTargetLiters > 0 ? clamp01(waterLiters / waterTargetLiters) : 1;

  const coverage: CategoryCoverage[] = ESSENTIAL_CATEGORIES.map((key) => ({
    key,
    present: fresh.some((p) => p.category === key),
  }));
  const essentialCovered = coverage.filter((c) => c.present).length;
  const essentialTotal = ESSENTIAL_CATEGORIES.length;

  const freshRatio = active.length > 0 ? fresh.length / active.length : 1;

  // Energy / food range — counts any fresh product that has a kcal value set.
  const foodKcal = Math.round(
    fresh
      .filter((p) => typeof p.kcalPerUnit === 'number' && p.kcalPerUnit > 0)
      .reduce((sum, p) => sum + p.kcalPerUnit! * p.quantity, 0)
  );
  const hasEnergyData = foodKcal > 0;
  const dailyKcalNeed = persons * KCAL_PER_PERSON_DAY;
  const foodTargetKcal = dailyKcalNeed * targetDays;
  const foodDays = Math.floor(foodKcal / dailyKcalNeed);
  const foodProgress = foodTargetKcal > 0 ? clamp01(foodKcal / foodTargetKcal) : 1;
  const survivalDays = hasEnergyData ? Math.min(waterDays, foodDays) : null;

  const waterScore = waterProgress;
  const categoryScore = essentialCovered / essentialTotal;
  const freshScore = freshRatio;
  const foodScore = foodProgress;

  // With real kcal data, energy replaces the coarse category-coverage signal.
  const score = Math.round(
    100 *
      (hasEnergyData
        ? 0.4 * waterScore + 0.4 * foodScore + 0.2 * freshScore
        : 0.45 * waterScore + 0.35 * categoryScore + 0.2 * freshScore)
  );

  return {
    score,
    waterLiters,
    waterDays,
    waterTargetLiters,
    waterDeficitLiters,
    waterProgress,
    waterUncountedCount,
    coverage,
    essentialCovered,
    essentialTotal,
    freshRatio,
    targetDays,
    hasEnergyData,
    foodKcal,
    foodTargetKcal,
    foodDays,
    foodProgress,
    survivalDays,
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
