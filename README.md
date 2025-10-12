# Aura Communal Demo

A laptop-friendly monorepo for showing the communal mug aura experience at tradeshows. It bundles an MQTT broker, Node.js aggregator, React dashboard, and supports both ESP32 simulator and real M5StickC hardware.

## System Architecture
```
📱 Phone (BLE beacon "COMMUNAL_ZONE") 
    ↓ BLE proximity scan
🔧 M5StickC (mug-001) 
    ↓ MQTT publish
💻 Laptop Backend (172.16.11.232:1883)
    ↓ WebSocket
🌐 React Dashboard (localhost:5173)
```

## Prerequisites
- Node.js 20 or newer with npm 10+
- Mosquitto installed locally (e.g. `brew install mosquitto` on macOS or `sudo apt install mosquitto` on Debian/Ubuntu)
- M5StickC with Arduino IDE (for hardware setup)
- Phone with BLE beacon app (for proximity testing)

## Install
```bash
npm install
```

## Run everything (broker + aggregator + dashboard + simulator)
```bash
npm run dev
```

## Open the dashboard
Visit [http://localhost:5173](http://localhost:5173) in your browser.

## M5StickC Hardware Setup

### 1. Arduino Configuration
Upload the provided Arduino sketch to your M5StickC with these settings:
- **Board**: M5StickC
- **Device ID**: `mug-001`
- **WiFi**: Connect to your network
- **MQTT Broker**: `172.16.11.232:1883` (your laptop's IP)

### 2. Expected Behavior
- **BLUE** (Best signal): Scanning for "COMMUNAL_ZONE" BLE beacon
- **GREEN** (Good signal): Stop scanning, start 60s timer
- **YELLOW** (Warning): After 60s in GREEN state
- **RED** (Timeout): After 30s in YELLOW state
- **Button A**: Re-arm scanning (back to BLUE)

### 3. Phone Setup
- Install a BLE beacon app
- Set beacon name to "COMMUNAL_ZONE"
- Start broadcasting

## API Endpoints
- **Dashboard**: http://localhost:5173
- **Health Check**: http://localhost:4000/health
- **Live Stats**: http://localhost:4000/stats

## Troubleshooting
- **Ports already in use**: Stop other services that might be listening on 1883, 9001, 4000, or 5173.
- **Firewall issues**: Ensure local firewall rules allow localhost traffic on the above ports.
- **WebSocket connection blocked**: Verify Mosquitto started with WebSocket support (`mosquitto -v -c infra/mosquitto/mosquitto.conf`).
- **M5StickC won't connect**: Check WiFi credentials and ensure laptop IP is `172.16.11.232`
- **Dashboard shows no data**: Hard refresh browser (Cmd+Shift+R) and check browser console
- **BLE scanning issues**: Ensure phone is broadcasting "COMMUNAL_ZONE" beacon

## Data Contracts

### Mug → Broker
```json
{
  "device_id": "mug-042",
  "state": "blue | green | yellow | red",
  "rssi": -60,
  "ts": 1733822400
}
```

### Offline LWT (retained)
```json
{"status":"offline"}
```

### Aggregator → Broker (retained)
```json
{
  "state": "blue | green | yellow | red",
  "counts": {"blue":0,"green":5,"yellow":1,"red":0,"online":6}
}
```

### Aggregator /stats
```json
{
  "counts": {"blue":0,"green":5,"yellow":1,"red":0},
  "online": 6,
  "devices": [
    {"device_id":"mug-042","state":"green","ageSec":2}
  ]
}
```
