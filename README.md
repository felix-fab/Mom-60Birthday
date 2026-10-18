# 🎂 60. Geburtstag – Handy-Flashmob

Eine Website, bei der mehrere Personen ihre Handys nebeneinander halten. Über alle Geräte hinweg läuft synchron ein Countdown, dann coole Animationen und schließlich erscheint **„HAPPY BIRTHDAY"** – jedes Handy zeigt einen Buchstaben.

## Funktionsweise

- Ein **Organisator** öffnet die Steuerungs-Seite (auf einem Laptop/Bildschirm).
- Dort erscheint ein **QR-Code**. Alle Gäste scannen ihn mit der Handykamera und öffnen so die Anzeige-Seite auf ihrem Handy.
- Jeder Gast gibt seinen **Namen** ein.
- Der Organisator sieht alle verbundenen Geräte mit Namen und kann die **Reihenfolge** festlegen (welches Handy zuerst gehalten wird).
- Per Knopfdruck startet der **Countdown**, dann die **Animationen** und schließlich **„HAPPY BIRTHDAY"** – verteilt über alle Handys.
- Der Bildschirm der Handys bleibt **automatisch an** (Screen Wake Lock), solange die Seite offen ist – kein Sperrbildschirm nötig.
- Alles läuft über einen kleinen Server **im WLAN** und ist dadurch perfekt synchron.

## Starten

1. Voraussetzung: [Node.js](https://nodejs.org) ist installiert.
2. In diesem Ordner die Abhängigkeiten installieren (einmalig):
   ```
   npm install
   ```
3. **Domain (optional) konfigurieren:** In `server.js` oben steht `PUBLIC_URL`.
   - Standard: `https://geburtstag.felixfab.de`
   - Oder per Umgebungsvariable: `PUBLIC_URL=https://deine-domain.de npm start`
   - Soll es **nur im WLAN** laufen, setze `PUBLIC_URL=` (leer) → die WLAN-IP wird automatisch genutzt.
4. Server starten:
   ```
   npm start
   ```
5. Im Terminal wird die Adresse angezeigt, z.B. `https://geburtstag.felixfab.de`.
6. Diese Adresse im Browser des Organisators öffnen → QR-Code und Steuerung erscheinen.
   Der **QR-Code verlinkt auf die Handy-Seite** (`/display`).

> ⚠️ **Wichtig (nur im WLAN):** Laptop und alle Handys müssen im **selben WLAN** sein.
>
> ⚠️ **Wichtig (mit Domain über Internet):** Deine Domain/Tunnel muss
> **HTTPS (wss)** UND **WebSockets** unterstützen (z.B. Cloudflare Tunnel tut das).
> Die Handys öffnen dann `https://geburtstag.felixfab.de/display` und verbinden
> sich automatisch per `wss://` – auch über das Internet hinweg.

## Installieren als App (PWA)

Die Handy-Seite ist eine **installierbare Web-App (PWA)** – so kann man sie auf
Android als eigene App installieren und sie läuft dann **ohne Browser-Leiste**
(im Vollbild/Standalone-Modus):

1. Die Handy-Seite im **Chrome**-Browser auf Android öffnen (über den QR-Code).
2. Im Browser-Menü (⋮) auf **„App installieren"** (oder „Zum Startbildschirm") tippen.
   Manchmal erscheint auch automatisch ein Installations-Hinweis.
3. Die App wird auf dem Startbildschirm abgelegt und öffnet sich künftig wie eine
   eigene App – **ohne Adressleiste**, im Vollbild.

> 💡 **Hinweis:** Auf iOS (Safari) kann man die Seite über „Zum Home-Bildschirm"
> hinzufügen – dann läuft sie ebenfalls ohne Browser-Leiste.
>
> 💡 Die PWA-Funktionen (Manifest, Icons, Service Worker) liegen unter
> `public/manifest.json`, `public/icons/` und `public/sw.js`.

## Ablauf für die Feier

1. **Vorbereiten:** Server starten, Steuerungs-Seite am Laptop/Beamer öffnen.
2. **Verbinden:** Alle Gäste scannen den QR-Code und geben ihren Namen ein.
3. **Reihenfolge:** Im Steuerungs-Panel die Namen in die gewünschte Handy-Reihenfolge bringen
   und „Reihenfolge sortieren" drücken. Gerät #1 steht ganz links.
4. **Aufstellen:** Alle stellen sich mit ihrem Handy in der angezeigten Reihenfolge auf
   (die Handys zeigen nach vorn zum Publikum / zur Mama).
5. **Show starten:** „Countdown & Show starten" drücken.
   - Alle Handys zählen synchron von **10 nach 1** (mit Tick-Tönen). Dabei läuft
     bereits eine **Licht-Welle** von links nach rechts über die ganze Handy-Reihe.
   - **Direkt** nach dem Countdown erscheint „HAPPY BIRTHDAY" – jedes Handy zeigt genau
     **einen großen Buchstaben** über den ganzen Bildschirm, nacheinander von links
     nach rechts aufleuchtend (mit Fanfare). **Nur die Buchstaben** sind zu sehen.
   - Die Buchstaben **bleiben die ganze Zeit stehen** – zum Schluss kommt noch
     **Konfetti und Sound** dazu.

> 🎆 **Die Animation (hochauflösend, über alle Handys):** Jedes Handy rendert auf
> einem eigenen **Canvas** (in voller Geräte-Auflösung, inkl. Retina/`devicePixelRatio`)
> nur **seinen Streifen** eines gemeinsamen, über die Server-Zeit exakt synchronisierten
> Gesamtbilds. Dadurch läuft eine **durchgehende, mehrfarbige Lichtwelle mit Funken
> und Schweif** nahtlos von einem Handy zum nächsten – wie ein großes, zusammenhängendes
> Bild über die ganze Reihe. Dazu kommen aufsteigende **Herzen**, goldener **Sternenstaub**,
> ein pulsierender **Kerzenlicht-Glow** hinter den Buchstaben und ein großer
> **Konfetti-Regenschauer** zum Finale.

> 💡 **Idealfall:** Genau **14 Geräte** ergeben das perfekte „HAPPY BIRTHDAY"
> (jedes Handy = 1 Buchstabe, inkl. Leerzeichen). Jedes Handy zeigt immer nur
> **einen** Buchstaben – bei mehr als 14 Geräten zeigen die zusätzlichen Handys 🎉,
> bei weniger Geräten fehlen die hinteren Buchstaben.

## Dateien

| Datei | Zweck |
|-------|-------|
| `server.js` | Node.js-Server mit WebSocket-Synchronisation |
| `public/display.html` | Die Anzeige-Seite für die Handys (Countdown, Animationen, Buchstaben) |
| `public/` | Statische Dateien (CSS/JS inline in display.html) |
| `package.json` | Abhängigkeiten & Start-Skript |

## Technik

- **Node.js + Express** für den Server
- **`ws` (WebSocket)** für die Echtzeit-Synchronisation aller Geräte
- **`qrcode`** für den QR-Code auf der Steuerungs-Seite
- Alle Geräte erhalten beim Start dieselben Zeitstempel (`t1`, `t2`, `t3`),
  wodurch Countdown und Animationen überall gleichzeitig ablaufen.
