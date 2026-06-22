import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

// API base: same-origin in production (nginx proxies /api), overridable in dev.
const API = import.meta.env.VITE_API_BASE || "";

const REFRESH_MS = 5000;

async function getJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function alertColor(alert) {
  switch (alert) {
    case "HIGH POLLUTION": return "#e11d48";
    case "MODERATE POLLUTION": return "#f59e0b";
    case "HEAT WARNING": return "#f97316";
    case "NOISE WARNING": return "#8b5cf6";
    default: return "#10b981";
  }
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [latest, setLatest] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]); // rolling AQI series for the chart
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [h, l, a] = await Promise.all([
        getJSON("/health"),
        getJSON("/api/sensor/latest"),
        getJSON("/api/alerts?limit=10"),
      ]);
      setHealth(h);
      setLatest(l);
      setAlerts(a);
      setError(null);

      // Append a time-bucketed snapshot of each sensor's AQI for the trend chart.
      const point = { t: new Date().toLocaleTimeString() };
      for (const r of l) point[r.sensorId] = r.airQuality;
      setHistory((prev) => [...prev.slice(-19), point]);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const sensorIds = latest.map((r) => r.sensorId);
  const palette = ["#2563eb", "#16a34a", "#db2777", "#ca8a04"];

  // Label each line by its area name (e.g. "MG Road") instead of "sensor-1".
  const labelFor = (id) => {
    const r = latest.find((x) => x.sensorId === id);
    return r ? (r.location || r.name || id).split(",")[0] : id;
  };

  return (
    <div className="app">
      <header>
        <h1>Smart City - Environmental Monitoring</h1>
        <div className="status">
          <span className={`dot ${health?.adx ? "ok" : "bad"}`} /> Azure Data Explorer
          <span className={`dot ${health?.sql ? "ok" : "bad"}`} /> Azure SQL
          <span className="muted">refresh {REFRESH_MS / 1000}s</span>
        </div>
      </header>

      {error && <div className="error">{error} - is the API running?</div>}

      <section className="cards">
        {latest.map((r) => (
          <div className="card" key={r.sensorId} style={{ borderTopColor: alertColor(r.alert) }}>
            <div className="card-head">
              <strong>{r.name || r.sensorId}</strong>
              <span className="badge" style={{ background: alertColor(r.alert) }}>{r.alert}</span>
            </div>
            <div className="loc">{r.location || "-"}</div>
            <div className="metrics">
              <div><span>AQI</span><b>{r.airQuality}</b></div>
              <div><span>Temp</span><b>{r.temperature}°C</b></div>
              <div><span>Humidity</span><b>{r.humidity}%</b></div>
              <div><span>Noise</span><b>{r.noise} dB</b></div>
            </div>
          </div>
        ))}
        {!latest.length && !error && <div className="muted">Waiting for sensor data…</div>}
      </section>

      <section className="panel">
        <h2>Air Quality (AQI) - live trend</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="t" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} />
            <Legend />
            {sensorIds.map((id, i) => (
              <Line key={id} type="monotone" dataKey={id} name={labelFor(id)} stroke={palette[i % palette.length]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <h2>Recent alerts</h2>
        <table>
          <thead>
            <tr><th>Time</th><th>Sensor</th><th>Alert</th><th>AQI</th><th>Temp</th><th>Noise</th></tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={i}>
                <td>{new Date(a.timestamp).toLocaleTimeString()}</td>
                <td>{a.sensorId}</td>
                <td><span className="badge" style={{ background: alertColor(a.alert) }}>{a.alert}</span></td>
                <td>{a.airQuality}</td>
                <td>{a.temperature}°C</td>
                <td>{a.noise} dB</td>
              </tr>
            ))}
            {!alerts.length && <tr><td colSpan="6" className="muted">No alerts yet</td></tr>}
          </tbody>
        </table>
      </section>

      <footer className="muted">
        Smart City · Kafka → Spark → Azure Data Explorer (time-series) + Azure SQL (metadata) → REST API
      </footer>
    </div>
  );
}
