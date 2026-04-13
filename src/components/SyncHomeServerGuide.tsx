import { ArrowLeft, CheckCircle2, Copy, Home, ShieldAlert, Wrench } from 'lucide-react';

interface SyncHomeServerGuideProps {
  onBack: () => void;
}

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300">
          {step}
        </span>
        <h3 className="font-semibold text-gray-100">{title}</h3>
      </div>
      <div className="space-y-2 text-sm text-gray-300">{children}</div>
    </article>
  );
}

function CodeLine({ value }: { value: string }) {
  return (
    <code className="inline-flex items-center gap-1 rounded-md border border-primary-600 bg-primary-900 px-2 py-1 font-mono text-xs text-sky-300">
      <Copy size={12} />
      {value}
    </code>
  );
}

export function SyncHomeServerGuide({ onBack }: SyncHomeServerGuideProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-3 py-2 text-sm text-gray-200 hover:bg-primary-600"
        >
          <ArrowLeft size={16} />
          Zurück zu Einstellungen
        </button>
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-100">
          <Home size={20} className="text-sky-400" />
          LAN Sync Home-Server Anleitung
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          Diese Anleitung führt dich Schritt für Schritt durch die Einrichtung. Danach kannst du mehrere Geräte in deinem eigenen Heimnetzwerk synchronisieren – ohne Cloud-Zwang.
        </p>
      </section>

      <section className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-sm text-gray-300">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-100">
          <CheckCircle2 size={18} className="text-green-400" />
          Vor dem Start prüfen
        </h3>
        <ul className="list-inside list-disc space-y-1">
          <li>Du hast einen laufenden Heimserver (z. B. Raspberry Pi, Mini-PC oder NAS mit Docker).</li>
          <li>Der Server und dein Handy/Tablet sind im selben WLAN oder LAN.</li>
          <li>Du kannst am Server ein Terminal öffnen.</li>
          <li>Du darfst im Router die lokale IP des Servers sehen (z. B. 192.168.0.20).</li>
        </ul>
      </section>

      <StepCard step={1} title="Sync-Backend auf dem Server starten">
        <p>Wechsle auf dem Server in den Ordner deiner App und starte das Backend mit Docker Compose:</p>
        <p><CodeLine value="docker compose -f docker-compose.sync.yml up -d --build" /></p>
        <p>Prüfe danach, ob der Container läuft:</p>
        <p><CodeLine value="docker compose -f docker-compose.sync.yml ps" /></p>
      </StepCard>

      <StepCard step={2} title="Server URL in der App eintragen">
        <p>
          Öffne in den Einstellungen den Bereich <strong>LAN Sync</strong> und trage bei <strong>Server URL</strong> die lokale Adresse deines Servers ein.
        </p>
        <p>Beispiel: <CodeLine value="http://192.168.0.20:8787" /></p>
        <p>Wichtig: Kein HTTPS erzwingen, solange dein Heimserver nur lokal läuft.</p>
      </StepCard>

      <StepCard step={3} title="Gerätename und Sync-Code setzen">
        <p>
          Gerätename frei wählen (z. B. <CodeLine value="iPhone Küche" />).
        </p>
        <p>
          Beim Sync-Code einen langen, eigenen Code verwenden (mindestens 12 Zeichen, am besten mit Zahlen und Sonderzeichen).
        </p>
        <p>Tippe zuerst auf <strong>Einstellungen speichern</strong>, dann auf <strong>Gerät koppeln</strong>.</p>
      </StepCard>

      <StepCard step={4} title="Weiteres Gerät koppeln">
        <p>Auf dem zweiten Gerät dieselbe Server URL und denselben Sync-Code eintragen.</p>
        <p>Neuen Gerätenamen vergeben (z. B. <CodeLine value="Tablet Vorratsraum" />) und ebenfalls koppeln.</p>
        <p>Wenn beide Geräte verbunden sind, kannst du <strong>Hintergrund-Sync</strong> aktivieren.</p>
      </StepCard>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-100">
          <ShieldAlert size={18} className="text-amber-400" />
          Fehlercodes & schnelle Lösung
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong>E_CONN_REFUSED:</strong> Server nicht erreichbar. Prüfe, ob Container läuft und Port 8787 offen ist.</p>
          <p><strong>E_TIMEOUT:</strong> Netzwerk zu langsam oder falsche Server-IP. URL neu prüfen.</p>
          <p><strong>E_BAD_CODE / 401:</strong> Sync-Code falsch. Auf allen Geräten exakt gleichen Code nutzen.</p>
          <p><strong>E_CONFLICT / 409:</strong> Datenkonflikt bei parallelen Änderungen. Erneut synchronisieren, danach Daten prüfen.</p>
          <p><strong>E_SCHEMA / 422:</strong> Veraltete App-Version oder inkompatible Datenstruktur. App und Backend aktualisieren.</p>
          <p><strong>E_SERVER / 500:</strong> Interner Fehler im Sync-Backend. Server-Logs prüfen:</p>
          <p><CodeLine value="docker compose -f docker-compose.sync.yml logs -f" /></p>
        </div>
      </section>

      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-100">
          <Wrench size={18} className="text-sky-400" />
          Wartung & Sicherheit
        </h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-300">
          <li>Nur im Heimnetzwerk nutzen oder sauber per VPN absichern.</li>
          <li>Regelmäßig Backup exportieren (JSON) – zusätzlich zum Sync.</li>
          <li>Bei Serverwechsel in der App auf <strong>Neu koppeln</strong> tippen und neu verbinden.</li>
          <li>Bei Problemen zuerst Status und Letzter Erfolg im LAN-Sync-Bereich prüfen.</li>
        </ul>
        <p className="mt-3 text-sm text-gray-400">
          Tipp: Für tiefe Fehleranalyse kannst du zusätzlich die Datei <code className="rounded bg-primary-900 px-1 py-0.5 text-xs text-sky-300">sync-backend/README.md</code> im Projekt öffnen.
        </p>
      </section>
    </div>
  );
}
