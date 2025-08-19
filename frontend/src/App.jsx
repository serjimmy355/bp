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
  const [regAgreed, setRegAgreed] = useState(false);
  // Login form state
  const [username, setUsername] = useState(() => localStorage.getItem('bp_username') || '');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem('bp_username'));
  const [message, setMessage] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [average, setAverage] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  // Cookie consent state
  const [cookieConsent, setCookieConsent] = useState(() => {
    const consent = localStorage.getItem('cookieConsent');
    return consent === 'all' || consent === 'essential';
  });
  // Handle cookie consent
  const handleCookieConsent = (type) => {
    localStorage.setItem('cookieConsent', type);
    setCookieConsent(true);
  };

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
    localStorage.removeItem('bp_username');
    localStorage.removeItem('bp_last_activity');
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
    if (!window.confirm('Are you sure you want to delete the selected records?')) return;
    for (const id of selectedIds) {
      await deleteMeasurement(id);
    }
    setSelectedIds([]);
  };

  const register = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!regAgreed) {
      setMessage('You must confirm you have read and agree to the Privacy Policy and Terms of Service.');
      return;
    }
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
      setRegAgreed(false);
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
      localStorage.setItem('bp_username', username);
      localStorage.setItem('bp_last_activity', Date.now().toString());
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
  // Individual delete with confirmation
  const handleDeleteMeasurement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    await deleteMeasurement(id);
  };
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

  // Inactivity timeout (10 minutes)
  const INACTIVITY_LIMIT = 60 * 10 * 1000; // 10 minutes in ms
  const updateActivity = () => {
    if (loggedIn) {
      localStorage.setItem('bp_last_activity', Date.now().toString());
    }
  };
  useEffect(() => {
    if (loggedIn) {
      updateActivity();
      const checkInactivity = () => {
        const last = parseInt(localStorage.getItem('bp_last_activity') || '0', 10);
        if (Date.now() - last > INACTIVITY_LIMIT) {
          logout();
        }
      };
      const interval = setInterval(checkInactivity, 60 * 1000); // check every minute
      window.addEventListener('mousemove', updateActivity);
      window.addEventListener('keydown', updateActivity);
      window.addEventListener('click', updateActivity);
      return () => {
        clearInterval(interval);
        window.removeEventListener('mousemove', updateActivity);
        window.removeEventListener('keydown', updateActivity);
        window.removeEventListener('click', updateActivity);
      };
    }
  }, [loggedIn]);

  useEffect(() => {
    if (loggedIn && username) {
      fetchMeasurements(username);
    }
  }, [loggedIn, username]);

  return (
  <div className="container" style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Cookie Consent Popup */}
      {!cookieConsent && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#232a3a',
          color: '#eaf1fb',
          padding: '18px 16px',
          textAlign: 'center',
          zIndex: 9999,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.12)',
          fontSize: '1rem'
        }}>
          This website uses cookies to enhance your experience. Optional cookies help us improve the site. See our
          <a href="/src/privacypolicy.html" target="_blank" rel="noopener" style={{ color: '#3b82f6', textDecoration: 'underline', margin: '0 4px' }}>Privacy Policy</a>.
          <button
            onClick={() => handleCookieConsent('all')}
            style={{ marginLeft: '18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Accept All
          </button>
          <button
            onClick={() => handleCookieConsent('essential')}
            style={{ marginLeft: '12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Decline Optional
          </button>
        </div>
      )}
      {/* Centered logo + optional logout (no floats) */}
      <div className="topbar">
        <img className="app-logo" src={logo} alt="Blood Pressure & Heart Rate Tracker" />
        {loggedIn && <button className="logout-btn" onClick={logout}>Logout</button>}
      </div>

      {!loggedIn ? (
        <>
          {page === 'register' ? (
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
              <div style={{ margin: '12px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.98rem' }}>
                  <input
                    type="checkbox"
                    checked={regAgreed}
                    onChange={e => setRegAgreed(e.target.checked)}
                    required
                  />
                  I confirm I have read and agree to the
                  <a href="/src/privacypolicy.html" target="_blank" rel="noopener" style={{ color: '#3b82f6', textDecoration: 'underline', margin: '0 4px' }}>Privacy Policy</a>
                  and
                  <a href="/src/termsofservice.html" target="_blank" rel="noopener" style={{ color: '#3b82f6', textDecoration: 'underline', margin: '0 4px' }}>Terms of Service</a>
                </label>
              </div>
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
          )}
          <footer style={{background: '#161e2e', color: '#eaf1fb', textAlign: 'center', padding: '24px 0', marginTop: '48px', fontSize: '1rem', borderTop: '1px solid #232a3a', position: 'absolute', left: 0, right: 0, bottom: 0}}>
            <a href="/src/privacypolicy.html" target="_blank" rel="noopener" style={{color: '#3b82f6', textDecoration: 'underline', margin: '0 12px'}}>Privacy Policy</a>
            |
            <a href="/src/termsofservice.html" target="_blank" rel="noopener" style={{color: '#3b82f6', textDecoration: 'underline', margin: '0 12px'}}>Terms of Service</a>
          </footer>
        </>
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
                  type="number"
                  inputMode="numeric"
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
                  type="number"
                  inputMode="numeric"
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
                  type="number"
                  inputMode="numeric"
                  placeholder="Heart Rate"
                  value={heartRate}
                  onChange={e => setHeartRate(e.target.value)}
                />
              </div>
            </div>
            <button type="submit">Submit</button>
          </form>

          {/* Success message below submit button */}
          {message === 'Measurement stored' && (
            <div style={{ color: 'green', margin: '12px 0', textAlign: 'center', fontWeight: 'bold' }}>
              Measurement stored
            </div>
          )}

          <div className="message-container">
            <h2>Measurements</h2>

            {/* Message above table, only for errors, delete confirmation, or login success */}
            {message && message !== 'Measurement stored' && (
              <div
                style={{
                  color:
                    message === 'Logged in!' || message.toLowerCase().includes('login successful')
                      ? 'green'
                      : 'red',
                  marginBottom: '12px',
                  textAlign: 'center',
                  fontWeight:
                    message === 'Logged in!' || message.toLowerCase().includes('login successful')
                      ? 'bold'
                      : 'normal',
                  boxShadow: 'none',
                  background: 'none',
                  border: 'none',
                  padding: 0
                }}
              >
                {message}
              </div>
            )}

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
                          <button className="delete" onClick={async () => {
                            if (!window.confirm('Are you sure you want to delete this record?')) return;
                            await deleteMeasurement(m.id);
                          }}>
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
    </div>
  );
}

export default App;