

import { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'https://bp-worker.jimross355.workers.dev'; // Replace with your deployed Worker URL

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
    const payload = { username, systolic, diastolic, heart_rate: heartRate };
    console.log('Submitting measurement:', {
      url: `${API_BASE}/measurements`,
      payload
    });
    const res = await fetch(`${API_BASE}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.message) {
      setMessage(data.message); // Show success message
    } else if (data.error) {
      setMessage(data.error); // Show error message
    } else {
      setMessage('An unexpected error occurred.');
    }
    fetchMeasurements(username);
  };

  const fetchMeasurements = async (usernameParam) => {
    const url = `${API_BASE}/measurements?username=${encodeURIComponent(usernameParam)}`;
    console.log('Fetching measurements:', { url, usernameParam });
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
      <h1>Blood Pressure & Heart Rate Tracker</h1>
      {!loggedIn ? (
        page === 'register' ? (
          <form onSubmit={register}>
            <h2>Register</h2>
            <input placeholder="Username" value={regUsername} onChange={e => setRegUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
            <button type="submit">Register</button>
            <button type="button" onClick={() => setPage('login')}>Back to Login</button>
          </form>
        ) : (
          <form onSubmit={login}>
            <h2>Login</h2>
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit">Login</button>
            <button type="button" onClick={() => setPage('register')}>Register</button>
          </form>
        )
      ) : (
        <>
          <form onSubmit={submitMeasurement}>
            <h2>Enter Measurement</h2>
            <input placeholder="Systolic" value={systolic} onChange={e => setSystolic(e.target.value)} />
            <input placeholder="Diastolic" value={diastolic} onChange={e => setDiastolic(e.target.value)} />
            <input placeholder="Heart Rate" value={heartRate} onChange={e => setHeartRate(e.target.value)} />
            <button type="submit">Submit</button>
          </form>
          <button onClick={getAverage}>Get Average</button>
          {average && (
            <div>
              <h3>Average Blood Pressure</h3>
              <p>Systolic: {average.avg_systolic?.toFixed(2)}</p>
              <p>Diastolic: {average.avg_diastolic?.toFixed(2)}</p>
            </div>
          )}
          <h2>Measurements</h2>
          <button onClick={exportCSV}>Export to CSV</button>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Systolic</th>
                <th>Diastolic</th>
                <th>Heart Rate</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map(m => (
                <tr key={m.id}>
                  <td>{new Date(m.timestamp).toLocaleString()}</td>
                  <td>{m.systolic}</td>
                  <td>{m.diastolic}</td>
                  <td>{m.heart_rate}</td>
                  <td><button onClick={() => deleteMeasurement(m.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;
