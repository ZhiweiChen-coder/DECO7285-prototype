import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

const STATES = ['blue', 'green', 'yellow', 'red'];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i += 1) {
    const part = args[i];
    if (part.startsWith('--major=')) {
      result.major = part.split('=')[1];
    } else if (part === '--major' && args[i + 1]) {
      result.major = args[i + 1];
      i += 1;
    } else if (part.startsWith('--offline=')) {
      result.offline = part.split('=')[1];
    } else if (part === '--offline' && args[i + 1]) {
      result.offline = args[i + 1];
      i += 1;
    }
  }
  return result;
};

const { major, offline } = parseArgs();

const biasColour = STATES.includes(major) ? major : null;
if (major && !biasColour) {
  console.warn('Ignoring unsupported major colour:', major);
}

const MQTT_HOST = process.env.MQTT_HOST || 'localhost';
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  clientId: `simulator-${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 2000,
});

const mugs = Array.from({ length: 8 }, (_, i) => `mug-${String(i + 1).padStart(3, '0')}`);
const activeMugs = mugs.filter((id) => id !== offline);

const pickState = () => {
  const weights = { blue: 1, green: 1, yellow: 1, red: 1 };
  if (biasColour) {
    weights[biasColour] = 4;
  }
  const total = Object.values(weights).reduce((acc, val) => acc + val, 0);
  const target = Math.random() * total;
  let acc = 0;
  for (const colour of STATES) {
    acc += weights[colour];
    if (target <= acc) {
      return colour;
    }
  }
  return STATES[0];
};

const timers = new Map();

const scheduleNext = (deviceId) => {
  const delay = 1000 + Math.random() * 1000;
  const timer = setTimeout(() => {
    const payload = {
      device_id: deviceId,
      state: pickState(),
      rssi: -50 - Math.floor(Math.random() * 25),
      ts: Math.floor(Date.now() / 1000),
    };
    client.publish(
      `mugs/${deviceId}/state`,
      JSON.stringify(payload),
      { retain: true },
      (err) => {
        if (err) {
          console.error('Failed to publish state for', deviceId, err);
        }
      },
    );
    scheduleNext(deviceId);
  }, delay);
  timers.set(deviceId, timer);
};

client.on('connect', () => {
  console.log(`Simulator connected to mqtt://${MQTT_HOST}:${MQTT_PORT}`);
  for (const deviceId of activeMugs) {
    scheduleNext(deviceId);
  }
  if (offline) {
    client.publish(
      `mugs/${offline}/state`,
      JSON.stringify({ status: 'offline' }),
      { retain: true },
    );
    console.log(`Marked ${offline} as offline.`);
  }
  if (biasColour) {
    console.log(`Biasing majority colour towards ${biasColour}.`);
  }
});

client.on('reconnect', () => console.log('Simulator reconnecting...'));
client.on('error', (err) => console.error('Simulator error', err));
client.on('close', () => console.log('Simulator connection closed'));

const shutdown = () => {
  console.log('Simulator shutting down');
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  client.end(true, () => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
