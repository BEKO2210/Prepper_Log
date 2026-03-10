import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addProduct, updateProduct } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { compressImage } from '../lib/utils';
import {
  DEFAULT_UNITS,
  type Product,
  type ProductCategory,
} from '../types';
import { Camera, Upload, X, Save, ArrowLeft } from 'lucide-react';

const FORM_STORAGE_KEY = 'preptrack-form-draft';

interface FormState {
  name: string;
  barcode: string;
  category: ProductCategory;
  storageLocation: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  expiryPrecision: 'day' | 'month' | 'year';
  photo: string;
  minStock: string;
  notes: string;
}

const defaultForm: FormState = {
  name: '',
  barcode: '',
  category: 'lebensmittel',
  storageLocation: 'Keller',
  quantity: '1',
  unit: 'Stück',
  expiryDate: '',
  expiryPrecision: 'day',
  photo: '',
  minStock: '0',
  notes: '',
};

function saveFormDraft(form: FormState, editingId: number | null) {
  try {
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({ form, editingId, timestamp: Date.now() }));
  } catch { /* sessionStorage full or unavailable */ }
}

function loadFormDraft(): { form: FormState; editingId: number | null } | null {
  try {
    const raw = sessionStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      sessionStorage.removeItem(FORM_STORAGE_KEY);
      return null;
    }
    return { form: data.form, editingId: data.editingId };
  } catch { return null; }
}

function clearFormDraft() {
  sessionStorage.removeItem(FORM_STORAGE_KEY);
}

