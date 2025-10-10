# Simulator

Publishes synthetic mug telemetry to the MQTT broker. Useful when the physical ESP32 mugs are unavailable.

## Usage
```
npm run dev --workspace tools/simulator -- --major=green
```

### Options
- `--major=<colour>`: bias the colour distribution towards `blue`, `green`, `yellow`, or `red`.
- `--offline=<device_id>`: publish a retained offline message for the given device.

The simulator honours `MQTT_HOST` and `MQTT_PORT` environment variables (defaults to `localhost:1883`).
