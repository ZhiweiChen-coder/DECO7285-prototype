# Aura Communal Demo

A laptop-friendly monorepo for showing the communal mug aura experience at tradeshows. It bundles an MQTT broker, Node.js aggregator, React dashboard, and a simulator for ESP32 mugs.

## Prerequisites
- Node.js 20 or newer with npm 10+
- Mosquitto installed locally (e.g. `brew install mosquitto` on macOS or `sudo apt install mosquitto` on Debian/Ubuntu)

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

## Troubleshooting
- **Ports already in use**: Stop other services that might be listening on 1883, 9001, 4000, or 5173.
- **Firewall issues**: Ensure local firewall rules allow localhost traffic on the above ports.
- **WebSocket connection blocked**: Verify Mosquitto started with WebSocket support (`mosquitto -v -c infra/mosquitto/mosquitto.conf`).

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
