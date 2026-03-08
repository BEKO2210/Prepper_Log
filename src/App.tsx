import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { seedDefaults } from './lib/db';
import { startNotificationChecker } from './lib/notifications';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { BarcodeScanner } from './components/BarcodeScanner';
import { Settings } from './components/Settings';
import { Statistics } from './components/Statistics';

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
      return <BarcodeScanner />;
    case 'settings':
      return <Settings />;
    case 'stats':
      return <Statistics />;
  }
}

export default function App() {
  useEffect(() => {
    seedDefaults();

    const interval = startNotificationChecker();
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-primary-900">
      <OfflineBanner />

      <header className="sticky top-0 z-30 border-b border-primary-700 bg-primary-800/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
              PT
            </div>
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
  );
}
