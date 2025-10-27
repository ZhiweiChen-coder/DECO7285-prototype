# Aura Communal Dashboard Test Suite

This directory contains comprehensive automated tests for the Aura Communal Dashboard system, covering all components and their interactions.

## System Components Tested

- **Mosquitto MQTT Broker** (ports 1883, 9001)
- **Aggregator Service** (Node.js, port 4000)
- **Dashboard** (React + Vite, port 5173)
- **Simulator** (Node.js, publishes to MQTT)

## Test Structure

### Integration Tests (`integration.test.js`)
Comprehensive end-to-end tests covering all 11 test objectives:

1. **Broker connectivity** - Verifies MQTT and WebSocket connections
2. **Topic publishing/subscription** - Tests message flow from mugs to aggregator
3. **Aggregator majority logic** - Validates majority calculation (3 green + 2 blue = green majority)
4. **Device TTL expiry** - Ensures stale devices are removed after 10 seconds
5. **Offline handling (LWT)** - Tests offline status message handling
6. **Retained message recovery** - Verifies retained messages on aggregator restart
7. **HTTP /health endpoint** - Tests health check endpoint
8. **HTTP /stats endpoint** - Validates stats API response format
9. **Dashboard MQTT reception** - Tests WebSocket MQTT message reception
10. **Simulator integration** - Verifies realistic simulator data flow
11. **End-to-end flow** - Complete system integration test


## Running Tests

### Prerequisites

1. **Start the system** (from project root):
   ```bash
   npm run dev
   ```
   This starts all components: broker, aggregator, dashboard, and simulator.

2. **Install test dependencies**:
   ```bash
   cd tests
   npm install
   ```

### Test Commands

```bash
# Run all integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Test Configuration

### Environment Variables

Tests use default localhost connections:
- MQTT Broker: `localhost:1883`
- WebSocket Broker: `localhost:9001` 
- Aggregator HTTP: `localhost:4000`
- Dashboard: `localhost:5173`

### Timeouts

- Service readiness: 10 seconds
- Message waiting: 5-10 seconds depending on test
- UI interactions: 30 seconds (Playwright default)

## Test Scenarios


### Integration Test Scenarios

#### Basic Majority Calculation
```javascript
// Publish 3 green mugs, 2 blue mugs
// Expected: majority.state === "green"
```

#### TTL Expiry Test
```javascript
// Publish mug with timestamp 15 seconds ago
// Expected: device removed from stats after TTL (10s)
```

#### Offline LWT Test
```javascript
// Publish {"status":"offline"} to mug topic
// Expected: device removed from aggregator within 1s
```

#### Retained Message Test
```javascript
// Establish majority state, then verify retained message
// Expected: dashboard shows previous state immediately
```

## Expected Output

### Successful Test Run
```
✔ Broker reachable
✔ Aggregator subscribed to mugs/+/state  
✔ Majority logic correct
✔ TTL expiry removes stale devices
✔ Offline status removes device
✔ Retained message restored after restart
✔ Health endpoint returns 200 OK
✔ Stats endpoint returns valid JSON
✔ Dashboard receives WebSocket MQTT updates
✔ Simulator publishes realistic data
✔ End-to-end flow updates dashboard within 2s

All 11 functional tests passed ✅
```

### Test Failure Example
```
✗ Aggregator not publishing to dashboard/majority
   Error: Timeout waiting for message on dashboard/majority

3/11 tests passed ❌
```

## Troubleshooting

### Common Issues

1. **Services not ready**: Ensure `npm run dev` is running and all services are started
2. **Port conflicts**: Check that ports 1883, 4000, 5173, 9001 are available
3. **MQTT connection failures**: Verify Mosquitto broker is running with correct config
4. **UI test failures**: Ensure dashboard is accessible at http://localhost:5173

### Debug Mode

Run tests with verbose output:
```bash
npm run test:watch
```

Check service health:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/stats
```

## Test Architecture

### Helper Functions (`test-helpers.js`)
- `MQTTTestClient`: MQTT client wrapper for tests
- `waitForMessage()`: Wait for specific MQTT messages
- `waitForAggregatorReady()`: Wait for aggregator service
- `waitForDashboardReady()`: Wait for dashboard service
- `createMugState()`: Generate test mug state payloads
- `assertMajorityState()`: Validate majority calculations

### Test Isolation
Each test runs independently with:
- Fresh MQTT client connections
- Cleanup after each test
- Unique device IDs to avoid conflicts
- Proper timeout handling

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names matching the requirements
3. Include proper cleanup in `afterAll` hooks
4. Add timeout handling for async operations
5. Update this README with new test scenarios
