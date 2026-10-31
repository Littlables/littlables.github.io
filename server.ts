import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer, loadEnv } from 'vite';
import { SUPABASE_CONFIG } from './src/constants/config';

// Load local-only provider settings for the Node API, preserving shell/host values.
Object.assign(process.env, {
  ...loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''),
  ...process.env,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_LIL_QUERY_LENGTH = 500;
const LIL_RATE_LIMIT_WINDOW_MS = 60_000;
const LIL_RATE_LIMIT_MAX_REQUESTS = 15;
const lilRateLimitMap = new Map<string, number[]>();
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';

const DEFAULT_ADMIN_EMAILS = ['katie.lyn.counts@gmail.com'];
let lilRequestLogId = 0;

function logLilRequests(req: express.Request, res: express.Response, next: express.NextFunction) {
  const requestId = ++lilRequestLogId;
  const startedAt = Date.now();
  const requestPath = req.originalUrl;

  console.info(`[Lil API] -> #${requestId} ${req.method} ${requestPath}`);
  res.on('finish', () => {
    console.info(
      `[Lil API] <- #${requestId} ${req.method} ${requestPath} ${res.statusCode} (${Date.now() - startedAt}ms)`
    );
  });
  next();
}

function getAllowedAdminEmails(): Set<string> {
  const extra = String(process.env.VITE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS, ...extra]);
}

function checkLilRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (lilRateLimitMap.get(ip) || []).filter((ts) => now - ts < LIL_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= LIL_RATE_LIMIT_MAX_REQUESTS) {
    lilRateLimitMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  lilRateLimitMap.set(ip, recent);
  return true;
}

async function verifyAdminBearerToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const supabaseUrl = (process.env.SUPABASE_URL || SUPABASE_CONFIG.url || '').replace(/\/+$/, '');
  const apiKey = process.env.SUPABASE_ANON_KEY || SUPABASE_CONFIG.publishableKey || '';
  if (!supabaseUrl || !apiKey) return false;

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: apiKey,
      },
    });
    if (!userRes.ok) return false;
    const user: any = await userRes.json();
    if (!user || !user.id) return false;

    const email = String(user.email || '').trim().toLowerCase();
    const allowedEmails = getAllowedAdminEmails();
    if (
      user.app_metadata?.role === 'admin' ||
      user.user_metadata?.is_admin === true ||
      (email && allowedEmails.has(email))
    ) {
      return true;
    }

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=username,membership,is_admin`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
        },
      }
    );
    if (profileRes.ok) {
      const rows: any = await profileRes.json();
      const profile = Array.isArray(rows) ? rows[0] : null;
      if (
        profile &&
        (profile.is_admin === true || profile.membership === 'admin')
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const LIL_API_PORT = Number(process.env.LIL_API_PORT) || 3010;

  app.use(express.json({ limit: '16kb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'littlables' });
  });

  // Kept on the app server for local development. The dedicated listener below
  // exposes only this same admin-checked endpoint to the Cloudflare Tunnel.
  const lilSearchHandler = async (req: express.Request, res: express.Response) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    if (!checkLilRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many search requests. Please wait a minute and try again.' });
    }

    const isAdmin = await verifyAdminBearerToken(req.headers.authorization);
    if (!isAdmin) {
      return res.status(401).json({ error: 'Admin authentication is required to use Lil Search.' });
    }

    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Please provide a search question or topic.' });
    }

    const prompt = query.trim().slice(0, MAX_LIL_QUERY_LENGTH);
    const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
    const ollamaModel = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
    try {
      const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          stream: false,
          messages: [
            {
              role: 'system',
              content: "You are Lil, the friendly discovery guide at littlables. Give curious kids and families clear, accurate, age-appropriate answers. Use short headings and bullets when useful, explain unfamiliar ideas simply, and avoid frightening or inappropriate detail. You do not have live web access, so be clear when a question depends on recent news or changing facts; never invent current events or sources.",
            },
            { role: 'user', content: prompt },
          ],
          options: { temperature: 0.6 },
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!ollamaResponse.ok) {
        const detail = await ollamaResponse.text().catch(() => '');
        throw new Error(detail || `Ollama returned HTTP ${ollamaResponse.status}`);
      }

      const ollamaData: any = await ollamaResponse.json();
      const answer = String(ollamaData?.message?.content || '').trim();
      if (!answer) throw new Error('Ollama returned an empty answer.');

      return res.json({
        answer,
        searchQueries: [],
        sources: [],
        provider: 'ollama',
        model: ollamaData.model || ollamaModel,
        apiKeyNotice: 'Lil is running locally with Ollama. Answers are generated from the model and are not checked against live web sources.',
      });
    } catch (err: any) {
      const connectionHint = /fetch failed|ECONNREFUSED|ENOTFOUND|timed out|abort/i.test(String(err?.message || ''))
        ? `Could not reach Ollama at ${ollamaBaseUrl}. Start Ollama and make sure the ${ollamaModel} model is installed.`
        : `Ollama request failed: ${String(err?.message || 'Unknown error')}`;
      return res.status(503).json({ error: connectionHint });
    }
  };
  app.post('/api/lil/search', logLilRequests, lilSearchHandler);

  if (LIL_API_PORT === PORT) {
    throw new Error('LIL_API_PORT must be different from PORT');
  }
  const lilApi = express();
  lilApi.use(express.json({ limit: '16kb' }));
  lilApi.post('/api/lil/search', logLilRequests, lilSearchHandler);
  lilApi.listen(LIL_API_PORT, '127.0.0.1', () => {
    console.log(`Lil API listening on http://127.0.0.1:${LIL_API_PORT} (local tunnel target)`);
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Littlables server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
