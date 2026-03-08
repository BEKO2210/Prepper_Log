import { create } from 'zustand';

type Page = 'dashboard' | 'products' | 'add' | 'scanner' | 'settings' | 'stats';

interface FilterState {
  search: string;
  category: string;
  location: string;
  status: string;
}

export interface ScannedData {
  barcode: string;
  name?: string;
  imageUrl?: string;
}

interface AppState {
  currentPage: Page;
  setPage: (page: Page) => void;
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  editingProductId: number | null;
  setEditingProductId: (id: number | null) => void;
  scannedData: ScannedData | null;
  setScannedData: (data: ScannedData | null) => void;
  navigateToAddWithScan: (data: ScannedData) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const NOTIF_KEY = 'preptrack-notifications-enabled';

function getStoredNotifications(): boolean {
  const stored = localStorage.getItem(NOTIF_KEY);
  if (stored !== null) return stored === 'true';
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

const defaultFilters: FilterState = {
  search: '',
  category: '',
  location: '',
  status: '',
};

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page, editingProductId: null }),
  filters: { ...defaultFilters },
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  editingProductId: null,
  setEditingProductId: (id) =>
    set({ editingProductId: id, currentPage: id ? 'add' : 'products' }),
  scannedData: null,
  setScannedData: (data) => set({ scannedData: data }),
  navigateToAddWithScan: (data) =>
    set({ scannedData: data, currentPage: 'add', editingProductId: null }),
  notificationsEnabled: getStoredNotifications(),
  setNotificationsEnabled: (enabled) => {
    localStorage.setItem(NOTIF_KEY, String(enabled));
    set({ notificationsEnabled: enabled });
  },
}));
