import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ScanBarcode,
  Settings,
  BarChart3,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard' as const, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'products' as const, labelKey: 'nav.products', icon: Package },
  { id: 'add' as const, labelKey: 'nav.add', icon: PlusCircle },
  { id: 'scanner' as const, labelKey: 'nav.scanner', icon: ScanBarcode },
  { id: 'stats' as const, labelKey: 'nav.stats', icon: BarChart3 },
  { id: 'settings' as const, labelKey: 'nav.settings', icon: Settings },
];

export function Navigation() {
  const { currentPage, setPage, setEditingProductId } = useAppStore();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary-700 bg-primary-800/95 backdrop-blur-sm safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {NAV_ITEMS.map(({ id, labelKey, icon: Icon }) => {
          const isActive = currentPage === id;
          const label = t(labelKey);
          return (
            <button
              key={id}
              onClick={() => { if (id === 'add') setEditingProductId(null); setPage(id); }}
              className={`flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-green-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
