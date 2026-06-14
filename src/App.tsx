import { useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { seedDefaults } from './lib/db';
import { startNotificationChecker } from './lib/notifications';
import { startSyncEngine } from './lib/sync';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { WhatsNewModal } from './components/WhatsNewModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ToastProvider } from './components/Toast';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { PageSkeleton } from './components/Skeleton';

const Settings = lazy(() =>
  import('./components/Settings').then((m) => ({ default: m.Settings }))
);

const Statistics = lazy(() =>
  import('./components/Statistics').then((m) => ({ default: m.Statistics }))
);

const Preparedness = lazy(() =>
  import('./components/Preparedness').then((m) => ({ default: m.Preparedness }))
);

function LazyFallback() {
  return <PageSkeleton />;
}

function PageContent() {
  const currentPage = useAppStore((s) => s.currentPage);

  switch (currentPage) {
    case 'dashboard':
      return <Dashboard />;
    case 'products':
      return <ProductList />;
    case 'add':
      return <ProductForm />;
    case 'settings':
      return (
        <Suspense fallback={<LazyFallback />}>
          <Settings />
        </Suspense>
      );
    case 'stats':
      return (
        <Suspense fallback={<LazyFallback />}>
          <Statistics />
        </Suspense>
      );
    case 'preparedness':
      return (
        <Suspense fallback={<LazyFallback />}>
          <Preparedness />
        </Suspense>
      );
  }
}

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  useEffect(() => {
    seedDefaults().catch((err) =>
      console.error('[PrepTrack] seedDefaults fehlgeschlagen:', err)
    );

    const interval = startNotificationChecker();
    const stopSync = startSyncEngine();
    return () => {
      clearInterval(interval);
      stopSync();
    };
  }, []);

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
        <div className="min-h-screen bg-primary-900">
          <OfflineBanner />

          <header className="sticky top-0 z-30 border-b border-primary-700 bg-primary-800">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <img src="./icons/icon-48x48.png" alt="PrepTrack" className="h-8 w-8" />
                <h1 className="text-lg font-bold text-gray-100">PrepTrack</h1>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentPage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <PageContent />
              </motion.div>
            </AnimatePresence>
          </main>

          <Navigation />
          <PWAInstallPrompt />
          <OnboardingModal />
          <WhatsNewModal />
        </div>
        </ToastProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
