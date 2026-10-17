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
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export async function getAdminIdentity(request, env) {
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

export function isSameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
