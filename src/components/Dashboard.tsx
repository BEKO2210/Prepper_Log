import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { computeStats, getExpiryStatus, getDaysUntilExpiry, formatDate, formatDaysUntil } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingDown,
  MapPin,
  Layers,
} from 'lucide-react';

export function Dashboard() {
  const setPage = useAppStore((s) => s.setPage);
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const stats = computeStats(products);

  const urgentProducts = products
    .filter((p) => !p.archived)
    .map((p) => ({ ...p, daysLeft: getDaysUntilExpiry(p.expiryDate), status: getExpiryStatus(p.expiryDate) }))
    .filter((p) => p.status !== 'good')
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);

  const statCards = [
    { label: 'Gesamt', value: stats.totalProducts, icon: Package, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Abgelaufen', value: stats.expiredCount, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Kritisch', value: stats.criticalCount, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
    { label: 'Warnung', value: stats.warningCount, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'OK', value: stats.goodCount, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Unterbestand', value: stats.lowStockCount, icon: TrendingDown, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Kategorien', value: stats.totalCategories, icon: Layers, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Lagerorte', value: stats.totalLocations, icon: MapPin, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-400">Dein Vorrat. Immer im Blick.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className={`rounded-xl border border-primary-700 ${bg} p-3`}
          >
            <div className="flex items-center gap-2">
              <Icon size={18} className={color} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Urgent Products */}
      {urgentProducts.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-200">Dringend</h2>
            <button
              onClick={() => setPage('products')}
              className="text-sm text-green-400 hover:text-green-300"
            >
              Alle anzeigen
            </button>
          </div>
          <div className="space-y-2">
            {urgentProducts.map((product) => {
              const statusColors: Record<string, string> = {
                expired: 'border-red-500/40 bg-red-500/5',
                critical: 'border-red-400/40 bg-red-400/5',
                warning: 'border-orange-400/40 bg-orange-400/5',
                soon: 'border-yellow-400/40 bg-yellow-400/5',
                good: 'border-green-400/40 bg-green-400/5',
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
                  className={`flex items-center justify-between rounded-lg border p-3 ${statusColors[product.status]}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-200">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {product.storageLocation} &middot;{' '}
                      {formatDate(product.expiryDate, product.expiryPrecision)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${textColors[product.status]}`}
                  >
                    {formatDaysUntil(product.daysLeft)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {products.filter((p) => !p.archived).length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary-600 py-16 text-center">
          <Package size={48} className="mb-3 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">Noch keine Produkte</p>
          <p className="mt-1 text-sm text-gray-500">
            Füge dein erstes Produkt hinzu oder scanne einen Barcode.
          </p>
          <button
            onClick={() => setPage('add')}
            className="mt-4 rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-500"
          >
            Produkt hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}
