import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden bg-orange-600 text-center text-sm font-medium text-white"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-2">
            <WifiOff size={16} />
            <span>Offline-Modus — Daten werden lokal gespeichert</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
