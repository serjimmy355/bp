

import { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'https://bp-worker.jimross355.workers.dev/'; // Replace with your deployed Worker URL

function App() {
  // Navigation state
  const [page, setPage] = useState('login'); // 'login' or 'register'
  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
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
    setMessage(await res.text());
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
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setLoggedIn(true);
      setMessage('Logged in!');
      fetchMeasurements(data.token);
    } else {
      setMessage(await res.text());
    }
  };

  const submitMeasurement = async (e) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch(`${API_BASE}/measurements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ systolic, diastolic, heart_rate: heartRate })
    });
    setMessage(await res.text());
    fetchMeasurements(token);
  };

  const fetchMeasurements = async (jwt) => {
    const res = await fetch(`${API_BASE}/measurements`, {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    if (res.ok) {
      setMeasurements(await res.json());
    }
  };

  const deleteMeasurement = async (id) => {
    const res = await fetch(`${API_BASE}/measurements`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id })
    });
    setMessage(await res.text());
    fetchMeasurements(token);
  };

  const exportCSV = async () => {
    const res = await fetch(`${API_BASE}/export`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
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
    const res = await fetch(`${API_BASE}/average`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setAverage(await res.json());
    } else {
      setMessage(await res.text());
    }
  };

  useEffect(() => {
    if (loggedIn && token) {
      fetchMeasurements(token);
    }
  }, [loggedIn, token]);

  return (
    <div className="container">
      <h1>Blood Pressure & Heart Rate Tracker</h1>
      {page === 'register' ? (
        <form onSubmit={register}>
          <h2>Register</h2>
          <input placeholder="Username" value={regUsername} onChange={e => setRegUsername(e.target.value)} />
          <input type="password" placeholder="Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
          <button type="submit">Register</button>
          <button type="button" onClick={() => setPage('login')}>Back to Login</button>
        </form>
      ) : (
        <>
          <form onSubmit={login}>
            <h2>Login</h2>
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit">Login</button>
            <button type="button" onClick={() => setPage('register')}>Register</button>
          </form>
          {loggedIn && (
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
              <ul>
                {measurements.map(m => (
                  <li key={m.id}>
                    {m.timestamp}: {m.systolic}/{m.diastolic} mmHg, HR: {m.heart_rate}
                    <button onClick={() => deleteMeasurement(m.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;
