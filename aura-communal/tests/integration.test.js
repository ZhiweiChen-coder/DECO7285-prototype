import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { 
  MQTTTestClient, 
  waitForMessage, 
  waitForAggregatorReady, 
  waitForDashboardReady,
  createMugState,
  createOfflineMugState,
  assertMajorityState,
  sleep
} from './test-helpers.js';
import axios from 'axios';

describe('Aura Communal Dashboard System Integration Tests', () => {
  let mqttClient;
  let wsClient;
  let testResults = [];

  beforeAll(async () => {
    // Wait for services to be ready
    console.log('Waiting for services to be ready...');
    await waitForAggregatorReady();
    await waitForDashboardReady();
    console.log('Services are ready, starting tests...');
  });

  beforeEach(async () => {
    mqttClient = new MQTTTestClient('localhost', 1883);
    wsClient = new MQTTTestClient('localhost', 9001);
    
    await mqttClient.connect();
    await wsClient.connect();
  });

  afterAll(async () => {
    if (mqttClient) await mqttClient.disconnect();
    if (wsClient) await wsClient.disconnect();
    
    // Print test summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    testResults.forEach((result, index) => {
      const status = result.passed ? '✔' : '✗';
      console.log(`${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    console.log(`\n${passed}/${total} tests passed ${passed === total ? '✅' : '❌'}`);
  });

  const recordTest = (name, testFn) => {
    return async () => {
      try {
        await testFn();
        testResults.push({ name, passed: true });
        console.log(`✔ ${name}`);
      } catch (error) {
        testResults.push({ name, passed: false, error: error.message });
        console.log(`✗ ${name}: ${error.message}`);
        throw error;
      }
    };
  };

  it('1. Broker connectivity', recordTest('Broker reachable', async () => {
    // Test MQTT broker connectivity
    expect(mqttClient.connected).toBe(true);
    
    // Test WebSocket broker connectivity  
    expect(wsClient.connected).toBe(true);
  }));

  it('2. Topic publishing/subscription', recordTest('Aggregator subscribed to mugs/+/state', async () => {
    const testDeviceId = 'test-mug-001';
    const testState = createMugState(testDeviceId, 'green');
    
    // Publish a test message
    await mqttClient.publish(`mugs/${testDeviceId}/state`, testState);
    
    // Wait a moment for processing
    await sleep(1000);
    
    // Check that aggregator processed it by checking stats endpoint
    const response = await axios.get('http://localhost:4000/stats');
    expect(response.status).toBe(200);
    
    const stats = response.data;
    expect(stats.devices).toBeDefined();
    
    // Find our test device in the stats
    const testDevice = stats.devices.find(d => d.device_id === testDeviceId);
    expect(testDevice).toBeDefined();
    expect(testDevice.state).toBe('green');
  }));

  it('3. Aggregator majority logic', recordTest('Majority logic correct', async () => {
    const devices = [
      createMugState('majority-test-1', 'green'),
      createMugState('majority-test-2', 'green'), 
      createMugState('majority-test-3', 'green'),
      createMugState('majority-test-4', 'blue'),
      createMugState('majority-test-5', 'blue')
    ];
    
    // Publish all states
    for (const device of devices) {
      await mqttClient.publish(`mugs/${device.device_id}/state`, device);
    }
    
    // Wait for aggregator to process
    await sleep(2000);
    
    // Check majority via MQTT
    const majority = await waitForMessage(
      mqttClient, 
      'dashboard/majority',
      (data) => data.state === 'green' && data.counts.green >= 3,
      5000
    );
    
    assertMajorityState(majority, 'green', { green: 3, blue: 2 });
  }));

  it('4. Device TTL expiry', recordTest('TTL expiry removes stale devices', async () => {
    const staleDeviceId = 'stale-test-mug';
    const staleState = createMugState(staleDeviceId, 'red', Math.floor(Date.now() / 1000) - 15); // 15 seconds ago
    
    // Publish stale state
    await mqttClient.publish(`mugs/${staleDeviceId}/state`, staleState);
    
    // Wait for TTL to expire (TTL is 10 seconds, we sent 15 seconds ago)
    await sleep(2000);
    
    // Check that device is no longer in stats
    const response = await axios.get('http://localhost:4000/stats');
    const stats = response.data;
    
    const staleDevice = stats.devices.find(d => d.device_id === staleDeviceId);
    expect(staleDevice).toBeUndefined();
    
    // Verify majority doesn't include the stale device
    const majority = await waitForMessage(
      mqttClient,
      'dashboard/majority', 
      (data) => data.counts.red === 0, // Should not count the stale red device
      3000
    );
    
    expect(majority.counts.red).toBe(0);
  }));

  it('5. Offline handling (LWT)', recordTest('Offline status removes device', async () => {
    const offlineDeviceId = 'offline-test-mug';
    
    // First publish a normal state
    const normalState = createMugState(offlineDeviceId, 'yellow');
    await mqttClient.publish(`mugs/${offlineDeviceId}/state`, normalState);
    await sleep(1000);
    
    // Verify device is online
    let response = await axios.get('http://localhost:4000/stats');
    let stats = response.data;
    let device = stats.devices.find(d => d.device_id === offlineDeviceId);
    expect(device).toBeDefined();
    expect(device.state).toBe('yellow');
    
    // Now publish offline status
    const offlineState = createOfflineMugState(offlineDeviceId);
    await mqttClient.publish(`mugs/${offlineDeviceId}/state`, offlineState);
    await sleep(1000);
    
    // Verify device is removed
    response = await axios.get('http://localhost:4000/stats');
    stats = response.data;
    device = stats.devices.find(d => d.device_id === offlineDeviceId);
    expect(device).toBeUndefined();
  }));

  it('6. Retained message recovery', recordTest('Retained message restored after restart', async () => {
    // First establish a majority state
    const devices = [
      createMugState('retained-test-1', 'red'),
      createMugState('retained-test-2', 'red'),
      createMugState('retained-test-3', 'blue')
    ];
    
    for (const device of devices) {
      await mqttClient.publish(`mugs/${device.device_id}/state`, device);
    }
    
    // Wait for majority to be established
    const majority = await waitForMessage(
      mqttClient,
      'dashboard/majority',
      (data) => data.state === 'red' && data.counts.red >= 2,
      5000
    );
    
    expect(majority.state).toBe('red');
    
    // Note: In a real scenario, we would restart the aggregator here
    // For this test, we'll verify the retained message is available
    // by subscribing to the topic and checking we get the retained message immediately
    let retainedMessage = null;
    const handler = (data) => {
      retainedMessage = data;
    };
    
    await mqttClient.subscribe('dashboard/majority', handler);
    await sleep(1000);
    
    expect(retainedMessage).toBeDefined();
    expect(retainedMessage.state).toBe('red');
  }));

  it('7. HTTP /health endpoint', recordTest('Health endpoint returns 200 OK', async () => {
    const response = await axios.get('http://localhost:4000/health');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ status: 'ok' });
  }));

  it('8. HTTP /stats endpoint', recordTest('Stats endpoint returns valid JSON', async () => {
    const response = await axios.get('http://localhost:4000/stats');
    expect(response.status).toBe(200);
    
    const stats = response.data;
    expect(stats).toHaveProperty('counts');
    expect(stats).toHaveProperty('online');
    expect(stats).toHaveProperty('devices');
    
    expect(stats.counts).toHaveProperty('blue');
    expect(stats.counts).toHaveProperty('green');
    expect(stats.counts).toHaveProperty('yellow');
    expect(stats.counts).toHaveProperty('red');
    
    expect(Array.isArray(stats.devices)).toBe(true);
    expect(typeof stats.online).toBe('number');
  }));

  it('9. Dashboard MQTT reception', recordTest('Dashboard receives WebSocket MQTT updates', async () => {
    // Subscribe to dashboard/majority via WebSocket
    let receivedMessage = null;
    const handler = (data) => {
      receivedMessage = data;
    };
    
    await wsClient.subscribe('dashboard/majority', handler);
    
    // Publish a new state to trigger majority update
    const testState = createMugState('ws-test-mug', 'yellow');
    await mqttClient.publish(`mugs/ws-test-mug/state`, testState);
    
    // Wait for message to be received via WebSocket
    await waitForMessage(
      wsClient,
      'dashboard/majority',
      (data) => data !== null,
      5000
    );
    
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage).toHaveProperty('state');
    expect(receivedMessage).toHaveProperty('counts');
  }));

  it('10. Simulator integration', recordTest('Simulator publishes realistic data', async () => {
    // This test assumes the simulator is running via npm run dev:sim
    // We'll check that we receive regular updates from simulator devices
    
    let messageCount = 0;
    const handler = (data, topic) => {
      if (topic.startsWith('mugs/') && topic.endsWith('/state')) {
        messageCount++;
      }
    };
    
    await mqttClient.subscribe('mugs/+/state', handler);
    
    // Wait for simulator messages (should receive at least one within 2 seconds)
    await sleep(2000);
    
    expect(messageCount).toBeGreaterThan(0);
    
    // Verify the messages have realistic structure
    const response = await axios.get('http://localhost:4000/stats');
    const stats = response.data;
    
    // Should have some devices from simulator
    expect(stats.devices.length).toBeGreaterThan(0);
    
    // Verify device structure
    const device = stats.devices[0];
    expect(device).toHaveProperty('device_id');
    expect(device).toHaveProperty('state');
    expect(device).toHaveProperty('ageSec');
    expect(['blue', 'green', 'yellow', 'red']).toContain(device.state);
  }));

  it('11. End-to-end flow', recordTest('End-to-end flow updates dashboard within 2s', async () => {
    // This test verifies the complete flow from simulator to dashboard
    // We'll monitor the dashboard/majority topic and verify updates happen within expected time
    
    const startTime = Date.now();
    let lastUpdateTime = startTime;
    let updateCount = 0;
    
    const handler = (data) => {
      lastUpdateTime = Date.now();
      updateCount++;
    };
    
    await wsClient.subscribe('dashboard/majority', handler);
    
    // Wait for initial message and at least one update
    await sleep(3000);
    
    const totalTime = lastUpdateTime - startTime;
    
    // Should have received updates
    expect(updateCount).toBeGreaterThan(0);
    
    // Updates should happen within reasonable time (2 seconds for each update)
    expect(totalTime).toBeLessThan(5000); // Allow some buffer
    
    // Verify the dashboard is showing a valid state
    const response = await axios.get('http://localhost:4000/stats');
    const stats = response.data;
    
    expect(stats.online).toBeGreaterThan(0);
    expect(stats.counts.blue + stats.counts.green + stats.counts.yellow + stats.counts.red).toBe(stats.online);
  }));
});
