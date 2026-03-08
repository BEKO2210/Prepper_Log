import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addStorageLocation, deleteStorageLocation, exportData, exportCSV, exportExcelXML, importData } from '../lib/db';
import { requestNotificationPermission, getNotificationPermissionStatus } from '../lib/notifications';
import { useDarkMode } from '../hooks/useDarkMode';
import { usePWAInstall } from '../hooks/usePWAInstall';
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
  Heart,
  Smartphone,
  Share,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function Settings() {
  const [isDark, toggleDark] = useDarkMode();
  const { notificationsEnabled, setNotificationsEnabled } = useAppStore();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const locations = useLiveQuery(() => db.storageLocations.toArray()) ?? [];
  const [newLocation, setNewLocation] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showDatenschutz, setShowDatenschutz] = useState(false);
  const [showAGB, setShowAGB] = useState(false);

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

  async function handleExportExcel() {
    const data = await exportExcelXML();
    downloadFile(data, `preptrack-export-${new Date().toISOString().split('T')[0]}.xls`, 'application/vnd.ms-excel');
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

  async function handleInstall() {
    const success = await install();
    if (!success) {
      alert(
        'Die Installation konnte nicht automatisch gestartet werden.\n\n' +
        'So installierst du PrepTrack manuell:\n' +
        '1. Chrome/Edge: Klicke auf das Installieren-Symbol in der Adressleiste (oder Menu > App installieren)\n' +
        '2. Safari (iOS): Tippe auf Teilen > Zum Home-Bildschirm\n' +
        '3. Firefox: Menu > Seite installieren'
      );
    }
  }

  const notifStatus = getNotificationPermissionStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Einstellungen</h1>
      </div>

      {/* PWA Install */}
      {!isInstalled && (
        <section className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
            <Smartphone size={18} className="text-green-400" />
            App installieren
          </h2>
          {isIOS ? (
            <div className="space-y-2 text-sm text-gray-400">
              <p>
                Tippe auf{' '}
                <Share size={14} className="inline text-blue-400" />{' '}
                <strong className="text-gray-300">Teilen</strong> und dann auf{' '}
                <strong className="text-gray-300">&quot;Zum Home-Bildschirm&quot;</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Installiere PrepTrack als App fuer schnelleren Zugriff und Offline-Nutzung.
              </p>
              <button
                onClick={handleInstall}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-500 active:scale-[0.98] transition-transform"
              >
                <Download size={18} />
                {isInstallable ? 'Jetzt installieren' : 'App installieren'}
              </button>
              {!isInstallable && (
                <p className="text-xs text-gray-500">
                  Tipp: In Chrome/Edge erscheint auch ein Installieren-Symbol in der Adressleiste.
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
            <span className="text-sm font-medium text-green-400">App ist installiert</span>
          </div>
        </section>
      )}

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
                  Nicht in diesem Browser unterstuetzt
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
              <span>JSON-Backup</span>
              <p className="text-xs text-gray-500">Vollstaendiges Backup aller Daten</p>
            </div>
            <Download size={16} className="ml-auto text-gray-500" />
          </button>

          <button
            onClick={handleExportExcel}
            className="flex w-full items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700"
          >
            <FileSpreadsheet size={20} className="text-green-400" />
            <div className="text-left">
              <span>Excel exportieren</span>
              <p className="text-xs text-gray-500">Formatiert mit Farben und Spaltenbreiten</p>
            </div>
            <Download size={16} className="ml-auto text-gray-500" />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex w-full items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700"
          >
            <FileText size={20} className="text-gray-400" />
            <div className="text-left">
              <span>CSV exportieren</span>
              <p className="text-xs text-gray-500">Fuer Google Sheets oder Textverarbeitung</p>
            </div>
            <Download size={16} className="ml-auto text-gray-500" />
          </button>

          <label className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-primary-700/50 px-4 py-3 text-gray-200 hover:bg-primary-700">
            <Upload size={20} className="text-orange-400" />
            <div className="text-left">
              <span>JSON-Backup importieren</span>
              <p className="text-xs text-gray-500">Daten aus einem Backup wiederherstellen</p>
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

      {/* Spenden */}
      <section className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-200">
          <Heart size={18} className="text-pink-400" />
          Unterstuetzen
        </h2>
        <p className="mb-3 text-sm text-gray-400">
          PrepTrack ist kostenlos und werbefrei. Wenn dir die App gefaellt, kannst du die
          Entwicklung mit einer kleinen Spende unterstuetzen. Danke!
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
          Mit PayPal spenden
        </a>
        <p className="mt-2 text-center text-xs text-gray-500">renateweinfurtner@gmx.de</p>
      </section>

      {/* Datenschutz */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <button
          onClick={() => setShowDatenschutz(!showDatenschutz)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="flex items-center gap-2 font-semibold text-gray-200">
            <Shield size={18} className="text-green-400" />
            Datenschutzerklaerung
          </h2>
          {showDatenschutz ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showDatenschutz && (
          <div className="mt-3 space-y-3 text-sm text-gray-400">
            <p className="font-medium text-gray-300">Verantwortlich:</p>
            <p>
              Belkis Aslani<br />
              Vogelsangstr. 32<br />
              71691 Freiberg am Neckar<br />
              E-Mail: belkis.aslani@gmail.com
            </p>

            <p className="font-medium text-gray-300">1. Datenverarbeitung</p>
            <p>
              PrepTrack speichert alle Daten ausschliesslich lokal auf deinem Geraet
              (IndexedDB im Browser). Es werden keine personenbezogenen Daten an Server
              uebertragen oder in einer Cloud gespeichert.
            </p>

            <p className="font-medium text-gray-300">2. Externe Dienste</p>
            <p>
              Beim Barcode-Scan wird die Open Food Facts API (world.openfoodfacts.org)
              kontaktiert, um Produktinformationen abzurufen. Dabei wird lediglich der
              gescannte Barcode uebermittelt. Open Food Facts ist ein gemeinnuetziges
              Open-Data-Projekt.
            </p>

            <p className="font-medium text-gray-300">3. Benachrichtigungen</p>
            <p>
              Wenn du Benachrichtigungen aktivierst, werden diese lokal auf deinem Geraet
              erzeugt. Es werden keine Push-Tokens oder Daten an externe Server gesendet.
            </p>

            <p className="font-medium text-gray-300">4. Cookies &amp; Tracking</p>
            <p>
              PrepTrack verwendet keine Cookies, kein Tracking, keine Analytics und keine
              Werbung. Es werden keine Daten an Dritte weitergegeben.
            </p>

            <p className="font-medium text-gray-300">5. Deine Rechte</p>
            <p>
              Da alle Daten lokal gespeichert werden, hast du jederzeit volle Kontrolle.
              Du kannst deine Daten ueber die Export-Funktion sichern und ueber die
              Browser-Einstellungen (Website-Daten loeschen) vollstaendig entfernen.
            </p>
          </div>
        )}
      </section>

      {/* AGB */}
      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <button
          onClick={() => setShowAGB(!showAGB)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="flex items-center gap-2 font-semibold text-gray-200">
            <FileText size={18} className="text-blue-400" />
            Allgemeine Geschaeftsbedingungen
          </h2>
          {showAGB ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {showAGB && (
          <div className="mt-3 space-y-3 text-sm text-gray-400">
            <p className="font-medium text-gray-300">Anbieter:</p>
            <p>
              Belkis Aslani<br />
              Vogelsangstr. 32<br />
              71691 Freiberg am Neckar<br />
              E-Mail: belkis.aslani@gmail.com
            </p>

            <p className="font-medium text-gray-300">1. Geltungsbereich</p>
            <p>
              Diese AGB gelten fuer die Nutzung der Web-App &quot;PrepTrack&quot;.
              Mit der Nutzung der App akzeptierst du diese Bedingungen.
            </p>

            <p className="font-medium text-gray-300">2. Leistungsbeschreibung</p>
            <p>
              PrepTrack ist eine kostenlose, werbefreie Progressive Web App zur Verwaltung
              von Vorratsbestaenden. Die App funktioniert offline und speichert alle Daten
              lokal auf dem Endgeraet des Nutzers.
            </p>

            <p className="font-medium text-gray-300">3. Verfuegbarkeit</p>
            <p>
              Ein Anspruch auf staendige Verfuegbarkeit besteht nicht. Die App kann jederzeit
              ohne Ankuendigung geaendert oder eingestellt werden.
            </p>

            <p className="font-medium text-gray-300">4. Haftung</p>
            <p>
              Die Nutzung erfolgt auf eigene Verantwortung. Der Anbieter haftet nicht fuer
              Schaeden, die durch die Nutzung der App entstehen, insbesondere nicht fuer den
              Verlust von Daten. Regelmaessige Backups werden empfohlen.
            </p>

            <p className="font-medium text-gray-300">5. Geistiges Eigentum</p>
            <p>
              Alle Rechte an der App liegen beim Anbieter.
              Die App darf fuer den persoenlichen Gebrauch frei genutzt werden.
            </p>

            <p className="font-medium text-gray-300">6. Spenden</p>
            <p>
              Spenden sind freiwillig und begruenden kein Vertragsverhaeltnis.
              Es besteht kein Anspruch auf besondere Leistungen.
            </p>
          </div>
        )}
      </section>

      {/* App Info */}
      <section className="space-y-1 text-center text-xs text-gray-600">
        <p>PrepTrack v1.0.0</p>
        <p>Dein Vorrat. Immer im Blick.</p>
        <p>&copy; {new Date().getFullYear()} Belkis Aslani</p>
      </section>
    </div>
  );
}
