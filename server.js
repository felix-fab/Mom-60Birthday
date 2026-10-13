import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import QRCode from "qrcode";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Öffentliche Basis-URL, unter der die Seite erreichbar ist.
// Nutzt du eine eigene Domain (z.B. geburtstag.felixfab.de), hier eintragen.
// Oder per Umgebungsvariable setzen:  PUBLIC_URL=https://geburtstag.felixfab.de  npm start
// Wenn leer, wird automatisch die lokale WLAN-IP ermittelt (nur im selben WLAN nutzbar).
const PUBLIC_URL = process.env.PUBLIC_URL || "https://geburtstag.felixfab.de";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static("public"));

// ---------- Zustand ----------
// Jedes Gerät (Display) bekommt eine id. Der Organisator/Control ist separat.
const displays = new Map(); // id -> { id, name, order, lastSeen }

let nextOrder = 0;
let activeEvent = null; // { type, payload, at }

// ---------- WebSocket ----------
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    handleMessage(ws, msg);
  });
  ws.on("close", () => {
    if (ws.deviceId) {
      const d = displays.get(ws.deviceId);
      if (d) d.connected = false;
      broadcastState();
    }
  });
});

function handleMessage(ws, msg) {
  switch (msg.type) {
    case "register-display":
      // Ein Handy meldet sich als Anzeige-Gerät an
      if (!ws.deviceId) {
        ws.deviceId = msg.id || "d" + Math.random().toString(36).slice(2, 10);
      }
      displays.set(ws.deviceId, {
        id: ws.deviceId,
        name: (msg.name || "").trim() || "Unbenannt",
        order: msg.order ?? nextOrder++,
        connected: true,
        lastSeen: Date.now(),
      });
      ws.send(JSON.stringify({ type: "registered", id: ws.deviceId }));
      // Falls ein Event gerade läuft, direkt nachreichen (z.B. Seite neu geladen)
      if (activeEvent) {
        ws.send(JSON.stringify(eventMessage()));
      }
      broadcastState();
      break;

    case "rename":
      if (ws.deviceId && displays.has(ws.deviceId)) {
        displays.get(ws.deviceId).name = (msg.name || "").trim() || "Unbenannt";
        broadcastState();
      }
      break;

    case "set-order":
      // Organisator setzt die Reihenfolge für ein Gerät
      if (displays.has(msg.id)) {
        displays.get(msg.id).order = msg.order;
        broadcastState();
      }
      break;

    case "set-names":
      // Organisator überträgt eine komplette Namens-/Reihenfolge-Liste
      if (Array.isArray(msg.list)) {
        msg.list.forEach((entry, idx) => {
          if (displays.has(entry.id)) {
            const d = displays.get(entry.id);
            d.name = entry.name || d.name;
            d.order = entry.order ?? idx;
          }
        });
        broadcastState();
      }
      break;

    case "set-active":
      // Organisator wählt, welche Geräte teilnehmen (aktive Reihenfolge)
      if (Array.isArray(msg.activeIds)) {
        for (const d of displays.values()) {
          d.active = msg.activeIds.includes(d.id);
        }
        broadcastState();
      }
      break;

    case "start":
      // Organisator startet das Event mit Timeout, damit alle bereit sind
      activeEvent = { type: "pending", payload: { timeout: 4000 } };
      broadcastEvent();
      setTimeout(() => {
        if (activeEvent && activeEvent.type === "pending") {
          beginSequence();
        }
      }, 4000);
      break;

    case "fire":
      // Jede Geräte-Seite meldet, dass sie bereit ist (Foto/Name geladen).
      // Der Server startet den Countdown, sobald genug Geräte bereit sind,
      // oder nach kurzer Zeit.
      break;

    case "sync-request":
      ws.send(JSON.stringify({ type: "state", displays: stateList() }));
      break;

    case "time-sync":
      // Für die Clock-Synchronisation der Geräte: RTT messen
      ws.send(JSON.stringify({
        type: "time-sync",
        clientSend: msg.clientSend,
        serverTime: Date.now(),
      }));
      break;
  }
}

function beginSequence() {
  const t0 = Date.now();
  const seq = {
    type: "sequence",
    // t1: Countdown startet bei 10 (10 Sekunden, 1 pro Sekunde)
    // t2: Buchstaben ("Happy Birthday") direkt nach dem Countdown
    // t3: Feier (Konfetti) über den stehenbleibenden Buchstaben
    payload: { t0, t1: t0 + 1000, t2: t0 + 11500, t3: t0 + 17000 },
  };
  activeEvent = seq;
  broadcastEvent();
}

