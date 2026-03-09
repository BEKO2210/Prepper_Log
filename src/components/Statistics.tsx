import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { getExpiryStatus, computeStats } from '../lib/utils';
import type { ExpiryStatus, ProductCategory } from '../types';
import { BarChart3, TrendingUp, Package, Calendar } from 'lucide-react';

export function Statistics() {
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const consumptionLogs = useLiveQuery(() => db.consumptionLogs.toArray()) ?? [];
  const { t } = useTranslation();

  const { stats, expiryDist, totalForDist, categoryBreakdown, locationBreakdown, topConsumed, expiryRate } = useMemo(() => {
    const s = computeStats(products);
    const activeProducts = products.filter((p) => !p.archived);

    // Category breakdown
    const catBreakdown = (['konserven', 'wasser', 'medizin', 'werkzeug', 'hygiene', 'lebensmittel', 'getranke', 'elektronik', 'kleidung', 'sonstiges'] as ProductCategory[]).map((key) => {
      const count = activeProducts.filter((p) => p.category === key).length;
      return { key, label: t(`categories.${key}`), count };
    }).filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

    // Location breakdown
    const locCounts = activeProducts.reduce<Record<string, number>>((acc, p) => {
      acc[p.storageLocation] = (acc[p.storageLocation] || 0) + 1;
      return acc;
    }, {});
    const locBreakdown = Object.entries(locCounts).sort(([, a], [, b]) => b - a);

    // Expiry distribution — single pass instead of 5 separate filters
    const dist: Record<ExpiryStatus, number> = { expired: 0, critical: 0, warning: 0, soon: 0, good: 0 };
    for (const p of activeProducts) {
      dist[getExpiryStatus(p.expiryDate)]++;
    }

    // Most consumed
    const consumeCounts = consumptionLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.productName] = (acc[log.productName] || 0) + log.quantity;
      return acc;
    }, {});
    const topConsumedList = Object.entries(consumeCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

    // Expiry rate
    const archivedTotal = products.filter((p) => p.archived).length;
    const expiredArchived = products.filter(
      (p) => p.archived && getExpiryStatus(p.expiryDate) === 'expired'
    ).length;
    const rate = archivedTotal > 0 ? Math.round((expiredArchived / archivedTotal) * 100) : 0;

    return {
      stats: s,
      expiryDist: dist,
      totalForDist: Math.max(activeProducts.length, 1),
      categoryBreakdown: catBreakdown,
      locationBreakdown: locBreakdown,
      topConsumed: topConsumedList,
      expiryRate: rate,
    };
  }, [products, consumptionLogs, t]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">{t('stats.title')}</h2>
        <p className="text-sm text-gray-400">{t('stats.subtitle')}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="flex items-center gap-2 text-blue-400">
            <Package size={18} />
            <span className="text-sm">{t('stats.activeProducts')}</span>
          </div>
          <p className="mt-1 text-3xl font-bold text-gray-100">
            {stats.totalProducts}
          </p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="flex items-center gap-2 text-orange-400">
            <Calendar size={18} />
            <span className="text-sm">{t('stats.expiryRate')}</span>
          </div>
          <p className="mt-1 text-3xl font-bold text-gray-100">{expiryRate}%</p>
          <p className="text-xs text-gray-400">{t('stats.ofArchived')}</p>
        </div>
      </div>

      {/* Expiry Distribution */}
      <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
          <BarChart3 size={18} className="text-green-400" />
          {t('stats.expiryDistribution')}
        </h3>
        <div className="space-y-2">
          {[
            { label: t('stats.expired'), count: expiryDist.expired, color: 'bg-red-500' },
            { label: t('stats.critical'), count: expiryDist.critical, color: 'bg-red-400' },
            { label: t('stats.warning'), count: expiryDist.warning, color: 'bg-orange-400' },
            { label: t('stats.soon'), count: expiryDist.soon, color: 'bg-yellow-400' },
            { label: t('stats.ok'), count: expiryDist.good, color: 'bg-green-500' },
          ].map(({ label, count, color }) => (
            <div key={label}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-300">{count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-primary-700">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${(count / totalForDist) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <Package size={18} className="text-purple-400" />
            {t('stats.byCategory')}
          </h3>
          <div className="space-y-2">
            {categoryBreakdown.map(({ key, label, count }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg bg-primary-700/50 px-3 py-2"
              >
                <span className="text-sm text-gray-300">{label}</span>
                <span className="font-semibold text-gray-200">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location breakdown */}
      {locationBreakdown.length > 0 && (
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <TrendingUp size={18} className="text-cyan-400" />
            {t('stats.byLocation')}
          </h3>
          <div className="space-y-2">
            {locationBreakdown.map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg bg-primary-700/50 px-3 py-2"
              >
                <span className="text-sm text-gray-300">{name}</span>
                <span className="font-semibold text-gray-200">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top consumed */}
      {topConsumed.length > 0 && (
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <TrendingUp size={18} className="text-green-400" />
            {t('stats.mostConsumed')}
          </h3>
          <div className="space-y-2">
            {topConsumed.map(([name, count], i) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg bg-primary-700/50 px-3 py-2"
              >
                <span className="text-sm text-gray-300">
                  {i + 1}. {name}
                </span>
                <span className="font-semibold text-gray-200">
                  {count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
