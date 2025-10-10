import mqtt from 'mqtt';
import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

const MQTT_HOST = process.env.MQTT_HOST || 'localhost';
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const TTL_SECONDS = Number(process.env.TTL_SECONDS || 10);
const HTTP_PORT = Number(process.env.HTTP_PORT || 4000);

const STATES = ['blue', 'green', 'yellow', 'red'];

const log = (...args) => console.log('[aggregator]', ...args);

const client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  clientId: `aura-aggregator-${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 2000,
});

const devices = new Map();
let lastMajorityPayload = '';
let lastSnapshotPayload = '';
let dirtySnapshot = false;

client.on('connect', () => {
  log(`connected to mqtt://${MQTT_HOST}:${MQTT_PORT}`);
  client.subscribe('mugs/+/state', (err) => {
    if (err) {
      log('subscription error', err.message);
    } else {
      log('subscribed to mugs/+/state');
    }
  });
});

client.on('reconnect', () => log('reconnecting...'));
client.on('close', () => log('connection closed'));
client.on('error', (err) => log('error', err.message));

client.on('message', (topic, payload) => {
  const [, deviceId] = topic.split('/');
  if (!deviceId) {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(payload.toString());
  } catch (err) {
    log('ignoring malformed payload for', deviceId);
    return;
  }

  if (parsed?.status === 'offline') {
    if (devices.delete(deviceId)) {
      dirtySnapshot = true;
      log(`device ${deviceId} offline`);
    }
    return;
  }

  const state = parsed?.state;
  const ts = Number(parsed?.ts || Math.floor(Date.now() / 1000));
  if (!STATES.includes(state) || Number.isNaN(ts)) {
    log(`ignoring state for ${deviceId}`);
    return;
  }

  devices.set(deviceId, { state, ts });
  dirtySnapshot = true;
});

const computeCounts = () => {
  const counts = { blue: 0, green: 0, yellow: 0, red: 0 };
  for (const { state } of devices.values()) {
    if (counts[state] !== undefined) {
      counts[state] += 1;
    }
  }
  return counts;
};

const publishMajority = () => {
  const counts = computeCounts();
  const online = Object.values(counts).reduce((acc, val) => acc + val, 0);

  let majority = STATES[0];
  let maxCount = -1;
  for (const colour of STATES) {
    const count = counts[colour];
    if (count > maxCount) {
      majority = colour;
      maxCount = count;
    }
  }

  const majorityPayload = JSON.stringify({
    state: majority,
    counts: { ...counts, online },
  });

  if (majorityPayload !== lastMajorityPayload) {
    client.publish('dashboard/majority', majorityPayload, { retain: true });
    lastMajorityPayload = majorityPayload;
    log(`majority=${majority} online=${online}`);
  }
};

const publishSnapshot = () => {
  if (!dirtySnapshot) {
    return;
  }
  const snapshot = {};
  for (const [deviceId, data] of devices) {
    snapshot[deviceId] = data;
  }
  const snapshotPayload = JSON.stringify(snapshot);
  if (snapshotPayload !== lastSnapshotPayload) {
    client.publish('dashboard/snapshot', snapshotPayload, { retain: false });
    lastSnapshotPayload = snapshotPayload;
  }
  dirtySnapshot = false;
};

const prune = () => {
  const nowSec = Math.floor(Date.now() / 1000);
  let removed = false;
  for (const [deviceId, data] of devices) {
    if (nowSec - data.ts > TTL_SECONDS) {
      devices.delete(deviceId);
      removed = true;
    }
  }
  if (removed) {
    dirtySnapshot = true;
  }
};

const loop = () => {
  prune();
  publishMajority();
  publishSnapshot();
};

loop();
const interval = setInterval(loop, 1000);

const fastify = Fastify({ logger: false });

fastify.get('/health', async () => ({ status: 'ok' }));

fastify.get('/stats', async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const counts = { blue: 0, green: 0, yellow: 0, red: 0 };
  const devicesList = [];

  for (const [deviceId, data] of devices) {
    const ageSec = Math.max(0, nowSec - data.ts);
    if (ageSec <= TTL_SECONDS && counts[data.state] !== undefined) {
      counts[data.state] += 1;
    }
    devicesList.push({ device_id: deviceId, state: data.state, ageSec });
  }

  const online = counts.blue + counts.green + counts.yellow + counts.red;

  return {
    counts,
    online,
    devices: devicesList,
  };
});

fastify
  .listen({ port: HTTP_PORT, host: '0.0.0.0' })
  .then(() => {
    log(`http server listening on http://localhost:${HTTP_PORT}`);
  })
  .catch((err) => {
    log('failed to start http server', err);
    process.exit(1);
  });

const shutdown = () => {
  log('shutting down');
  clearInterval(interval);
  client.end(true, () => {
    fastify.close().finally(() => process.exit(0));
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
