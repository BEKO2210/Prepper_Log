# PrepTrack im Google Play Store veröffentlichen (TWA)

Diese Anleitung verpackt die bestehende PWA als **Trusted Web Activity (TWA)** —
eine native Android-App-Hülle, die PrepTrack im Vollbild (ohne Browser-Adressleiste)
anzeigt. Die App-Inhalte kommen weiterhin von der gehosteten PWA; das APK/AAB ist
nur eine schlanke Hülle (wenige MB), unabhängig von der Größe des Web-Caches.

> **Was die Tooling-Dateien hier liefern:** `twa-manifest.json` (Bubblewrap-Konfig)
> und `public/.well-known/assetlinks.json` (Vorlage). Den finalen Build und Upload
> musst du selbst durchführen — dafür braucht es ein Google-Play-Entwicklerkonto
> (einmalig 25 $) und einen Signatur-Keystore, die nicht im Repository liegen.

---

## ⚠️ Wichtig zuerst: Digital Asset Links & Domain

Damit die TWA **ohne Adressleiste** startet, muss unter der **Origin-Wurzel** eine
Datei erreichbar sein:

```
https://<DEINE-DOMAIN>/.well-known/assetlinks.json
```

Das ist der **kritische Punkt bei GitHub Pages**: Projektseiten liegen unter einem
Unterpfad (`beko2210.github.io/Prepper_Log/`), aber Asset Links werden **nur an der
Origin-Wurzel** (`beko2210.github.io/.well-known/...`) ausgewertet — und die gehört
zum User-Pages-Repo `beko2210.github.io`, nicht zu diesem Projekt.

**Zwei Wege:**

1. **Eigene Domain (empfohlen für eine „Nr. 1"-App).** Z. B. `preptrack.app` per
   `CNAME` auf GitHub Pages zeigen lassen. Dann liegt `assetlinks.json` an der
   Wurzel dieser Domain, sieht professionell aus und vereinfacht ASO/SEO.
   - `start_url`/`host`/URLs in `twa-manifest.json` entsprechend anpassen.
2. **github.io-Wurzel nutzen.** `assetlinks.json` zusätzlich ins Repo
   `beko2210/beko2210.github.io` legen, sodass sie unter
   `https://beko2210.github.io/.well-known/assetlinks.json` ausgeliefert wird.
   Die TWA verweist weiterhin auf den `/Prepper_Log/`-Pfad.

Die Datei `public/.well-known/assetlinks.json` in diesem Repo wird nach
`…/Prepper_Log/.well-known/assetlinks.json` deployt — das ist die richtige Vorlage,
aber **nicht** der wirksame Wurzel-Pfad. Kopiere sie an den passenden Ort (s. o.).

---

## Voraussetzungen

- Node.js 20+ und Java JDK 17+ (`java -version`).
- Android SDK (Bubblewrap kann es beim ersten Lauf automatisch einrichten).
- Google-Play-Entwicklerkonto.

## 1. Bubblewrap installieren & initialisieren

```bash
# Bubblewrap ist Googles offizielles TWA-Tool – kein Repo-Dependency nötig:
npx @bubblewrap/cli init --manifest ./twa-manifest.json
```

`twa-manifest.json` ist bereits mit PrepTrack-Werten vorbereitet
(Theme `#1a3a2a`, Icons, `standalone`, Benachrichtigungen aktiv,
`packageId` `io.github.beko2210.preptrack`). Passe bei eigener Domain `host`,
`startUrl`, `webManifestUrl`, `iconUrl`, `maskableIconUrl` und `fullScopeUrl` an.

## 2. Signatur-Keystore erstellen

Beim ersten `init`/`build` erzeugt Bubblewrap einen Keystore (`android.keystore`)
oder du erstellst ihn explizit:

```bash
keytool -genkeypair -v -keystore android.keystore \
  -alias preptrack -keyalg RSA -keysize 2048 -validity 9125
```

> **Keystore + Passwörter sicher aufbewahren und NIEMALS committen.** Ohne sie sind
> keine App-Updates mehr möglich. (`.gitignore` schließt `*.keystore` aus.)

## 3. SHA-256-Fingerprint holen und assetlinks füllen

```bash
keytool -list -v -keystore android.keystore -alias preptrack | grep SHA256
```

Den Wert in `assetlinks.json` bei `sha256_cert_fingerprints` eintragen
(Platzhalter `REPLACE_WITH_YOUR_APP_SIGNING_SHA256_FINGERPRINT` ersetzen) und an die
Origin-Wurzel deployen (siehe oben).

> **Play App Signing:** Wenn du in der Play Console „Play App Signing" nutzt
> (empfohlen), signiert Google die App mit einem **eigenen** Schlüssel. Dann den
> dort angezeigten SHA-256 zusätzlich in `assetlinks.json` aufnehmen.

## 4. App bauen

```bash
npx @bubblewrap/cli build
```

Ergebnis: `app-release-bundle.aab` (für den Play Store) und ein Test-APK.
Lokal testen:

```bash
adb install app-release-signed.apk
```

Die App sollte **ohne** Browser-Adressleiste starten. Erscheint eine Leiste, stimmt
die Asset-Links-Verknüpfung (Fingerprint/Pfad) noch nicht.

## 5. Im Play Store veröffentlichen

1. [Play Console](https://play.google.com/console) → **App erstellen**.
2. Store-Eintrag ausfüllen: Beschreibung, Screenshots (in `public/screenshots/`
   vorhanden), Feature-Grafik, Kategorie *Tools/Lifestyle*, Datenschutz-URL.
3. **Datensicherheit**-Formular: PrepTrack speichert lokal, kein Tracking — ehrlich
   so angeben (starkes Verkaufsargument).
4. `app-release-bundle.aab` in einen Release (intern → geschlossen → produktiv)
   hochladen.
5. Nach Aktivierung von Play App Signing den Google-Fingerprint in `assetlinks.json`
   ergänzen und neu deployen.

## 6. Updates

- **Web-Inhalt** (Features/Fixes): einfach auf `main` pushen → GitHub Pages deployt,
  die TWA lädt automatisch die neue Version. **Kein** Play-Store-Update nötig.
- **Hülle** (Icon, Name, `targetSdk`, Berechtigungen): `appVersionCode` in
  `twa-manifest.json` erhöhen, neu bauen, neues AAB hochladen.

---

## Checkliste

- [ ] Domain-Strategie entschieden (eigene Domain empfohlen)
- [ ] `assetlinks.json` an der Origin-Wurzel erreichbar
- [ ] Keystore erstellt & sicher gesichert
- [ ] SHA-256-Fingerprint(s) in `assetlinks.json`
- [ ] TWA startet lokal ohne Adressleiste
- [ ] Play-Console-Eintrag inkl. Datensicherheit ausgefüllt
- [ ] AAB hochgeladen & Release ausgerollt
