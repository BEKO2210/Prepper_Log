import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import {
  LayoutDashboard,
  Package,
  Plus,
  Settings,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

const LEFT_ITEMS = [
  { id: 'dashboard' as const, labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'products' as const, labelKey: 'nav.products', icon: Package },
];

const RIGHT_ITEMS = [
  { id: 'stats' as const, labelKey: 'nav.stats', icon: BarChart3 },
  { id: 'settings' as const, labelKey: 'nav.settings', icon: Settings },
];

interface NavItemProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ label, icon: Icon, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-0 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 transition-colors ${
        isActive ? 'text-green-400' : 'text-gray-300 hover:text-gray-200'
      }`}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      {isActive && (
        <motion.span
          layoutId="nav-active"
          className="absolute top-0 h-0.5 w-7 rounded-full bg-green-400"
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        />
      )}
      <motion.span
        animate={{ scale: isActive ? 1.12 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
      </motion.span>
      <span className="w-full truncate text-center text-[10px] leading-tight">{label}</span>
    </button>
  );
}

export function Navigation() {
  const { currentPage, setPage, setEditingProductId } = useAppStore();
  const { t } = useTranslation();
  const isAddActive = currentPage === 'add';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary-700 bg-primary-800 safe-bottom">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center">
        {LEFT_ITEMS.map(({ id, labelKey, icon }) => (
          <NavItem
            key={id}
            label={t(labelKey)}
            icon={icon}
            isActive={currentPage === id}
            onClick={() => setPage(id)}
          />
        ))}

        {/* Center FAB button */}
        <div className="relative flex items-center justify-center">
          <motion.button
            onClick={() => { setEditingProductId(null); setPage('add'); }}
            whileTap={{ scale: 0.92 }}
            className={`-mt-7 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors ${
              isAddActive
                ? 'bg-green-500 shadow-green-500/30'
                : 'bg-green-700 shadow-green-600/20 hover:bg-green-600 hover:shadow-green-500/30'
            }`}
            aria-label={t('nav.add')}
            aria-current={isAddActive ? 'page' : undefined}
          >
            <Plus size={28} strokeWidth={2.5} className="text-white" />
          </motion.button>
        </div>

        {RIGHT_ITEMS.map(({ id, labelKey, icon }) => (
          <NavItem
            key={id}
            label={t(labelKey)}
            icon={icon}
            isActive={currentPage === id}
            onClick={() => setPage(id)}
          />
        ))}
      </div>
    </nav>
  );
}
