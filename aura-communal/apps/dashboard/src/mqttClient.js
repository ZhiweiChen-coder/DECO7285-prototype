import mqtt from 'mqtt';

const DEFAULT_URL = 'ws://localhost:9001';

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
  client.on('error', () => notify(false));

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
      client.unsubscribe(topic, () => {});
      client.off('message', listener);
    };
  };

  return {
    subscribeMajority: (handler) => subscribeJson('dashboard/majority', handler),
    subscribeSnapshot: (handler) => subscribeJson('dashboard/snapshot', handler),
    disconnect: () => client.end(true),
  };
};
