import { describe, it, expect } from 'vitest';
import {
  computePreparedness,
  computeShoppingList,
  DEFAULT_HOUSEHOLD,
  ESSENTIAL_CATEGORIES,
} from './preparedness';
import type { Product } from '../types';

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

const futureWater = (liters: number, unit = 'Liter') =>
  makeProduct({ category: 'wasser', quantity: liters, unit });

describe('computePreparedness — energy / food range', () => {
  it('reports no energy data when no kcal is set', () => {
    const r = computePreparedness([makeProduct({ category: 'konserven' })], DEFAULT_HOUSEHOLD);
    expect(r.hasEnergyData).toBe(false);
    expect(r.foodKcal).toBe(0);
    expect(r.survivalDays).toBeNull();
  });

  it('computes food days from kcalPerUnit * quantity (BBK 2200 kcal/person/day)', () => {
    // 2 persons * 2200 = 4400 kcal/day. 10 cans * 4400 kcal = 44000 -> 10 days.
    const cans = makeProduct({ category: 'konserven', quantity: 10, unit: 'Dose', kcalPerUnit: 4400 });
    const r = computePreparedness([cans], { persons: 2, days: 10 });
    expect(r.hasEnergyData).toBe(true);
    expect(r.foodKcal).toBe(44000);
    expect(r.foodDays).toBe(10);
    expect(r.foodTargetKcal).toBe(44000);
  });

  it('excludes expired food from available energy', () => {
    const expired = makeProduct({ quantity: 10, unit: 'Dose', kcalPerUnit: 4400 });
    expired.expiryDate = new Date(Date.now() - 86_400_000).toISOString();
    const r = computePreparedness([expired], { persons: 2, days: 10 });
    expect(r.hasEnergyData).toBe(false);
    expect(r.foodKcal).toBe(0);
  });

  it('survivalDays is the minimum of water and food range', () => {
    const water = futureWater(40); // 2 persons,10 days -> 10 water days
    const food = makeProduct({ category: 'lebensmittel', quantity: 5, unit: 'Packung', kcalPerUnit: 4400 }); // 5 days food
    const r = computePreparedness([water, food], { persons: 2, days: 10 });
    expect(r.waterDays).toBe(10);
    expect(r.foodDays).toBe(5);
    expect(r.survivalDays).toBe(5);
  });
});

describe('computePreparedness — water range', () => {
  it('computes whole days of water from the BBK 2 L/person/day rule', () => {
    // 2 persons * 2 L = 4 L/day. 20 L -> 5 days.
    const result = computePreparedness([futureWater(20)], { persons: 2, days: 10 });
    expect(result.waterLiters).toBe(20);
    expect(result.waterDays).toBe(5);
    expect(result.waterTargetLiters).toBe(40);
    expect(result.waterDeficitLiters).toBe(20);
  });

  it('converts millilitres to litres', () => {
    const result = computePreparedness([futureWater(1500, 'ml')], { persons: 1, days: 1 });
    expect(result.waterLiters).toBe(1.5);
  });

  it('ignores ambiguous container units (Flasche, Dose)', () => {
    const result = computePreparedness([futureWater(10, 'Flasche')], DEFAULT_HOUSEHOLD);
    expect(result.waterLiters).toBe(0);
  });

  it('excludes expired water from the available amount', () => {
    const expired = futureWater(50);
    expired.expiryDate = new Date(Date.now() - 86_400_000).toISOString();
    const result = computePreparedness([expired], { persons: 1, days: 5 });
    expect(result.waterLiters).toBe(0);
    expect(result.waterDays).toBe(0);
  });

  it('reports no deficit once the target is reached', () => {
    const result = computePreparedness([futureWater(40)], { persons: 2, days: 10 });
    expect(result.waterDeficitLiters).toBe(0);
  });
});

describe('computePreparedness — score & coverage', () => {
  it('keeps the score within 0..100', () => {
    const empty = computePreparedness([], DEFAULT_HOUSEHOLD);
    expect(empty.score).toBeGreaterThanOrEqual(0);
    expect(empty.score).toBeLessThanOrEqual(100);
  });

  it('marks essential categories as covered only with fresh stock', () => {
    const products = [
      futureWater(40),
      makeProduct({ category: 'lebensmittel' }),
      makeProduct({ category: 'medizin' }),
    ];
    const result = computePreparedness(products, { persons: 2, days: 10 });
    const covered = result.coverage.filter((c) => c.present).map((c) => c.key);
    expect(covered).toContain('wasser');
    expect(covered).toContain('lebensmittel');
    expect(covered).toContain('medizin');
    expect(result.essentialCovered).toBe(3);
    expect(result.essentialTotal).toBe(ESSENTIAL_CATEGORIES.length);
  });

  it('rewards a fully stocked, fresh household with a high score', () => {
    const products = ESSENTIAL_CATEGORIES.map((category) =>
      category === 'wasser' ? futureWater(40) : makeProduct({ category })
    );
    const result = computePreparedness(products, { persons: 2, days: 10 });
    expect(result.score).toBeGreaterThan(80);
    expect(result.freshRatio).toBe(1);
  });
});

