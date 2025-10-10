# Mosquitto Broker

This folder holds the Mosquitto configuration used for the Aura Communal demo.

## Run (macOS with Homebrew)
```bash
brew install mosquitto
mosquitto -c ./infra/mosquitto/mosquitto.conf -v
```

## Run (Linux)
```bash
sudo apt install mosquitto
mosquitto -c ./infra/mosquitto/mosquitto.conf -v
```

The configuration enables both the classic MQTT listener on port 1883 and a WebSocket listener on port 9001 for the dashboard.
