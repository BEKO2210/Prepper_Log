import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAppStore } from '../store/useAppStore';
import { lookupBarcode, formatDate, getDaysUntilExpiry, formatDaysUntil, getExpiryStatus, getStatusBadgeColor } from '../lib/utils';
import { db } from '../lib/db';
import type { Product } from '../types';
import {
  Camera,
  CameraOff,
  Loader2,
  AlertCircle,
  X,
  Package,
  MapPin,
  Calendar,
  Layers,
  PlusCircle,
} from 'lucide-react';

type ScanState =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'loading'; barcode: string }
  | { type: 'duplicate'; barcode: string; existing: Product[]; apiName?: string }
  | { type: 'error'; message: string };

function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export function BarcodeScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const processedRef = useRef(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [state, setState] = useState<ScanState>({ type: 'idle' });
  const [cameraActive, setCameraActive] = useState(false);
  const isOnline = useOnlineStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const { navigateToAddWithScan } = useAppStore();
  const { t } = useTranslation();

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      processedRef.current = false;
      setState({ type: 'scanning' });
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const constraints: MediaStreamConstraints = {
        video: { facingMode: 'environment' },
      };

      if (!videoRef.current) {
        setState({ type: 'error', message: t('scanner.cameraError') });
        return;
      }

      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        async (result) => {
          if (result && !processedRef.current) {
            processedRef.current = true;
            const barcode = result.getText();
            stopCamera();
            vibrate(100);

            setState({ type: 'loading', barcode });

            // Check if barcode already exists in the local DB
            const existing = await db.products
              .where('barcode')
              .equals(barcode)
              .filter((p) => !p.archived)
              .toArray();

            if (existing.length > 0) {
              // Fetch API name in background for extra info
              let apiName: string | undefined;
              if (isOnlineRef.current) {
                const apiResult = await lookupBarcode(barcode);
                apiName = apiResult?.name;
              }
              setState({ type: 'duplicate', barcode, existing, apiName });
              return;
            }

            // No duplicate — look up online and go to form
            if (!isOnlineRef.current) {
              navigateToAddWithScan({ barcode });
              return;
            }

            const product = await lookupBarcode(barcode);
            navigateToAddWithScan({
              barcode,
              name: product?.name,
              imageUrl: product?.imageUrl,
            });
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
      setState({ type: 'error', message });
    }
  }, [stopCamera, navigateToAddWithScan, t]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  function reset() {
    processedRef.current = false;
    setState({ type: 'idle' });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-100">{t('scanner.title')}</h2>
      <p className="text-sm text-gray-400">
        {t('scanner.description')}
      </p>

      {/* Camera View */}
      <div className="relative overflow-hidden rounded-xl border border-primary-700 bg-black">
        <video
          ref={videoRef}
          className={`aspect-[4/3] w-full object-cover ${cameraActive ? '' : 'hidden'}`}
          autoPlay
          playsInline
          muted
        />
        {!cameraActive && state.type !== 'scanning' && state.type !== 'loading' && (
          <div className="flex aspect-[4/3] items-center justify-center bg-primary-900">
            <CameraOff size={48} className="text-gray-600" />
          </div>
        )}

        {/* Scan overlay with darkened surround + animated scan line */}
        {cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-1/3 w-3/4 rounded-lg border-2 border-green-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
            <div className="scan-line" />
          </div>
        )}
      </div>

      {/* Controls */}
      {state.type === 'idle' && (
        <button
          onClick={startCamera}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
        >
          <Camera size={20} />
          {t('scanner.startCamera')}
        </button>
      )}

      {state.type === 'scanning' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-6 py-3">
          <Loader2 size={20} className="animate-spin text-green-400" />
          <span className="text-gray-300">{t('scanner.searching')}</span>
          <button onClick={() => { stopCamera(); reset(); }} className="ml-auto text-gray-400 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
      )}

      {state.type === 'loading' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-6 py-3">
          <Loader2 size={20} className="animate-spin text-blue-400" />
          <span className="text-gray-300">
            {t('scanner.loadingProduct', { barcode: state.barcode })}
          </span>
        </div>
      )}

      {/* Duplicate found popup */}
      {state.type === 'duplicate' && (
        <div className="space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-orange-400" />
            <p className="font-semibold text-orange-300">
              {t('scanner.duplicateFound')}
            </p>
          </div>
          {state.apiName && (
            <p className="text-sm text-gray-400">
              Barcode: {state.barcode} &middot; {state.apiName}
            </p>
          )}
          {!state.apiName && (
            <p className="text-sm text-gray-400">Barcode: {state.barcode}</p>
          )}

          <div className="space-y-2">
            {state.existing.map((product) => {
              const status = getExpiryStatus(product.expiryDate);
              const daysLeft = getDaysUntilExpiry(product.expiryDate);
              return (
                <div
                  key={product.id}
                  className="rounded-lg border border-primary-700 bg-primary-800 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-200">{product.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusBadgeColor(status)}`}>
                      {t(`status.${status}`)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-gray-400" />
                      {product.storageLocation}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers size={12} className="text-gray-400" />
                      {product.quantity} {product.unit}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" />
                      {formatDate(product.expiryDate, product.expiryPrecision)}
                    </div>
                    <div className={`flex items-center gap-1.5 font-semibold ${
                      status === 'expired' || status === 'critical' ? 'text-red-400' :
                      status === 'warning' ? 'text-orange-400' :
                      status === 'soon' ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {formatDaysUntil(daysLeft)}
                    </div>
                  </div>
                  {product.notes && (
                    <p className="mt-1.5 text-xs italic text-gray-400">{product.notes}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                navigateToAddWithScan({
                  barcode: state.barcode,
                  name: state.apiName || state.existing[0]?.name,
                });
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
            >
              <PlusCircle size={16} />
              {t('scanner.addAnyway')}
            </button>
            <button
              onClick={startCamera}
              className="flex-1 rounded-lg border border-primary-600 px-4 py-2.5 text-sm text-gray-300 hover:bg-primary-700"
            >
              {t('scanner.scanAgain')}
            </button>
          </div>
          <button
            onClick={reset}
            className="w-full text-sm text-gray-400 hover:text-gray-300"
          >
            {t('scanner.cancel')}
          </button>
        </div>
      )}

      {state.type === 'error' && (
        <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={24} className="shrink-0 text-red-400" />
            <p className="text-sm text-gray-300">{state.message}</p>
          </div>
          <button
            onClick={() => navigateToAddWithScan({ barcode: '' })}
            className="w-full rounded-lg border border-primary-600 px-4 py-2 text-sm text-gray-300 hover:bg-primary-700"
          >
            {t('scanner.manualEntry')}
          </button>
          <button
            onClick={reset}
            className="w-full text-sm text-gray-400 hover:text-gray-300"
          >
            {t('scanner.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
