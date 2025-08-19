/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { DB } = env;
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    // Normalize pathname (remove trailing slashes)
    const pathname = url.pathname.replace(/\/+$/, '');

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Get all measurements for a user
    if (request.method === 'GET' && pathname === '/measurements') {
      let username = url.searchParams.get('username');
      if (!username) {
        return new Response(JSON.stringify({ error: 'Missing username' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      username = username.toLowerCase();
      const user = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const measurements = await DB.prepare('SELECT id, systolic, diastolic, heart_rate, timestamp FROM measurements WHERE user_id = ? ORDER BY timestamp DESC').bind(user.id).all();
      return new Response(JSON.stringify(measurements.results), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Register user
    if (request.method === 'POST' && pathname === '/register') {
      let { username, password } = await request.json();
      if (!username || !password) {
        return new Response('Missing username or password', { status: 400, headers: corsHeaders });
      }
      username = username.toLowerCase();
      // Hash password using Web Crypto API
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const pwKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
      const hashBuffer = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      }, pwKey, 256);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
      const storedHash = `${saltHex}:${hashHex}`;
      try {
        await DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(username, storedHash).run();
        return new Response(JSON.stringify({ message: 'User registered' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response('Username already exists', { status: 409, headers: corsHeaders });
      }
    }

    // Login user
    if (request.method === 'POST' && pathname === '/login') {
      let { username, password } = await request.json();
      if (!username || !password) {
        return new Response('Missing username or password', { status: 400, headers: corsHeaders });
      }
      username = username.toLowerCase();
      const user = await DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response('Invalid credentials', { status: 401, headers: corsHeaders });
      }
      // Verify password using Web Crypto API
      const [saltHex, hashHex] = user.password_hash.split(':');
      const encoder = new TextEncoder();
      const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      const pwKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
      const hashBuffer = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      }, pwKey, 256);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const inputHashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      if (inputHashHex !== hashHex) {
        return new Response('Invalid credentials', { status: 401, headers: corsHeaders });
      }
      // For simplicity, return success (JWT/session can be added later)
      return new Response(JSON.stringify({ message: 'Login successful' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store measurement
    if (request.method === 'POST' && pathname === '/measurements') {
      let { username, systolic, diastolic, heart_rate, timestamp } = await request.json();
      if (!username || !systolic || !diastolic || !heart_rate) {
        return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      username = username.toLowerCase();
      const user = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Use provided timestamp (local time string) or fallback to UTC
      const storeTimestamp = timestamp ? timestamp : new Date().toISOString();
      await DB.prepare('INSERT INTO measurements (user_id, systolic, diastolic, heart_rate, timestamp) VALUES (?, ?, ?, ?, ?)')
        .bind(user.id, systolic, diastolic, heart_rate, storeTimestamp).run();
      return new Response(JSON.stringify({ message: 'Measurement stored' }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Delete a measurement
    if (request.method === 'DELETE' && pathname === '/measurements') {
      let { id, username } = await request.json();
      if (!id || !username) {
        return new Response(JSON.stringify({ error: 'Missing id or username' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      username = username.toLowerCase();
      const user = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const result = await DB.prepare('DELETE FROM measurements WHERE id = ? AND user_id = ?').bind(id, user.id).run();
      if (result.changes === 0) {
        return new Response(JSON.stringify({ error: 'Measurement not found or not deleted' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ message: 'Measurements deleted' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate average blood pressure
    if (request.method === 'GET' && pathname === '/average') {
      let username = url.searchParams.get('username');
      if (!username) {
        return new Response('Missing username', { status: 400, headers: corsHeaders });
      }
      username = username.toLowerCase();
      const user = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response('User not found', { status: 404, headers: corsHeaders });
      }
      const result = await DB.prepare('SELECT AVG(systolic) AS avg_systolic, AVG(diastolic) AS avg_diastolic, AVG(heart_rate) AS avg_heart_rate FROM measurements WHERE user_id = ?')
        .bind(user.id).first();
      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Export measurements as CSV
    if (request.method === 'GET' && pathname === '/export') {
      let username = url.searchParams.get('username');
      if (!username) {
        return new Response('Missing username', { status: 400, headers: corsHeaders });
      }
      username = username.toLowerCase();
      const user = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response('User not found', { status: 404, headers: corsHeaders });
      }
      const measurements = await DB.prepare('SELECT systolic, diastolic, heart_rate, timestamp FROM measurements WHERE user_id = ? ORDER BY timestamp DESC').bind(user.id).all();
      // Build CSV string with Date and Time columns
      let csv = 'Systolic, Diastolic, Heart Rate, Date, Time\n';
      for (const m of measurements.results) {
        let date = '';
        let time = '';
        if (m.timestamp) {
          // Accept both "DD/MM/YYYY, HH:MM:SS" and "DD/MM/YYYY HH:MM:SS" formats
          if (m.timestamp.includes(',')) {
            const [datePart, timePart] = m.timestamp.split(',');
            date = datePart ? datePart.trim() : '';
            time = timePart ? timePart.trim() : '';
          } else {
            // Try to split by first space after date
            const match = m.timestamp.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
            if (match) {
              date = match[1];
              time = match[2];
            } else {
              date = m.timestamp.trim();
              time = '';
            }
          }
        }
        csv += `${m.systolic}, ${m.diastolic}, ${m.heart_rate},${date}, ${time}\n`;
      }
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="measurements.csv"'
        }
      });
    }

    // Fallback for unknown routes
    return new Response(JSON.stringify({ message: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}