const SESSION_COOKIE = '__Host-littlables_admin';
const STATE_COOKIE = 'littlables_oauth_state';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

function cookieValue(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function sessionKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('GITHUB_SESSION_SECRET must be set to a random value of at least 32 characters');
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createAdminSessionCookie(login, secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    login,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })));
  const key = await sessionKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await key, encoder.encode(payload)));
  const token = `${payload}.${toBase64Url(signature)}`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${SESSION_SECONDS}`;
}

export async function getAdminIdentity(request, env) {
  // 1. Check Supabase site account Bearer token first (for inline frontend admin actions)
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ') && env?.SUPABASE_URL) {
    const accessToken = authHeader.slice('Bearer '.length).trim();
    if (accessToken) {
      try {
        const apiKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SECRET_KEY || 'sb_publishable_NNWeMzQK6GCcsAl4Ij1iiw_1sT0v44k';
        const userResp = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: apiKey,
          },
        });
        if (userResp.ok) {
          const user = await userResp.json();
          const email = String(user?.email || '').trim().toLowerCase();
          const configuredAdmins = String(env.ADMIN_EMAILS || 'katie.lyn.counts@gmail.com')
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          const isEmailAdmin = email && configuredAdmins.includes(email);
          const isMetaAdmin =
            user?.app_metadata?.role === 'admin' || user?.user_metadata?.is_admin === true;

          if (isEmailAdmin || isMetaAdmin) {
            return { login: email || user.id };
          }

          // Also check profiles table for is_admin / role === 'admin' / membership === 'admin'
          if (user?.id && env.SUPABASE_SECRET_KEY) {
            const profResp = await fetch(
              `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=username,is_admin,role,membership`,
              {
                headers: {
                  apikey: env.SUPABASE_SECRET_KEY,
                  Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
                },
              }
            );
            if (profResp.ok) {
              const rows = await profResp.json();
              const prof = Array.isArray(rows) ? rows[0] : null;
              if (prof && (prof.is_admin === true || prof.role === 'admin' || prof.membership === 'admin')) {
                return { login: prof.username || email || user.id };
              }
            }
          }
        }
      } catch {
        // Fall through to GitHub session cookie check
      }
    }
  }

  // 2. Fallback: GitHub OAuth session cookie (for standalone /admin dashboard)
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;
  try {
    const payload = token.slice(0, separator);
    const signature = fromBase64Url(token.slice(separator + 1));
    const key = await sessionKey(env.GITHUB_SESSION_SECRET);
    const valid = await crypto.subtle.verify('HMAC', await key, signature, encoder.encode(payload));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (
      typeof session.login !== 'string' ||
      !Number.isInteger(session.expiresAt) ||
      session.expiresAt <= Math.floor(Date.now() / 1000) ||
      session.login.toLowerCase() !== env.GITHUB_ALLOWED_USER?.toLowerCase()
    ) return null;
    return { login: session.login };
  } catch (error) {
    if (error instanceof Error && error.message.includes('GITHUB_SESSION_SECRET')) throw error;
    return null;
  }
}

export function createOAuthStateCookie(state) {
  return `${STATE_COOKIE}=${state}; Path=/admin/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function getOAuthState(request) {
  return cookieValue(request, STATE_COOKIE);
}

export function clearOAuthStateCookie() {
  return `${STATE_COOKIE}=; Path=/admin/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function clearAdminSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function createOAuthState() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function isAllowedFrontendOrigin(origin) {
  if (!origin) return false;
  const allowed = ['https://littlables.com', 'https://www.littlables.com', 'https://dev.littlables.com', 'http://localhost:5173', 'http://localhost:3000'];
  if (allowed.includes(origin)) return true;
  if (/^https:\/\/ais-(dev|pre)-[a-z0-9-]+\.run\.app$/i.test(origin)) return true;
  return false;
}

export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return true;
  return isAllowedFrontendOrigin(origin);
}

export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (isAllowedFrontendOrigin(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
  return {};
}
