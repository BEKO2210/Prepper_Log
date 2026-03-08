import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { getExpiryStatus, computeStats } from '../lib/utils';
import { CATEGORY_LABELS } from '../types';
import { BarChart3, TrendingUp, Package, Calendar } from 'lucide-react';

export function Statistics() {
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const consumptionLogs = useLiveQuery(() => db.consumptionLogs.toArray()) ?? [];
  const stats = computeStats(products);
  const activeProducts = products.filter((p) => !p.archived);

  // Category breakdown
  const categoryBreakdown = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const count = activeProducts.filter((p) => p.category === key).length;
    return { key, label, count };
  }).filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

  // Location breakdown
  const locationCounts = activeProducts.reduce<Record<string, number>>((acc, p) => {
    acc[p.storageLocation] = (acc[p.storageLocation] || 0) + 1;
    return acc;
  }, {});
  const locationBreakdown = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a);

  // Expiry distribution
  const expiryDist = {
    expired: activeProducts.filter((p) => getExpiryStatus(p.expiryDate) === 'expired').length,
    critical: activeProducts.filter((p) => getExpiryStatus(p.expiryDate) === 'critical').length,
    warning: activeProducts.filter((p) => getExpiryStatus(p.expiryDate) === 'warning').length,
    soon: activeProducts.filter((p) => getExpiryStatus(p.expiryDate) === 'soon').length,
    good: activeProducts.filter((p) => getExpiryStatus(p.expiryDate) === 'good').length,
  };
  const totalForDist = Math.max(activeProducts.length, 1);

  // Most consumed products
  const consumptionCounts = consumptionLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.productName] = (acc[log.productName] || 0) + log.quantity;
    return acc;
  }, {});
  const topConsumed = Object.entries(consumptionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Expiry rate
  const archivedTotal = products.filter((p) => p.archived).length;
  const expiredArchived = products.filter(
    (p) => p.archived && getExpiryStatus(p.expiryDate) === 'expired'
  ).length;
  const expiryRate =
    archivedTotal > 0 ? Math.round((expiredArchived / archivedTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Statistiken</h1>
        <p className="text-sm text-gray-400">Übersicht deines Vorrats</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="flex items-center gap-2 text-blue-400">
            <Package size={18} />
            <span className="text-sm">Aktive Produkte</span>
          </div>
          <p className="mt-1 text-3xl font-bold text-gray-100">
            {stats.totalProducts}
          </p>
        </div>
        <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="flex items-center gap-2 text-orange-400">
            <Calendar size={18} />
            <span className="text-sm">Ablaufrate</span>
          </div>
          <p className="mt-1 text-3xl font-bold text-gray-100">{expiryRate}%</p>
          <p className="text-xs text-gray-500">der archivierten Produkte</p>
        </div>
      </div>

      {/* Expiry Distribution */}
      <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
          <BarChart3 size={18} className="text-green-400" />
          MHD-Verteilung
        </h2>
        <div className="space-y-2">
          {[
            { label: 'Abgelaufen', count: expiryDist.expired, color: 'bg-red-500' },
            { label: 'Kritisch (≤7d)', count: expiryDist.critical, color: 'bg-red-400' },
            { label: 'Warnung (8-14d)', count: expiryDist.warning, color: 'bg-orange-400' },
            { label: 'Bald (15-30d)', count: expiryDist.soon, color: 'bg-yellow-400' },
            { label: 'OK (>30d)', count: expiryDist.good, color: 'bg-green-500' },
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
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <Package size={18} className="text-purple-400" />
            Nach Kategorie
          </h2>
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
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <TrendingUp size={18} className="text-cyan-400" />
            Nach Lagerort
          </h2>
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
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <TrendingUp size={18} className="text-green-400" />
            Meistverbraucht
          </h2>
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
