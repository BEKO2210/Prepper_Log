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
  ScanBarcode,
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

  const ampelCards = [
    { label: 'Abgelaufen', value: stats.expiredCount, icon: AlertCircle, color: 'text-red-500' },
    { label: 'Kritisch', value: stats.criticalCount, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Warnung', value: stats.warningCount, icon: Clock, color: 'text-orange-400' },
    { label: 'OK', value: stats.goodCount, icon: CheckCircle, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Ampel Stats */}
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-primary-700 bg-primary-700">
        {ampelCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-primary-800 p-3 text-center">
            <p className={`font-display text-3xl leading-none ${color}`}>{value}</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <Icon size={10} className={color} />
              <span className="text-[0.65rem] text-gray-500">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-primary-700 bg-primary-800/60 p-3 text-center">
          <p className="font-display text-2xl text-gray-200">{stats.totalProducts}</p>
          <span className="text-[0.65rem] text-gray-500">Gesamt</span>
        </div>
        <div className="rounded-lg border border-primary-700 bg-primary-800/60 p-3 text-center">
          <p className={`font-display text-2xl ${stats.lowStockCount > 0 ? 'text-yellow-400' : 'text-gray-200'}`}>
            {stats.lowStockCount}
          </p>
          <span className="text-[0.65rem] text-gray-500">Unterbestand</span>
        </div>
        <div className="rounded-lg border border-primary-700 bg-primary-800/60 p-3 text-center">
          <p className="font-display text-2xl text-gray-200">{stats.totalLocations}</p>
          <span className="text-[0.65rem] text-gray-500">Lagerorte</span>
        </div>
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
                  className={`flex items-center justify-between border-l-4 ${borderColors[product.status]} rounded-r-lg border border-primary-700 bg-primary-800/60 p-3`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-200">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {product.storageLocation} &middot;{' '}
                      {formatDate(product.expiryDate, product.expiryPrecision)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold ${textColors[product.status]}`}
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
          <Package size={48} className="mb-3 text-primary-600" />
          <p className="text-lg font-medium text-gray-300">Noch leer.</p>
          <p className="mt-1 text-sm text-gray-500">
            Leg los mit dem ersten Scan oder erfasse ein Produkt manuell.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPage('scanner')}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
            >
              <ScanBarcode size={18} />
              Barcode scannen
            </button>
            <button
              onClick={() => setPage('add')}
              className="rounded-lg border border-primary-600 px-5 py-2 font-medium text-gray-300 hover:bg-primary-700"
            >
              Manuell erfassen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
