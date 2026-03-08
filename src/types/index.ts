export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'soon' | 'good';

export interface Product {
  id?: number;
  name: string;
  barcode?: string;
  category: ProductCategory;
  storageLocation: string;
  quantity: number;
  unit: string;
  expiryDate: string; // ISO date string
  expiryPrecision: 'day' | 'month' | 'year';
  photo?: string; // Base64 data URL
  minStock?: number;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductCategory =
  | 'konserven'
  | 'wasser'
  | 'medizin'
  | 'werkzeug'
  | 'hygiene'
  | 'lebensmittel'
  | 'getranke'
  | 'elektronik'
  | 'kleidung'
  | 'sonstiges';

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  konserven: 'Konserven',
  wasser: 'Wasser',
  medizin: 'Medizin',
  werkzeug: 'Werkzeug',
  hygiene: 'Hygiene',
  lebensmittel: 'Lebensmittel',
  getranke: 'Getränke',
  elektronik: 'Elektronik',
  kleidung: 'Kleidung',
  sonstiges: 'Sonstiges',
};

export const CATEGORY_ICONS: Record<ProductCategory, string> = {
  konserven: 'Package',
  wasser: 'Droplets',
  medizin: 'Pill',
  werkzeug: 'Wrench',
  hygiene: 'SprayCan',
  lebensmittel: 'Apple',
  getranke: 'GlassWater',
  elektronik: 'Zap',
  kleidung: 'Shirt',
  sonstiges: 'Box',
};

export const DEFAULT_UNITS = [
  'Stück',
  'Liter',
  'kg',
  'g',
  'ml',
  'Packung',
  'Dose',
  'Flasche',
  'Karton',
  'Palette',
];

export interface StorageLocation {
  id?: number;
  name: string;
  icon?: string;
  createdAt: string;
}

export const DEFAULT_LOCATIONS = [
  'Keller',
  'Garage',
  'Küche',
  'Dachboden',
  'Vorratsraum',
  'Bunker',
  'Auto',
  'Gartenhaus',
];

export interface ConsumptionLog {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  unit: string;
  consumedAt: string;
  reason: 'verbraucht' | 'abgelaufen' | 'beschadigt' | 'sonstiges';
}

export interface NotificationSchedule {
  id?: number;
  productId: number;
  productName: string;
  expiryDate: string;
  notifyAt: string;
  daysBefore: number;
  sent: boolean;
}

export interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  quantity?: string;
}

export interface DashboardStats {
  totalProducts: number;
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
  soonCount: number;
  goodCount: number;
  lowStockCount: number;
  totalCategories: number;
  totalLocations: number;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  products: Product[];
  storageLocations: StorageLocation[];
  consumptionLogs: ConsumptionLog[];
}
