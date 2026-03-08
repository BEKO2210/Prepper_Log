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
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products' as const, label: 'Vorräte', icon: Package },
  { id: 'add' as const, label: 'Hinzufügen', icon: PlusCircle },
  { id: 'scanner' as const, label: 'Scanner', icon: ScanBarcode },
  { id: 'stats' as const, label: 'Statistik', icon: BarChart3 },
  { id: 'settings' as const, label: 'Einstellungen', icon: Settings },
];

export function Navigation() {
  const { currentPage, setPage } = useAppStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary-700 bg-primary-800/95 backdrop-blur-sm safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-green-400'
                  : 'text-gray-500 hover:text-gray-300'
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
