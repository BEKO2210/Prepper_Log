import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import {
  LayoutDashboard,
  Package,
  Plus,
  Settings,
  BarChart3,
} from 'lucide-react';

const LEFT_ITEMS = [
  { id: 'dashboard' as const, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'products' as const, labelKey: 'nav.products', icon: Package },
];

const RIGHT_ITEMS = [
  { id: 'stats' as const, labelKey: 'nav.stats', icon: BarChart3 },
  { id: 'settings' as const, labelKey: 'nav.settings', icon: Settings },
];

export function Navigation() {
  const { currentPage, setPage, setEditingProductId } = useAppStore();
  const { t } = useTranslation();
  const isAddActive = currentPage === 'add';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary-700 bg-primary-800/95 backdrop-blur-sm safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {/* Left nav items */}
        {LEFT_ITEMS.map(({ id, labelKey, icon: Icon }) => {
          const isActive = currentPage === id;
          const label = t(labelKey);
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-green-400'
                  : 'text-gray-300 hover:text-gray-200'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="leading-none">{label}</span>
            </button>
          );
        })}

        {/* Center FAB button */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => { setEditingProductId(null); setPage('add'); }}
            className={`-mt-7 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
              isAddActive
                ? 'bg-green-500 shadow-green-500/30'
                : 'bg-green-600 shadow-green-600/20 hover:bg-green-500 hover:shadow-green-500/30'
            }`}
            aria-label={t('nav.add')}
            aria-current={isAddActive ? 'page' : undefined}
          >
            <Plus size={28} strokeWidth={2.5} className="text-white" />
          </button>
        </div>

        {/* Right nav items */}
        {RIGHT_ITEMS.map(({ id, labelKey, icon: Icon }) => {
          const isActive = currentPage === id;
          const label = t(labelKey);
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors ${
                isActive
                  ? 'text-green-400'
                  : 'text-gray-300 hover:text-gray-200'
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
