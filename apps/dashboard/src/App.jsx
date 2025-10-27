import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  const [paused, setPaused] = useState(false);
  const appShellRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update CSS custom properties when majority color changes
  useEffect(() => {
    const majorityColor = COLOUR_MAP[majority.state] || COLOUR_MAP.blue;
    document.documentElement.style.setProperty('--majority-color', majorityColor);
    document.documentElement.style.setProperty('--baseColor', majorityColor);
  }, [majority.state]);

  // Dot animation functions
  const rand = (min, max) => Math.random() * (max - min) + min;

  const spawnDots = () => {
    if (!appShellRef.current || paused) return;
    
    const rect = appShellRef.current.getBoundingClientRect();
    const { width: w, height: h } = rect;
    const count = Math.floor(rand(4, 7));
    
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot dotCycle';

      const size = rand(60, 110);
      dot.style.width = dot.style.height = size + 'px';

      // Start anywhere inside container
      const x0 = rand(0, w);
      const y0 = rand(0, h);
      // Drift outward in a random direction
      const angle = rand(0, Math.PI * 2);
      const travel = rand(160, 320);
      const x1 = x0 + travel * Math.cos(angle);
      const y1 = y0 + travel * Math.sin(angle);

      dot.style.setProperty('--x0', x0 + 'px');
      dot.style.setProperty('--y0', y0 + 'px');
      dot.style.setProperty('--x1', x1 + 'px');
      dot.style.setProperty('--y1', y1 + 'px');
      dot.style.setProperty('--dotDur', Math.floor(rand(13000, 18000)) + 'ms');
      dot.style.animationDelay = Math.floor(rand(0, 4000)) + 'ms';

      appShellRef.current.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    }
  };

  const startDotLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    spawnDots();
    timerRef.current = setInterval(() => {
      if (!paused) {
        spawnDots();
        setTimeout(() => {
          if (!paused) spawnDots();
        }, 12000); // Half cycle
      }
    }, 24000); // Full cycle
    
    setTimeout(() => {
      if (!paused) spawnDots();
    }, 12000);
  };

  const stopDotLoop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Start dot animation on mount
  useEffect(() => {
    startDotLoop();
    return () => stopDotLoop();
  }, []);

  // Handle pause/play
  useEffect(() => {
    document.body.classList.toggle('paused', paused);
    if (paused) {
      stopDotLoop();
    } else {
      startDotLoop();
    }
  }, [paused]);

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
    <div className="app-shell" ref={appShellRef}>
      <button
        className="ctrl"
        onClick={() => setPaused(!paused)}
        aria-pressed={paused}
        title="Pause / Play"
      >
        {paused ? 'Play' : 'Pause'}
      </button>
      
      {!connected && <div className="ribbon">Reconnecting…</div>}
      
      <div className="content">
        <div className="logo-section">
          <div className="logo">
            <div className="logo-icon">☕</div>
            <div className="logo-text">Breakly</div>
          </div>
          <div className="tagline">Communal Aura</div>
        </div>
        
        <div className="majority-section">
          <h1 className="title">{formatState(majority.state)}</h1>
          <p className="subtitle">
            <span className="online-count">{counts.online ?? 0}</span> cups online
          </p>
        </div>
      </div>
      
      {showDevices && (
        <div className="device-grid">
          {deviceCards.map((card) => (
            <div
              key={card.deviceId}
              className={`device-card${card.stale ? ' stale' : ''}`}
              style={{ 
                '--device-color': COLOUR_MAP[card.state] || '#64748b'
              }}
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
