import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Camera, RotateCcw, Check } from 'lucide-react';

interface ImageCaptureModalProps {
  isOpen: boolean;
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export function ImageCaptureModal({ isOpen, onCapture, onClose }: ImageCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [captured, setCaptured] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setPermissionDenied(false);
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setLoading(false);
      }
    } catch {
      setPermissionDenied(true);
      setLoading(false);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (isOpen) {
      setCaptured(null);
      setFrozen(false);
      startCamera();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [isOpen, startCamera, stopStream]);

  const shoot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    setFrozen(true);
    navigator.vibrate?.([80]);

    setTimeout(() => {
      let quality = 0.85;
      let base64 = canvas.toDataURL('image/jpeg', quality);

      while (base64.length > 500_000 && quality > 0.3) {
        quality -= 0.1;
        base64 = canvas.toDataURL('image/jpeg', quality);
      }

      setCaptured(base64);
      setFrozen(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => (t.enabled = false));
      }
    }, 150);
  }, []);

  const retake = useCallback(() => {
    setCaptured(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => (t.enabled = true));
    }
  }, []);

  const confirm = useCallback(() => {
    if (captured) {
      onCapture(captured);
      onClose();
    }
  }, [captured, onCapture, onClose]);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
          aria-label="Schliessen"
        >
          <X size={20} />
        </button>
        {!permissionDenied && !captured && (
          <button
            onClick={flipCamera}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
            aria-label="Kamera wechseln"
          >
            <RotateCcw size={18} />
          </button>
        )}
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        {permissionDenied ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white">
            <Camera size={48} className="mb-4 opacity-40" />
            <p className="mb-2 text-lg font-medium">Kein Kamera-Zugriff</p>
            <p className="mb-6 text-sm opacity-60">
              Erlaube den Kamera-Zugriff in den Browser-Einstellungen.
            </p>
            <button
              onClick={onClose}
              className="rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white"
            >
              Schliessen
            </button>
          </div>
        ) : captured ? (
          <img
            src={captured}
            alt="Aufgenommenes Foto"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
                frozen || loading ? 'opacity-0' : 'opacity-100'
              }`}
            />
            {frozen && <div className="absolute inset-0 animate-pulse bg-white" />}
            {!loading && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded border-2 border-white/30">
                  <div className="absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-green-400" />
                  <div className="absolute -right-px -top-px h-6 w-6 border-r-2 border-t-2 border-green-400" />
                  <div className="absolute -bottom-px -left-px h-6 w-6 border-b-2 border-l-2 border-green-400" />
                  <div className="absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-green-400" />
                </div>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="camera-loader" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8 bg-gradient-to-t from-black/80 to-transparent pb-10 pt-6">
        {captured ? (
          <>
            <button onClick={retake} className="flex flex-col items-center gap-2 text-white/70">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/40">
                <RotateCcw size={20} />
              </div>
              <span className="text-xs">Nochmal</span>
            </button>
            <button onClick={confirm} className="flex flex-col items-center gap-2 text-green-400">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <Check size={28} className="text-black" />
              </div>
              <span className="text-xs font-semibold">Verwenden</span>
            </button>
          </>
        ) : (
          <button
            onClick={shoot}
            disabled={loading || permissionDenied}
            aria-label="Foto aufnehmen"
            className="shutter-btn"
          >
            <span className="shutter-inner" />
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
