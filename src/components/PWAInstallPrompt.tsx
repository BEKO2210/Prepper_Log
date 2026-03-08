import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PWAInstallPrompt() {
  const { isInstallable, showIOSInstructions, install, dismiss } = usePWAInstall();

  const showPrompt = isInstallable || showIOSInstructions;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-primary-600 bg-primary-800 p-4 shadow-2xl"
        >
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-primary-700 hover:text-gray-200"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-600">
              <Download size={24} className="text-green-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-100">PrepTrack installieren</h3>

              {isInstallable && (
                <>
                  <p className="mt-1 text-sm text-gray-400">
                    Installiere PrepTrack auf deinem Gerät für schnelleren Zugriff und
                    Offline-Nutzung.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={install}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 active:bg-green-700"
                    >
                      Installieren
                    </button>
                    <button
                      onClick={dismiss}
                      className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-primary-700 hover:text-gray-200"
                    >
                      Später
                    </button>
                  </div>
                </>
              )}

              {showIOSInstructions && !isInstallable && (
                <>
                  <p className="mt-1 text-sm text-gray-400">
                    Tippe auf{' '}
                    <Share size={14} className="inline text-blue-400" />{' '}
                    <strong>Teilen</strong> und dann auf{' '}
                    <strong>&quot;Zum Home-Bildschirm&quot;</strong>, um PrepTrack zu installieren.
                  </p>
                  <button
                    onClick={dismiss}
                    className="mt-3 rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-primary-700 hover:text-gray-200"
                  >
                    Verstanden
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
