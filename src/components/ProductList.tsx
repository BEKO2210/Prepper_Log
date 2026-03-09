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
import { CATEGORY_LABELS, type ProductCategory, type Product } from '../types';
import {
  Search,
  Filter,
  Edit3,
  Trash2,
  Package,
  ChevronDown,
  X,
  ShoppingCart,
  MapPin,
  Calendar,
  Layers,
  Clock,
  Tag,
  FileText,
  CheckCircle,
  Info,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { archiveProduct, deleteProduct, logConsumption } from '../lib/db';

const BORDER_COLORS: Record<string, string> = {
  expired: 'border-l-red-500',
  critical: 'border-l-red-400',
  warning: 'border-l-orange-400',
  soon: 'border-l-yellow-400',
  good: 'border-l-green-400',
};

export function ProductList() {
  const { filters, setFilter, resetFilters, setEditingProductId } = useAppStore();
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);

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

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
    return () => clearTimeout(timer);
  }, [toast.visible]);

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
      showToast(`„${product.name}" — 1× verbraucht und ins Archiv verschoben`);
    } else {
      await db.products.update(productId, {
        quantity: product.quantity - 1,
        updatedAt: new Date().toISOString(),
      });
      showToast(`„${product.name}" — 1× verbraucht (noch ${product.quantity - 1} ${product.unit})`);
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
            placeholder="Name oder Barcode..."
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
          <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
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
              <option value="critical">Kritisch (&le;7 Tage)</option>
              <option value="warning">Warnung (&le;30 Tage)</option>
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
            onClick={() => setSelectedProduct(product.id!)}
            className={`border-l-4 ${BORDER_COLORS[product.status]} cursor-pointer rounded-r-lg border border-primary-700 bg-primary-800/60 p-3 transition-colors hover:bg-primary-800`}
          >
            <div className="flex items-start gap-3">
              {product.photo ? (
                <img
                  src={product.photo}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-700">
                  <Package size={24} className="text-gray-600" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-200">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500">
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
                    MHD: {formatDate(product.expiryDate, product.expiryPrecision)} ({formatDaysUntil(product.daysLeft)})
                  </span>
                  <span>
                    {product.quantity} {product.unit}
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
                      onClick={(e) => { e.stopPropagation(); setEditingProductId(product.id!); }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-primary-700 hover:text-gray-200"
                      title="Bearbeiten"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleConsume(product.id!); }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-primary-700 hover:text-green-400"
                      title="Verbraucht"
                    >
                      <ShoppingCart size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(product.id!); }}
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
                <span className="text-sm text-red-400">Wirklich löschen? Nicht rückgängig machbar.</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(product.id!)}
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500"
                  >
                    Löschen
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
            {hasActiveFilters ? (
              <p>Kein Treffer für diese Filter.</p>
            ) : showArchived ? (
              <p>Archiv ist leer.</p>
            ) : (
              <p>Noch keine Produkte erfasst.</p>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-primary-900/95 px-4 py-3 shadow-lg backdrop-blur">
            <CheckCircle size={18} className="shrink-0 text-green-400" />
            <span className="text-sm text-gray-200">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          productId={selectedProduct}
          products={products}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Product Detail Popup                                               */
/* ------------------------------------------------------------------ */

function ProductDetailModal({
  productId,
  products,
  onClose,
}: {
  productId: number;
  products: Product[];
  onClose: () => void;
}) {
  const product = products.find((p) => p.id === productId);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!product) return null;

  const status = getExpiryStatus(product.expiryDate);
  const daysLeft = getDaysUntilExpiry(product.expiryDate);

  // Countdown berechnen (bis auf Minuten genau)
  const expiryMs = new Date(product.expiryDate).getTime();
  const diffMs = expiryMs - now;
  const isExpired = diffMs <= 0;
  const absDiff = Math.abs(diffMs);
  const totalMinutes = Math.floor(absDiff / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const countdownText = isExpired
    ? `Seit ${days} T ${hours} Std ${minutes} Min abgelaufen`
    : `${days} T ${hours} Std ${minutes} Min verbleibend`;

  // Einlagerungsdauer
  const createdMs = new Date(product.createdAt).getTime();
  const storedDiff = now - createdMs;
  const storedDays = Math.floor(storedDiff / 86_400_000);

  // Fortschrittsbalken: Einlagerung bis Ablauf
  const totalSpan = expiryMs - createdMs;
  const elapsed = now - createdMs;
  const progressPercent = totalSpan > 0 ? Math.max(0, Math.min(100, (elapsed / totalSpan) * 100)) : 100;

  const progressColor =
    status === 'expired' || status === 'critical'
      ? 'bg-red-500'
      : status === 'warning'
        ? 'bg-orange-400'
        : status === 'soon'
          ? 'bg-yellow-400'
          : 'bg-green-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 mb-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-primary-600 bg-primary-900 shadow-2xl sm:mb-0"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary-700 bg-primary-900/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <Info size={20} className="shrink-0 text-green-400" />
            <h2 className="truncate text-lg font-bold text-gray-100">
              {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-primary-700 hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Foto */}
          {product.photo && (
            <img
              src={product.photo}
              alt={product.name}
              className="h-48 w-full rounded-xl object-cover"
            />
          )}

          {/* Status Badge + Countdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadgeColor(status)}`}
              >
                {getStatusLabel(status)}
              </span>
              <span className="text-sm font-medium text-gray-300">
                {formatDaysUntil(daysLeft)}
              </span>
            </div>

            {/* Zeitbalken */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock size={14} />
                <span>{countdownText}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-primary-700">
                <div
                  className={`h-full rounded-full transition-all ${progressColor}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>Eingelagert: {new Date(product.createdAt).toLocaleDateString('de-DE')}</span>
                <span>MHD: {formatDate(product.expiryDate, product.expiryPrecision)}</span>
              </div>
            </div>
          </div>

          {/* Detail-Raster */}
          <div className="grid grid-cols-2 gap-3">
            <DetailItem icon={<Tag size={16} />} label="Kategorie" value={CATEGORY_LABELS[product.category as ProductCategory] ?? product.category} />
            <DetailItem icon={<MapPin size={16} />} label="Lagerort" value={product.storageLocation} />
            <DetailItem icon={<Layers size={16} />} label="Menge" value={`${product.quantity} ${product.unit}`} />
            <DetailItem icon={<Calendar size={16} />} label="MHD" value={formatDate(product.expiryDate, product.expiryPrecision)} />
            {product.barcode && (
              <DetailItem icon={<Package size={16} />} label="Barcode" value={product.barcode} />
            )}
            {product.minStock !== undefined && product.minStock > 0 && (
              <DetailItem icon={<Layers size={16} />} label="Mindestbestand" value={`${product.minStock} ${product.unit}`} />
            )}
            <DetailItem icon={<Clock size={16} />} label="Eingelagert seit" value={`${storedDays} Tage`} />
            {product.updatedAt !== product.createdAt && (
              <DetailItem icon={<Calendar size={16} />} label="Zuletzt bearbeitet" value={new Date(product.updatedAt).toLocaleDateString('de-DE')} />
            )}
          </div>

          {/* Bemerkungen */}
          {product.notes && (
            <div className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300">
                <FileText size={16} className="text-gray-500" />
                Bemerkungen
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-400">
                {product.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary-700 bg-primary-800/40 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-gray-500">
        {icon}
        {label}
      </div>
      <p className="truncate text-sm font-medium text-gray-200">{value}</p>
    </div>
  );
}
