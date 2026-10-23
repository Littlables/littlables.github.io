export type StandardNewsCategory = 'all' | 'childcare' | 'animals' | 'arts' | 'tech' | 'world' | 'uplifting';

export type NewsCategory = StandardNewsCategory | (string & {});

export type ThemeId = 'dark' | 'dark-purple' | 'light' | 'rainbow' | 'pastel-rainbow' | 'pink';

export type ReactionType = 'love' | 'mind' | 'cozy';

export interface NewsItem {
  title: string;
  link: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  thumbnail?: string;
  enclosure?: {
    link?: string;
  };
  description?: string;
  content?: string;
  aiSummary?: string;
  pubDate?: string;
  fetchedAt?: string;
  approved?: boolean;
  category?: NewsCategory;
  /** Admin-curated frontend category override. When set, the story displays under these categories instead of `category`. */
  displayCategories?: string[] | null;
  /** Interest keyword tags (cross-cutting, never shown as categories). */
  interestKeywords?: string[] | null;
  provider?: string;
  source?: string;
}

export interface AdItem {
  title: string;
  desc: string;
  img: string;
  cta: string;
  sponsor: string;
  url?: string;
  category?: string;
  /** Interest keyword ids this ad is relevant to (for keyword-based matching). */
  keywords?: string[];
}

export interface ReactionCounts {
  love: number | '—';
  mind: number | '—';
  cozy: number | '—';
}
