import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { getExpiryStatus, computeStats } from '../lib/utils';
import type { ExpiryStatus, ProductCategory } from '../types';
import { BarChart3, TrendingUp, Package, Calendar, MapPin } from 'lucide-react';
import { CountUp } from './CountUp';
import { SectionHeader } from './SectionHeader';
import { PageSkeleton } from './Skeleton';

const RANK_STYLES = ['bg-yellow-400/20 text-yellow-300', 'bg-gray-400/20 text-gray-200', 'bg-orange-500/20 text-orange-300'];

export function Statistics() {
  const productsQuery = useLiveQuery(() => db.products.toArray());
  const logsQuery = useLiveQuery(() => db.consumptionLogs.toArray());
  const products = useMemo(() => productsQuery ?? [], [productsQuery]);
  const consumptionLogs = useMemo(() => logsQuery ?? [], [logsQuery]);
  const { t } = useTranslation();

  const { stats, expiryDist, totalForDist, categoryBreakdown, categoryMax, locationBreakdown, locationMax, topConsumed, topConsumedMax, expiryRate } = useMemo(() => {
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
      categoryMax: Math.max(...catBreakdown.map((c) => c.count), 1),
      locationBreakdown: locBreakdown,
      locationMax: Math.max(...locBreakdown.map(([, c]) => c), 1),
      topConsumed: topConsumedList,
      topConsumedMax: Math.max(...topConsumedList.map(([, c]) => c), 1),
      expiryRate: rate,
    };
  }, [products, consumptionLogs, t]);

  if (productsQuery === undefined || logsQuery === undefined) {
    return <PageSkeleton />;
  }

  const hasData = stats.totalProducts > 0 || consumptionLogs.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="title-display text-4xl text-gray-100">{t('stats.title')}</h2>
          <p className="text-sm text-gray-400">{t('stats.subtitle')}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-primary-700 bg-primary-800/60 px-6 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10">
            <BarChart3 size={32} className="text-green-400" />
          </div>
          <p className="mt-4 text-lg font-semibold text-gray-200">{t('stats.noData')}</p>
          <p className="mt-1 max-w-xs text-sm text-gray-400">{t('stats.noDataDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="title-display text-4xl text-gray-100">{t('stats.title')}</h2>
        <p className="text-sm text-gray-400">{t('stats.subtitle')}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="flex items-center gap-2 text-[color:var(--pt-accent)]">
            <Package size={15} />
            <span className="eyebrow">{t('stats.activeProducts')}</span>
          </div>
          <p className="num mt-2 text-3xl font-bold text-gray-100">
            <CountUp value={stats.totalProducts} />
          </p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="flex items-center gap-2 text-[color:var(--pt-accent)]">
            <Calendar size={15} />
            <span className="eyebrow">{t('stats.expiryRate')}</span>
          </div>
          <p className="num mt-2 text-3xl font-bold text-gray-100"><CountUp value={expiryRate} suffix="%" /></p>
          <p className="text-xs text-gray-400">{t('stats.ofArchived')}</p>
        </div>
      </div>

      {/* Expiry Distribution */}
      <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <SectionHeader icon={BarChart3} title={t('stats.expiryDistribution')} tone="green" />
        <div className="space-y-2">
          {[
            { label: t('stats.expired'), count: expiryDist.expired, color: 'bg-[color:var(--pt-crit)]' },
            { label: t('stats.critical'), count: expiryDist.critical, color: 'bg-[color:var(--pt-crit)]' },
            { label: t('stats.warning'), count: expiryDist.warning, color: 'bg-[color:var(--pt-warn)]' },
            { label: t('stats.soon'), count: expiryDist.soon, color: 'bg-[color:var(--pt-warn)]' },
            { label: t('stats.ok'), count: expiryDist.good, color: 'bg-[color:var(--pt-ok)]' },
          ].map(({ label, count, color }) => {
            const pct = Math.round((count / totalForDist) * 100);
            return (
              <div key={label}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="num text-gray-300">{count} <span className="text-gray-500">· {pct}%</span></span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-primary-700">
                  <div
                    className={`h-full rounded-full ${color} transition-all`}
                    style={{ width: count > 0 ? `${Math.max(pct, 4)}%` : '0%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <SectionHeader icon={Package} title={t('stats.byCategory')} tone="purple" />
          <div className="space-y-2.5">
            {categoryBreakdown.map(({ key, label, count }) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-300">{label}</span>
                  <span className="num font-semibold text-gray-200">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-primary-700">
                  <div className="h-full rounded-full bg-[color:var(--pt-accent)] opacity-80 transition-all" style={{ width: `${Math.max((count / categoryMax) * 100, 4)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location breakdown */}
      {locationBreakdown.length > 0 && (
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <SectionHeader icon={MapPin} title={t('stats.byLocation')} tone="cyan" />
          <div className="space-y-2.5">
            {locationBreakdown.map(([name, count]) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-300">{name}</span>
                  <span className="num font-semibold text-gray-200">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-primary-700">
                  <div className="h-full rounded-full bg-[color:var(--pt-accent)] opacity-80 transition-all" style={{ width: `${Math.max((count / locationMax) * 100, 4)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top consumed */}
      {topConsumed.length > 0 && (
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <SectionHeader icon={TrendingUp} title={t('stats.mostConsumed')} tone="green" />
          <div className="space-y-2">
            {topConsumed.map(([name, count], i) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-lg bg-primary-700/50 px-3 py-2"
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLES[i] ?? 'bg-primary-600 text-gray-300'}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-gray-300">{name}</span>
                    <span className="shrink-0 font-semibold text-gray-200">{count}x</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary-800">
                    <div className="h-full rounded-full bg-[color:var(--pt-accent)] opacity-80 transition-all" style={{ width: `${Math.max((count / topConsumedMax) * 100, 4)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
