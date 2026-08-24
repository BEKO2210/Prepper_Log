import { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, importData, loadImportedImages, ImportResult } from '../lib/db';
import { computeStats, getExpiryStatus, getDaysUntilExpiry, formatDate, formatDaysUntil } from '../lib/utils';
import { computePreparedness } from '../lib/preparedness';
import { useAppStore } from '../store/useAppStore';
import { useToast } from './Toast';
import { SectionHeader } from './SectionHeader';
import { DashboardSkeleton } from './Skeleton';
import type { ProductCategory } from '../types';
import { StatRing } from './StatRing';
import { CountUp } from './CountUp';
import {
  Package,
  PlusCircle,
  TrendingDown,
  ChevronRight,
  Camera,
  Image,
  BellRing,
  WifiOff,
  Lock,
  HardDrive,
  Loader2,
  ScanBarcode,
  Upload,
  ShieldCheck,
  PieChart,
  AlertTriangle,
} from 'lucide-react';

function preparednessColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

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
  const setEditingProductId = useAppStore((s) => s.setEditingProductId);
  const requestScan = useAppStore((s) => s.requestScan);
  const household = useAppStore((s) => s.household);
  const productsQuery = useLiveQuery(() => db.products.toArray());
  const products = useMemo(() => productsQuery ?? [], [productsQuery]);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [imageLoadProgress, setImageLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importData(text);
      showToast(t('import.success', { count: result.imported }), 'success');
      if (result.productsNeedingImages.length > 0) {
        setImageLoadProgress({ loaded: 0, total: result.productsNeedingImages.length });
        await loadImportedImages(result.productsNeedingImages, (loaded, total) => {
          setImageLoadProgress({ loaded, total });
        });
        setImageLoadProgress(null);
      }
    } catch (err) {
      if (err instanceof ImportResult) {
        showToast(err.message, 'warning');
        if (err.productsNeedingImages.length > 0) {
          setImageLoadProgress({ loaded: 0, total: err.productsNeedingImages.length });
          await loadImportedImages(err.productsNeedingImages, (loaded, total) => {
            setImageLoadProgress({ loaded, total });
          });
          setImageLoadProgress(null);
        }
      } else {
        showToast(t('import.error', { message: err instanceof Error ? err.message : t('import.importFailed') }), 'error');
      }
    }
    e.target.value = '';
  }

  const { stats, activeProducts, urgentProducts, categoryBreakdown, total, preparedness } = useMemo(() => {
    const s = computeStats(products);
    const active = products.filter((p) => !p.archived);
    const prep = computePreparedness(products, household);

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
      preparedness: prep,
    };
  }, [products, household, t]);

  if (productsQuery === undefined) {
    return <DashboardSkeleton />;
  }

  if (activeProducts.length === 0) {
    return (
      <div className="space-y-3 pb-4">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10">
            <Package size={40} className="text-green-400" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-100">{t('onboarding.title')}</h2>
          <p className="mt-1 text-sm text-gray-400">{t('onboarding.subtitle')}</p>
        </div>
        <div className="flex flex-col items-center text-center">
          <p className="mt-5 text-xl font-semibold text-gray-200">{t('dashboard.noProducts')}</p>
          <p className="mt-2 max-w-xs text-sm text-gray-400">{t('dashboard.noProductsDesc')}</p>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <button onClick={() => { setEditingProductId(null); setPage('add'); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 font-medium text-white hover:bg-green-600 active:scale-[0.98] transition-transform">
              <PlusCircle size={18} />
              {t('nav.add')}
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-600/40 bg-transparent px-5 py-3 font-medium text-green-400 hover:border-green-500 hover:bg-green-500/10 active:scale-[0.98] transition-transform">
              <Upload size={18} />
              {t('onboarding.startImport')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>

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
        <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-3">
          <h3 className="eyebrow mb-3">{t('onboarding.features')}</h3>
          <div className="space-y-2">
            {[
              { icon: <WifiOff size={15} className="text-[color:var(--pt-accent)]" />, text: t('onboarding.featureOffline') },
              { icon: <Camera size={15} className="text-[color:var(--pt-accent)]" />, text: t('onboarding.featureCamera') },
              { icon: <Image size={15} className="text-[color:var(--pt-accent)]" />, text: t('onboarding.featureImages') },
              { icon: <BellRing size={15} className="text-[color:var(--pt-accent)]" />, text: t('onboarding.featureNotifications') },
              { icon: <HardDrive size={15} className="text-[color:var(--pt-accent)]" />, text: t('onboarding.featureExport') },
              { icon: <Lock size={15} className="text-[color:var(--pt-accent)]" />, text: t('onboarding.featurePrivacy') },
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
    <div className="space-y-3 pb-4">
      {/* Lagerstand: eine Zahl, ein Balken, eine Legende — statt vier Ringen
          plus separatem Verteilungsbalken mit denselben Daten. */}
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
        <SectionHeader icon={PieChart} title={t('dashboard.expiryDistribution')} tone="green" className="mb-3" />
        <div className="flex items-baseline gap-2.5">
          <p className="num text-5xl font-bold leading-none text-gray-100"><CountUp value={stats.totalProducts} /></p>
          <p className="eyebrow">{t('dashboard.total')}</p>
        </div>
        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {stats.expiredCount + stats.criticalCount > 0 && <div className="rounded-full bg-[color:var(--pt-crit)] transition-all" style={{ width: `${((stats.expiredCount + stats.criticalCount) / total) * 100}%` }} />}
          {stats.warningCount + stats.soonCount > 0 && <div className="rounded-full bg-[color:var(--pt-warn)] transition-all" style={{ width: `${((stats.warningCount + stats.soonCount) / total) * 100}%` }} />}
          {stats.goodCount > 0 && <div className="rounded-full bg-[color:var(--pt-ok)] transition-all" style={{ width: `${(stats.goodCount / total) * 100}%` }} />}
          {total === 0 && <div className="w-full rounded-full bg-primary-700" />}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className={stats.expiredCount + stats.criticalCount > 0 ? 'text-[color:var(--pt-crit)]' : 'text-gray-500'}>
            <span className="num font-semibold">{stats.expiredCount + stats.criticalCount}</span> {t('dashboard.critical')}
          </span>
          <span className={stats.warningCount + stats.soonCount > 0 ? 'text-[color:var(--pt-warn)]' : 'text-gray-500'}>
            <span className="num font-semibold">{stats.warningCount + stats.soonCount}</span> {t('dashboard.soon')}
          </span>
          <span className={stats.goodCount > 0 ? 'text-[color:var(--pt-ok)]' : 'text-gray-500'}>
            <span className="num font-semibold">{stats.goodCount}</span> {t('dashboard.good')}
          </span>
        </div>
      </div>

      <button
        onClick={() => setPage('preparedness')}
        className="flex w-full items-center gap-4 rounded-2xl border border-primary-700 bg-primary-800/60 p-3 text-start transition-colors hover:bg-primary-700/50 active:scale-[0.99]"
      >
        <StatRing value={preparedness.score} max={100} label={t('preparedness.score')} color={preparednessColor(preparedness.score)} size={64} strokeWidth={6} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-[color:var(--pt-accent)]" />
            <span className="eyebrow">{t('preparedness.cardTitle')}</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {preparedness.survivalDays !== null
              ? t('preparedness.survival', { count: preparedness.survivalDays })
              : t('preparedness.waterDays', { count: preparedness.waterDays })}
          </p>
          <p className="text-[0.65rem] text-gray-500">{t('preparedness.cardHint')}</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-gray-500" />
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={requestScan} className="flex items-center gap-3 rounded-xl border border-primary-700 bg-primary-800/60 p-3 text-start hover:bg-primary-700/50 active:scale-[0.98] transition-transform">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--pt-accent-soft)]">
            <ScanBarcode size={20} className="text-[color:var(--pt-accent)]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-200">{t('dashboard.scan')}</p>
            <p className="truncate text-[0.65rem] text-gray-400">{t('dashboard.scanBarcode')}</p>
          </div>
        </button>
        <button onClick={() => { setEditingProductId(null); setPage('add'); }} className="flex items-center gap-3 rounded-xl border border-primary-700 bg-primary-800/60 p-3 text-start hover:bg-primary-700/50 active:scale-[0.98] transition-transform">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--pt-accent-soft)]">
            <PlusCircle size={20} className="text-[color:var(--pt-accent)]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-200">{t('dashboard.addProduct')}</p>
            <p className="truncate text-[0.65rem] text-gray-400">{t('dashboard.addManual')}</p>
          </div>
        </button>
      </div>

      {urgentProducts.length > 0 && (
        <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-3">
          <SectionHeader
            icon={AlertTriangle}
            title={t('dashboard.urgent')}
            tone="orange"
            action={
              <button onClick={() => setPage('products')} className="-me-2 flex min-h-[44px] shrink-0 items-center gap-0.5 rounded-lg px-2 text-xs text-green-400 hover:text-green-300">
                {t('dashboard.all')} <ChevronRight size={14} />
              </button>
            }
          />
          <div className="space-y-2">
            {urgentProducts.map((product) => (
              <button key={product.id} onClick={() => setEditingProductId(product.id!)} className="flex w-full overflow-hidden rounded-lg bg-primary-900/40 text-start transition-colors hover:bg-primary-900/70">
                <div className={`w-1 shrink-0 ${URGENT_STATUS_COLORS[product.status]}`} />
                <div className="flex flex-1 items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-200">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.storageLocation} &middot; <span className="num">{formatDate(product.expiryDate, product.expiryPrecision)}</span></p>
                  </div>
                  <span className={`num shrink-0 text-xs font-bold ${URGENT_TEXT_COLORS[product.status]}`}>{formatDaysUntil(product.daysLeft)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {categoryBreakdown.length > 0 && (
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-3">
            <h2 className="eyebrow mb-2.5">{t('dashboard.categories')}</h2>
            <div className="space-y-1.5">
              {categoryBreakdown.map(({ key, label, count }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="num text-xs font-semibold text-gray-300">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-3">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className={stats.lowStockCount > 0 ? 'text-[color:var(--pt-warn)]' : 'text-[color:var(--pt-accent)]'} />
              <span className="eyebrow">{t('dashboard.lowStock')}</span>
            </div>
            <p className={`stat-number num mt-1 text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-[color:var(--pt-warn)]' : 'text-gray-300'}`}><CountUp value={stats.lowStockCount} /></p>
          </div>
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-3">
            <span className="eyebrow">{t('dashboard.storageLocations')}</span>
            <p className="stat-number num mt-1 text-2xl font-bold text-gray-300"><CountUp value={stats.totalLocations} /></p>
          </div>
        </div>
      </div>
    </div>
  );
}
