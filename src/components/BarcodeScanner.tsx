import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAppStore } from '../store/useAppStore';
import { lookupBarcode } from '../lib/utils';
import {
  Camera,
  CameraOff,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

type ScanState =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'loading'; barcode: string }
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
  const [state, setState] = useState<ScanState>({ type: 'idle' });
  const [cameraActive, setCameraActive] = useState(false);
  const isOnline = useOnlineStatus();
  const { navigateToAddWithScan } = useAppStore();

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      processedRef.current = false;
      setState({ type: 'scanning' });
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCamera = devices.find(
        (d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('rück')
      );

      const deviceId = backCamera?.deviceId || devices[0]?.deviceId;
      if (!deviceId) {
        setState({ type: 'error', message: 'Keine Kamera gefunden.' });
        return;
      }

      await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        async (result) => {
          if (result && !processedRef.current) {
            processedRef.current = true;
            const barcode = result.getText();
            stopCamera();
            vibrate(100);

            if (!isOnline) {
              // Offline: go to form with just the barcode
              navigateToAddWithScan({ barcode });
              return;
            }

            setState({ type: 'loading', barcode });

            const product = await lookupBarcode(barcode);
            // Navigate to form with whatever data we got
            navigateToAddWithScan({
              barcode,
              name: product?.name,
              imageUrl: product?.imageUrl,
            });
          }
        }
      );

      setCameraActive(true);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Kein Kamera-Zugriff. Bitte in den Browser-Einstellungen erlauben.'
          : 'Kamera konnte nicht gestartet werden.';
      setState({ type: 'error', message });
    }
  }, [isOnline, stopCamera]);

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
      <h1 className="text-2xl font-bold text-gray-100">Barcode scannen</h1>
      <p className="text-sm text-gray-400">
        Kamera auf den Barcode halten — du wirst automatisch zum Formular weitergeleitet.
      </p>

      {/* Camera View */}
      <div className="relative overflow-hidden rounded-xl border border-primary-700 bg-black">
        <video
          ref={videoRef}
          className={`aspect-[4/3] w-full object-cover ${cameraActive ? '' : 'hidden'}`}
          playsInline
          muted
        />
        {!cameraActive && state.type !== 'scanning' && state.type !== 'loading' && (
          <div className="flex aspect-[4/3] items-center justify-center bg-primary-900">
            <CameraOff size={48} className="text-gray-600" />
          </div>
        )}

        {/* Scan overlay with darkened surround */}
        {cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-1/3 w-3/4 rounded-lg border-2 border-green-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
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
          Kamera starten
        </button>
      )}

      {state.type === 'scanning' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-6 py-3">
          <Loader2 size={20} className="animate-spin text-green-400" />
          <span className="text-gray-300">Suche Barcode...</span>
          <button onClick={() => { stopCamera(); reset(); }} className="ml-auto text-gray-400 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
      )}

      {state.type === 'loading' && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-6 py-3">
          <Loader2 size={20} className="animate-spin text-blue-400" />
          <span className="text-gray-300">
            Lade Produktdaten für {state.barcode}...
          </span>
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
            Manuell eingeben
          </button>
          <button
            onClick={reset}
            className="w-full text-sm text-gray-400 hover:text-gray-300"
          >
            Nochmal versuchen
          </button>
        </div>
      )}
    </div>
  );
}
