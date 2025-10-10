import { useEffect, useMemo, useState } from 'react';
import { createDashboardClient } from './mqttClient.js';

const COLOUR_MAP = {
  blue: '#4da3ff',
  green: '#5ad46b',
  yellow: '#ffd54a',
  red: '#ff6b6b',
};

const BASE_COUNTS = { blue: 0, green: 0, yellow: 0, red: 0, online: 0 };

const resolveTtl = () => {
  const fromEnv =
    Number(import.meta.env.VITE_TTL_SECONDS) || Number(process.env.TTL_SECONDS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 10;
};

const TTL_SECONDS = resolveTtl();

const formatState = (state) => (state ? state.toUpperCase() : 'UNKNOWN');

export default function App() {
  const [connected, setConnected] = useState(false);
  const [majority, setMajority] = useState({ state: 'blue', counts: BASE_COUNTS });
  const [devices, setDevices] = useState({});
  const [now, setNow] = useState(Date.now());
  const [showDevices, setShowDevices] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key?.toLowerCase() === 'd') {
        setShowDevices((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const client = createDashboardClient({
      onStatus: (isConnected) => setConnected(Boolean(isConnected)),
    });

    const unsubscribeMajority = client.subscribeMajority((data) => {
      setMajority({
        state: data?.state || 'blue',
        counts: { ...BASE_COUNTS, ...(data?.counts || {}) },
      });
    });

    const unsubscribeSnapshot = client.subscribeSnapshot((snapshot) => {
      setDevices(snapshot || {});
    });

    return () => {
      unsubscribeMajority?.();
      unsubscribeSnapshot?.();
      client.disconnect();
    };
  }, []);

  const auraColour = COLOUR_MAP[majority.state] || COLOUR_MAP.blue;
  const counts = majority.counts || BASE_COUNTS;

  const deviceCards = useMemo(() => {
    const entries = Object.entries(devices || {}).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return entries.map(([deviceId, data]) => {
      const ts = Number(data?.ts) || 0;
      const ageSec = Math.max(0, Math.floor(now / 1000) - ts);
      const state = data?.state || 'unknown';
      const stale = ageSec > TTL_SECONDS;
      return {
        deviceId,
        state,
        ageSec,
        stale,
      };
    });
  }, [devices, now]);

  return (
    <div className="app-shell">
      {!connected && <div className="ribbon">Reconnecting…</div>}
      <div
        className="aura"
        style={{
          background: `radial-gradient(circle at center, ${auraColour} 0%, rgba(11, 15, 23, 0) 65%)`,
        }}
      />
      <div className="content">
        <h1 className="title">{formatState(majority.state)}</h1>
        <p className="subtitle">
          online: {counts.online ?? 0} — B:{counts.blue ?? 0} G:{counts.green ?? 0} Y:
          {counts.yellow ?? 0} R:{counts.red ?? 0}
        </p>
      </div>
      {showDevices && (
        <div className="device-grid">
          {deviceCards.map((card) => (
            <div
              key={card.deviceId}
              className={`device-card${card.stale ? ' stale' : ''}`}
              style={{ borderLeft: `4px solid ${COLOUR_MAP[card.state] || '#64748b'}` }}
            >
              <div className="device-id">{card.deviceId}</div>
              <div className="device-meta">
                {formatState(card.state)} • {card.ageSec}s ago
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
