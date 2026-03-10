import i18n from '../i18n/i18n';
import type { ExpiryStatus, Product, DashboardStats } from '../types';

export function getExpiryStatus(expiryDate: string): ExpiryStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'expired';
  if (diffDays <= 7) return 'critical';
  if (diffDays <= 14) return 'warning';
  if (diffDays <= 30) return 'soon';
  return 'good';
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getStatusColor(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'critical':
      return 'text-red-400 bg-red-400/10 border-red-400/30';
    case 'warning':
      return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
    case 'soon':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    case 'good':
      return 'text-green-400 bg-green-400/10 border-green-400/30';
  }
}

export function getStatusBadgeColor(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'bg-red-600 text-white';
    case 'critical':
      return 'bg-red-500 text-white';
    case 'warning':
      return 'bg-orange-500 text-white';
    case 'soon':
      return 'bg-yellow-500 text-black';
    case 'good':
      return 'bg-green-600 text-white';
  }
}

export function getStatusLabel(status: ExpiryStatus): string {
  return i18n.t(`status.${status}`);
}

const LOCALE_MAP: Record<string, string> = {
  de: 'de-DE',
  en: 'en-GB',
  pt: 'pt-BR',
  ar: 'ar-SA',
};

export function getLocale(): string {
  const lang = (i18n.language || 'de').split('-')[0];
  return LOCALE_MAP[lang] || 'de-DE';
}

export function formatDate(dateString: string, precision: 'day' | 'month' | 'year' = 'day'): string {
  const date = new Date(dateString);
  const locale = getLocale();
  switch (precision) {
    case 'year':
      return date.getFullYear().toString();
    case 'month':
      return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    case 'day':
      return date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
  }
}

export function formatDaysUntil(days: number): string {
  const t = i18n.t.bind(i18n);
  if (days === 0) return t('time.today');
  if (days === 1) return t('time.tomorrow');
  if (days === -1) return t('time.dayExpired');

  const abs = Math.abs(days);
  const suffix = days < 0 ? t('time.daysExpiredSuffix') : '';

  if (abs < 60) return t('time.days', { count: abs }) + suffix;

  const years = Math.floor(abs / 365);
  const remaining = abs % 365;
  const months = Math.floor(remaining / 30);
  const d = remaining % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(t('time.year', { count: years }));
  if (months > 0) parts.push(t('time.month', { count: months }));
  if (d > 0 && years === 0) parts.push(t('time.days', { count: d }));

  return parts.join(', ') + suffix;
}

export function formatDuration(totalDays: number): string {
  const t = i18n.t.bind(i18n);
  if (totalDays < 1) return t('time.today');
  if (totalDays < 60) return t('time.days', { count: totalDays });

  const years = Math.floor(totalDays / 365);
  const remaining = totalDays % 365;
  const months = Math.floor(remaining / 30);
  const d = remaining % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(t('time.year', { count: years }));
  if (months > 0) parts.push(t('time.month', { count: months }));
  if (d > 0 && years === 0) parts.push(t('time.days', { count: d }));

  return parts.join(', ');
}

export function computeStats(products: Product[]): DashboardStats {
  const active = products.filter((p) => !p.archived);

  const stats: DashboardStats = {
    totalProducts: active.length,
    expiredCount: 0,
    criticalCount: 0,
    warningCount: 0,
    soonCount: 0,
    goodCount: 0,
    lowStockCount: 0,
    totalCategories: new Set(active.map((p) => p.category)).size,
    totalLocations: new Set(active.map((p) => p.storageLocation)).size,
  };

  for (const product of active) {
    const status = getExpiryStatus(product.expiryDate);
    switch (status) {
      case 'expired':
        stats.expiredCount++;
        break;
      case 'critical':
        stats.criticalCount++;
        break;
      case 'warning':
        stats.warningCount++;
        break;
      case 'soon':
        stats.soonCount++;
        break;
      case 'good':
        stats.goodCount++;
        break;
    }

    if (product.minStock && product.quantity < product.minStock) {
      stats.lowStockCount++;
    }
  }

  return stats;
}

const MAX_INPUT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function compressImage(
  file: File | Blob,
  maxSizeKB: number = 500
): Promise<string> {
  if (file.size > MAX_INPUT_SIZE_BYTES) {
    throw new Error(i18n.t('imageErrors.tooLarge'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDim = 1024;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error(i18n.t('imageErrors.canvasError')));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        const format = supportsWebP ? 'image/webp' : 'image/jpeg';

        const maxBase64Bytes = maxSizeKB * 1024 * 1.37;
        let quality = 0.7;
        let dataUrl = canvas.toDataURL(format, quality);

        while (dataUrl.length > maxBase64Bytes && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL(format, quality);
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error(i18n.t('imageErrors.loadError')));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error(i18n.t('imageErrors.readError')));
    reader.readAsDataURL(file);
  });
}

export async function lookupBarcode(
  barcode: string
): Promise<{ name: string; category?: string; imageUrl?: string } | null> {
  if (!barcode || !/^\d{8,14}$/.test(barcode)) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,product_name_de,brands,categories,image_front_url,quantity&lc=de`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    const product = data.product;
    const rawCategory = product.categories as string | undefined;
    const firstCategory = rawCategory?.split(',')[0]?.trim() || undefined;
    return {
      name:
        product.product_name_de ||
        product.product_name ||
        product.brands ||
        i18n.t('dbErrors.unknownProduct'),
      category: firstCategory,
      imageUrl: product.image_front_url || undefined,
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
