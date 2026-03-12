import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addProduct, updateProduct } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { compressImage, fetchAndCompressImage, lookupBarcode, formatDate, getDaysUntilExpiry, formatDaysUntil, getExpiryStatus, getStatusBadgeColor } from '../lib/utils';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  DEFAULT_UNITS,
  type Product,
  type ProductCategory,
} from '../types';
import {
  Camera,
  Upload,
  X,
  Save,
  ArrowLeft,
  ScanBarcode,
  CameraOff,
  Loader2,
  AlertCircle,
  Package,
  MapPin,
  Calendar,
  Layers,
  PlusCircle,
  ChevronDown,
} from 'lucide-react';

const FORM_STORAGE_KEY = 'preptrack-form-draft';

interface FormState {
  name: string;
  barcode: string;
  category: ProductCategory;
  storageLocation: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  expiryPrecision: 'day' | 'month' | 'year';
  photo: string;
  minStock: string;
  notes: string;
}

const defaultForm: FormState = {
  name: '',
  barcode: '',
  category: 'lebensmittel',
  storageLocation: 'Keller',
  quantity: '1',
  unit: 'Stück',
  expiryDate: '',
  expiryPrecision: 'day',
  photo: '',
  minStock: '0',
  notes: '',
};

function saveFormDraft(form: FormState, editingId: number | null) {
  try {
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({ form, editingId, timestamp: Date.now() }));
  } catch { /* sessionStorage full or unavailable */ }
}

function loadFormDraft(): { form: FormState; editingId: number | null } | null {
  try {
    const raw = sessionStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      sessionStorage.removeItem(FORM_STORAGE_KEY);
      return null;
    }
    return { form: data.form, editingId: data.editingId };
  } catch { return null; }
}

function clearFormDraft() {
  sessionStorage.removeItem(FORM_STORAGE_KEY);
}

function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

type ScanState =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'loading'; barcode: string }
  | { type: 'duplicate'; barcode: string; existing: Product[]; apiName?: string }
  | { type: 'error'; message: string }
  | { type: 'success'; barcode: string; name?: string };

