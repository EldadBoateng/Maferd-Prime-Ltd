#!/usr/bin/env node
'use strict';

// Optional local backend. Static file:// use remains a demo mode without login.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const pbkdf2 = promisify(crypto.pbkdf2);

const ROOT = __dirname;
const AUTH_PATH = path.join(ROOT, 'auth.json');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const publicFiles = new Set(['login.html', 'login.css', 'login.js']);
const protectedFiles = new Set(['index.html', 'style.css', 'script.js']);
const mimeTypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));

function sendJson(res, status, value, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extraHeaders });
  res.end(JSON.stringify(value));
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('='); return [part.slice(0,index), decodeURIComponent(part.slice(index+1))];
  }));
}
function currentSession(req) {
  const token = cookies(req).motiv_session;
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expires <= Date.now()) { sessions.delete(token); return null; }
  session.expires = Date.now() + SESSION_TTL_MS;
  return { token, session };
}
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function attemptState(ip) {
  const now = Date.now();
  const state = loginAttempts.get(ip) || { count:0, until:now + 15 * 60 * 1000 };
  if (state.until <= now) { state.count = 0; state.until = now + 15 * 60 * 1000; }
  return state;
}
async function readJson(req, limit = 8192) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error('Request too large');
  }
  return JSON.parse(body || '{}');
}
function setSessionCookie(res, token, secure) {
  const flags = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS/1000}${secure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', `motiv_session=${encodeURIComponent(token)}; ${flags}`);
}
function clearSessionCookie(res, secure) {
  res.setHeader('Set-Cookie', `motiv_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}
function sendFile(res, file) {
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type':mimeTypes[ext], 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const secure = Boolean(req.socket.encrypted) || req.headers['x-forwarded-proto'] === 'https';
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname); }
  catch { return sendJson(res, 400, { error:'Invalid request URL' }); }

  if (pathname === '/api/session' && req.method === 'GET') {
    const active = currentSession(req);
    return sendJson(res, 200, active ? { authenticated:true, username:active.session.username } : { authenticated:false });
  }
  if (pathname === '/api/login' && req.method === 'POST') {
    if (!originAllowed(req)) return sendJson(res, 403, { error:'Request origin not allowed' });
    const ip = req.socket.remoteAddress || 'unknown';
    const attempts = attemptState(ip);
    if (attempts.count >= 8) return sendJson(res, 429, { error:'Too many sign-in attempts. Try again in 15 minutes.' }, { 'Retry-After':'900' });
    let input;
    try { input = await readJson(req); } catch { attempts.count += 1; loginAttempts.set(ip, attempts); return sendJson(res, 400, { error:'Invalid sign-in request' }); }
    const username = typeof input.username === 'string' ? input.username.slice(0,80) : '';
    const password = typeof input.password === 'string' ? input.password.slice(0,256) : '';
    const candidate = await pbkdf2(password, Buffer.from(auth.salt,'hex'), auth.iterations, 32, 'sha256');
    const passwordMatches = crypto.timingSafeEqual(candidate, Buffer.from(auth.passwordHash,'hex'));
    const valid = username.toLowerCase() === auth.username.toLowerCase() && password.length > 0 && passwordMatches;
    if (!valid) {
      attempts.count += 1; loginAttempts.set(ip, attempts);
      return sendJson(res, 401, { error:'Username or password is incorrect' });
    }
    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { username:auth.username, expires:Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, token, secure);
    return sendJson(res, 200, { authenticated:true, username:auth.username });
  }
  if (pathname === '/api/logout' && req.method === 'POST') {
    if (!originAllowed(req)) return sendJson(res, 403, { error:'Request origin not allowed' });
    const active = currentSession(req);
    if (active) sessions.delete(active.token);
    clearSessionCookie(res, secure);
    return sendJson(res, 200, { authenticated:false });
  }
  if (pathname.startsWith('/api/')) return sendJson(res, 404, { error:'Not found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error:'Method not allowed' }, { Allow:'GET, HEAD' });

  const basename = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (publicFiles.has(basename)) return sendFile(res, path.join(ROOT, basename));
  if (!protectedFiles.has(basename)) return sendJson(res, 404, { error:'Not found' });
  if (!currentSession(req)) {
    res.writeHead(302, { Location:'/login.html', 'Cache-Control':'no-store' });
    return res.end();
  }
  return sendFile(res, path.join(ROOT, basename));
});

server.listen(PORT, HOST, () => {
  console.log(`Motiv local server listening at http://${HOST}:${PORT}`);
  console.log('Sign in with the administrator username configured in auth.json.');
  console.log('Use Ctrl+C to stop the local server.');
});

for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
