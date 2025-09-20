import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import './App.css';
import logo from './assets/logo.svg';

const API_BASE = 'https://bp-worker.jimross355.workers.dev';

// Reusable style generator for cookie banner buttons
const bannerBtnStyle = (bg) => ({
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 16px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem'
});

// Reusable global footer component (policy links)
function GlobalFooter() {
  return (
    <footer className="app-footer" style={{ marginTop: '40px' }}>
      <a href="/src/privacypolicy.html" target="_blank" rel="noopener">Privacy Policy</a>
      <span>|</span>
      <a href="/src/termsofservice.html" target="_blank" rel="noopener">Terms of Service</a>
      <span>|</span>
      <a href="/src/cookies.html" target="_blank" rel="noopener">Cookie Policy</a>
    </footer>
  );
}

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
  // Remember-me preference (persisted if user opts in)
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('bp_remember') === 'true');
  const [message, setMessage] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [average, setAverage] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  // Cookie consent state
  // Cookie preferences model
  // Stored as JSON: { essential: true, analytics: boolean }
  // Backwards compatibility: legacy values 'accepted','all','essential','true'
  const [cookiePrefs, setCookiePrefs] = useState(() => {
    try {
      const raw = localStorage.getItem('cookiePrefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.essential) return parsed;
      }
      const legacy = localStorage.getItem('cookieConsent');
      if (legacy && ['accepted','all','essential','true'].includes(legacy)) {
        const migrated = { essential: true, analytics: false };
        localStorage.setItem('cookiePrefs', JSON.stringify(migrated));
        return migrated;
      }
    } catch {}
    return { essential: false, analytics: false };
  });
  const [showCookieBanner, setShowCookieBanner] = useState(() => !cookiePrefs.essential);
  const [showCustomize, setShowCustomize] = useState(false);

  const persistCookiePrefs = (prefs) => {
    setCookiePrefs(prefs);
    localStorage.setItem('cookiePrefs', JSON.stringify(prefs));
  };

  const acceptAllCookies = () => {
    persistCookiePrefs({ essential: true, analytics: true });
    setShowCookieBanner(false);
    setShowCustomize(false);
  };
  const rejectNonEssential = () => {
    persistCookiePrefs({ essential: true, analytics: false });
    setShowCookieBanner(false);
    setShowCustomize(false);
  };
  const saveCustomCookies = () => {
    // essential must always be true to continue
    persistCookiePrefs(prev => ({ essential: true, analytics: prev.analytics }));
    setShowCookieBanner(false);
    setShowCustomize(false);
  };
  const toggleAnalytics = () => {
    setCookiePrefs(p => ({ ...p, analytics: !p.analytics }));
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
    localStorage.removeItem('bp_remember');
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
    let msg = '';
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        msg = data.message || data.error || '';
      } else {
        msg = await res.text();
      }
    } catch {
      msg = '';
    }
    setMessage(msg);
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
    // Validation for blank username/password removed
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    let msg = '';
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        msg = data.message || data.error || '';
      } else {
        msg = await res.text();
      }
    } catch {
      msg = 'Login failed';
    }
    if (res.ok) {
      setLoggedIn(true);
      setMessage(msg || 'Logged in!');
      localStorage.setItem('bp_username', username);
      localStorage.setItem('bp_last_activity', Date.now().toString());
      if (rememberMe) {
        localStorage.setItem('bp_remember', 'true');
      } else {
        localStorage.removeItem('bp_remember');
      }
      fetchMeasurements(username);
    } else {
      setMessage(msg || 'Login failed');
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
  // Clear form fields after successful submission
  setSystolic('');
  setDiastolic('');
  setHeartRate('');
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
      if (rememberMe) {
        // Skip auto-logout when rememberMe active
        return; // no cleanup needed beyond default
      }
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
  }, [loggedIn, rememberMe]);

  useEffect(() => {
    if (loggedIn && username) {
      fetchMeasurements(username);
    }
  }, [loggedIn, username]);

  return (
  <>
  <div className={`container ${loggedIn ? 'logged-in' : ''}`} style={{ position: 'relative' }}>
      {/* Cookie Preferences Banner */}
      {showCookieBanner && (
        <div className="cookie-overlay" role="dialog" aria-modal="true" aria-label="Cookie preferences">
          <div className="cookie-modal">
            {!showCustomize && (
              <div className="cookie-step cookie-intro">
                <h3>We Value Your Privacy</h3>
                <p>
                  We use essential cookies to make this site work. With your permission we may also use
                  analytics cookies to understand usage and improve the product. You can accept all,
                  reject non-essential, or customize your choices.
                  Read our <a href="/src/cookies.html" target="_blank" rel="noopener">Cookie Policy</a>,
                  <a href="/src/privacypolicy.html" target="_blank" rel="noopener"> Privacy Policy</a> and
                  <a href="/src/termsofservice.html" target="_blank" rel="noopener"> Terms</a>.
                </p>
                <div className="cookie-actions">
                  <button onClick={acceptAllCookies} className="ck-btn primary">Accept All</button>
                  <button onClick={rejectNonEssential} className="ck-btn subtle">Reject Non-Essential</button>
                  <button onClick={() => setShowCustomize(true)} className="ck-btn outline">Customize</button>
                </div>
              </div>
            )}
            {showCustomize && (
              <div className="cookie-step cookie-customize">
                <h3 style={{ marginTop: 0 }}>Cookie Preferences</h3>
                <div className="cookie-options">
                  <div className="cookie-option disabled">
                    <div>
                      <strong>Essential</strong>
                      <div className="desc">Required for core functionality (always on).</div>
                    </div>
                    <input type="checkbox" checked disabled />
                  </div>
                  <div className="cookie-option">
                    <div>
                      <strong>Analytics</strong>
                      <div className="desc">Anonymous usage metrics to improve features.</div>
                    </div>
                    <input type="checkbox" checked={cookiePrefs.analytics} onChange={toggleAnalytics} />
                  </div>
                </div>
                <div className="cookie-actions">
                  <button onClick={saveCustomCookies} className="ck-btn primary">Save Choices</button>
                  <button onClick={acceptAllCookies} className="ck-btn success">Accept All</button>
                  <button onClick={rejectNonEssential} className="ck-btn subtle">Reject Non-Essential</button>
                  <button onClick={() => { setShowCustomize(false); if (!cookiePrefs.essential) setShowCookieBanner(true); }} className="ck-btn outline">Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Centered logo + optional logout (no floats) */}
      <div className="topbar" style={{ position: 'relative' }}>
        <img className="app-logo" src={logo} alt="Blood Pressure & Heart Rate Tracker" />
        {loggedIn && <button className="logout-btn" onClick={logout}>Logout</button>}
      </div>
      {/* Cookie Settings button at absolute top-left of container */}
      {loggedIn && (
        <button
          onClick={() => { setShowCookieBanner(true); setShowCustomize(false); }}
          className="cookie-btn"
          style={{ position: 'absolute', top: 16, left: 32, zIndex: 10 }}
        >Cookies</button>
      )}

      {!loggedIn ? (
        <>
          {/* Cookie Settings button at absolute top-left of container (logged-out) */}
          <button
            onClick={() => { setShowCookieBanner(true); setShowCustomize(false); }}
            className="cookie-btn"
            style={{ position: 'absolute', top: 16, left: 32, zIndex: 10 }}
          >Cookies</button>
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
              {/* Registration message under form */}
              {message && (
                <div style={{
                  color: message.toLowerCase().includes('registered') || message.toLowerCase().includes('logged in') || message.toLowerCase().includes('success') ? '#fff' : 'red',
                  marginBottom: '12px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                }}>
                  {message}
                </div>
              )}
              <div className="auth-actions">
                <button type="submit">Register</button>
                <button type="button" onClick={() => { setPage('login'); setMessage(''); }}>Back to Login</button>
              </div>
            </form>
          ) : (
            <form onSubmit={login}>
              <h2>Login</h2>
              <label htmlFor="login-username">Username</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  id="login-username"
                  name="login-username"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ borderColor: username === '' && message === 'Please enter a username/password' ? 'red' : undefined, width: '100%' }}
                />
                {/* ...existing code for bubble... */}
              </div>
              <label htmlFor="login-password">Password</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  id="login-password"
                  name="login-password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ borderColor: password === '' && message === 'Please enter a username/password' ? 'red' : undefined, width: '100%' }}
                />
                {/* ...existing code for bubble... */}
              </div>
              {/* Remember me checkbox directly under password field */}
              <div className="remember-row">
                <label>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  Keep me signed in
                </label>
              </div>
              {/* Login message under form */}
              {message && (
                <div style={{
                  color: '#d70000ff',
                  margin: '12px 0',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                }}>
                  {message}
                </div>
              )}
              <div className="auth-actions" style={{ marginTop: '8px' }}>
                <button type="submit">Login</button>
                <button type="button" onClick={() => { setPage('register'); setMessage(''); }}>Register</button>
              </div>
            </form>
          )}
            {/* Footer removed here; now rendered globally below */}

      
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
                      ? 'white'
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
                  {[...measurements]
                    .sort((a, b) => {
                      // Robust date parsing for DD/MM/YYYY and YYYY-MM-DD
                      const parse = (ts) => {
                        if (!ts) return 0;
                        let datePart = '';
                        let timePart = '';
                        if (ts.includes(',')) {
                          [datePart, timePart] = ts.split(',').map(s => s.trim());
                        } else if (ts.includes(' ')) {
                          [datePart, timePart] = ts.split(' ').map(s => s.trim());
                        } else {
                          datePart = ts.trim();
                        }
                        // DD/MM/YYYY or YYYY-MM-DD
                        let year, month, day;
                        if (datePart.includes('/')) {
                          // DD/MM/YYYY
                          const parts = datePart.split('/');
                          if (parts.length === 3) {
                            day = parseInt(parts[0], 10);
                            month = parseInt(parts[1], 10) - 1; // JS months are 0-based
                            year = parseInt(parts[2], 10);
                          }
                        } else if (datePart.includes('-')) {
                          // YYYY-MM-DD
                          const parts = datePart.split('-');
                          if (parts.length === 3) {
                            year = parseInt(parts[0], 10);
                            month = parseInt(parts[1], 10) - 1;
                            day = parseInt(parts[2], 10);
                          }
                        }
                        // Parse time
                        let hour = 0, minute = 0, second = 0;
                        if (timePart) {
                          const tParts = timePart.split(':');
                          if (tParts.length >= 2) {
                            hour = parseInt(tParts[0], 10);
                            minute = parseInt(tParts[1], 10);
                            second = tParts[2] ? parseInt(tParts[2], 10) : 0;
                          }
                        }
                        if (year && month >= 0 && day) {
                          return new Date(year, month, day, hour, minute, second).getTime();
                        }
                        return 0;
                      };
                      return parse(b.timestamp) - parse(a.timestamp);
                    })
                    .map(m => {
                      let date = '';
                      let time = '';
                      if (m.timestamp) {
                        const commaSplit = m.timestamp.split(',');
                        if (commaSplit.length === 2) {
                          date = commaSplit[0].trim();
                          time = commaSplit[1].trim();
                        } else {
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
          {/* Footer removed here to avoid duplicate; unified footer handled in logged-out section or can be placed globally if needed. */}
        </>
      )}
      <GlobalFooter />
    </div>
  </>
  );
}

export default App;