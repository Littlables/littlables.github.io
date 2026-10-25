/**
 * User-facing descriptions for front-page spaces.
 * Shown on empty space pages and in the homepage editor (Interests tab).
 * English only for now; add translations as needed.
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  childcare:
    "News about raising children, parenting tips, family activities, child development, and kids' education and health.",
  animals:
    "News about animals, wildlife, pets, nature, conservation, and the natural world.",
  arts:
    "News about art, music, crafts, creativity, performances, and artistic expression — plus shows, sports, play, and food.",
  tech:
    "News about technology, artificial intelligence, gadgets, video games, and science discoveries.",
  world:
    "News from around the world — travel destinations, cultures, countries, and planet and weather events.",
  uplifting:
    "Positive news, inspiring stories, community kindness, celebrations, and heartwarming moments.",
  // 'all' intentionally has no description — it's the catch-all feed.
};

export function getCategoryDescription(category: string): string | null {
  return CATEGORY_DESCRIPTIONS[category] ?? null;
}