function InlineScanner({ onScanned }: { onScanned: (data: { barcode: string; name?: string; imageUrl?: string }) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const processedRef = useRef(false);
  const [scanState, setScanState] = useState<ScanState>({ type: 'idle' });
  const [cameraActive, setCameraActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isOnline = useOnlineStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const { t } = useTranslation();

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((tr) => tr.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      // Dynamically import @zxing/browser only when needed
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      stopCamera();
      processedRef.current = false;
      setScanState({ type: 'scanning' });
      setExpanded(true);
      const reader = new BrowserMultiFormatReader();

      if (!videoRef.current) {
        setScanState({ type: 'error', message: t('scanner.cameraError') });
        return;
      }

      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        async (result) => {
          if (result && !processedRef.current) {
            processedRef.current = true;
            const barcode = result.getText();
            stopCamera();
            vibrate(100);
            setScanState({ type: 'loading', barcode });

            // Check for duplicates
            const existing = await db.products
              .where('barcode')
              .equals(barcode)
              .filter((p) => !p.archived)
              .toArray();

            if (existing.length > 0) {
              let apiName: string | undefined;
              if (isOnlineRef.current) {
                const apiResult = await lookupBarcode(barcode);
                apiName = apiResult?.name;
              }
              setScanState({ type: 'duplicate', barcode, existing, apiName });
              return;
            }

            // No duplicate — look up online
            if (isOnlineRef.current) {
              const product = await lookupBarcode(barcode);
              setScanState({ type: 'success', barcode, name: product?.name });
              onScanned({ barcode, name: product?.name, imageUrl: product?.imageUrl });
            } else {
              setScanState({ type: 'success', barcode });
              onScanned({ barcode });
            }
          }
        }
      );

      controlsRef.current = controls;
      setCameraActive(true);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? t('scanner.cameraNoAccess')
          : t('scanner.cameraError');
      setScanState({ type: 'error', message });
    }
  }, [stopCamera, onScanned, t]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  function reset() {
    processedRef.current = false;
    setScanState({ type: 'idle' });
  }

  // Collapsed state — just a button
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => { setExpanded(true); startCamera(); }}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-green-500/40 bg-green-500/5 px-4 py-4 text-green-400 transition-colors hover:border-green-500/60 hover:bg-green-500/10"
      >
        <ScanBarcode size={24} />
        <span className="font-medium">{t('scanner.startCamera')}</span>
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary-600 bg-primary-800/50 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <ScanBarcode size={16} />
          {t('scanner.title')}
        </div>
        <button
          type="button"
          onClick={() => { stopCamera(); reset(); setExpanded(false); }}
          className="rounded-lg p-1 text-gray-400 hover:bg-primary-700 hover:text-gray-200"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Camera View */}
      <div className="relative overflow-hidden rounded-lg border border-primary-700 bg-black">
        <video
          ref={videoRef}
          className={`aspect-[4/3] w-full object-cover ${cameraActive ? '' : 'hidden'}`}
          autoPlay
          playsInline
          muted
        />
        {!cameraActive && scanState.type !== 'scanning' && scanState.type !== 'loading' && (
          <div className="flex aspect-[4/3] items-center justify-center bg-primary-900">
            <CameraOff size={36} className="text-gray-600" />
          </div>
        )}
        {cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-1/3 w-3/4 rounded-lg border-2 border-green-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
            <div className="scan-line" />
          </div>
        )}
      </div>

      {/* Scan controls & status */}
      {scanState.type === 'idle' && (
        <button
          type="button"
          onClick={startCamera}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
        >
          <Camera size={18} />
          {t('scanner.startCamera')}
        </button>
      )}

      {scanState.type === 'scanning' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-sm">
          <Loader2 size={16} className="animate-spin text-green-400" />
          <span className="text-gray-300">{t('scanner.searching')}</span>
          <button type="button" onClick={() => { stopCamera(); reset(); }} className="ms-auto text-gray-400 hover:text-gray-200">
            <X size={16} />
          </button>
        </div>
      )}

      {scanState.type === 'loading' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-sm">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <span className="text-gray-300">{t('scanner.loadingProduct', { barcode: scanState.barcode })}</span>
        </div>
      )}

      {scanState.type === 'success' && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-300">
          <Package size={16} />
          <span>{scanState.name || scanState.barcode}</span>
          <button type="button" onClick={() => { reset(); startCamera(); }} className="ms-auto text-xs text-gray-400 hover:text-gray-200">
            {t('scanner.scanAgain')}
          </button>
        </div>
      )}

      {/* Duplicate found */}
      {scanState.type === 'duplicate' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-orange-400" />
            <p className="text-sm font-semibold text-orange-300">{t('scanner.duplicateFound')}</p>
          </div>
          <p className="text-xs text-gray-400">
            Barcode: {scanState.barcode}{scanState.apiName ? ` · ${scanState.apiName}` : ''}
          </p>
          <div className="space-y-1.5">
            {scanState.existing.map((product) => {
              const status = getExpiryStatus(product.expiryDate);
              const daysLeft = getDaysUntilExpiry(product.expiryDate);
              return (
                <div key={product.id} className="rounded-lg border border-primary-700 bg-primary-800 p-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-200">{product.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusBadgeColor(status)}`}>
                      {t(`status.${status}`)}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-400">
                    <div className="flex items-center gap-1"><MapPin size={10} />{product.storageLocation}</div>
                    <div className="flex items-center gap-1"><Layers size={10} />{product.quantity} {product.unit}</div>
                    <div className="flex items-center gap-1"><Calendar size={10} />{formatDate(product.expiryDate, product.expiryPrecision)}</div>
                    <div className={`flex items-center gap-1 font-semibold ${
                      status === 'expired' || status === 'critical' ? 'text-red-400' :
                      status === 'warning' ? 'text-orange-400' :
                      status === 'soon' ? 'text-yellow-400' : 'text-green-400'
                    }`}>{formatDaysUntil(daysLeft)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const name = scanState.apiName || scanState.existing[0]?.name;
                setScanState({ type: 'success', barcode: scanState.barcode, name });
                onScanned({ barcode: scanState.barcode, name });
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
            >
              <PlusCircle size={14} />
              {t('scanner.addAnyway')}
            </button>
            <button
              type="button"
              onClick={() => { reset(); startCamera(); }}
              className="flex-1 rounded-lg border border-primary-600 px-3 py-2 text-xs text-gray-300 hover:bg-primary-700"
            >
              {t('scanner.scanAgain')}
            </button>
          </div>
        </div>
      )}

      {scanState.type === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
            <p className="text-xs text-gray-300">{scanState.message}</p>
          </div>
          <button type="button" onClick={() => { reset(); startCamera(); }} className="w-full text-xs text-gray-400 hover:text-gray-300">
            {t('scanner.retry')}
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductForm() {
  const { editingProductId, setPage, setEditingProductId, scannedData, setScannedData } = useAppStore();
  const locations = useLiveQuery(() => db.storageLocations.toArray()) ?? [];
  const existingProduct = useLiveQuery(() => (editingProductId ? db.products.get(editingProductId) : undefined), [editingProductId]);
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const populatedRef = useRef(false);

  const [form, setForm] = useState<FormState>(() => {
    const draft = loadFormDraft();
    if (draft) { restoredRef.current = true; return draft.form; }
    return { ...defaultForm, storageLocation: '' };
  });

  const [saving, setSaving] = useState(false);

  function getQuantityStep(unit: string): string {
    switch (unit) {
      case 'kg': return '0.1';
      case 'Liter': return '0.25';
      case 'g': case 'ml': return '1';
      default: return '1';
    }
  }

  useEffect(() => {
    if (restoredRef.current) { clearFormDraft(); restoredRef.current = false; }
  }, []);

  useEffect(() => {
    if (existingProduct && !populatedRef.current) {
      populatedRef.current = true;
      setForm({
        name: existingProduct.name,
        barcode: existingProduct.barcode || '',
        category: existingProduct.category,
        storageLocation: existingProduct.storageLocation,
        quantity: String(existingProduct.quantity),
        unit: existingProduct.unit,
        expiryDate: existingProduct.expiryDate.split('T')[0],
        expiryPrecision: existingProduct.expiryPrecision,
        photo: existingProduct.photo || '',
        minStock: String(existingProduct.minStock || 0),
        notes: existingProduct.notes || '',
      });
    }
  }, [existingProduct]);

  useEffect(() => {
    populatedRef.current = false;
    if (!editingProductId) {
      setForm((prev) => {
        if (prev.name && !restoredRef.current) {
          return { ...defaultForm, storageLocation: prev.storageLocation || '' };
        }
        return prev;
      });
    }
  }, [editingProductId]);

  useEffect(() => {
    if (scannedData && !editingProductId) {
      setForm((prev) => ({ ...prev, barcode: scannedData.barcode || prev.barcode, name: scannedData.name || prev.name }));
      const imageUrl = scannedData.imageUrl;
      setScannedData(null);
      if (imageUrl) {
        fetchAndCompressImage(imageUrl).then((base64) => {
          if (base64) setForm((prev) => ({ ...prev, photo: base64 }));
        });
      }
    }
  }, [scannedData, editingProductId, setScannedData]);

  useEffect(() => {
    if (!editingProductId && locations.length > 0 && !form.storageLocation) {
      setForm((prev) => ({ ...prev, storageLocation: locations[0].name }));
    }
  }, [locations, editingProductId, form.storageLocation]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleScanned = useCallback((data: { barcode: string; name?: string; imageUrl?: string }) => {
    setForm((prev) => ({
      ...prev,
      barcode: data.barcode || prev.barcode,
      name: data.name || prev.name,
    }));
    if (data.imageUrl) {
      fetchAndCompressImage(data.imageUrl).then((base64) => {
        if (base64) setForm((prev) => ({ ...prev, photo: base64 }));
      });
    }
  }, []);

  function handleCameraClick() {
    saveFormDraft(form, editingProductId);
    cameraInputRef.current?.click();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      updateField('photo', compressed);
      clearFormDraft();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('form.imageError'));
    }
    e.target.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.expiryDate) return;
    setSaving(true);
    try {
      const productData: Omit<Product, 'id'> = {
        name: form.name.trim(),
        barcode: form.barcode || undefined,
        category: form.category,
        storageLocation: form.storageLocation,
        quantity: parseFloat(form.quantity) || 1,
        unit: form.unit,
        expiryDate: new Date(form.expiryDate).toISOString(),
        expiryPrecision: form.expiryPrecision,
        photo: form.photo || undefined,
        minStock: parseFloat(form.minStock) || undefined,
        notes: form.notes || undefined,
        archived: false,
        createdAt: editingProductId ? existingProduct?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (editingProductId) { await updateProduct(editingProductId, productData); }
      else { await addProduct(productData); }
      clearFormDraft();
      setEditingProductId(null);
      setPage('products');
    } catch (err) {
      console.error('Speichern fehlgeschlagen:', err);
      alert(t('form.saveError'));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {editingProductId && (
          <button onClick={() => { clearFormDraft(); setEditingProductId(null); setPage('products'); }} className="rounded-lg p-2 text-gray-400 hover:bg-primary-700 hover:text-gray-200">
            <ArrowLeft size={20} />
          </button>
        )}
        <h2 className="text-2xl font-bold text-gray-100">
          {editingProductId ? t('form.editTitle') : t('form.addTitle')}
        </h2>
      </div>

      {/* Inline Barcode Scanner — only when adding new products */}
      {!editingProductId && (
        <InlineScanner onScanned={handleScanned} />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.photo')}</label>
          <div className="flex items-center gap-3">
            {form.photo ? (
              <div className="relative">
                <img src={form.photo} alt={t('form.productImage')} className="h-20 w-20 rounded-lg object-cover" />
                <button type="button" onClick={() => updateField('photo', '')} className="absolute -end-1 -top-1 rounded-full bg-red-600 p-0.5"><X size={12} className="text-white" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={handleCameraClick} className="hidden items-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2 text-sm text-gray-300 hover:border-green-500">
                  <Camera size={18} /> {t('form.camera')}
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2 text-sm text-gray-300 hover:border-green-500">
                  <Upload size={18} /> {t('form.gallery')}
                </button>
              </div>
            )}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.productName')}</label>
          <input type="text" required value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder={t('form.productNamePlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.barcode')}</label>
          <input type="text" value={form.barcode} onChange={(e) => updateField('barcode', e.target.value)} placeholder={t('form.barcodePlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.category')}</label>
            <select value={form.category} onChange={(e) => updateField('category', e.target.value as ProductCategory)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none">
              {(['konserven', 'wasser', 'medizin', 'werkzeug', 'hygiene', 'lebensmittel', 'getranke', 'elektronik', 'kleidung', 'sonstiges'] as ProductCategory[]).map((key) => (
                <option key={key} value={key}>{t(`categories.${key}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.storageLocation')}</label>
            <select value={form.storageLocation} onChange={(e) => updateField('storageLocation', e.target.value)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none">
              {locations.map((loc) => (<option key={loc.id} value={loc.name}>{loc.name}</option>))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.quantity')}</label>
            <input type="number" min={getQuantityStep(form.unit)} step={getQuantityStep(form.unit)} required value={form.quantity} onChange={(e) => updateField('quantity', e.target.value)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.unit')}</label>
            <select value={form.unit} onChange={(e) => updateField('unit', e.target.value)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none">
              {DEFAULT_UNITS.map((unit) => (<option key={unit} value={unit}>{t(`units.${unit}`)}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.expiryDate')}</label>
          <div className="flex gap-2">
            <input type="date" required value={form.expiryDate} onChange={(e) => updateField('expiryDate', e.target.value)} className="flex-1 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none" />
            <select value={form.expiryPrecision} onChange={(e) => updateField('expiryPrecision', e.target.value as 'day' | 'month' | 'year')} className="rounded-lg border border-primary-600 bg-primary-800 px-3 py-2.5 text-sm text-gray-200 focus:border-green-500 focus:outline-none">
              <option value="day">{t('form.precisionDay')}</option>
              <option value="month">{t('form.precisionMonth')}</option>
              <option value="year">{t('form.precisionYear')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.minStock')}</label>
          <input type="number" min="0" value={form.minStock} onChange={(e) => updateField('minStock', e.target.value)} placeholder={t('form.minStockPlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.notes')}</label>
          <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} placeholder={t('form.notesPlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <button type="submit" disabled={saving || !form.name.trim() || !form.expiryDate} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50">
          <Save size={20} />
          {saving ? t('form.saving') : editingProductId ? t('form.saveChanges') : t('form.saveProduct')}
        </button>
      </form>
    </div>
  );
}
