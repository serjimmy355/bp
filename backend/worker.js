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
  async fetch(request, env) {
    const url = new URL(request.url);
    const { DB } = env;
    const ACCESS_SECRET = env.ACCESS_TOKEN_SECRET || 'dev-secret-change';
    const TWO_YEARS_MS = 1000 * 60 * 60 * 24 * 730;
    const ACCESS_TOKEN_TTL_SEC = 60 * 15; // 15 minutes
    // Dynamic CORS (replace with explicit allowlist in production)
    const origin = request.headers.get('Origin');
    const corsHeaders = {
      // Access-Control-Allow-Origin must reflect the exact origin when credentials are used.
      // Only set it if an Origin header is present; do NOT fall back to '*'.
      'Vary': 'Origin',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    if (origin) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    }
    const pathname = url.pathname.replace(/\/+$/, '');

    if (request.method === 'OPTIONS') {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Utility helpers
    const generateToken = (length = 32) => {
      const bytes = crypto.getRandomValues(new Uint8Array(length));
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    };
    async function hashToken(raw) {
      const enc = new TextEncoder().encode(raw);
      const digest = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const textB64 = (txt) => btoa(txt).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    async function signAccess(userId, username){
      const header = { alg:'HS256', typ:'JWT' };
      const exp = Math.floor(Date.now()/1000) + ACCESS_TOKEN_TTL_SEC;
      const payload = { sub:userId, username, exp };
      const h = textB64(JSON.stringify(header));
      const p = textB64(JSON.stringify(payload));
      const data = `${h}.${p}`;
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(ACCESS_SECRET), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
      const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
      return `${data}.${b64url(sigBuf)}`;
    }
    async function verifyAccess(token){
      if(!token) return null;
      const [h,p,s] = token.split('.');
      if(!s) return null;
      try {
        const data = `${h}.${p}`;
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(ACCESS_SECRET), { name:'HMAC', hash:'SHA-256' }, false, ['verify']);
        const sig = Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
        const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
        if(!ok) return null;
        const payload = JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
        if(payload.exp < Math.floor(Date.now()/1000)) return null;
        return payload;
      } catch { return null; }
    }
    async function issueRefresh(userId, ua){
      const raw = generateToken(32);
      const hash = await hashToken(raw);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TWO_YEARS_MS).toISOString();
      await DB.prepare('INSERT INTO refresh_tokens (user_id, token_hash, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)')
        .bind(userId, hash, now.toISOString(), expiresAt, ua||'')
        .run();
      return raw;
    }
    async function rotateRefresh(oldRaw, ua){
      const oldHash = await hashToken(oldRaw);
      const rec = await DB.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').bind(oldHash).first();
      if(!rec) return null;
      if(new Date(rec.expires_at).getTime() < Date.now()) {
        await DB.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(rec.id).run();
        return null;
      }
      await DB.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(rec.id).run();
      const newToken = await issueRefresh(rec.user_id, ua);
      return { userId: rec.user_id, token: newToken };
    }
    async function revokeRefresh(raw){
      const h = await hashToken(raw);
      await DB.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(h).run();
    }

    // Parse cookie helper
    const parseCookie = (name) => {
      const cookie = request.headers.get('Cookie') || '';
      const m = cookie.match(new RegExp('(?:^|; )'+name+'=([^;]+)'));
      return m ? decodeURIComponent(m[1]) : null;
    };

    // Auth guard wrapper
    async function requireAuth() {
      const auth = request.headers.get('Authorization')||'';
      const token = auth.startsWith('Bearer ')? auth.slice(7): null;
      const payload = await verifyAccess(token);
      return payload;
    }

    // LOGIN
    if (request.method === 'POST' && pathname === '/login') {
      let { username, password, remember } = await request.json();
      if(!username || !password) return new Response('Missing username or password', { status:400, headers: corsHeaders });
      username = username.toLowerCase();
      const user = await DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      if(!user) return new Response('Invalid credentials', { status:401, headers: corsHeaders });
      const [saltHex, hashHex] = user.password_hash.split(':');
      const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(b=>parseInt(b,16)));
      const pwKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      const hashBuf = await crypto.subtle.deriveBits({ name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' }, pwKey, 256);
      const inputHash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(inputHash !== hashHex) return new Response('Invalid credentials', { status:401, headers: corsHeaders });
      const access = await signAccess(user.id, username);
      let setCookie;
      if (remember) {
        const rt = await issueRefresh(user.id, request.headers.get('User-Agent'));
        setCookie = `refresh_token=${rt}; Max-Age=${Math.floor(TWO_YEARS_MS/1000)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
      }
      const headers = { ...corsHeaders, 'Content-Type':'application/json' };
      if (setCookie) headers['Set-Cookie'] = setCookie;
      return new Response(JSON.stringify({ message:'Login successful', accessToken: access, username, expiresIn: ACCESS_TOKEN_TTL_SEC }), { status:200, headers });
    }

    // REFRESH
    if (request.method === 'POST' && pathname === '/refresh') {
      const old = parseCookie('refresh_token');
      if(!old) return new Response(JSON.stringify({ error:'Missing refresh token cookie' }), { status:400, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      const rotated = await rotateRefresh(old, request.headers.get('User-Agent'));
      if(!rotated) return new Response(JSON.stringify({ error:'Invalid or expired refresh token' }), { status:401, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      const userRow = await DB.prepare('SELECT username FROM users WHERE id = ?').bind(rotated.userId).first();
      const access = await signAccess(rotated.userId, userRow.username);
      const setCookie = `refresh_token=${rotated.token}; Max-Age=${Math.floor(TWO_YEARS_MS/1000)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
      return new Response(JSON.stringify({ message:'Refreshed', accessToken: access, username: userRow.username, expiresIn: ACCESS_TOKEN_TTL_SEC }), { status:200, headers:{ ...corsHeaders, 'Content-Type':'application/json', 'Set-Cookie': setCookie } });
    }

    // LOGOUT
    if (request.method === 'POST' && pathname === '/logout') {
      const old = parseCookie('refresh_token');
      if (old) await revokeRefresh(old);
      return new Response(JSON.stringify({ message:'Logged out' }), { status:200, headers:{ ...corsHeaders, 'Content-Type':'application/json', 'Set-Cookie':'refresh_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax' } });
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

    // PROTECTED ROUTES BELOW
    // /measurements GET (auth)
    if (request.method === 'GET' && pathname === '/measurements') {
      const payload = await requireAuth();
      if(!payload) return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      const measurements = await DB.prepare('SELECT id, systolic, diastolic, heart_rate, timestamp FROM measurements WHERE user_id = ? ORDER BY timestamp DESC').bind(payload.sub).all();
      return new Response(JSON.stringify(measurements.results), { status:200, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
    }

    if (request.method === 'POST' && pathname === '/measurements') {
      const payload = await requireAuth();
      if(!payload) return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      let { systolic, diastolic, heart_rate, timestamp } = await request.json();
      if(!systolic || !diastolic || !heart_rate) return new Response(JSON.stringify({ error:'Missing data' }), { status:400, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      const storeTimestamp = timestamp || new Date().toISOString();
      await DB.prepare('INSERT INTO measurements (user_id, systolic, diastolic, heart_rate, timestamp) VALUES (?, ?, ?, ?, ?)').bind(payload.sub, systolic, diastolic, heart_rate, storeTimestamp).run();
      return new Response(JSON.stringify({ message:'Measurement stored' }), { status:201, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
    }

    if (request.method === 'DELETE' && pathname === '/measurements') {
      const payload = await requireAuth();
      if(!payload) return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      let { id } = await request.json();
      if(!id) return new Response(JSON.stringify({ error:'Missing id' }), { status:400, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      const result = await DB.prepare('DELETE FROM measurements WHERE id = ? AND user_id = ?').bind(id, payload.sub).run();
      if(result.changes === 0) return new Response(JSON.stringify({ error:'Measurement not found or not deleted' }), { status:404, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
      return new Response(JSON.stringify({ message:'Measurements deleted' }), { status:200, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
    }

    if (request.method === 'GET' && pathname === '/average') {
      const payload = await requireAuth();
      if(!payload) return new Response('Unauthorized', { status:401, headers: corsHeaders });
      const result = await DB.prepare('SELECT AVG(systolic) AS avg_systolic, AVG(diastolic) AS avg_diastolic, AVG(heart_rate) AS avg_heart_rate FROM measurements WHERE user_id = ?').bind(payload.sub).first();
      return new Response(JSON.stringify(result), { status:200, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
    }

    if (request.method === 'GET' && pathname === '/export') {
      const payload = await requireAuth();
      if(!payload) return new Response('Unauthorized', { status:401, headers: corsHeaders });
      const measurements = await DB.prepare('SELECT systolic, diastolic, heart_rate, timestamp FROM measurements WHERE user_id = ? ORDER BY timestamp DESC').bind(payload.sub).all();
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

    return new Response(JSON.stringify({ message: 'Not found' }), { status:404, headers:{ ...corsHeaders, 'Content-Type':'application/json' } });
  }
}