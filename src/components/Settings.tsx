import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addStorageLocation, deleteStorageLocation, exportData, exportCSV, importData } from '../lib/db';
import { requestNotificationPermission, getNotificationPermissionStatus } from '../lib/notifications';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAppStore } from '../store/useAppStore';
import { downloadFile } from '../lib/utils';
import {
  Bell,
  BellOff,
  Moon,
  Sun,
  MapPin,
  Plus,
  Trash2,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  Shield,
  Info,
} from 'lucide-react';

export function Settings() {
  const [isDark, toggleDark] = useDarkMode();
  const { notificationsEnabled, setNotificationsEnabled } = useAppStore();
  const locations = useLiveQuery(() => db.storageLocations.toArray()) ?? [];
  const [newLocation, setNewLocation] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  async function handleToggleNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
    } else {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
    }
  }

  async function handleAddLocation() {
    const name = newLocation.trim();
    if (!name) return;
    const exists = locations.some((l) => l.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    await addStorageLocation(name);
    setNewLocation('');
  }

  async function handleExportJSON() {
    const data = await exportData();
    downloadFile(data, `preptrack-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  }

  async function handleExportCSV() {
    const data = await exportCSV();
    downloadFile(data, `preptrack-export-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await importData(text);
      setImportStatus(`${count} Produkte importiert.`);
    } catch (err) {
      setImportStatus(`Fehler: ${err instanceof Error ? err.message : 'Import fehlgeschlagen'}`);
    }

    e.target.value = '';
  }

  const notifStatus = getNotificationPermissionStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Einstellungen</h1>
      </div>

      {/* Appearance */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h2 className="mb-3 font-semibold text-gray-200">Darstellung</h2>
        <button
          onClick={toggleDark}
          className="flex w-full items-center justify-between rounded-lg bg-primary-700/50 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            {isDark ? (
              <Moon size={20} className="text-blue-400" />
            ) : (
              <Sun size={20} className="text-yellow-400" />
            )}
            <span className="text-gray-200">
              {isDark ? 'Dunkles Design' : 'Helles Design'}
            </span>
          </div>
          <div
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isDark ? 'bg-green-600' : 'bg-gray-500'
            }`}
          >
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isDark ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>
      </section>

      {/* Notifications */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h2 className="mb-3 font-semibold text-gray-200">Benachrichtigungen</h2>
        <button
          onClick={handleToggleNotifications}
          disabled={notifStatus === 'denied' || notifStatus === 'unsupported'}
          className="flex w-full items-center justify-between rounded-lg bg-primary-700/50 px-4 py-3 disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            {notificationsEnabled ? (
              <Bell size={20} className="text-green-400" />
            ) : (
              <BellOff size={20} className="text-gray-400" />
            )}
            <div className="text-left">
              <span className="text-gray-200">MHD-Erinnerungen</span>
              {notifStatus === 'denied' && (
                <p className="text-xs text-red-400">
                  Benachrichtigungen im Browser blockiert
                </p>
              )}
              {notifStatus === 'unsupported' && (
                <p className="text-xs text-gray-500">
                  Nicht in diesem Browser unterstützt
                </p>
              )}
            </div>
          </div>
          <div
            className={`relative h-6 w-11 rounded-full transition-colors ${
              notificationsEnabled ? 'bg-green-600' : 'bg-gray-500'
            }`}
          >
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>
        {notificationsEnabled && (
          <p className="mt-2 text-xs text-gray-500">
            Du wirst 30, 14, 7, 3 und 1 Tag vor dem Ablauf benachrichtigt.
          </p>
        )}
      </section>

      {/* Storage Locations */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h2 className="mb-3 font-semibold text-gray-200">Lagerorte verwalten</h2>
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <MapPin
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
              placeholder="Neuer Lagerort..."
              className="w-full rounded-lg border border-primary-600 bg-primary-900 py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleAddLocation}
            disabled={!newLocation.trim()}
            className="rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-500 disabled:opacity-50"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-1">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between rounded-lg bg-primary-700/30 px-3 py-2"
            >
              <span className="text-sm text-gray-300">{loc.name}</span>
              <button
                onClick={() => deleteStorageLocation(loc.id!)}
                className="rounded p-1 text-gray-500 hover:bg-primary-600 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Data Management */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h2 className="mb-3 font-semibold text-gray-200">Datenverwaltung</h2>
        <div className="space-y-2">
          <button
            onClick={handleExportJSON}
            className="flex w-full items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700"
          >
            <FileJson size={20} className="text-blue-400" />
            <div className="text-left">
              <span>JSON-Backup exportieren</span>
              <p className="text-xs text-gray-500">
                Vollständiges Backup aller Daten
              </p>
            </div>
            <Download size={16} className="ml-auto text-gray-500" />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex w-full items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700"
          >
            <FileSpreadsheet size={20} className="text-green-400" />
            <div className="text-left">
              <span>CSV exportieren</span>
              <p className="text-xs text-gray-500">Für Excel oder Google Sheets</p>
            </div>
            <Download size={16} className="ml-auto text-gray-500" />
          </button>

          <label className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700">
            <Upload size={20} className="text-orange-400" />
            <div className="text-left">
              <span>JSON-Backup importieren</span>
              <p className="text-xs text-gray-500">
                Daten aus einem Backup wiederherstellen
              </p>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {importStatus && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                importStatus.startsWith('Fehler')
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-green-500/10 text-green-400'
              }`}
            >
              {importStatus}
            </p>
          )}
        </div>
      </section>

      {/* Privacy */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
          <Shield size={18} className="text-green-400" />
          Datenschutz
        </h2>
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>Alle Daten werden lokal auf deinem Gerät gespeichert (IndexedDB).</p>
          </div>
          <div className="flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>Keine Tracking-Dienste oder externe Analytics.</p>
          </div>
          <div className="flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Die Open Food Facts API wird nur beim Barcode-Scan kontaktiert.
            </p>
          </div>
        </div>
      </section>

      {/* App Info */}
      <section className="text-center text-xs text-gray-600">
        <p>PrepTrack v1.0.0</p>
        <p>Dein Vorrat. Immer im Blick.</p>
      </section>
    </div>
  );
}
