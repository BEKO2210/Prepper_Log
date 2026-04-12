import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { version as appVersion } from '../../package.json';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addStorageLocation, deleteStorageLocation, exportData, exportCSV, importData, loadImportedImages, ImportResult } from '../lib/db';
import { requestNotificationPermission, getNotificationPermissionStatus } from '../lib/notifications';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppStore } from '../store/useAppStore';
import { downloadFile } from '../lib/utils';
import { getSyncConfig, saveSyncConfig, clearSyncPairing } from '../lib/syncConfig';
import {
  getSyncRuntimeState,
  pairSyncDevice,
  runSyncNow,
  subscribeSyncRuntime,
} from '../lib/sync';
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
  Shield,
  Heart,
  Smartphone,
  Share,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
  Globe,
  Cloud,
  RefreshCw,
  WifiOff,
  Camera,
  Image as ImageIcon,
  BellRing,
  HardDrive,
  Lock,
  Loader2,
} from 'lucide-react';

const LANGUAGES = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

function formatSyncTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function Settings() {
  const [isDark, toggleDark] = useDarkMode();
  const { notificationsEnabled, setNotificationsEnabled } = useAppStore();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const locations = useLiveQuery(() => db.storageLocations.toArray()) ?? [];
  const allProducts = useLiveQuery(() => db.products.toArray()) ?? [];
  const [newLocation, setNewLocation] = useState('');
  const [importStatus, setImportStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [syncConfigState, setSyncConfigState] = useState(() => getSyncConfig());
  const [syncServerUrl, setSyncServerUrl] = useState(syncConfigState.serverUrl);
  const [syncDeviceName, setSyncDeviceName] = useState(syncConfigState.deviceName || '');
  const [syncCode, setSyncCode] = useState('');
  const [showRepair, setShowRepair] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncRuntime, setSyncRuntime] = useState(() => getSyncRuntimeState());
  const [showImpressum, setShowImpressum] = useState(false);
  const [showDatenschutz, setShowDatenschutz] = useState(false);
  const [showAGB, setShowAGB] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [imageLoadProgress, setImageLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const { t, i18n } = useTranslation();

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
    downloadFile(data, `preptrack-export-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
  }

  async function startImageLoading(productIds: number[]) {
    if (productIds.length === 0) return;
    setImageLoadProgress({ loaded: 0, total: productIds.length });
    await loadImportedImages(productIds, (loaded, total) => {
      setImageLoadProgress({ loaded, total });
    });
    setImageLoadProgress(null);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importData(text);
      setImportStatus({ message: t('import.success', { count: result.imported }), type: 'success' });
      // Bilder im Hintergrund nachladen
      startImageLoading(result.productsNeedingImages);
    } catch (err) {
      if (err instanceof ImportResult) {
        setImportStatus({ message: err.message, type: 'warning' });
        // Auch bei teilweisem Import Bilder nachladen
        startImageLoading(err.productsNeedingImages);
      } else {
        setImportStatus({ message: t('import.error', { message: err instanceof Error ? err.message : t('import.importFailed') }), type: 'error' });
      }
    }

    e.target.value = '';
  }

  async function handleInstall() {
    const success = await install();
    if (!success) {
      alert(t('settings.installError'));
    }
  }

  function handleLanguageChange(langCode: string) {
    i18n.changeLanguage(langCode);
  }

  useEffect(() => {
    return subscribeSyncRuntime((next) => {
      setSyncRuntime(next);
    });
  }, []);

  function handleSaveSyncSettings() {
    const next = saveSyncConfig({
      ...syncConfigState,
      serverUrl: syncServerUrl.trim(),
      deviceName: syncDeviceName.trim(),
    });
    setSyncConfigState(next);
    setSyncNotice({ type: 'success', message: 'Sync-Einstellungen gespeichert.' });
  }

  async function handlePairSyncDevice() {
    if (!syncServerUrl.trim() || !syncCode.trim() || !syncDeviceName.trim()) {
      setSyncNotice({
        type: 'error',
        message: 'Server URL, Sync-Code und Gerätename sind erforderlich.',
      });
      return;
    }

    setSyncBusy(true);
    setSyncNotice(null);
    try {
      await pairSyncDevice({
        serverUrl: syncServerUrl.trim(),
        syncCode: syncCode.trim(),
        deviceName: syncDeviceName.trim(),
      });
      setSyncCode('');
      setShowRepair(false);
      const next = getSyncConfig();
      setSyncConfigState(next);
      setSyncNotice({ type: 'success', message: 'Gerät erfolgreich gekoppelt.' });
      await runSyncNow('pairing');
    } catch (err) {
      setSyncNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Koppeln fehlgeschlagen.',
      });
    } finally {
      setSyncBusy(false);
    }
  }

  function handleToggleSyncEnabled(enabled: boolean) {
    const next = saveSyncConfig({
      ...syncConfigState,
      enabled,
      serverUrl: syncServerUrl.trim(),
      deviceName: syncDeviceName.trim(),
    });
    setSyncConfigState(next);
    setSyncNotice(null);
    void runSyncNow(enabled ? 'enable' : 'disable').catch(() => undefined);
  }

  async function handleSyncNowClick() {
    setSyncBusy(true);
    setSyncNotice(null);
    try {
      await runSyncNow('manual');
      setSyncNotice({ type: 'success', message: 'Sync abgeschlossen.' });
    } catch (err) {
      setSyncNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Sync fehlgeschlagen.',
      });
    } finally {
      setSyncBusy(false);
    }
  }

  const notifStatus = getNotificationPermissionStatus();
  const syncIsPaired =
    syncConfigState.householdId.length > 0 &&
    syncConfigState.deviceId.length > 0 &&
    syncConfigState.deviceToken.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">{t('settings.title')}</h2>
      </div>

      {/* Über PrepTrack / Info */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex w-full items-center justify-between"
        >
          <h3 className="flex items-center gap-2 font-semibold text-gray-200">
            <Info size={18} className="text-green-400" />
            {t('onboarding.features')}
          </h3>
          {showInfo ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showInfo && (
          <div className="mt-4 space-y-3">
            <div className="space-y-2.5">
              {[
                { icon: <WifiOff size={16} className="text-blue-400" />, text: t('onboarding.featureOffline') },
                { icon: <Camera size={16} className="text-green-400" />, text: t('onboarding.featureCamera') },
                { icon: <ImageIcon size={16} className="text-purple-400" />, text: t('onboarding.featureImages') },
                { icon: <BellRing size={16} className="text-yellow-400" />, text: t('onboarding.featureNotifications') },
                { icon: <HardDrive size={16} className="text-orange-400" />, text: t('onboarding.featureExport') },
                { icon: <Lock size={16} className="text-emerald-400" />, text: t('onboarding.featurePrivacy') },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-primary-700/30 px-3 py-2.5">
                  <span className="mt-0.5 shrink-0">{item.icon}</span>
                  <span className="text-sm text-gray-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Language */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
          <Globe size={18} className="text-blue-400" />
          {t('settings.language')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                i18n.language.startsWith(lang.code)
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-primary-600 text-gray-300 hover:bg-primary-700'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="truncate">{lang.label}</span>
              <span className="ms-auto text-xs uppercase text-gray-400">{lang.code}</span>
            </button>
          ))}
        </div>
      </section>

      {/* PWA Install */}
      {!isInstalled && (
        <section className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <Smartphone size={18} className="text-green-400" />
            {t('settings.installApp')}
          </h3>
          {isIOS ? (
            <div className="space-y-2 text-sm text-gray-400">
              <p>
                {t('settings.iosInstallHint')}{' '}
                <Share size={14} className="inline text-blue-400" />{' '}
                <strong className="text-gray-300">{t('settings.iosShare')}</strong>{' '}
                <strong className="text-gray-300">&quot;{t('settings.iosHomeScreen')}&quot;</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                {t('settings.installDescription')}
              </p>
              <button
                onClick={handleInstall}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
              >
                <Download size={18} />
                {isInstallable ? t('settings.installNow') : t('settings.installApp2')}
              </button>
              {!isInstallable && (
                <p className="text-xs text-gray-400">
                  {t('settings.installTip')}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {isInstalled && (
        <section className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-center gap-2">
            <Smartphone size={18} className="text-green-400" />
            <span className="text-sm font-medium text-green-400">{t('settings.appInstalled')}</span>
          </div>
        </section>
      )}

      {/* Appearance */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-3 font-semibold text-gray-200">{t('settings.appearance')}</h3>
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
              {isDark ? t('settings.darkTheme') : t('settings.lightTheme')}
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
        <h3 className="mb-3 font-semibold text-gray-200">{t('settings.notifications')}</h3>
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
            <div className="text-start">
              <span className="text-gray-200">{t('settings.expiryReminders')}</span>
              {notifStatus === 'denied' && (
                <p className="text-xs text-red-400">
                  {t('settings.notifBlocked')}
                </p>
              )}
              {notifStatus === 'unsupported' && (
                <p className="text-xs text-gray-400">
                  {t('settings.notifUnsupported')}
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
          <p className="mt-2 text-xs text-gray-400">
            {t('settings.notifSchedule')}
          </p>
        )}
      </section>

      {/* Storage Locations */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-3 font-semibold text-gray-200">{t('settings.manageLocations')}</h3>
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <MapPin
              size={16}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
              placeholder={t('settings.newLocationPlaceholder')}
              className="w-full rounded-lg border border-primary-600 bg-primary-900 py-2 ps-9 pe-4 text-sm text-gray-200 placeholder-gray-500 focus:border-green-500 focus:outline-none"
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
                onClick={() => {
                  const used = allProducts.filter((p) => !p.archived && p.storageLocation === loc.name).length;
                  if (used > 0) {
                    alert(t('settings.locationInUse', { name: loc.name, count: used }));
                    return;
                  }
                  deleteStorageLocation(loc.id!);
                }}
                className="rounded p-1 text-gray-400 hover:bg-primary-600 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Data Management */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-3 font-semibold text-gray-200">{t('settings.dataManagement')}</h3>
        <div className="space-y-2">
          <button
            onClick={handleExportJSON}
            className="flex w-full items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700"
          >
            <FileJson size={20} className="text-blue-400" />
            <div className="text-start">
              <span>{t('settings.jsonBackup')}</span>
              <p className="text-xs text-gray-400">{t('settings.jsonBackupDesc')}</p>
            </div>
            <Download size={16} className="ms-auto text-gray-400" />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex w-full items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700"
          >
            <FileText size={20} className="text-gray-400" />
            <div className="text-start">
              <span>{t('settings.csvExport')}</span>
              <p className="text-xs text-gray-400">{t('settings.csvExportDesc')}</p>
            </div>
            <Download size={16} className="ms-auto text-gray-400" />
          </button>

          <label className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700">
            <Upload size={20} className="text-orange-400" />
            <div className="text-start">
              <span>{t('settings.jsonImport')}</span>
              <p className="text-xs text-gray-400">{t('settings.jsonImportDesc')}</p>
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
                importStatus.type === 'error'
                  ? 'bg-red-500/10 text-red-400'
                  : importStatus.type === 'warning'
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'bg-green-500/10 text-green-400'
              }`}
            >
              {importStatus.message}
            </p>
          )}

          {imageLoadProgress && (
            <div className="space-y-2 rounded-lg bg-blue-500/10 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader2 size={16} className="animate-spin" />
                <span>
                  {t('import.loadingImages', {
                    loaded: imageLoadProgress.loaded,
                    total: imageLoadProgress.total,
                    defaultValue: 'Lade Produktbilder… {{loaded}} / {{total}}',
                  })}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(imageLoadProgress.loaded / imageLoadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sync */}
      <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
          <Cloud size={18} className="text-sky-400" />
          LAN Sync (optional)
        </h3>

        <p className="mb-3 text-xs text-gray-400">
          Daten bleiben lokal nutzbar. Sync ist optional und wird nur mit deinem eigenen Backend verwendet.
        </p>

        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Server URL</label>
            <input
              type="url"
              value={syncServerUrl}
              onChange={(e) => setSyncServerUrl(e.target.value)}
              placeholder="http://192.168.0.20:8787"
              className="w-full rounded-lg border border-primary-600 bg-primary-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Gerätename</label>
            <input
              type="text"
              value={syncDeviceName}
              onChange={(e) => setSyncDeviceName(e.target.value)}
              placeholder="z. B. iPhone Küche"
              className="w-full rounded-lg border border-primary-600 bg-primary-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {(!syncIsPaired || showRepair) && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Sync-Code</label>
              <input
                type="password"
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value)}
                placeholder="gemeinsamer Haushalt-Code"
                className="w-full rounded-lg border border-primary-600 bg-primary-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={handleSaveSyncSettings}
              className="rounded-lg bg-primary-700 px-3 py-2 text-sm text-gray-200 hover:bg-primary-600"
            >
              Einstellungen speichern
            </button>

            {!syncIsPaired || showRepair ? (
              <button
                onClick={handlePairSyncDevice}
                disabled={syncBusy}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {showRepair ? 'Neu koppeln' : 'Gerät koppeln'}
              </button>
            ) : (
              <button
                onClick={handleSyncNowClick}
                disabled={syncBusy || !syncConfigState.enabled}
                className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={15} className={syncBusy ? 'animate-spin' : ''} />
                Jetzt synchronisieren
              </button>
            )}
          </div>

          {syncIsPaired && !showRepair && (
            <button
              onClick={() => {
                clearSyncPairing();
                setSyncConfigState(getSyncConfig());
                setSyncCode('');
                setShowRepair(true);
                setSyncNotice(null);
              }}
              className="w-full text-xs text-gray-500 hover:text-gray-300"
            >
              Neu koppeln (anderen Server oder Code verwenden)
            </button>
          )}
          {showRepair && (
            <button
              onClick={() => { setSyncCode(''); setShowRepair(false); }}
              className="w-full text-xs text-gray-500 hover:text-gray-300"
            >
              Abbrechen
            </button>
          )}

          {syncIsPaired && (
            <button
              onClick={() => handleToggleSyncEnabled(!syncConfigState.enabled)}
              className="flex w-full items-center justify-between rounded-lg bg-primary-700/50 px-4 py-3"
            >
              <span className="text-sm text-gray-200">Hintergrund-Sync</span>
              <div
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  syncConfigState.enabled ? 'bg-sky-600' : 'bg-gray-500'
                }`}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    syncConfigState.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </button>
          )}

          <div className="rounded-lg border border-primary-700 bg-primary-800/60 px-3 py-2 text-xs text-gray-400">
            <p>Status: <span className="text-gray-300">{syncRuntime.status}</span></p>
            <p>Ausstehende Änderungen: <span className="text-gray-300">{syncRuntime.pendingChanges}</span></p>
            <p>Letzter Erfolg: <span className="text-gray-300">{formatSyncTime(syncRuntime.lastSuccessAt)}</span></p>
            {syncRuntime.lastError && (
              <p className="text-red-400">Fehler: {syncRuntime.lastError}</p>
            )}
            {syncIsPaired && (
              <p className="mt-1 break-all text-[11px] text-gray-500">
                Haushalt: {syncConfigState.householdId}
              </p>
            )}
          </div>

          {syncNotice && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                syncNotice.type === 'error'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-green-500/10 text-green-400'
              }`}
            >
              {syncNotice.message}
            </p>
          )}
        </div>
      </section>

      {/* Freiwillige Unterstützung */}
      <section className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
          <Heart size={18} className="text-pink-400" />
          {t('settings.support')}
        </h3>
        <p className="mb-3 text-sm text-gray-400">
          {t('settings.supportDesc')}
        </p>
        <a
          href="https://www.paypal.com/paypalme/renateweinfurtner"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0070ba] px-4 py-3 font-medium text-white hover:bg-[#005ea6] active:scale-[0.98] transition-transform"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.774.774 0 0 1 .763-.658h6.568c2.183 0 3.678.568 4.44 1.69.357.526.563 1.105.613 1.72.053.66-.01 1.443-.19 2.39l-.007.038v.338l.263.149c.224.116.402.253.539.412.227.265.374.593.435.976.064.396.044.866-.058 1.397-.116.607-.304 1.136-.56 1.574a3.305 3.305 0 0 1-.887.99 3.547 3.547 0 0 1-1.214.592c-.46.137-.98.206-1.55.206H13.44a.907.907 0 0 0-.607.233.927.927 0 0 0-.313.579l-.034.195-.563 3.574-.025.14a.082.082 0 0 1-.026.055.078.078 0 0 1-.05.018H7.076Z" />
          </svg>
          {t('settings.donatePayPal')}
        </a>
        <p className="mt-2 text-center text-xs text-gray-400">renateweinfurtner@gmx.de</p>
        <p className="mt-3 rounded-lg border border-primary-700 bg-primary-900/40 px-3 py-2 text-xs leading-relaxed text-gray-400">
          {t('settings.supportLegal')}
        </p>
      </section>

      {/* Impressum */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <button
          onClick={() => setShowImpressum(!showImpressum)}
          className="flex w-full items-center justify-between"
        >
          <h3 className="flex items-center gap-2 font-semibold text-gray-200">
            <Info size={18} className="text-blue-400" />
            {t('settings.impressum')}
          </h3>
          {showImpressum ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showImpressum && (
          <div className="mt-3 space-y-3 text-sm text-gray-400">
            <p className="font-medium text-gray-300">{t('settings.impressumTMG')}</p>
            <p>
              Belkis Aslani<br />
              Vogelsangstr. 32<br />
              71691 Freiberg am Neckar
            </p>

            <p className="font-medium text-gray-300">{t('settings.impressumContact')}</p>
            <p>E-Mail: belkis.aslani@gmail.com</p>

            <p className="font-medium text-gray-300">{t('settings.impressumResponsible')}</p>
            <p>
              Belkis Aslani<br />
              Vogelsangstr. 32<br />
              71691 Freiberg am Neckar
            </p>

            <p className="font-medium text-gray-300">{t('settings.impressumDisclaimer')}</p>
            <p>{t('settings.impressumDisclaimerText')}</p>
          </div>
        )}
      </section>

      {/* Datenschutz */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <button
          onClick={() => setShowDatenschutz(!showDatenschutz)}
          className="flex w-full items-center justify-between"
        >
          <h3 className="flex items-center gap-2 font-semibold text-gray-200">
            <Shield size={18} className="text-green-400" />
            {t('settings.privacy')}
          </h3>
          {showDatenschutz ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showDatenschutz && (
          <div className="mt-3 space-y-3 text-sm text-gray-400">
            <p className="font-medium text-gray-300">{t('settings.privacyResponsible')}</p>
            <p>
              Belkis Aslani<br />
              Vogelsangstr. 32<br />
              71691 Freiberg am Neckar<br />
              E-Mail: belkis.aslani@gmail.com
            </p>

            <p className="font-medium text-gray-300">{t('settings.privacyDataProcessing')}</p>
            <p>{t('settings.privacyDataProcessingText')}</p>

            <p className="font-medium text-gray-300">{t('settings.privacyExternalServices')}</p>
            <p>{t('settings.privacyExternalServicesText')}</p>

            <p className="font-medium text-gray-300">{t('settings.privacyNotifications')}</p>
            <p>{t('settings.privacyNotificationsText')}</p>

            <p className="font-medium text-gray-300">{t('settings.privacyCookies')}</p>
            <p>{t('settings.privacyCookiesText')}</p>

            <p className="font-medium text-gray-300">{t('settings.privacyRights')}</p>
            <p>{t('settings.privacyRightsText')}</p>
          </div>
        )}
      </section>

      {/* AGB */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <button
          onClick={() => setShowAGB(!showAGB)}
          className="flex w-full items-center justify-between"
        >
          <h3 className="flex items-center gap-2 font-semibold text-gray-200">
            <FileText size={18} className="text-blue-400" />
            {t('settings.terms')}
          </h3>
          {showAGB ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showAGB && (
          <div className="mt-3 space-y-3 text-sm text-gray-400">
            <p className="font-medium text-gray-300">{t('settings.termsProvider')}</p>
            <p>
              Belkis Aslani<br />
              Vogelsangstr. 32<br />
              71691 Freiberg am Neckar<br />
              E-Mail: belkis.aslani@gmail.com
            </p>

            <p className="font-medium text-gray-300">{t('settings.termsScope')}</p>
            <p>{t('settings.termsScopeText')}</p>

            <p className="font-medium text-gray-300">{t('settings.termsService')}</p>
            <p>{t('settings.termsServiceText')}</p>

            <p className="font-medium text-gray-300">{t('settings.termsAvailability')}</p>
            <p>{t('settings.termsAvailabilityText')}</p>

            <p className="font-medium text-gray-300">{t('settings.termsLiability')}</p>
            <p>{t('settings.termsLiabilityText')}</p>

            <p className="font-medium text-gray-300">{t('settings.termsIP')}</p>
            <p>{t('settings.termsIPText')}</p>

            <p className="font-medium text-gray-300">{t('settings.termsDonations')}</p>
            <p>{t('settings.termsDonationsText')}</p>
          </div>
        )}
      </section>

      {/* App Info */}
      <section className="space-y-1.5 text-center text-xs text-gray-400">
        <p className="flex items-center justify-center gap-2">
          <span>PrepTrack v{appVersion}</span>
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-green-400">
            {t('settings.versionStatus')}
          </span>
        </p>
        <p>{t('settings.appSlogan')}</p>
        <p>&copy; {new Date().getFullYear()} Belkis Aslani</p>
      </section>
    </div>
  );
}
