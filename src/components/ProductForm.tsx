import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addProduct, updateProduct } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { compressImage, fetchAndCompressImage, lookupBarcode, formatDate, getDaysUntilExpiry, formatDaysUntil, getExpiryStatus, getStatusBadgeColor } from '../lib/utils';
import { recognizeExpiryDate, type ParsedExpiry } from '../lib/dateOcr';
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
  ScanText,
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

function InlineScanner({ onScanned, autoStart = false }: { onScanned: (data: { barcode: string; name?: string; imageUrl?: string }) => void; autoStart?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const cancelledRef = useRef(false);
  const processedRef = useRef(false);
  const [scanState, setScanState] = useState<ScanState>({ type: 'idle' });
  const [cameraActive, setCameraActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const autoStartedRef = useRef(false);
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
      cancelledRef.current = false;
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
          if (!result || processedRef.current) return;
          processedRef.current = true;
          const barcode = result.getText();
          stopCamera();
          vibrate(100);
          setScanState({ type: 'loading', barcode });

          try {
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
          } catch (err) {
            // Never leave the spinner stuck — proceed with the bare barcode.
            console.error('[PrepTrack] Barcode-Verarbeitung fehlgeschlagen:', err);
            setScanState({ type: 'success', barcode });
            onScanned({ barcode });
          }
        }
      );

      if (cancelledRef.current) {
        controls.stop();
        return;
      }

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
    return () => { cancelledRef.current = true; stopCamera(); };
  }, [stopCamera]);

  useEffect(() => {
    if (autoStart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setExpanded(true);
      startCamera();
    }
  }, [autoStart, startCamera]);

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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 active:scale-[0.98] transition-transform"
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-medium text-white hover:bg-green-600 active:scale-[0.98] transition-transform"
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

type DateScanState = 'idle' | 'live' | 'recognizing' | 'error';

/**
 * Inline expiry-date scanner: opens the camera ON THE PAGE (live <video> +
 * shutter) and runs offline OCR on the captured frame. Unlike a native
 * <input capture>, this never reloads the PWA, so the form state is preserved.
 */
function DateScanner({ onResult }: { onResult: (parsed: ParsedExpiry) => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<DateScanState>('idle');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    cancelledRef.current = false;
    setState('idle');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (cancelledRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState('live');
    } catch {
      setState('error');
    }
  }, []);

  const close = useCallback(() => {
    cancelledRef.current = true;
    stopCamera();
    setExpanded(false);
    setState('idle');
  }, [stopCamera]);

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setState('recognizing');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setState('error'); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) { setState('error'); return; }
      const parsed = await recognizeExpiryDate(blob);
      if (parsed) {
        onResult(parsed);
        vibrate(60);
        close();
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  useEffect(() => () => { cancelledRef.current = true; stopCamera(); }, [stopCamera]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => { setExpanded(true); startCamera(); }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-green-500/40 bg-green-500/5 px-4 py-2.5 text-sm font-medium text-green-400 transition-colors hover:border-green-500/60 hover:bg-green-500/10"
      >
        <ScanText size={16} />
        {t('form.ocrScanDate')}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary-600 bg-primary-800/50 p-3">
      <div className="flex items-center justify-between text-sm font-medium text-gray-300">
        <div className="flex items-center gap-2"><ScanText size={16} /> {t('form.ocrScanDate')}</div>
        <button type="button" onClick={close} aria-label={t('pwa.close')} className="rounded-lg p-1 text-gray-400 hover:bg-primary-700 hover:text-gray-200">
          <X size={18} />
        </button>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-primary-700 bg-black">
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" autoPlay playsInline muted />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-1/4 w-4/5 rounded-lg border-2 border-green-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
        </div>
        {state === 'recognizing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="flex items-center gap-2 text-sm text-gray-100">
              <Loader2 size={18} className="animate-spin" /> {t('form.ocrRunning')}
            </span>
          </div>
        )}
      </div>

      <p className="text-[0.7rem] text-gray-400">{t('form.ocrHint')}</p>
      {state === 'error' && <p className="text-xs text-orange-400">{t('form.ocrError')}</p>}

      <button
        type="button"
        onClick={capture}
        disabled={state !== 'live'}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition-transform hover:bg-green-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Camera size={18} />
        {state === 'recognizing' ? t('form.ocrRunning') : t('form.ocrCapture')}
      </button>
    </div>
  );
}

export function ProductForm() {
  const { editingProductId, setPage, setEditingProductId, scannedData, setScannedData, scanRequested, clearScanRequest } = useAppStore();
  const [autoStartScan] = useState(scanRequested);
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
  const [formError, setFormError] = useState<string | null>(null);

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
    if (scanRequested) { clearScanRequest(); }
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

  function handleDateScanned(parsed: ParsedExpiry) {
    setForm((prev) => ({ ...prev, expiryDate: parsed.date, expiryPrecision: parsed.precision }));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      updateField('photo', compressed);
      clearFormDraft();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('form.imageError'));
    }
    e.target.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.expiryDate) return;
    setFormError(null);
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
      setFormError(t('form.saveError'));
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
        <InlineScanner onScanned={handleScanned} autoStart={autoStartScan} />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p className="flex-1 text-sm text-red-300">{formError}</p>
            <button type="button" onClick={() => setFormError(null)} className="shrink-0 text-red-400 hover:text-red-300" aria-label={t('consume.cancel')}>
              <X size={16} />
            </button>
          </div>
        )}
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
          <div className="mt-2">
            <DateScanner onResult={handleDateScanned} />
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

        <button type="submit" disabled={saving || !form.name.trim() || !form.expiryDate} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-6 py-3 font-medium text-white shadow-lg shadow-green-600/20 transition-transform hover:bg-green-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100">
          <Save size={20} />
          {saving ? t('form.saving') : editingProductId ? t('form.saveChanges') : t('form.saveProduct')}
        </button>
      </form>
    </div>
  );
}
