import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const ACCENT: Record<ToastType, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-orange-400',
  info: 'text-blue-400',
};

const TOAST_DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction) => {
      const id = ++idRef.current;
      setToasts((list) => [...list.slice(-2), { id, message, type, action }]);
      // Give the user more time to react when there's an action (e.g. undo).
      window.setTimeout(() => remove(id), action ? 6000 : TOAST_DURATION);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.type];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                role="status"
                className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-primary-600 bg-primary-800 px-4 py-3 shadow-2xl shadow-black/40"
              >
                <Icon size={18} className={`shrink-0 ${ACCENT[toast.type]}`} />
                <span className="flex-1 text-sm text-gray-200">{toast.message}</span>
                {toast.action && (
                  <button
                    onClick={() => { toast.action!.onClick(); remove(toast.id); }}
                    className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-green-400 transition-colors hover:bg-primary-700 hover:text-green-300"
                  >
                    {toast.action.label}
                  </button>
                )}
                <button
                  onClick={() => remove(toast.id)}
                  className="shrink-0 rounded-md p-0.5 text-gray-500 transition-colors hover:text-gray-300"
                  aria-label={t('pwa.close')}
                >
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
