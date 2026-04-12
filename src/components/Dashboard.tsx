import { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, importData, loadImportedImages, ImportResult } from '../lib/db';
import { computeStats, getExpiryStatus, getDaysUntilExpiry, formatDate, formatDaysUntil } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { ProductCategory } from '../types';
import { StatRing } from './StatRing';
import {
  Package,
  ScanBarcode,
  PlusCircle,
  TrendingDown,
  ChevronRight,
  Upload,
  Camera,
  Image,
  BellRing,
  WifiOff,
  Lock,
  HardDrive,
  Loader2,
} from 'lucide-react';

const URGENT_STATUS_COLORS: Record<string, string> = {
  expired: 'bg-red-500',
  critical: 'bg-red-400',
  warning: 'bg-orange-400',
  soon: 'bg-yellow-400',
  good: 'bg-green-400',
};

const URGENT_TEXT_COLORS: Record<string, string> = {
  expired: 'text-red-400',
  critical: 'text-red-400',
  warning: 'text-orange-400',
  soon: 'text-yellow-400',
  good: 'text-green-400',
};

export function Dashboard() {
  const setPage = useAppStore((s) => s.setPage);
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const { t } = useTranslation();
  const [importStatus, setImportStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [imageLoadProgress, setImageLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importData(text);
      setImportStatus({ message: t('import.success', { count: result.imported }), type: 'success' });
      if (result.productsNeedingImages.length > 0) {
        setImageLoadProgress({ loaded: 0, total: result.productsNeedingImages.length });
        await loadImportedImages(result.productsNeedingImages, (loaded, total) => {
          setImageLoadProgress({ loaded, total });
        });
        setImageLoadProgress(null);
      }
    } catch (err) {
      if (err instanceof ImportResult) {
        setImportStatus({ message: err.message, type: 'warning' });
        if (err.productsNeedingImages.length > 0) {
          setImageLoadProgress({ loaded: 0, total: err.productsNeedingImages.length });
          await loadImportedImages(err.productsNeedingImages, (loaded, total) => {
            setImageLoadProgress({ loaded, total });
          });
          setImageLoadProgress(null);
        }
      } else {
        setImportStatus({ message: t('import.error', { message: err instanceof Error ? err.message : t('import.importFailed') }), type: 'error' });
      }
    }
    e.target.value = '';
  }

  const { stats, activeProducts, urgentProducts, categoryBreakdown, total } = useMemo(() => {
    const s = computeStats(products);
    const active = products.filter((p) => !p.archived);

    const urgent = active
      .map((p) => ({ ...p, daysLeft: getDaysUntilExpiry(p.expiryDate), status: getExpiryStatus(p.expiryDate) }))
      .filter((p) => p.status !== 'good')
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);

    const catBreakdown = (['konserven', 'wasser', 'medizin', 'werkzeug', 'hygiene', 'lebensmittel', 'getranke', 'elektronik', 'kleidung', 'sonstiges'] as ProductCategory[])
      .map((key) => ({
        key,
        label: t(`categories.${key}`),
        count: active.filter((p) => p.category === key).length,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      stats: s,
      activeProducts: active,
      urgentProducts: urgent,
      categoryBreakdown: catBreakdown,
      total: Math.max(s.totalProducts, 1),
    };
  }, [products, t]);

  if (activeProducts.length === 0) {
    return (
      <div className="space-y-5 pb-4">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10">
            <Package size={40} className="text-green-400" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-100">{t('onboarding.title')}</h2>
          <p className="mt-1 text-sm text-gray-400">{t('onboarding.subtitle')}</p>
        </div>

        {/* Schnellstart-Buttons */}
        <div className="grid grid-cols-1 gap-2.5">
          <button
            onClick={() => setPage('scanner')}
            className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-start hover:bg-green-500/20 active:scale-[0.98] transition-transform"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
              <ScanBarcode size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">{t('onboarding.startScan')}</p>
              <p className="text-xs text-gray-400">{t('onboarding.step1Desc')}</p>
            </div>
          </button>

          <button
            onClick={() => setPage('add')}
            className="flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-start hover:bg-blue-500/20 active:scale-[0.98] transition-transform"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
              <PlusCircle size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">{t('onboarding.startManual')}</p>
              <p className="text-xs text-gray-400">{t('dashboard.addManual')}</p>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-start hover:bg-orange-500/20 active:scale-[0.98] transition-transform"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600/20">
              <Upload size={20} className="text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">{t('onboarding.startImport')}</p>
              <p className="text-xs text-gray-400">{t('onboarding.step3Desc')}</p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Import Status */}
        {importStatus && (
          <p className={`rounded-lg px-3 py-2 text-sm ${
            importStatus.type === 'error' ? 'bg-red-500/10 text-red-400'
              : importStatus.type === 'warning' ? 'bg-orange-500/10 text-orange-400'
                : 'bg-green-500/10 text-green-400'
          }`}>
            {importStatus.message}
          </p>
        )}

        {imageLoadProgress && (
          <div className="space-y-2 rounded-lg bg-blue-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <Loader2 size={16} className="animate-spin" />
              <span>{t('import.loadingImages', { loaded: imageLoadProgress.loaded, total: imageLoadProgress.total })}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-700">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(imageLoadProgress.loaded / imageLoadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Feature-Übersicht */}
        <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{t('onboarding.features')}</h3>
          <div className="space-y-2">
            {[
              { icon: <WifiOff size={15} className="text-blue-400" />, text: t('onboarding.featureOffline') },
              { icon: <Camera size={15} className="text-green-400" />, text: t('onboarding.featureCamera') },
              { icon: <Image size={15} className="text-purple-400" />, text: t('onboarding.featureImages') },
              { icon: <BellRing size={15} className="text-yellow-400" />, text: t('onboarding.featureNotifications') },
              { icon: <HardDrive size={15} className="text-orange-400" />, text: t('onboarding.featureExport') },
              { icon: <Lock size={15} className="text-emerald-400" />, text: t('onboarding.featurePrivacy') },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">{item.icon}</span>
                <span className="text-xs text-gray-400">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-5">
        <div className="flex items-center justify-around">
          <StatRing value={stats.expiredCount + stats.criticalCount} max={total} label={t('dashboard.critical')} color="#ef4444" />
          <StatRing value={stats.warningCount + stats.soonCount} max={total} label={t('dashboard.soon')} color="#f97316" />
          <StatRing value={stats.goodCount} max={total} label={t('dashboard.good')} color="#22c55e" />
          <StatRing value={stats.totalProducts} max={stats.totalProducts} label={t('dashboard.total')} color="#9ca3af" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setPage('scanner')} className="flex items-center gap-3 rounded-xl border border-primary-700 bg-primary-800/60 p-4 text-start hover:bg-primary-700/50 active:scale-[0.98] transition-transform">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
            <ScanBarcode size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">{t('dashboard.scan')}</p>
            <p className="text-[0.65rem] text-gray-400">{t('dashboard.scanBarcode')}</p>
          </div>
        </button>
        <button onClick={() => setPage('add')} className="flex items-center gap-3 rounded-xl border border-primary-700 bg-primary-800/60 p-4 text-start hover:bg-primary-700/50 active:scale-[0.98] transition-transform">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
            <PlusCircle size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">{t('dashboard.addProduct')}</p>
            <p className="text-[0.65rem] text-gray-400">{t('dashboard.addManual')}</p>
          </div>
        </button>
      </div>

      {stats.totalProducts > 0 && (
        <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{t('dashboard.expiryDistribution')}</h2>
          <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-primary-700">
            {stats.expiredCount > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(stats.expiredCount / total) * 100}%` }} />}
            {stats.criticalCount > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(stats.criticalCount / total) * 100}%` }} />}
            {stats.warningCount > 0 && <div className="bg-orange-400 transition-all" style={{ width: `${(stats.warningCount / total) * 100}%` }} />}
            {stats.soonCount > 0 && <div className="bg-yellow-400 transition-all" style={{ width: `${(stats.soonCount / total) * 100}%` }} />}
            {stats.goodCount > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(stats.goodCount / total) * 100}%` }} />}
          </div>
          <div className="flex justify-between text-[0.6rem] text-gray-400">
            <span>{t('dashboard.expired_count', { count: stats.expiredCount })}</span>
            <span>{t('dashboard.warning_count', { count: stats.warningCount + stats.soonCount })}</span>
            <span>{t('dashboard.ok_count', { count: stats.goodCount })}</span>
          </div>
        </div>
      )}

      {urgentProducts.length > 0 && (
        <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{t('dashboard.urgent')}</h2>
            <button onClick={() => setPage('products')} className="flex items-center gap-0.5 text-xs text-green-400 hover:text-green-300">
              {t('dashboard.all')} <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {urgentProducts.map((product) => (
              <div key={product.id} className="flex overflow-hidden rounded-lg bg-primary-900/40">
                <div className={`w-1 shrink-0 ${URGENT_STATUS_COLORS[product.status]}`} />
                <div className="flex flex-1 items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-200">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.storageLocation} &middot; {formatDate(product.expiryDate, product.expiryPrecision)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${URGENT_TEXT_COLORS[product.status]}`}>{formatDaysUntil(product.daysLeft)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {categoryBreakdown.length > 0 && (
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
            <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">{t('dashboard.categories')}</h2>
            <div className="space-y-1.5">
              {categoryBreakdown.map(({ key, label, count }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs font-semibold text-gray-300">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-yellow-400" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">{t('dashboard.lowStock')}</span>
            </div>
            <p className={`stat-number mt-1 text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>{stats.lowStockCount}</p>
          </div>
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">{t('dashboard.storageLocations')}</span>
            <p className="stat-number mt-1 text-2xl font-bold text-gray-300">{stats.totalLocations}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
