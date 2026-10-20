export type NewsCategory = 'all' | 'childcare' | 'animals' | 'arts' | 'tech' | 'world' | 'uplifting';

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
  aiSummary?: string;
  pubDate?: string;
  fetchedAt?: string;
  approved?: boolean;
  category?: NewsCategory;
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
}

export interface ReactionCounts {
  love: number | '—';
  mind: number | '—';
  cozy: number | '—';
}
