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
  switch (status) {
    case 'expired':
      return 'Abgelaufen';
    case 'critical':
      return 'Kritisch';
    case 'warning':
      return 'Warnung';
    case 'soon':
      return 'Bald';
    case 'good':
      return 'OK';
  }
}

export function formatDate(dateString: string, precision: 'day' | 'month' | 'year' = 'day'): string {
  const date = new Date(dateString);
  switch (precision) {
    case 'year':
      return date.getFullYear().toString();
    case 'month':
      return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    case 'day':
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
  }
}

export function formatDaysUntil(days: number): string {
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days === -1) return '1 Tag abgelaufen';

  const abs = Math.abs(days);
  const suffix = days < 0 ? ' abgelaufen' : '';

  if (abs < 60) return `${abs} Tage${suffix}`;

  const years = Math.floor(abs / 365);
  const remaining = abs % 365;
  const months = Math.floor(remaining / 30);
  const d = remaining % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Jahr' : 'Jahre'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'Monat' : 'Monate'}`);
  if (d > 0 && years === 0) parts.push(`${d} ${d === 1 ? 'Tag' : 'Tage'}`);

  return parts.join(', ') + suffix;
}

export function formatDuration(totalDays: number): string {
  if (totalDays < 1) return 'Heute';
  if (totalDays < 60) return `${totalDays} ${totalDays === 1 ? 'Tag' : 'Tage'}`;

  const years = Math.floor(totalDays / 365);
  const remaining = totalDays % 365;
  const months = Math.floor(remaining / 30);
  const d = remaining % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Jahr' : 'Jahre'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'Monat' : 'Monate'}`);
  if (d > 0 && years === 0) parts.push(`${d} ${d === 1 ? 'Tag' : 'Tage'}`);

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

export async function compressImage(
  file: File | Blob,
  maxSizeKB: number = 500
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context nicht verfügbar'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}

export async function lookupBarcode(
  barcode: string
): Promise<{ name: string; category?: string; imageUrl?: string } | null> {
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
    return {
      name:
        product.product_name_de ||
        product.product_name ||
        product.brands ||
        'Unbekanntes Produkt',
      category: product.categories,
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
