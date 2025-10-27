#include <M5StickC.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ==== CONFIG ====
#define WIFI_SSID   "201 Wifi-2G"
#define WIFI_PASS   "xxx"
#define MQTT_HOST   "172.16.11.232"   // your backend IP (broker or local API host)
#define MQTT_PORT   1883
#define DEVICE_ID   "mug-001"

// MQTT Topics
const char* TOPIC_STATE = "mugs/mug-001/state";
const char* TOPIC_CMD   = "mugs/mug-001/cmd";

// Timer presets (seconds)
const uint16_t GR_SEC = 60;   // Green duration (60s as per README)
const uint16_t Y_SEC  = 30;   // Yellow duration (30s as per README)

enum class State { Blue, Green, Yellow, Red };
State state = State::Green;  // Start with Green

unsigned long stateStartMs = 0;
unsigned long lastPubMs = 0;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

uint16_t COL_GREEN, COL_YELLOW, COL_RED, COL_BLUE;

// ---------- Helpers ----------
inline unsigned long nowMs() { return millis(); }
inline unsigned long secToMs(uint16_t s) { return (unsigned long)s * 1000UL; }

const char* stateStr(State s) {
  switch (s) {
    case State::Blue:   return "blue";    // lowercase for system compatibility
    case State::Green:  return "green";
    case State::Yellow: return "yellow";
    case State::Red:    return "red";
  }
  return "unknown";
}

// ---------- UI ----------
void drawScreen() {
  uint16_t col =
    (state==State::Blue)   ? COL_BLUE :
    (state==State::Green)  ? COL_GREEN :
    (state==State::Yellow) ? COL_YELLOW : COL_RED;

  M5.Lcd.fillScreen(col);
  M5.Lcd.setTextColor(TFT_WHITE, col);
  M5.Lcd.setTextDatum(MC_DATUM);
  M5.Lcd.setTextFont(4);
  
  // Display uppercase for UI
  const char* displayStr = 
    (state==State::Blue)   ? "BLUE" :
    (state==State::Green)  ? "GREEN" :
    (state==State::Yellow) ? "YELLOW" : "RED";
    
  M5.Lcd.drawString(displayStr, 80, 40);
}

// ---------- State ----------
void enter(State s) {
  state = s;
  stateStartMs = nowMs();
  drawScreen();
}

// ---------- Wi-Fi + MQTT ----------
void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = nowMs();
  while (WiFi.status() != WL_CONNECTED && nowMs() - start < 10000) {
    delay(200);
  }
}

void publishState() {
  if (!mqtt.connected()) return;
  char payload[200];
  unsigned long ts = nowMs() / 1000;

  // 把 state 转成小写
  const char* s = stateStr(state);
  char lower[16];
  for (int i=0; s[i] && i < 15; ++i)
    lower[i] = tolower(s[i]);
  lower[strlen(s)] = '\0';

  // 符合系统格式
  snprintf(payload, sizeof(payload),
    "{\"device_id\":\"%s\",\"state\":\"%s\",\"ts\":%lu}",
    DEVICE_ID, lower, ts);

  mqtt.publish(TOPIC_STATE, payload, true);
  Serial.printf("Published: %s\n", payload);
}

void onMqttMessage(char* topic, byte* payload, unsigned int len) {
  // Simple command parsing
  String t = String(topic);
  String msg; msg.reserve(len);
  for (unsigned int i=0; i<len; ++i) msg += (char)payload[i];

  if (t == TOPIC_CMD) {
    if (msg.indexOf("pantry") >= 0) {
      enter(State::Blue);  // Go to pantry (Blue state)
      publishState();
    }
  }
}

void ensureMqtt() {
  if (mqtt.connected() || WiFi.status() != WL_CONNECTED) return;

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setCallback(onMqttMessage);

  char lwt[128];
  snprintf(lwt, sizeof(lwt), 
    "{\"device_id\":\"%s\",\"state\":\"offline\",\"ts\":%lu}", 
    DEVICE_ID, nowMs() / 1000);

  // Non-blocking connection
  if (mqtt.connect(DEVICE_ID, nullptr, nullptr, TOPIC_STATE, 0, true, lwt)) {
    mqtt.subscribe(TOPIC_CMD, 0);
    publishState();
  }
}

// ---------- Arduino setup ----------
void setup() {
  M5.begin();
  M5.Lcd.setRotation(1);
  M5.Axp.ScreenBreath(12);
  Serial.begin(115200);

  COL_GREEN  = M5.Lcd.color565( 34,139, 90);
  COL_YELLOW = M5.Lcd.color565(212,164, 26);
  COL_RED    = M5.Lcd.color565(200, 50, 47);
  COL_BLUE   = M5.Lcd.color565( 77,163,255);

  ensureWifi();
  ensureMqtt();
  enter(State::Green);  // Start in Green state
}

// ---------- Loop ----------
void loop() {
  M5.update();

  // Network maintenance
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  // Button A: Reset to Green state (restart timer)
  if (M5.BtnA.wasPressed()) {
    enter(State::Green);
    publishState();
  }

  // State transitions
  unsigned long elapsed = nowMs() - stateStartMs;
  unsigned long gMs = secToMs(GR_SEC);
  unsigned long yMs = secToMs(Y_SEC);

  switch (state) {
    case State::Green:
      if (elapsed >= gMs) enter(State::Yellow);
      break;
    case State::Yellow:
      if (elapsed >= yMs) enter(State::Red);
      break;
    case State::Red:
      // Stay red until Button A pressed
      break;
    case State::Blue:
      // Blue state doesn't participate in timing
      break;
  }

  // Publish state every 5 seconds
  if (nowMs() - lastPubMs > 5000) {
    publishState();
    lastPubMs = nowMs();
  }

  delay(20);
}
