// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

let mockProducts: any[] = [];
const mockLocations = [{ id: 1, name: 'Keller' }];

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => any) =>
    fn.toString().includes('storageLocations') ? mockLocations : mockProducts,
}));

const deleteProduct = vi.fn(async (..._args: any[]) => {});
vi.mock('../lib/db', () => ({
  db: { products: {}, storageLocations: {} },
  deleteProduct: (...a: any[]) => deleteProduct(...a),
  archiveProduct: vi.fn(async () => {}),
  logConsumption: vi.fn(async () => {}),
  updateProduct: vi.fn(async () => {}),
}));

import { ProductList } from './ProductList';
import { ToastProvider } from './Toast';
import i18n from '../i18n/i18n';

const renderList = () => render(<ToastProvider><ProductList /></ToastProvider>);

function archivedProduct() {
  return {
    id: 7, name: 'Altes Reis', barcode: '', category: 'lebensmittel',
    storageLocation: 'Keller', quantity: 1, unit: 'Stück',
    expiryDate: new Date('2020-01-01').toISOString(), expiryPrecision: 'day',
    archived: true, createdAt: new Date('2019-01-01').toISOString(),
    updatedAt: new Date('2019-01-01').toISOString(),
  };
}

describe('archive deletion', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    deleteProduct.mockClear();
    mockProducts = [archivedProduct()];
  });

  afterEach(() => cleanup());

  it('deletes via the trash button + confirm in the archive list', () => {
    const { container } = renderList();
    fireEvent.click(screen.getByRole('button', { name: /archiv/i }));
    expect(screen.getByText('Altes Reis')).toBeTruthy();

    const trash = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-label')?.match(/löschen/i) && b.querySelector('svg')
    );
    fireEvent.click(trash!);

    const confirmBox = container.querySelector('.bg-red-500\\/10') as HTMLElement;
    fireEvent.click(within(confirmBox).getAllByRole('button')[0]);
    expect(deleteProduct).toHaveBeenCalledWith(7);
  });

  it('deletes from the product detail modal', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /archiv/i }));

    // Open detail modal by tapping the row
    fireEvent.click(screen.getByText('Altes Reis'));

    const dialog = screen.getByRole('dialog');
    // First delete button reveals the inline confirm
    const deleteBtn = within(dialog).getAllByRole('button').find(
      (b) => /löschen/i.test(b.textContent || '')
    );
    fireEvent.click(deleteBtn!);

    const confirmBtn = within(dialog).getAllByRole('button').find(
      (b) => /löschen/i.test(b.textContent || '')
    );
    fireEvent.click(confirmBtn!);
    expect(deleteProduct).toHaveBeenCalledWith(7);
  });
});
