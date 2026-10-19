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

  const items = await adapter(config, category, market, {
    ...options,
    retryDelays: options.retryDelays || config.retryDelays,
    credentials
  });
  return { provider: providerId, items };
}
