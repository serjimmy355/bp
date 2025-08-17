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
    if (request.method === 'POST' && url.pathname === '/register') {
      const { username, password } = await request.json();
      if (!username || !password) {
        return new Response('Missing username or password', { status: 400 });
      }
      // Hash password
      const bcrypt = await import('bcryptjs');
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      try {
        await DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(username, hash).run();
        return new Response('User registered', { status: 201 });
      } catch (e) {
        return new Response('Username already exists', { status: 409 });
      }
    }
    if (request.method === 'POST' && url.pathname === '/login') {
      const { username, password } = await request.json();
      if (!username || !password) {
        return new Response('Missing username or password', { status: 400 });
      }
      const bcrypt = await import('bcryptjs');
      const user = await DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      if (!user) {
        return new Response('Invalid credentials', { status: 401 });
      }
      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        return new Response('Invalid credentials', { status: 401 });
      }
      // For simplicity, return success (JWT/session can be added later)
      return new Response('Login successful', { status: 200 });
    }
      // Store measurement
      if (request.method === 'POST' && url.pathname === '/measurements') {
        const { username, systolic, diastolic, heart_rate } = await request.json();
        if (!username || !systolic || !diastolic || !heart_rate) {
          return new Response('Missing data', { status: 400 });
        }
        const user = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (!user) {
          return new Response('User not found', { status: 404 });
        }
        const timestamp = new Date().toISOString();
        await DB.prepare('INSERT INTO measurements (user_id, systolic, diastolic, heart_rate, timestamp) VALUES (?, ?, ?, ?, ?)')
          .bind(user.id, systolic, diastolic, heart_rate, timestamp).run();
        return new Response('Measurement stored', { status: 201 });
      }
      // Calculate average blood pressure
      if (request.method === 'GET' && url.pathname === '/average') {
        const username = url.searchParams.get('username');
        if (!username) {
          return new Response('Missing username', { status: 400 });
        }
        const user = await DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (!user) {
          return new Response('User not found', { status: 404 });
        }
        const result = await DB.prepare('SELECT AVG(systolic) AS avg_systolic, AVG(diastolic) AS avg_diastolic FROM measurements WHERE user_id = ?')
          .bind(user.id).first();
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    return new Response('Hello World!');
  }
};