describe('computeShoppingList', () => {
  it('lists products below their minimum stock with the missing amount', () => {
    const product = makeProduct({ name: 'Reis', quantity: 1, minStock: 5, unit: 'kg' });
    const list = computeShoppingList([product], DEFAULT_HOUSEHOLD);
    const rice = list.find((i) => i.name === 'Reis');
    expect(rice).toBeDefined();
    expect(rice?.needed).toBe(4);
    expect(rice?.reason).toBe('lowStock');
  });

  it('adds a water item when there is a deficit', () => {
    const list = computeShoppingList([futureWater(10)], { persons: 2, days: 10 });
    const water = list.find((i) => i.reason === 'water');
    expect(water).toBeDefined();
    expect(water?.needed).toBe(30);
    expect(water?.unit).toBe('Liter');
  });

  it('returns an empty list when everything is stocked', () => {
    const products = [
      futureWater(40),
      makeProduct({ name: 'Reis', quantity: 5, minStock: 5, unit: 'kg' }),
    ];
    const list = computeShoppingList(products, { persons: 2, days: 10 });
    expect(list).toHaveLength(0);
  });
});

describe('computePreparedness — Fortschritt deckt sich mit dem Defizit', () => {
  const household = { persons: 2, days: 10 }; // Ziel 40 L

  it('meldet den Wasser-Fortschritt in Litern, nicht in ganzen Tagen', () => {
    // 39 von 40 L: knapp unter Ziel. Ganze Tage (floor(39/4) = 9) wuerden
    // 90 % anzeigen, obwohl nur 1 L fehlt — Balken und Defizit widersprechen sich.
    const result = computePreparedness([futureWater(39)], household);
    expect(result.waterDeficitLiters).toBe(1);
    expect(result.waterProgress).toBeCloseTo(0.975, 3);
  });

  it('deckelt den Fortschritt bei vollem Vorrat auf 1', () => {
    const result = computePreparedness([futureWater(80)], household);
    expect(result.waterProgress).toBe(1);
    expect(result.waterDeficitLiters).toBe(0);
  });

  it('meldet den Ernaehrungs-Fortschritt in kcal statt in ganzen Tagen', () => {
    // Ziel 44.000 kcal; 43.000 kcal = 97,7 %, ganze Tage waeren 9/10 = 90 %.
    const result = computePreparedness(
      [makeProduct({ category: 'lebensmittel', quantity: 1, kcalPerUnit: 43_000 })],
      household
    );
    expect(result.foodProgress).toBeCloseTo(43_000 / 44_000, 3);
  });
});

describe('computePreparedness — nicht zaehlbare Wassermengen', () => {
  it('zaehlt Wasser in Flaschen nicht mit, meldet es aber getrennt', () => {
    const result = computePreparedness(
      [futureWater(12, 'Flasche'), futureWater(4, 'Liter')],
      DEFAULT_HOUSEHOLD
    );
    expect(result.waterLiters).toBe(4);
    expect(result.waterUncountedCount).toBe(1);
  });

  it('meldet keine ungezaehlten Mengen, wenn alle Einheiten eindeutig sind', () => {
    const result = computePreparedness(
      [futureWater(4, 'Liter'), futureWater(500, 'ml')],
      DEFAULT_HOUSEHOLD
    );
    expect(result.waterUncountedCount).toBe(0);
    expect(result.waterLiters).toBe(4.5);
  });

  it('zaehlt abgelaufenes Flaschenwasser nicht als ungezaehlt', () => {
    const result = computePreparedness(
      [futureWater(12, 'Flasche'), makeProduct({
        category: 'wasser', unit: 'Flasche', quantity: 6,
        expiryDate: new Date(Date.now() - 86_400_000).toISOString(),
      })],
      DEFAULT_HOUSEHOLD
    );
    expect(result.waterUncountedCount).toBe(1);
  });
});


describe('computePreparedness — leerer Vorrat', () => {
  it('vergibt ohne jeden Vorrat 0 Punkte', () => {
    const result = computePreparedness([], DEFAULT_HOUSEHOLD);
    expect(result.score).toBe(0);
    expect(result.freshRatio).toBe(0);
  });

  it('vergibt auch bei ausschliesslich archiviertem Vorrat 0 Punkte', () => {
    const result = computePreparedness([makeProduct({ archived: true })], DEFAULT_HOUSEHOLD);
    expect(result.score).toBe(0);
  });

  it('zaehlt einen vollstaendig abgelaufenen Vorrat als 0 Frische', () => {
    const expired = makeProduct({ expiryDate: new Date(Date.now() - 86_400_000).toISOString() });
    expect(computePreparedness([expired], DEFAULT_HOUSEHOLD).freshRatio).toBe(0);
  });
});
