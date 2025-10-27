import mqtt from 'mqtt';
import axios from 'axios';

/**
 * Helper class for MQTT operations in tests
 */
export class MQTTTestClient {
  constructor(host = 'localhost', port = 1883) {
    this.host = host;
    this.port = port;
    this.client = null;
    this.connected = false;
    this.messageHandlers = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(`mqtt://${this.host}:${this.port}`, {
        clientId: `test-client-${Math.random().toString(16).slice(2, 8)}`,
        connectTimeout: 5000,
        reconnectPeriod: 0, // Disable auto-reconnect for tests
        protocolVersion: 4, // Use MQTT v3.1.1 instead of v5
        clean: true,
      });

      this.client.on('connect', () => {
        this.connected = true;
        resolve();
      });

      this.client.on('error', (err) => {
        reject(err);
      });

      this.client.on('message', (topic, payload) => {
        const handlers = this.messageHandlers.get(topic) || [];
        handlers.forEach(handler => {
          try {
            const data = JSON.parse(payload.toString());
            handler(data, topic);
          } catch (err) {
            handler(payload.toString(), topic);
          }
        });
      });
    });
  }

  async disconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(false, () => {
          this.connected = false;
          resolve();
        });
      });
    }
  }

  async publish(topic, message, options = {}) {
    if (!this.connected) {
      throw new Error('Client not connected');
    }
    
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, options, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async subscribe(topic, handler) {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, (err) => {
        if (err) {
          reject(err);
        } else {
          if (!this.messageHandlers.has(topic)) {
            this.messageHandlers.set(topic, []);
          }
          this.messageHandlers.get(topic).push(handler);
          resolve();
        }
      });
    });
  }

  async unsubscribe(topic) {
    if (!this.connected) return;
    
    this.messageHandlers.delete(topic);
    return new Promise((resolve) => {
      this.client.unsubscribe(topic, () => resolve());
    });
  }
}

/**
 * Wait for a message matching a predicate on a topic
 */
export async function waitForMessage(client, topic, predicate, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message on ${topic}`));
    }, timeout);

    const handler = (data, receivedTopic) => {
      if (receivedTopic === topic && predicate(data)) {
        clearTimeout(timer);
        resolve(data);
      }
    };

    client.subscribe(topic, handler).catch(reject);
  });
}

/**
 * Wait for aggregator to be ready
 */
export async function waitForAggregatorReady(timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get('http://localhost:4000/health', { timeout: 1000 });
      if (response.status === 200 && response.data.status === 'ok') {
        return true;
      }
    } catch (err) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error('Aggregator not ready within timeout');
}

/**
 * Wait for dashboard to be ready
 */
export async function waitForDashboardReady(timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get('http://localhost:5173', { timeout: 1000 });
      if (response.status === 200) {
        return true;
      }
    } catch (err) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error('Dashboard not ready within timeout');
}

/**
 * Create a test mug state payload
 */
export function createMugState(deviceId, state, timestamp = null) {
  return {
    device_id: deviceId,
    state: state,
    ts: timestamp || Math.floor(Date.now() / 1000),
    rssi: -50 - Math.floor(Math.random() * 25)
  };
}

/**
 * Create an offline mug state payload
 */
export function createOfflineMugState(deviceId) {
  return {
    status: 'offline'
  };
}

/**
 * Assert majority state matches expected
 */
export function assertMajorityState(majority, expectedState, expectedCounts = null) {
  if (majority.state !== expectedState) {
    throw new Error(`Expected majority state '${expectedState}', got '${majority.state}'`);
  }
  
  if (expectedCounts) {
    for (const [color, expectedCount] of Object.entries(expectedCounts)) {
      const actualCount = majority.counts[color] || 0;
      if (actualCount !== expectedCount) {
        throw new Error(`Expected ${color} count ${expectedCount}, got ${actualCount}`);
      }
    }
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check WebSocket broker connectivity
 */
export async function checkWebSocketBroker() {
  const client = mqtt.connect('ws://localhost:9001', {
    clientId: `test-ws-client-${Math.random().toString(16).slice(2, 8)}`,
    connectTimeout: 5000,
    reconnectPeriod: 0,
    protocolVersion: 4,
    clean: true,
  });
  
  return new Promise((resolve, reject) => {
    client.on('connect', () => {
      client.end(false, () => resolve());
    });
    client.on('error', reject);
  });
}