// Event als Nachricht an die Geräte: wrapper mit eindeutigem Typ "event"
// und dem eigentlichen Event-Typ als Feld "event" (statt ihn zu überschreiben).
function eventMessage() {
  return { type: "event", event: activeEvent.type, payload: activeEvent.payload };
}

function broadcastEvent() {
  broadcast(eventMessage());
}

function stateList() {
  return [...displays.values()]
    .map((d) => ({
      id: d.id,
      name: d.name,
      order: d.order,
      connected: !!d.connected,
      active: d.active !== false,
    }))
    .sort((a, b) => a.order - b.order);
}

function broadcast(msg) {
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(msg));
    }
  }
}

function broadcastState() {
  broadcast({ type: "state", displays: stateList() });
}

// Heartbeat: tote Verbindungen entfernen
setInterval(() => {
  for (const client of wss.clients) {
    if (!client.isAlive) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 15000);

// ---------- HTTP ----------
// Control-Ansicht (Organisator): zeigt Geräte + QR-Code
// Der QR-Code verlinkt auf die DISPLAY-Seite (/display), damit Handys sich
// direkt als Anzeige-Gerät verbinden – NICHT auf die Control-Seite.
app.get("/", async (req, res) => {
  const displayUrl = PUBLIC_URL.replace(/\/+$/, "") + "/display";
  const qr = await QRCode.toDataURL(displayUrl, { width: 400, margin: 1 });
  res.send(controlHtml(qr, displayUrl, PUBLIC_URL));
});

function displayUrl() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        candidates.push(net.address);
      }
    }
  }
  // Bevorzuge typische private WLAN-Adressen (192.168, 10., 172.16-31)
  const preferred = candidates.find(a =>
    a.startsWith("192.168.") || a.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(a));
  return "http://" + (preferred || candidates[0] || `localhost`) + `:${PORT}`;
}

// State als JSON für das Control-Dashboard
app.get("/api/state", (req, res) => res.json({ displays: stateList() }));

// Display-Seite (Handy)
app.get("/display", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "display.html"));
});

