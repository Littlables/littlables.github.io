/**
 * Interest keywords for Littlables.
 *
 * A cross-cutting keyword layer SEPARATE from display categories. Keywords are
 * never shown as categories in the nav or homepage sections — they exist for
 * classification and custom boards. Keep in sync with
 * cloudflare-worker/src/interest-keywords.mjs (ids, labels, icons).
 */
export interface InterestKeyword {
  id: string;
  label: string;
  icon: string;
}

export const INTEREST_KEYWORDS: InterestKeyword[] = [
  { id: 'space', label: 'Space', icon: '🚀' },
  { id: 'dinosaurs', label: 'Dinosaurs', icon: '🦕' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'food', label: 'Food', icon: '🍎' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'gardening', label: 'Gardening', icon: '🌱' },
  { id: 'ocean-life', label: 'Ocean Life', icon: '🐋' },
  { id: 'weather', label: 'Weather', icon: '🌤️' },
  { id: 'inventions', label: 'Inventions', icon: '💡' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'holidays', label: 'Holidays', icon: '🎄' },
];

export const INTEREST_KEYWORD_IDS = new Set(INTEREST_KEYWORDS.map((k) => k.id));

export function getInterestKeywordLabel(id: string): string {
  const found = INTEREST_KEYWORDS.find((k) => k.id === id);
  return found ? `${found.icon} ${found.label}` : id;
}