export function ProductForm() {
  const { editingProductId, setPage, setEditingProductId, scannedData, setScannedData } = useAppStore();
  const locations = useLiveQuery(() => db.storageLocations.toArray()) ?? [];
  const existingProduct = useLiveQuery(() => (editingProductId ? db.products.get(editingProductId) : undefined), [editingProductId]);
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const populatedRef = useRef(false);

  const [form, setForm] = useState<FormState>(() => {
    const draft = loadFormDraft();
    if (draft) { restoredRef.current = true; return draft.form; }
    return { ...defaultForm, storageLocation: '' };
  });

  const [saving, setSaving] = useState(false);

  function getQuantityStep(unit: string): string {
    switch (unit) {
      case 'kg': return '0.1';
      case 'Liter': return '0.25';
      case 'g': case 'ml': return '1';
      default: return '1';
    }
  }

  useEffect(() => {
    if (restoredRef.current) { clearFormDraft(); restoredRef.current = false; }
  }, []);

  useEffect(() => {
    if (existingProduct && !populatedRef.current) {
      populatedRef.current = true;
      setForm({
        name: existingProduct.name,
        barcode: existingProduct.barcode || '',
        category: existingProduct.category,
        storageLocation: existingProduct.storageLocation,
        quantity: String(existingProduct.quantity),
        unit: existingProduct.unit,
        expiryDate: existingProduct.expiryDate.split('T')[0],
        expiryPrecision: existingProduct.expiryPrecision,
        photo: existingProduct.photo || '',
        minStock: String(existingProduct.minStock || 0),
        notes: existingProduct.notes || '',
      });
    }
  }, [existingProduct]);

  useEffect(() => {
    populatedRef.current = false;
    if (!editingProductId) {
      setForm((prev) => {
        // Only reset if the form was populated with editing data
        if (prev.name && !restoredRef.current) {
          return { ...defaultForm, storageLocation: prev.storageLocation || '' };
        }
        return prev;
      });
    }
  }, [editingProductId]);

  useEffect(() => {
    if (scannedData && !editingProductId) {
      setForm((prev) => ({ ...prev, barcode: scannedData.barcode || prev.barcode, name: scannedData.name || prev.name }));
      setScannedData(null);
    }
  }, [scannedData, editingProductId, setScannedData]);

  useEffect(() => {
    if (!editingProductId && locations.length > 0 && !form.storageLocation) {
      setForm((prev) => ({ ...prev, storageLocation: locations[0].name }));
    }
  }, [locations, editingProductId, form.storageLocation]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCameraClick() {
    saveFormDraft(form, editingProductId);
    cameraInputRef.current?.click();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      updateField('photo', compressed);
      clearFormDraft();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('form.imageError'));
    }
    e.target.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.expiryDate) return;
    setSaving(true);
    try {
      const productData: Omit<Product, 'id'> = {
        name: form.name.trim(),
        barcode: form.barcode || undefined,
        category: form.category,
        storageLocation: form.storageLocation,
        quantity: parseFloat(form.quantity) || 1,
        unit: form.unit,
        expiryDate: new Date(form.expiryDate).toISOString(),
        expiryPrecision: form.expiryPrecision,
        photo: form.photo || undefined,
        minStock: parseFloat(form.minStock) || undefined,
        notes: form.notes || undefined,
        archived: false,
        createdAt: editingProductId ? existingProduct?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (editingProductId) { await updateProduct(editingProductId, productData); }
      else { await addProduct(productData); }
      clearFormDraft();
      setEditingProductId(null);
      setPage('products');
    } catch (err) {
      console.error('Speichern fehlgeschlagen:', err);
      alert(t('form.saveError'));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {editingProductId && (
          <button onClick={() => { clearFormDraft(); setEditingProductId(null); setPage('products'); }} className="rounded-lg p-2 text-gray-400 hover:bg-primary-700 hover:text-gray-200">
            <ArrowLeft size={20} />
          </button>
        )}
        <h2 className="text-2xl font-bold text-gray-100">
          {editingProductId ? t('form.editTitle') : t('form.addTitle')}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.photo')}</label>
          <div className="flex items-center gap-3">
            {form.photo ? (
              <div className="relative">
                <img src={form.photo} alt={t('form.productImage')} className="h-20 w-20 rounded-lg object-cover" />
                <button type="button" onClick={() => updateField('photo', '')} className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5"><X size={12} className="text-white" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={handleCameraClick} className="hidden items-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2 text-sm text-gray-300 hover:border-green-500">
                  <Camera size={18} /> {t('form.camera')}
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2 text-sm text-gray-300 hover:border-green-500">
                  <Upload size={18} /> {t('form.gallery')}
                </button>
              </div>
            )}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.productName')}</label>
          <input type="text" required value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder={t('form.productNamePlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.barcode')}</label>
          <input type="text" value={form.barcode} onChange={(e) => updateField('barcode', e.target.value)} placeholder={t('form.barcodePlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.category')}</label>
            <select value={form.category} onChange={(e) => updateField('category', e.target.value as ProductCategory)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none">
              {(['konserven', 'wasser', 'medizin', 'werkzeug', 'hygiene', 'lebensmittel', 'getranke', 'elektronik', 'kleidung', 'sonstiges'] as ProductCategory[]).map((key) => (
                <option key={key} value={key}>{t(`categories.${key}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.storageLocation')}</label>
            <select value={form.storageLocation} onChange={(e) => updateField('storageLocation', e.target.value)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none">
              {locations.map((loc) => (<option key={loc.id} value={loc.name}>{loc.name}</option>))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.quantity')}</label>
            <input type="number" min={getQuantityStep(form.unit)} step={getQuantityStep(form.unit)} required value={form.quantity} onChange={(e) => updateField('quantity', e.target.value)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.unit')}</label>
            <select value={form.unit} onChange={(e) => updateField('unit', e.target.value)} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none">
              {DEFAULT_UNITS.map((unit) => (<option key={unit} value={unit}>{t(`units.${unit}`)}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.expiryDate')}</label>
          <div className="flex gap-2">
            <input type="date" required value={form.expiryDate} onChange={(e) => updateField('expiryDate', e.target.value)} className="flex-1 rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 focus:border-green-500 focus:outline-none" />
            <select value={form.expiryPrecision} onChange={(e) => updateField('expiryPrecision', e.target.value as 'day' | 'month' | 'year')} className="rounded-lg border border-primary-600 bg-primary-800 px-3 py-2.5 text-sm text-gray-200 focus:border-green-500 focus:outline-none">
              <option value="day">{t('form.precisionDay')}</option>
              <option value="month">{t('form.precisionMonth')}</option>
              <option value="year">{t('form.precisionYear')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.minStock')}</label>
          <input type="number" min="0" value={form.minStock} onChange={(e) => updateField('minStock', e.target.value)} placeholder={t('form.minStockPlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">{t('form.notes')}</label>
          <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} placeholder={t('form.notesPlaceholder')} className="w-full rounded-lg border border-primary-600 bg-primary-800 px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none" />
        </div>

        <button type="submit" disabled={saving || !form.name.trim() || !form.expiryDate} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50">
          <Save size={20} />
          {saving ? t('form.saving') : editingProductId ? t('form.saveChanges') : t('form.saveProduct')}
        </button>
      </form>
    </div>
  );
}
