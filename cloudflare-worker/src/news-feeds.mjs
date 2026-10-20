import { fetchBing } from './feeds/bing.mjs';
import { fetchGNews } from './feeds/gnews.mjs';
import { fetchNewsData } from './feeds/newsdata.mjs';
import { fetchReddit } from './feeds/reddit.mjs';
import { fetchTheNewsApi } from './feeds/thenewsapi.mjs';
import { fetchWorldNewsApi } from './feeds/worldnewsapi.mjs';
import { getNewsProviderConfig, getNewsProviders } from './news-provider-config.mjs';

const PROVIDER_ADAPTERS = Object.freeze({
  bing: fetchBing,
  gnews: fetchGNews,
  newsdata: fetchNewsData,
  reddit: fetchReddit,
  thenewsapi: fetchTheNewsApi,
  worldnewsapi: fetchWorldNewsApi
});

export { getNewsProviders };

export async function getNewsFeed(providerId, category, market, options = {}) {
  const config = getNewsProviderConfig(providerId);
  const adapter = PROVIDER_ADAPTERS[config?.adapter];
  if (!config || !adapter) throw new Error(`Unknown news feed provider: ${providerId}`);

  const credentials = options.credentials || {};
  if (config.credential && !credentials[config.credential]) {
    throw new Error(`${config.label} API key is not configured. Set the ${config.credential} Worker secret.`);
  }

  const startedAt = Date.now();
  let lastHttpTelemetry = null;

  try {
    const items = await adapter(config, category, market, {
      ...options,
      retryDelays: options.retryDelays || config.retryDelays,
      credentials,
      onFetchTelemetry: (telemetry) => {
        lastHttpTelemetry = telemetry;
        options.onFetchTelemetry?.(telemetry);
      }
    });
    const durationMs = lastHttpTelemetry?.durationMs ?? (Date.now() - startedAt);
    const logEntry = {
      provider: providerId,
      providerLabel: config.label,
      category: category || 'all',
      market: market || 'en-US',
      status: 'succeeded',
      httpStatus: lastHttpTelemetry?.httpStatus ?? 200,
      durationMs,
      attemptCount: lastHttpTelemetry?.attemptCount ?? 1,
      itemsFetched: Array.isArray(items) ? items.length : 0,
      retryAfterSeconds: lastHttpTelemetry?.retryAfterSeconds ?? null,
      rateLimitRemaining: lastHttpTelemetry?.rateLimitRemaining ?? null,
      rateLimitReset: lastHttpTelemetry?.rateLimitReset ?? null,
      requestUrl: lastHttpTelemetry?.requestUrl || config.endpoint || '',
      errorMessage: null,
      createdAt: new Date().toISOString()
    };
    console.info(JSON.stringify({
      event: 'PROVIDER_FETCH',
      ...logEntry
    }));
    if (options.onFetchLog) {
      await options.onFetchLog(logEntry);
    }
    return { provider: providerId, items };
  } catch (err) {
    const durationMs = lastHttpTelemetry?.durationMs ?? err?.durationMs ?? (Date.now() - startedAt);
    const isRateLimit = Boolean(err?.isRateLimit || err?.status === 429);
    const logEntry = {
      provider: providerId,
      providerLabel: config.label,
      category: category || 'all',
      market: market || 'en-US',
      status: isRateLimit ? 'rate_limited' : 'failed',
      httpStatus: err?.status ?? lastHttpTelemetry?.httpStatus ?? null,
      durationMs,
      attemptCount: err?.attemptCount ?? lastHttpTelemetry?.attemptCount ?? 1,
      itemsFetched: 0,
      retryAfterSeconds: err?.retryAfterSeconds ?? lastHttpTelemetry?.retryAfterSeconds ?? null,
      rateLimitRemaining: err?.rateLimitRemaining ?? lastHttpTelemetry?.rateLimitRemaining ?? null,
      rateLimitReset: err?.rateLimitReset ?? lastHttpTelemetry?.rateLimitReset ?? null,
      requestUrl: err?.requestUrl || lastHttpTelemetry?.requestUrl || config.endpoint || '',
      errorMessage: err instanceof Error ? err.message : String(err),
      createdAt: new Date().toISOString()
    };
    console.error(JSON.stringify({
      event: isRateLimit ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_FETCH_ERROR',
      ...logEntry
    }));
    if (options.onFetchLog) {
      await options.onFetchLog(logEntry);
    }
    throw err;
  }
}