// ---------- Control HTML ----------
// qr = QR-Code-Bild (verlinkt auf die Display-Seite der Handys)
// displayUrl = URL, die im QR-Code steht (was die Handys öffnen)
// controlUrl = URL der Steuerungs-Seite (für den Organisator)
function controlHtml(qr, displayUrl, controlUrl) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>🎂 60. Geburtstag – Steuerung</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: 'Segoe UI', system-ui, sans-serif; background:#1a1030; color:#fff;
         min-height:100vh; padding:24px; }
  h1 { margin:0 0 4px; font-size:1.6rem; }
  .sub { opacity:.75; margin-bottom:20px; font-size:.95rem; }
  .grid { display:grid; grid-template-columns: 320px 1fr; gap:24px; max-width:1100px; margin:0 auto; }
  .card { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:20px; }
  .card h2 { margin:0 0 12px; font-size:1.1rem; }
  .qrwrap { text-align:center; }
  .qrwrap img { width:280px; height:280px; border-radius:12px; background:#fff; padding:8px; }
  .urlbox { margin-top:14px; font-size:.85rem; word-break:break-all; background:rgba(0,0,0,.3); padding:10px; border-radius:8px; }
  .devices { display:flex; flex-direction:column; gap:8px; }
  .device { display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.05);
            padding:10px 12px; border-radius:10px; }
  .device .order { font-weight:700; color:#ffd166; width:26px; }
  .device .name { flex:1; background:transparent; border:none; color:#fff; font-size:1rem; }
  .device .name:focus { outline:none; border-bottom:1px solid #ffd166; }
  .dot { width:10px; height:10px; border-radius:50%; background:#4caf50; }
  .dot.off { background:#e05c5c; }
  .count { font-size:.8rem; opacity:.7; }
  .actions { margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; }
  button { background:linear-gradient(135deg,#ff6b6b,#f06595); border:none; color:#fff; font-size:1.05rem;
           font-weight:600; padding:14px 22px; border-radius:12px; cursor:pointer; transition:transform .1s; }
  button:hover { transform:scale(1.03); }
  button.ghost { background:rgba(255,255,255,.1); }
  button:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .hint { margin-top:16px; font-size:.85rem; opacity:.8; line-height:1.5; }
  .spin { display:inline-block; animation:spin 1s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media (max-width:800px){ .grid{grid-template-columns:1fr;} }
</style>
</head>
<body>
<div class="grid">
  <div class="card qrwrap">
    <h2>📱 Handys verbinden</h2>
    <p class="sub">Jede Person scannt den QR-Code mit der Handykamera.</p>
    <img id="qr" src="${qr}" alt="QR-Code" />
    <div class="urlbox">Handy-URL (im QR-Code):<br>${displayUrl}</div>
    <div class="urlbox" style="margin-top:8px;">Steuerung (diese Seite):<br>${controlUrl}</div>
  </div>
  <div class="card">
    <h2>🎯 Geräte & Reihenfolge</h2>
    <p class="sub">Geräte in der Reihenfolge, in der die Handys gehalten werden sollen.
       <span id="devcount" class="count"></span></p>
    <div id="devices" class="devices"></div>
    <div class="actions">
      <button id="btnStart">▶ Countdown & Show starten</button>
      <button id="btnActive" class="ghost">Nur verbundene aktivieren</button>
      <button id="btnOrder" class="ghost">Reihenfolge sortieren</button>
    </div>
    <div class="hint">
      💡 <b>Reihenfolge festlegen:</b> Tippe die Namen in der gewünschten Reihenfolge ein und drücke
      „Reihenfolge sortieren". Das 1. Gerät zeigt die Nummer 1 und steht ganz links.<br />
      💡 Alle Handys müssen die gleiche Webseite öffnen und <b>nicht</b> in den Sperrbildschirm gehen.
    </div>
  </div>
</div>

<script>
const ws = new WebSocket(location.origin.replace(/^http/,'ws'));
let displays = [];

ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === "state") { displays = m.displays; render(); }
};
ws.onopen = () => ws.send(JSON.stringify({type:"sync-request"}));

const el = {
  devices: document.getElementById("devices"),
  devcount: document.getElementById("devcount"),
};

function render() {
  el.devcount.textContent = "(" + displays.length + " verbunden)";
  el.devices.innerHTML = "";
  displays.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "device";
    row.innerHTML =
      '<span class="order">' + (i+1) + '</span>' +
      '<span class="dot' + (d.connected?"":" off") + '"></span>' +
      '<input class="name" value="' + escapeHtml(d.name) + '" data-id="' + d.id + '" />' +
      '<span class="count">' + (d.connected?"verbunden":"offline") + '</span>';
    el.devices.appendChild(row);
    const input = row.querySelector(".name");
    input.addEventListener("change", () => {
      ws.send(JSON.stringify({ type:"set-names", list:[{ id:d.id, name:input.value }] }));
    });
  });
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

document.getElementById("btnStart").onclick = () => {
  if (!confirm("Show starten? Alle Geräte starten gleichzeitig den Countdown.")) return;
  const btn = document.getElementById("btnStart");
  btn.disabled = true; btn.innerHTML = '<span class="spin">⟳</span> Läuft...';
  ws.send(JSON.stringify({ type:"start" }));
  setTimeout(()=>{ btn.disabled=false; btn.textContent="▶ Countdown & Show starten"; }, 8000);
};
document.getElementById("btnActive").onclick = () => {
  ws.send(JSON.stringify({ type:"set-active", activeIds: displays.filter(d=>d.connected).map(d=>d.id) }));
};
document.getElementById("btnOrder").onclick = () => {
  const rows = [...document.querySelectorAll(".device")];
  const list = rows.map((r,idx) => {
    const id = r.querySelector(".name").dataset.id;
    const name = r.querySelector(".name").value;
    return { id, name, order: idx };
  });
  ws.send(JSON.stringify({ type:"set-names", list }));
  alert("Reihenfolge gespeichert. Ziehe die Namen durch Neuanordnen der Eingaben und drücke erneut, falls nötig.");
};
</script>
</body>
</html>`;
}

// ---------- Start ----------
const PORT = process.env.PORT || 3010;
server.listen(PORT, () => {
  const ctrl = PUBLIC_URL || displayUrl();
  console.log("🎉 Geburtstags-Show läuft auf " + PUBLIC_URL);
  console.log("   Steuerung (Organisator): " + ctrl);
  console.log("   Handy-Display (QR-Code): " + PUBLIC_URL.replace(/\/+$/, "") + "/display");
});
