# Breakly Demo

A laptop-friendly monorepo for demonstrating the communal mug experience at tradeshows. It bundles an MQTT broker, a Node.js aggregator, and a React dashboard, and supports both an ESP32 simulator and real M5StickC hardware.

## System Architecture
```
🔧 Device (e.g., M5StickC: "mug-001")
    ↓ MQTT publish
💻 Laptop Backend (172.16.11.232:1883)
    ↓ WebSocket
🌐 React Dashboard (localhost:5173)
```

## Prerequisites
- Node.js 20 or newer with npm 10+
- Mosquitto installed locally (e.g. `brew install mosquitto` on macOS or `sudo apt install mosquitto` on Debian/Ubuntu)
- M5StickC with Arduino IDE (for hardware setup)


## Install
```bash
npm install
```

## Run system (broker + aggregator + dashboard)
```bash
npm run dev
```

## Run with simulator (for testing without hardware)
```bash
npm run dev:with-sim
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
- 
- **M5StickC shows 0 cups online**: The aggregator automatically corrects M5StickC timestamps - wait a few seconds for the device to be recognized
- **Device appears/disappears**: M5StickC devices are pruned after 10 seconds of inactivity - ensure continuous BLE scanning

## Data Contracts

### MQTT Topics
- **Device State**: `mugs/<device_id>/state` (retained)
- **Majority State**: `dashboard/majority` (retained)
- **Device Shadow**: `dashboard/mugs/<device_id>` (retained, optional)

### Mug → Broker (mugs/<id>/state, retained)
```json
{
  "device_id": "mug-042",
  "state": "blue|green|yellow|red|offline",
  "rssi": -60,
  "ts": 1733822400
}
```
*Note: `ts` = Unix epoch seconds*

### LWT (Last Will and Testament)
```json
{
  "device_id": "mug-001",
  "state": "offline",
  "ts": 1733822400
}
```
*Published to same topic as device state when connection drops*

### Backend → Broker (dashboard/majority, retained)
```json
{
  "state": "blue|green|yellow|red",
  "counts": {"blue":0,"green":5,"yellow":1,"red":0,"online":6},
  "ts": 1733822400
}
```

### Backend HTTP /stats
```json
{
  "counts": {"blue":0,"green":5,"yellow":1,"red":0},
  "online": 6,
  "devices": [
    {"device_id":"mug-042","state":"green","ageSec":2,"lastRssi":-62}
  ],
  "ts": 1733822400
}
```

## Quick Demo Checklist

### ✅ Pre-Demo Setup
- [ ] Laptop IP in Arduino sketch matches current LAN IP (`172.16.11.232`)
- [ ] Mosquitto running; port 1883 open (firewall)
- [ ] Backend logs show "MQTT connected", "subscribed mugs/+/state"
- [ ] Retained messages enabled on device state & majority topics
- [ ] Frontend connected to backend WebSocket (no CORS errors in console)
- [ ] LWT includes device_id and publishes to `mugs/<id>/state`
- [ ] Dashboard shows "1 cup online" when M5StickC is connected

### ✅ Hardware Setup
- [ ] M5StickC programmed with Arduino sketch
- [ ] WiFi credentials updated in sketch

- 
- [ ] Dashboard shows live updates at http://localhost:5173

### 🔧 Troubleshooting Commands
```bash
# Check system health
curl http://localhost:4000/health

# View live stats
curl http://localhost:4000/stats

# Test MQTT connection
mosquitto_pub -h 172.16.11.232 -t "mugs/test/state" -m '{"device_id":"test","state":"blue","ts":1733822400}'

# View Mosquitto logs
mosquitto -v -c infra/mosquitto/mosquitto.conf
# Free common dev ports (macOS/Linux)
lsof -ti:1883,9001,4000,5173 2>/dev/null | xargs -r kill -9 || true

# Kill ALL listening TCP processes (macOS/Linux, dangerous)
sudo lsof -tiTCP -sTCP:LISTEN | xargs -r kill -9
```

#### Windows: free common dev ports
```powershell
$ports = 1883,9001,4000,5173
Get-NetTCPConnection -State Listen | Where-Object { $ports -contains $_.LocalPort } |
  Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```
