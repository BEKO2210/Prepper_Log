import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { computeStats, getExpiryStatus, getDaysUntilExpiry, formatDate, formatDaysUntil } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { CATEGORY_LABELS } from '../types';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  ScanBarcode,
  PlusCircle,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';

export function Dashboard() {
  const setPage = useAppStore((s) => s.setPage);
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const stats = computeStats(products);

  const activeProducts = products.filter((p) => !p.archived);

  const urgentProducts = activeProducts
    .map((p) => ({ ...p, daysLeft: getDaysUntilExpiry(p.expiryDate), status: getExpiryStatus(p.expiryDate) }))
    .filter((p) => p.status !== 'good')
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);

  // Category breakdown (top 4)
  const categoryBreakdown = Object.entries(CATEGORY_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      count: activeProducts.filter((p) => p.category === key).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const total = Math.max(stats.totalProducts, 1);
  const goodPct = Math.round((stats.goodCount / total) * 100);

  // Empty state
  if (activeProducts.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-800 border border-primary-700">
          <Package size={40} className="text-primary-600" />
        </div>
        <p className="mt-5 text-xl font-semibold text-gray-200">Noch keine Vorraete</p>
        <p className="mt-2 max-w-xs text-sm text-gray-500">
          Starte mit einem Barcode-Scan oder erfasse dein erstes Produkt manuell.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setPage('scanner')}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
          >
            <ScanBarcode size={18} />
            Scannen
          </button>
          <button
            onClick={() => setPage('add')}
            className="flex items-center gap-2 rounded-xl border border-primary-600 px-5 py-3 font-medium text-gray-300 hover:bg-primary-700"
          >
            <PlusCircle size={18} />
            Manuell
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Hero: Total + Ring */}
      <div className="flex items-center gap-5 rounded-2xl border border-primary-700 bg-primary-800/60 p-5">
        {/* SVG ring */}
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-primary-700" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - goodPct / 100)}`}
              className="text-green-500 transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-green-400">{goodPct}%</span>
            <span className="text-[0.6rem] text-gray-500">OK</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold text-gray-100">{stats.totalProducts}</p>
          <p className="text-sm text-gray-500">Produkte im Vorrat</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {stats.expiredCount > 0 && (
              <span className="text-red-400">{stats.expiredCount} abgelaufen</span>
            )}
            {stats.criticalCount > 0 && (
              <span className="text-red-400">{stats.criticalCount} kritisch</span>
            )}
            {stats.warningCount > 0 && (
              <span className="text-orange-400">{stats.warningCount} Warnung</span>
            )}
            {stats.lowStockCount > 0 && (
              <span className="text-yellow-400">{stats.lowStockCount} Unterbestand</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setPage('scanner')}
          className="flex items-center gap-3 rounded-xl border border-primary-700 bg-primary-800/60 p-4 text-left hover:bg-primary-700/50 active:scale-[0.98] transition-transform"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
            <ScanBarcode size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">Scannen</p>
            <p className="text-[0.65rem] text-gray-500">Barcode erfassen</p>
          </div>
        </button>
        <button
          onClick={() => setPage('add')}
          className="flex items-center gap-3 rounded-xl border border-primary-700 bg-primary-800/60 p-4 text-left hover:bg-primary-700/50 active:scale-[0.98] transition-transform"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
            <PlusCircle size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">Hinzufuegen</p>
            <p className="text-[0.65rem] text-gray-500">Manuell erfassen</p>
          </div>
        </button>
      </div>

      {/* Status Ampel Bar */}
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wide">MHD-Status</h2>
        {/* Visual bar */}
        {stats.totalProducts > 0 && (
          <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-primary-700">
            {stats.expiredCount > 0 && (
              <div className="bg-red-500 transition-all" style={{ width: `${(stats.expiredCount / total) * 100}%` }} />
            )}
            {stats.criticalCount > 0 && (
              <div className="bg-red-400 transition-all" style={{ width: `${(stats.criticalCount / total) * 100}%` }} />
            )}
            {stats.warningCount > 0 && (
              <div className="bg-orange-400 transition-all" style={{ width: `${(stats.warningCount / total) * 100}%` }} />
            )}
            {stats.soonCount > 0 && (
              <div className="bg-yellow-400 transition-all" style={{ width: `${(stats.soonCount / total) * 100}%` }} />
            )}
            {stats.goodCount > 0 && (
              <div className="bg-green-500 transition-all" style={{ width: `${(stats.goodCount / total) * 100}%` }} />
            )}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Abgelaufen', value: stats.expiredCount, icon: AlertCircle, color: 'text-red-500' },
            { label: 'Kritisch', value: stats.criticalCount, icon: AlertTriangle, color: 'text-red-400' },
            { label: 'Warnung', value: stats.warningCount + stats.soonCount, icon: Clock, color: 'text-orange-400' },
            { label: 'OK', value: stats.goodCount, icon: CheckCircle, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Icon size={12} className={color} />
                <span className={`text-lg font-bold ${color}`}>{value}</span>
              </div>
              <p className="text-[0.6rem] text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Urgent Products */}
      {urgentProducts.length > 0 && (
        <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Dringend</h2>
            <button
              onClick={() => setPage('products')}
              className="flex items-center gap-0.5 text-xs text-green-400 hover:text-green-300"
            >
              Alle <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {urgentProducts.map((product) => {
              const borderColors: Record<string, string> = {
                expired: 'border-l-red-500',
                critical: 'border-l-red-400',
                warning: 'border-l-orange-400',
                soon: 'border-l-yellow-400',
                good: 'border-l-green-400',
              };
              const textColors: Record<string, string> = {
                expired: 'text-red-400',
                critical: 'text-red-400',
                warning: 'text-orange-400',
                soon: 'text-yellow-400',
                good: 'text-green-400',
              };
              return (
                <div
                  key={product.id}
                  className={`flex items-center justify-between border-l-4 ${borderColors[product.status]} rounded-r-lg bg-primary-900/40 p-3`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-200">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {product.storageLocation} &middot;{' '}
                      {formatDate(product.expiryDate, product.expiryPrecision)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold ${textColors[product.status]}`}
                  >
                    {formatDaysUntil(product.daysLeft)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category + Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Categories */}
        {categoryBreakdown.length > 0 && (
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
            <h2 className="mb-2 text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide">Kategorien</h2>
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

        {/* Quick numbers */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-yellow-400" />
              <span className="text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide">Unterbestand</span>
            </div>
            <p className={`mt-1 text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>
              {stats.lowStockCount}
            </p>
          </div>
          <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
            <span className="text-[0.65rem] font-semibold text-gray-500 uppercase tracking-wide">Lagerorte</span>
            <p className="mt-1 text-2xl font-bold text-gray-300">{stats.totalLocations}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
