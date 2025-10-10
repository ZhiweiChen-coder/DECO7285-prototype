# Dashboard

React dashboard that visualises the communal mug aura.

## Scripts
- `npm run dev` – start Vite in development mode (http://localhost:5173)
- `npm run build` – build for production
- `npm run preview` – preview the production build

## Environment
Create an `.env` file to override defaults.

```
VITE_MQTT_WS_URL=ws://localhost:9001
VITE_TTL_SECONDS=10
```

`VITE_MQTT_WS_URL` controls the MQTT over WebSocket endpoint.

Press `D` during the demo to toggle the device grid overlay.
