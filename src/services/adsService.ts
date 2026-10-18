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
  cta?: string;
  category?: string;
}

const adCache: Partial<Record<NewsCategory, AdItem[]>> = {};

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function formatProductAd(raw: RawProductAd, category: NewsCategory, defaultIndex: number): AdItem {
  const title = raw.name || raw.title || "Curated Discovery";
  const desc = raw.description || raw.desc || "A handpicked resource tailored to your interests.";
  const img = raw.thumbnailUrl || raw.img || `img/${category}_${(defaultIndex % 10) + 1}.jpg`;
  const sponsor = raw.sellerName || raw.sponsor || "Featured Partner";
  const url = raw.url || "#";
  const price = raw.priceUsd != null && raw.priceUsd > 0
    ? `$${raw.priceUsd}`
    : (raw.priceCents != null && raw.priceCents > 0
      ? `$${(raw.priceCents / 100).toFixed(2)}`
      : 'Free');
  const cta = raw.cta || (price === 'Free' ? 'Explore Free →' : `Get for ${price} →`);

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
    // Return a newly shuffled copy each time to ensure unbiased random presentation
    return shuffleArray(adCache[category]!);
  }

  const lookupPaths = [
    `ads/${category}.json`,
    `/ads/${category}.json`,
    `./ads/${category}.json`,
    `ads/all.json`,
    `/ads/all.json`
  ];

  let rawAds: RawProductAd[] = [];

  // 1. Load Gumroad products for category
  for (const path of lookupPaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data: RawProductAd[] = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          rawAds = data;
          break;
        }
      }
    } catch {
      // Try next path
    }
  }

  // 2. Load Amazon search affiliate ads for category (5 searches per category with tag=littlables-20)
  const amazonPaths = ['ads/amazon.json', '/ads/amazon.json', './ads/amazon.json'];
  for (const aPath of amazonPaths) {
    try {
      const aResponse = await fetch(aPath);
      if (aResponse.ok) {
        const aData: RawProductAd[] = await aResponse.json();
        if (Array.isArray(aData) && aData.length > 0) {
          const categoryAmazonAds = aData.filter(ad => ad.category === category);
          if (categoryAmazonAds.length > 0) {
            rawAds = [...rawAds, ...categoryAmazonAds];
          }
          break;
        }
      }
    } catch {
      // Continue
    }
  }

  // 3. Load TikTok affiliate ads for Creative Arts and Future Tech & AI
  if (category === 'arts' || category === 'tech') {
    const tiktokPaths = ['ads/tiktok.json', '/ads/tiktok.json', './ads/tiktok.json'];
    for (const tPath of tiktokPaths) {
      try {
        const tResponse = await fetch(tPath);
        if (tResponse.ok) {
          const tData: RawProductAd[] = await tResponse.json();
          if (Array.isArray(tData) && tData.length > 0) {
            // Append TikTok ads into the pool
            rawAds = [...rawAds, ...tData];
            break;
          }
        }
      } catch {
        // Continue
      }
    }
  }

  if (rawAds.length > 0) {
    const parsed = rawAds.map((item, idx) => formatProductAd(item, category, idx));
    // Completely and randomly mix all the ads (Gumroad, Amazon, TikTok) together
    const mixed = shuffleArray(parsed);
    adCache[category] = mixed;
    return mixed;
  }

  // Fallback ad if none could be loaded
  return [
    {
      title: "Family Learning & Creative Discovery Set",
      desc: "Interactive educational printables, cozy activities, and sensory tools designed for mindful curious minds.",
      img: `img/${category}_1.jpg`,
      cta: "Explore Bundle →",
      sponsor: "Littlables Showcase",
      url: "#"
    }
  ];
}

export function getRandomAds(ads: AdItem[], count: number = 2): AdItem[] {
  if (!ads || !ads.length) return [];
  // Completely randomize and shuffle all ads for the category together
  const mixed = shuffleArray(ads);
  return mixed.slice(0, count);
}
