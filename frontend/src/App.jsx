import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import './App.css';
import logo from './assets/logo.svg';

const API_BASE = 'https://bp-worker.jimross355.workers.dev';

function App() {
  // Navigation state
  const [page, setPage] = useState('login'); // 'login' or 'register'
  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [average, setAverage] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // Logout handler
  const logout = () => {
    setLoggedIn(false);
    setUsername('');
    setPassword('');
    setMessage('');
    setSystolic('');
    setDiastolic('');
    setHeartRate('');
    setAverage(null);
    setMeasurements([]);
    setSelectedIds([]);
    setPage('login');
  };

  // Handle select all
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(measurements.map(m => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Shift-click bulk select support
  const [lastChecked, setLastChecked] = useState(null);
  const handleSelectOne = (id, e) => {
    if (e.shiftKey && lastChecked !== null && lastChecked !== id) {
      const ids = measurements.map(m => m.id);
      const start = ids.indexOf(lastChecked);
      const end = ids.indexOf(id);
      const [min, max] = [Math.min(start, end), Math.max(start, end)];
      const range = ids.slice(min, max + 1);
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        range.forEach(rid => newSet.add(rid));
        return Array.from(newSet);
      });
    } else {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
      setLastChecked(id);
    }
  };

  // Bulk delete
  const deleteSelected = async () => {
    for (const id of selectedIds) {
      await deleteMeasurement(id);
    }
    setSelectedIds([]);
  };

  const register = async (e) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: regUsername, password: regPassword })
    });
    const data = await res.json().catch(() => ({}));
    setMessage(data.message || data.error || '');
    if (res.ok) {
      setPage('login');
      setRegUsername('');
      setRegPassword('');
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setLoggedIn(true);
      setMessage(data.message || 'Logged in!');
      fetchMeasurements(username);
    } else {
      setMessage(data.message || data.error || 'Login failed');
    }
  };

  const submitMeasurement = async (e) => {
    e.preventDefault();
    setMessage('');
    // Use device local time string for timestamp
    const localTime = new Date().toLocaleString();
    const payload = {
      username,
      systolic,
      diastolic,
      heart_rate: heartRate,
      timestamp: localTime
    };
    const res = await fetch(`${API_BASE}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.message) {
      setMessage(data.message);
    } else if (data.error) {
      setMessage(data.error);
    } else {
      setMessage('An unexpected error occurred.');
    }
    fetchMeasurements(username);
  };

  const fetchMeasurements = async (usernameParam) => {
    const url = `${API_BASE}/measurements?username=${encodeURIComponent(usernameParam)}`;
    const res = await fetch(url);
    if (res.ok) {
      setMeasurements(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      console.warn('Fetch measurements error:', data);
    }
  };

  const deleteMeasurement = async (id) => {
    const res = await fetch(`${API_BASE}/measurements`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, username })
    });
    const data = await res.json().catch(() => ({}));
    setMessage(data.message || data.error || '');
    fetchMeasurements(username);
  };

  const exportCSV = async () => {
    const res = await fetch(`${API_BASE}/export?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'measurements.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const getAverage = async () => {
    setMessage('');
    const res = await fetch(`${API_BASE}/average?username=${encodeURIComponent(username)}`);
    if (res.ok) {
      setAverage(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || data.error || '');
    }
  };

  useEffect(() => {
    if (loggedIn && username) {
      fetchMeasurements(username);
    }
  }, [loggedIn, username]);

  return (
    <div className="container">
      {/* Centered logo + optional logout (no floats) */}
      <div className="topbar">
        <img className="app-logo" src={logo} alt="Blood Pressure & Heart Rate Tracker" />
        {loggedIn && <button className="logout-btn" onClick={logout}>Logout</button>}
      </div>

      {!loggedIn ? (
        page === 'register' ? (
          <form onSubmit={register}>
            <h2>Register</h2>
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              name="register-username"
              placeholder="Username"
              value={regUsername}
              onChange={e => setRegUsername(e.target.value)}
            />
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              name="register-password"
              type="password"
              placeholder="Password"
              value={regPassword}
              onChange={e => setRegPassword(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <button type="submit">Register</button>
              <button type="button" onClick={() => setPage('login')}>Back to Login</button>
            </div>
          </form>
        ) : (
          <form onSubmit={login}>
            <h2>Login</h2>
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              name="login-username"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="login-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <button type="submit">Login</button>
              <button type="button" onClick={() => setPage('register')}>Register</button>
            </div>
          </form>
        )
      ) : (
        <>
          <form onSubmit={submitMeasurement}>
            <h2>Enter Measurement</h2>
            <div className="measurement-row">
              <div className="input-group">
                <label htmlFor="systolic">Systolic</label>
                <input
                  id="systolic"
                  name="systolic"
                  placeholder="Systolic"
                  value={systolic}
                  onChange={e => setSystolic(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="diastolic">Diastolic</label>
                <input
                  id="diastolic"
                  name="diastolic"
                  placeholder="Diastolic"
                  value={diastolic}
                  onChange={e => setDiastolic(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="heart-rate">Heart Rate</label>
                <input
                  id="heart-rate"
                  name="heart-rate"
                  placeholder="Heart Rate"
                  value={heartRate}
                  onChange={e => setHeartRate(e.target.value)}
                />
              </div>
            </div>
            <button type="submit">Submit</button>
          </form>

          <div className="message-container">
            <h2>Measurements</h2>

            {selectedIds.length > 0 && (
              <button className="delete" onClick={deleteSelected} style={{ marginLeft: '12px' }}>
                Delete Selected
              </button>
            )}

            {/* table scroll wrapper */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === measurements.length && measurements.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Systolic</th>
                    <th>Diastolic</th>
                    <th>Heart Rate</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {measurements.map(m => {
                    let date = '';
                    let time = '';
                    if (m.timestamp) {
                      // Handles 'YYYY-MM-DD, HH:MM:SS', 'YYYY-MM-DD HH:MM:SS', 'DD/MM/YYYY, HH:MM:SS', 'DD/MM/YYYY HH:MM:SS'
                      const commaSplit = m.timestamp.split(',');
                      if (commaSplit.length === 2) {
                        date = commaSplit[0].trim();
                        time = commaSplit[1].trim();
                      } else {
                        // Try to split by first space after date
                        const spaceSplit = m.timestamp.split(' ');
                        if (spaceSplit.length === 2) {
                          date = spaceSplit[0].trim();
                          time = spaceSplit[1].trim();
                        } else {
                          date = m.timestamp.trim();
                          time = '';
                        }
                      }
                    }
                    return (
                      <tr key={m.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(m.id)}
                            onChange={e => handleSelectOne(m.id, e)}
                          />
                        </td>
                        <td>{date}</td>
                        <td>{time}</td>
                        <td>{m.systolic}</td>
                        <td>{m.diastolic}</td>
                        <td>{m.heart_rate}</td>
                        <td>
                          <button className="delete" onClick={() => deleteMeasurement(m.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Average readings below table, above buttons */}
            {average && (
              <div style={{ margin: '24px 0 8px 0' }}>
                <h3>Average Readings</h3>
                <p>Systolic: {average.avg_systolic?.toFixed(2)}</p>
                <p>Diastolic: {average.avg_diastolic?.toFixed(2)}</p>
                <p>Heart Rate: {average.avg_heart_rate != null ? average.avg_heart_rate.toFixed(2) : 'N/A'}</p>
              </div>
            )}

            {/* Even-flex, capped width action buttons */}
            <div className="action-row">
              <button onClick={getAverage}>Get Average</button>
              <button onClick={exportCSV}>CSV ⬇</button>
            </div>
          </div>
        </>
      )}

      {message && (
        <div className={`err${message.toLowerCase().includes('success') ? ' success' : ''}`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default App;