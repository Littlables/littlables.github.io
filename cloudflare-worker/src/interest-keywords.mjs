/**
 * Interest keywords for Littlables.
 *
 * A cross-cutting keyword layer SEPARATE from display categories. Keywords are
 * never shown as categories in the nav or homepage sections — they exist for:
 *   1. Classification: stories are auto-tagged via embedding similarity
 *      (see embedding-classifier.mjs) and can be hand-tagged in the admin panel.
 *   2. Custom boards: users build boards around keywords (e.g. a "Space" board).
 *
 * IDs are URL-safe slugs; labels are display names.
 */

// Natural-language descriptions — embeddings capture meaning better from
// phrases than from bare IDs like "ocean-life".
export const INTEREST_KEYWORDS = Object.freeze([
  { id: 'space', label: 'Space', icon: '🚀', description: 'space, astronomy, planets, stars, galaxies, NASA, rockets, astronauts, moon, mars, telescopes' },
  { id: 'dinosaurs', label: 'Dinosaurs', icon: '🦕', description: 'dinosaurs, fossils, paleontology, prehistoric creatures, tyrannosaurus, triceratops, extinction' },
  { id: 'science', label: 'Science', icon: '🔬', description: 'science, scientific discovery, experiments, research, physics, chemistry, biology, scientists' },
  { id: 'food', label: 'Food', icon: '🍎', description: 'food, cooking, baking, recipes, restaurants, snacks, treats, meals, chefs, desserts' },
  { id: 'sports', label: 'Sports', icon: '⚽', description: 'sports, soccer, basketball, baseball, football, olympics, athletes, games, exercise, running' },
  { id: 'music', label: 'Music', icon: '🎵', description: 'music, songs, singing, instruments, bands, concerts, musicians, piano, guitar' },
  { id: 'gardening', label: 'Gardening', icon: '🌱', description: 'gardening, plants, flowers, growing vegetables, garden, seeds, trees, farming' },
  { id: 'ocean-life', label: 'Ocean Life', icon: '🐋', description: 'ocean life, marine animals, whales, dolphins, sharks, coral reefs, sea creatures, beaches, tide pools' },
  { id: 'weather', label: 'Weather', icon: '🌤️', description: 'weather, rain, snow, storms, hurricanes, climate, seasons, tornadoes, clouds, rainbow' },
  { id: 'inventions', label: 'Inventions', icon: '💡', description: 'inventions, inventors, new gadgets, patents, creative ideas, innovation, machines' },
  { id: 'travel', label: 'Travel', icon: '✈️', description: 'travel, vacations, airplanes, road trips, hotels, tourist attractions, exploring new places, camping' },
  { id: 'holidays', label: 'Holidays', icon: '🎄', description: 'holidays, christmas, halloween, thanksgiving, easter, celebrations, traditions, festivals, new year' },
]);

export const INTEREST_KEYWORD_IDS = new Set(INTEREST_KEYWORDS.map((k) => k.id));

/** Look up a keyword by id (case-insensitive). Returns the keyword object or null. */
export function getInterestKeyword(id) {
  if (typeof id !== 'string') return null;
  const needle = id.trim().toLowerCase();
  return INTEREST_KEYWORDS.find((k) => k.id === needle) || null;
}

/** True when the value is a known interest keyword id. */
export function isValidInterestKeyword(id) {
  return getInterestKeyword(id) !== null;
}

/**
 * Normalize a keyword list: lowercase ids, drop unknowns, dedupe.
 * Returns null when the result is empty (NULL = no keywords stored).
 */
export function normalizeInterestKeywords(keywords) {
  if (!Array.isArray(keywords)) return null;
  const seen = new Set();
  for (const raw of keywords) {
    const kw = getInterestKeyword(raw);
    if (kw) seen.add(kw.id);
  }
  return seen.size > 0 ? [...seen] : null;
}
