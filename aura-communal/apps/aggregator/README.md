# Aggregator

The aggregator subscribes to mug state updates, calculates the majority colour, and exposes health and stats endpoints.

## Environment
Copy `.env.example` to `.env` to override defaults.

- `MQTT_HOST` (default `localhost`)
- `MQTT_PORT` (default `1883`)
- `TTL_SECONDS` (default `10`)
- `HTTP_PORT` (default `4000`)

## Scripts
- `npm run dev` – start with autoreload via nodemon
- `npm start` – run once with Node.js
