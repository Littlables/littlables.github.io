import { NewsCategory, AdItem } from '../types';

interface RawProductAd {
  name?: string;
  title?: string;
  description?: string;
  desc?: string;
  thumbnailUrl?: string;
  img?: string;
  url?: string;
  sellerName?: string;
  sponsor?: string;
  priceUsd?: number;
  priceCents?: number;
  currency?: string;
}

const adCache: Partial<Record<NewsCategory, AdItem[]>> = {};

function formatProductAd(raw: RawProductAd, category: NewsCategory, defaultIndex: number): AdItem {
  const title = raw.name || raw.title || "Curated Discovery";
  const desc = raw.description || raw.desc || "A handpicked resource tailored to your interests.";
  const img = raw.thumbnailUrl || raw.img || `img/${category}_${(defaultIndex % 10) + 1}.jpg`;
  const sponsor = raw.sellerName || raw.sponsor || "Featured Creator";
  const url = raw.url || "#";
  const price = raw.priceUsd != null && raw.priceUsd > 0
    ? `$${raw.priceUsd}`
    : (raw.priceCents != null && raw.priceCents > 0
      ? `$${(raw.priceCents / 100).toFixed(2)}`
      : 'Free');
  const cta = price === 'Free' ? 'Explore Free →' : `Get for ${price} →`;

  return {
    title,
    desc,
    img,
    cta,
    sponsor,
    url
  };
}

export async function fetchAdsForCategory(category: NewsCategory): Promise<AdItem[]> {
  if (adCache[category] && adCache[category]!.length > 0) {
    return adCache[category]!;
  }

  const lookupPaths = [
    `ads/${category}.json`,
    `/ads/${category}.json`,
    `ads/all.json`,
    `/ads/all.json`
  ];

  for (const path of lookupPaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data: RawProductAd[] = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const parsed = data.map((item, idx) => formatProductAd(item, category, idx));
          adCache[category] = parsed;
          return parsed;
        }
      }
    } catch {
      // Try next path
    }
  }

  // Fallback ad if none could be loaded
  return [
    {
      title: "Family Learning & Creative Discovery Set",
      desc: "Interactive educational printables, cozy activities, and sensory tools designed for mindful curious minds.",
      img: `img/${category}_1.jpg`,
      cta: "Explore Bundle →",
      sponsor: "Littlables Showcase"
    }
  ];
}

export function getRandomAds(ads: AdItem[], count: number = 2): AdItem[] {
  if (!ads.length) return [];
  const shuffled = [...ads].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
