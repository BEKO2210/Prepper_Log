import { create } from 'zustand';

type Page = 'dashboard' | 'products' | 'add' | 'scanner' | 'settings' | 'stats';

interface FilterState {
  search: string;
  category: string;
  location: string;
  status: string;
}

interface AppState {
  currentPage: Page;
  setPage: (page: Page) => void;
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  editingProductId: number | null;
  setEditingProductId: (id: number | null) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
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
  notificationsEnabled: Notification.permission === 'granted',
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
}));
