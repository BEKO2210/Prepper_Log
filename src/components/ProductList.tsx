import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import {
  getExpiryStatus,
  getDaysUntilExpiry,
  formatDate,
  formatDaysUntil,
  getStatusBadgeColor,
  getStatusLabel,
} from '../lib/utils';
import { CATEGORY_LABELS, type ProductCategory } from '../types';
import {
  Search,
  Filter,
  Edit3,
  Trash2,
  Archive,
  Package,
  ChevronDown,
  X,
  ShoppingCart,
} from 'lucide-react';
import { useState } from 'react';
import { archiveProduct, deleteProduct, logConsumption } from '../lib/db';

export function ProductList() {
  const { filters, setFilter, resetFilters, setEditingProductId } = useAppStore();
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const locations = useLiveQuery(() => db.storageLocations.toArray()) ?? [];

  const filtered = products
    .filter((p) => p.archived === showArchived)
    .filter((p) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.barcode || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.category && p.category !== filters.category) return false;
      if (filters.location && p.storageLocation !== filters.location) return false;
      if (filters.status) {
        const status = getExpiryStatus(p.expiryDate);
        if (filters.status === 'expired' && status !== 'expired') return false;
        if (filters.status === 'critical' && status !== 'critical') return false;
        if (filters.status === 'warning' && status !== 'warning' && status !== 'soon')
          return false;
        if (filters.status === 'good' && status !== 'good') return false;
      }
      return true;
    })
    .map((p) => ({
      ...p,
      daysLeft: getDaysUntilExpiry(p.expiryDate),
      status: getExpiryStatus(p.expiryDate),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const hasActiveFilters =
    filters.search || filters.category || filters.location || filters.status;

  async function handleConsume(productId: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    await logConsumption({
      productId,
      productName: product.name,
      quantity: 1,
      unit: product.unit,
      consumedAt: new Date().toISOString(),
      reason: 'verbraucht',
    });

    if (product.quantity <= 1) {
      await archiveProduct(productId);
    } else {
      await db.products.update(productId, {
        quantity: product.quantity - 1,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async function handleDelete(id: number) {
    await deleteProduct(id);
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">
          {showArchived ? 'Archiv' : 'Vorräte'}
        </h1>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="text-sm text-green-400 hover:text-green-300"
        >
          {showArchived ? 'Aktive anzeigen' : 'Archiv anzeigen'}
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Suchen..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full rounded-lg border border-primary-600 bg-primary-800 py-2 pl-10 pr-4 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 rounded-lg border px-3 py-2 ${
            hasActiveFilters
              ? 'border-green-500 text-green-400'
              : 'border-primary-600 text-gray-400'
          }`}
        >
          <Filter size={18} />
          <ChevronDown size={14} className={showFilters ? 'rotate-180' : ''} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-2 rounded-lg border border-primary-700 bg-primary-800/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Filter</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
              >
                <X size={12} /> Zurücksetzen
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={filters.category}
              onChange={(e) => setFilter('category', e.target.value)}
              className="rounded-lg border border-primary-600 bg-primary-900 px-3 py-2 text-sm text-gray-300"
            >
              <option value="">Alle Kategorien</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filters.location}
              onChange={(e) => setFilter('location', e.target.value)}
              className="rounded-lg border border-primary-600 bg-primary-900 px-3 py-2 text-sm text-gray-300"
            >
              <option value="">Alle Lagerorte</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              className="rounded-lg border border-primary-600 bg-primary-900 px-3 py-2 text-sm text-gray-300"
            >
              <option value="">Alle Status</option>
              <option value="expired">Abgelaufen</option>
              <option value="critical">Kritisch (≤7 Tage)</option>
              <option value="warning">Warnung (≤30 Tage)</option>
              <option value="good">OK (&gt;30 Tage)</option>
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {filtered.length} Produkt{filtered.length !== 1 ? 'e' : ''}
      </p>

      {/* Product List */}
      <div className="space-y-2">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border border-primary-700 bg-primary-800/60 p-3"
          >
            <div className="flex items-start gap-3">
              {product.photo ? (
                <img
                  src={product.photo}
                  alt={product.name}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-700">
                  <Package size={24} className="text-gray-500" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-200">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {CATEGORY_LABELS[product.category as ProductCategory] ?? product.category} &middot;{' '}
                      {product.storageLocation}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusBadgeColor(
                      product.status
                    )}`}
                  >
                    {getStatusLabel(product.status)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span>
                    MHD: {formatDate(product.expiryDate, product.expiryPrecision)} (
                    {formatDaysUntil(product.daysLeft)})
                  </span>
                  <span>
                    Menge: {product.quantity} {product.unit}
                  </span>
                  {product.minStock && product.quantity < product.minStock && (
                    <span className="text-yellow-400">
                      Unterbestand (Min: {product.minStock})
                    </span>
                  )}
                </div>

                {/* Actions */}
                {!showArchived && (
                  <div className="mt-2 flex gap-1">
                    <button
                      onClick={() => setEditingProductId(product.id!)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-primary-700 hover:text-gray-200"
                      title="Bearbeiten"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleConsume(product.id!)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-primary-700 hover:text-green-400"
                      title="Verbraucht"
                    >
                      <ShoppingCart size={16} />
                    </button>
                    <button
                      onClick={() => archiveProduct(product.id!)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-primary-700 hover:text-orange-400"
                      title="Archivieren"
                    >
                      <Archive size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(product.id!)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-primary-700 hover:text-red-400"
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Delete Confirmation */}
            {confirmDelete === product.id && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                <span className="text-sm text-red-400">Wirklich löschen?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(product.id!)}
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500"
                  >
                    Ja, löschen
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="rounded bg-primary-700 px-3 py-1 text-xs text-gray-300 hover:bg-primary-600"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <Package size={40} className="mx-auto mb-2 text-gray-600" />
            <p>Keine Produkte gefunden</p>
          </div>
        )}
      </div>
    </div>
  );
}
