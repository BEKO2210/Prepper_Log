import { useEffect, lazy, Suspense } from 'react';
import { useAppStore } from './store/useAppStore';
import { seedDefaults } from './lib/db';
import { startNotificationChecker } from './lib/notifications';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { Loader2 } from 'lucide-react';

const BarcodeScanner = lazy(() =>
  import('./components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner }))
);

const Settings = lazy(() =>
  import('./components/Settings').then((m) => ({ default: m.Settings }))
);

const Statistics = lazy(() =>
  import('./components/Statistics').then((m) => ({ default: m.Statistics }))
);

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-green-400" />
    </div>
  );
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
    case 'scanner':
      return (
        <Suspense fallback={<LazyFallback />}>
          <BarcodeScanner />
        </Suspense>
      );
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
  }
}

export default function App() {
  useEffect(() => {
    seedDefaults().catch((err) =>
      console.error('[PrepTrack] seedDefaults fehlgeschlagen:', err)
    );

    const interval = startNotificationChecker();
    return () => clearInterval(interval);
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-primary-900">
        <OfflineBanner />

        <header className="sticky top-0 z-30 border-b border-primary-700 bg-primary-800/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img src="./icons/icon-48x48.png" alt="PrepTrack" className="h-8 w-8" />
              <h1 className="text-lg font-bold text-gray-100">PrepTrack</h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
          <PageContent />
        </main>

        <Navigation />
        <PWAInstallPrompt />
      </div>
    </ErrorBoundary>
  );
}
