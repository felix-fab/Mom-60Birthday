# 🎂 60. Geburtstag – Handy-Flashmob

Eine Website, bei der mehrere Personen ihre Handys nebeneinander halten. Über alle Geräte hinweg läuft synchron ein Countdown, dann coole Animationen und schließlich erscheint **„HAPPY BIRTHDAY"** – jedes Handy zeigt einen Buchstaben.

## Funktionsweise

- Ein **Organisator** öffnet die Steuerungs-Seite (auf einem Laptop/Bildschirm).
- Dort erscheint ein **QR-Code**. Alle Gäste scannen ihn mit der Handykamera und öffnen so die Anzeige-Seite auf ihrem Handy.
- Jeder Gast gibt seinen **Namen** ein.
- Der Organisator sieht alle verbundenen Geräte mit Namen und kann die **Reihenfolge** festlegen (welches Handy zuerst gehalten wird).
- Per Knopfdruck startet der **Countdown**, dann die **Animationen** und schließlich **„HAPPY BIRTHDAY"** – verteilt über alle Handys.
- Alles läuft über einen kleinen Server **im WLAN** und ist dadurch perfekt synchron.

## Starten

1. Voraussetzung: [Node.js](https://nodejs.org) ist installiert.
2. In diesem Ordner die Abhängigkeiten installieren (einmalig):
   ```
   npm install
   ```
3. Server starten:
   ```
   npm start
   ```
4. Im Terminal wird die Adresse angezeigt, z.B. `http://192.168.178.54:3000`.
5. Diese Adresse im Browser des Organisators öffnen → QR-Code und Steuerung erscheinen.

> ⚠️ **Wichtig:** Laptop und alle Handys müssen im **selben WLAN** sein.
> Die Adresse im Terminal wird automatisch auf die lokale WLAN-IP gesetzt
> (Tailscale/VPN-Adressen werden ignoriert).

## Ablauf für die Feier

1. **Vorbereiten:** Server starten, Steuerungs-Seite am Laptop/Beamer öffnen.
2. **Verbinden:** Alle Gäste scannen den QR-Code und geben ihren Namen ein.
3. **Reihenfolge:** Im Steuerungs-Panel die Namen in die gewünschte Handy-Reihenfolge bringen
   und „Reihenfolge sortieren" drücken. Gerät #1 steht ganz links.
4. **Aufstellen:** Alle stellen sich mit ihrem Handy in der angezeigten Reihenfolge auf
   (die Handys zeigen nach vorn zum Publikum / zur Mama).
5. **Show starten:** „Countdown & Show starten" drücken.
   - Alle Handys zählen synchron 3… 2… 1…
   - Dann läuft eine **Regenbogen-Welle** mit Blitz über alle Handys.
   - Dann erscheint **„HAPPY BIRTHDAY"** – jedes Handy zeigt einen Buchstaben.
   - Zum Schluss ein großes Finale mit Konfetti.

> 💡 **Idealfall:** Genau **14 Geräte** ergeben das perfekte „HAPPY BIRTHDAY"
> (jedes Handy = 1 Buchstabe, inkl. Leerzeichen). Bei weniger Geräten werden
> mehrere Buchstaben pro Handy zusammengelegt, bei mehr Geräten wiederholt sich
> der Text bzw. einige Handys zeigen 🎉.

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
