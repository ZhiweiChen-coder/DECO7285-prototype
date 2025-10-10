// Use browser bundle to avoid Node polyfills
import mqtt from 'mqtt/dist/mqtt.min.js';

// Prefer 127.0.0.1 to avoid loopback name/DNS or proxy quirks in some browsers
const DEFAULT_URL = 'ws://127.0.0.1:9001';

const resolveUrl = () => {
  return (
    import.meta.env.VITE_MQTT_WS_URL ||
    process.env.MQTT_WS_URL ||
    DEFAULT_URL
  );
};

export const createDashboardClient = ({ onStatus } = {}) => {
  const client = mqtt.connect(resolveUrl(), {
    reconnectPeriod: 2000,
    connectTimeout: 5000,
    clean: true,
    keepalive: 60,
    protocolVersion: 4, // MQTT v3.1.1
    resubscribe: true,
    // Force root path for Mosquitto websockets (mqtt.js defaults to "/mqtt")
    path: '/',
  });

  const notify = (connected) => {
    if (typeof onStatus === 'function') {
      onStatus(connected);
    }
  };

  client.on('connect', () => notify(true));
  client.on('reconnect', () => notify(false));
  client.on('close', () => notify(false));
  client.on('offline', () => notify(false));
  client.on('error', (err) => {
    console.error('MQTT error', err?.message || err);
    notify(false);
  });

  const subscribeJson = (topic, handler) => {
    const listener = (incomingTopic, payload) => {
      if (incomingTopic !== topic) return;
      try {
        const data = JSON.parse(payload.toString());
        handler(data);
      } catch (err) {
        console.warn('Failed to parse message for', topic, err);
      }
    };
    client.subscribe(topic, (err) => {
      if (err) {
        console.error('Failed to subscribe to', topic, err);
      }
    });
    client.on('message', listener);
    return () => {
      try {
        if (client.connected) {
          client.unsubscribe(topic, () => {});
        }
      } catch {}
      // Use removeListener to detach in browser build
      if (typeof client.removeListener === 'function') {
        client.removeListener('message', listener);
      }
    };
  };

  return {
    subscribeMajority: (handler) => subscribeJson('dashboard/majority', handler),
    subscribeSnapshot: (handler) => subscribeJson('dashboard/snapshot', handler),
    disconnect: () => client.end(true),
  };
};
