/**
 * Interest keywords for Littlables (100 total).
 *
 * A cross-cutting keyword layer SEPARATE from display categories. Keywords are
 * never shown as categories in the nav or homepage sections — they exist for:
 *   1. Classification: stories are auto-tagged via embedding similarity
 *      (see embedding-classifier.mjs) and can be hand-tagged in the admin panel.
 *   2. Custom boards: users build boards around keywords (e.g. a "Space" board).
 *
 * IDs are URL-safe slugs; labels are display names. `group` organizes the
 * admin/board pickers.
 *
 * Descriptions are embedding prompts written as "what kind of news story",
 * not bare noun lists — this keeps the matcher from firing on passing
 * mentions (e.g. "Musk" in a Starlink story should not tag ELECTRIC CARS).
 *
 * Bump KEYWORD_DESCRIPTIONS_VERSION whenever descriptions change: stored
 * vectors in `keyword_embeddings` are keyed by version and recomputed.
 */

export const KEYWORD_DESCRIPTIONS_VERSION = 2;

export const INTEREST_KEYWORDS = Object.freeze([
  // ---- Animals & Nature ----
  { id: 'ocean-life', label: 'Ocean Life', icon: '🐋', group: 'Animals & Nature', description: 'stories about ocean animals and sea life: whales, dolphins, sharks, coral reefs, tide pools, marine biology discoveries' },
  { id: 'pets', label: 'Pets', icon: '🐶', group: 'Animals & Nature', description: 'pet ownership stories: dogs, cats, puppies, kittens, pet care tips, funny pet moments, adopting pets' },
  { id: 'wildlife', label: 'Wildlife', icon: '🦁', group: 'Animals & Nature', description: 'wild animals in nature: safaris, lions, elephants, national parks, wildlife photography, animal behavior' },
  { id: 'birds', label: 'Birds', icon: '🐦', group: 'Animals & Nature', description: 'bird stories: parrots, owls, eagles, penguins, birdwatching, migration, nests and baby birds' },
  { id: 'bugs', label: 'Bugs & Insects', icon: '🐛', group: 'Animals & Nature', description: 'insect stories: butterflies, bees, ants, spiders, how insects live, bug discoveries' },
  { id: 'farm-animals', label: 'Farm Animals', icon: '🐄', group: 'Animals & Nature', description: 'farm life stories: cows, horses, pigs, chickens, goats, barns, farmers and their animals' },
  { id: 'zoos', label: 'Zoos & Aquariums', icon: '🦒', group: 'Animals & Nature', description: 'zoo and aquarium news: new animal babies, exhibits, zookeepers, safari parks' },
  { id: 'animal-rescues', label: 'Animal Rescues', icon: '🐾', group: 'Animals & Nature', description: 'animal rescue stories: shelters, adoptions, saving injured animals, heartwarming rescues' },
  { id: 'forests', label: 'Forests', icon: '🌲', group: 'Animals & Nature', description: 'forest stories: woods, hiking trails, forest animals, camping in the forest' },
  { id: 'mountains', label: 'Mountains', icon: '⛰️', group: 'Animals & Nature', description: 'mountain stories: climbing, peaks, hiking, mountain views and adventures' },
  { id: 'beaches', label: 'Beaches', icon: '🏖️', group: 'Animals & Nature', description: 'beach day stories: sand, seashells, tides, seaside fun, sandcastles' },
  { id: 'deserts', label: 'Deserts', icon: '🏜️', group: 'Animals & Nature', description: 'desert stories: cacti, camels, sand dunes, desert animals, oasis' },
  { id: 'rainforests', label: 'Rainforests', icon: '🌴', group: 'Animals & Nature', description: 'rainforest stories: jungles, tropical wildlife, canopy, conservation' },
  { id: 'endangered-species', label: 'Endangered Species', icon: '🦏', group: 'Animals & Nature', description: 'conservation news: endangered animals, protection efforts, saving species from extinction' },

  // ---- Science & Discovery ----
  { id: 'space', label: 'Space', icon: '🚀', group: 'Science & Discovery', description: 'outer space exploration: NASA missions, rockets launching, astronauts living in space, astronomy, distant planets and stars' },
  { id: 'dinosaurs', label: 'Dinosaurs', icon: '🦕', group: 'Science & Discovery', description: 'dinosaur discoveries: fossils, paleontology, T. rex, prehistoric creatures, extinction' },
  { id: 'science', label: 'Science', icon: '🔬', group: 'Science & Discovery', description: 'science news: new discoveries, research studies, how things work, scientists at work' },
  { id: 'robots-ai', label: 'Robots & AI', icon: '🤖', group: 'Science & Discovery', description: 'robotics and artificial intelligence: robots doing jobs, AI tools, how AI works' },
  { id: 'inventions', label: 'Inventions', icon: '💡', group: 'Science & Discovery', description: 'new inventions: inventors, clever gadgets, patents, creative problem-solving' },
  { id: 'volcanoes', label: 'Volcanoes', icon: '🌋', group: 'Science & Discovery', description: 'volcano stories: eruptions, lava flows, volcanic islands, how volcanoes work' },
  { id: 'natural-disasters', label: 'Natural Disasters', icon: '⛈️', group: 'Science & Discovery', description: 'severe weather and disaster news: hurricanes, floods, storms, emergency preparedness, staying safe' },
  { id: 'human-body', label: 'Human Body', icon: '🧠', group: 'Science & Discovery', description: 'how the body works: brain, heart, bones, muscles, senses, health science for kids' },
  { id: 'energy', label: 'Energy', icon: '⚡', group: 'Science & Discovery', description: 'energy stories: solar panels, wind turbines, electricity, renewable power' },
  { id: 'experiments', label: 'Experiments', icon: '🧪', group: 'Science & Discovery', description: 'hands-on science: experiments to try, science fair projects, chemistry reactions' },
  { id: 'moon', label: 'The Moon', icon: '🌙', group: 'Science & Discovery', description: 'the Moon: lunar missions, moon landings, moon phases, astronauts walking on the Moon' },
  { id: 'planets', label: 'Planets', icon: '🪐', group: 'Science & Discovery', description: 'planet stories: the solar system, Jupiter, Saturn, Mars rovers, distant exoplanets' },

  // ---- Kids & Family ----
  { id: 'parenting', label: 'Parenting', icon: '👨‍👩‍👧', group: 'Kids & Family', description: 'parenting advice: raising babies and kids, parenting tips, family routines' },
  { id: 'education', label: 'Education', icon: '🎓', group: 'Kids & Family', description: 'school and learning: teachers, classrooms, homework help, studying tips, school news' },
  { id: 'kids-crafts', label: 'Kids Crafts', icon: '🎨', group: 'Kids & Family', description: 'craft projects for kids: DIY art, coloring, building things, creative rainy-day activities' },
  { id: 'books', label: 'Books & Reading', icon: '📖', group: 'Kids & Family', description: 'reading and books: new children\'s books, authors, libraries, story time, book lists' },
  { id: 'babies', label: 'Babies', icon: '👶', group: 'Kids & Family', description: 'baby stories: newborns, first steps, baby milestones, infant care' },
  { id: 'toddlers', label: 'Toddlers', icon: '🧒', group: 'Kids & Family', description: 'toddler life: preschoolers, playtime, early learning, funny toddler moments' },
  { id: 'bedtime-stories', label: 'Bedtime Stories', icon: '✨', group: 'Kids & Family', description: 'bedtime reading: goodnight books, bedtime routines, calming stories before sleep' },
  { id: 'fairy-tales', label: 'Fairy Tales', icon: '🏰', group: 'Kids & Family', description: 'fairy tale stories: princesses, dragons, castles, magic kingdoms, classic tales retold' },
  { id: 'superheroes', label: 'Superheroes', icon: '🦸', group: 'Kids & Family', description: 'superhero stories: heroes with powers, comic heroes, saving the day' },
  { id: 'playgrounds', label: 'Playgrounds', icon: '🛝', group: 'Kids & Family', description: 'playground fun: slides, swings, parks, new playgrounds opening' },
  { id: 'birthday-parties', label: 'Birthday Parties', icon: '🎂', group: 'Kids & Family', description: 'birthday celebrations: parties, cake, presents, party games and themes' },
  { id: 'summer-camp', label: 'Summer Camp', icon: '🔥', group: 'Kids & Family', description: 'camp stories: summer camp activities, campfires, cabins, making camp friends' },

  // ---- Food ----
  { id: 'food', label: 'Food', icon: '🍎', group: 'Food', description: 'food and cooking: recipes to try, restaurants, chefs, meals, snacks and treats' },
  { id: 'baking', label: 'Baking', icon: '🧁', group: 'Food', description: 'baking projects: cupcakes, cookies, cakes, ovens, frosting, bakeries' },
  { id: 'desserts', label: 'Desserts', icon: '🍦', group: 'Food', description: 'sweet treats: ice cream, candy, milkshakes, dessert recipes' },
  { id: 'fruits-veggies', label: 'Fruits & Veggies', icon: '🥦', group: 'Food', description: 'healthy eating: fruits, vegetables, farms, harvests, farmers markets' },
  { id: 'pizza', label: 'Pizza', icon: '🍕', group: 'Food', description: 'pizza stories: pizzerias, pizza-making, pizza night' },
  { id: 'breakfast', label: 'Breakfast', icon: '🥞', group: 'Food', description: 'morning meals: pancakes, cereal, waffles, breakfast recipes' },
  { id: 'chocolate', label: 'Chocolate', icon: '🍫', group: 'Food', description: 'chocolate stories: cocoa, candy-making, chocolate factories' },
  { id: 'picnics', label: 'Picnics', icon: '🧺', group: 'Food', description: 'outdoor eating: picnics, lunchboxes, packed lunches' },

  // ---- Sports & Play ----
  { id: 'sports', label: 'Sports', icon: '⚽', group: 'Sports & Play', description: 'youth and pro sports: soccer, basketball, baseball games, athletes, competitions, team spirit' },
  { id: 'swimming', label: 'Swimming', icon: '🏊', group: 'Sports & Play', description: 'swimming stories: pools, swim lessons, swim teams, water safety' },
  { id: 'gymnastics', label: 'Gymnastics', icon: '🤸', group: 'Sports & Play', description: 'gymnastics: tumbling, balance beams, flips, gymnasts competing' },
  { id: 'dance', label: 'Dance', icon: '💃', group: 'Sports & Play', description: 'dance stories: ballet, hip hop, recitals, dance classes and performances' },
  { id: 'martial-arts', label: 'Martial Arts', icon: '🥋', group: 'Sports & Play', description: 'martial arts training: karate, taekwondo, discipline, belt tests' },
  { id: 'olympics', label: 'Olympics', icon: '🏅', group: 'Sports & Play', description: 'Olympic games: gold medals, world records, athletes competing for their countries' },
  { id: 'biking', label: 'Biking', icon: '🚲', group: 'Sports & Play', description: 'cycling stories: bike rides, bike trails, learning to ride, bike safety' },
  { id: 'skateboarding', label: 'Skateboarding', icon: '🛹', group: 'Sports & Play', description: 'skateboarding: skate parks, tricks, scooters' },
  { id: 'hiking', label: 'Hiking', icon: '🥾', group: 'Sports & Play', description: 'hiking adventures: trails, backpacks, nature walks, scenic viewpoints' },
  { id: 'fishing', label: 'Fishing', icon: '🎣', group: 'Sports & Play', description: 'fishing trips: lakes, boats, catching fish, fishing with family' },

  // ---- Arts & Music ----
  { id: 'music', label: 'Music', icon: '🎵', group: 'Arts & Music', description: 'music stories: songs, concerts, bands, learning instruments, piano, guitar, young musicians' },
  { id: 'painting', label: 'Painting', icon: '🖌️', group: 'Arts & Music', description: 'painting and art: watercolors, famous paintings, artists, art projects' },
  { id: 'drawing', label: 'Drawing', icon: '✏️', group: 'Arts & Music', description: 'drawing: sketching, cartoons, doodles, learn-to-draw guides' },
  { id: 'theater', label: 'Theater', icon: '🎭', group: 'Arts & Music', description: 'theater and plays: acting, school plays, musicals, stage performances' },
  { id: 'magic', label: 'Magic', icon: '🪄', group: 'Arts & Music', description: 'magic tricks: magicians, illusions, learn-a-trick guides, magic shows' },
  { id: 'lego', label: 'LEGO & Building', icon: '🧱', group: 'Arts & Music', description: 'LEGO building: new sets, building challenges, creative constructions' },
  { id: 'photography', label: 'Photography', icon: '📸', group: 'Arts & Music', description: 'photography: cameras, taking great pictures, photo tips for kids' },

  // ---- Tech & Games ----
  { id: 'video-games', label: 'Video Games', icon: '🎮', group: 'Tech & Games', description: 'video game news: new game releases, Minecraft, Nintendo, gaming tips, kid-friendly games' },
  { id: 'coding', label: 'Coding', icon: '💻', group: 'Tech & Games', description: 'learning to code: programming for kids, Scratch, building apps and games' },
  { id: 'apps', label: 'Apps', icon: '📱', group: 'Tech & Games', description: 'app news: educational apps, tablets, phones, screen-time tips for families' },
  { id: 'internet-safety', label: 'Internet Safety', icon: '🛡️', group: 'Tech & Games', description: 'staying safe online: passwords, cyberbullying prevention, kind online behavior, privacy for kids' },
  { id: 'virtual-reality', label: 'Virtual Reality', icon: '🥽', group: 'Tech & Games', description: 'VR experiences: virtual reality headsets, immersive games and tours' },
  { id: 'drones', label: 'Drones', icon: '🛸', group: 'Tech & Games', description: 'drone stories: flying drones, aerial photos, how drones work' },
  { id: 'electric-cars', label: 'Electric Cars', icon: '🚗', group: 'Tech & Games', description: 'electric vehicles families can buy: EV reviews, charging stations, battery range, going electric' },
  { id: 'board-games', label: 'Board Games', icon: '🎲', group: 'Tech & Games', description: 'tabletop games: board games, card games, puzzles, family game night ideas, chess' },

  // ---- Shows & Fun ----
  { id: 'family-movies', label: 'Family Movies', icon: '🎬', group: 'Shows & Fun', description: 'family film news: new animated movies, Disney, Pixar, movie night picks' },
  { id: 'tv-shows', label: 'TV Shows', icon: '📺', group: 'Shows & Fun', description: 'kids\' TV: new shows, cartoons, episodes, what to watch streaming' },
  { id: 'comics', label: 'Comics', icon: '💬', group: 'Shows & Fun', description: 'comics and graphic novels: manga, comic books, visual storytelling' },
  { id: 'theme-parks', label: 'Theme Parks', icon: '🎢', group: 'Shows & Fun', description: 'theme park news: new rides, Disney World, roller coasters, planning a park visit' },
  { id: 'circus', label: 'Circus', icon: '🎪', group: 'Shows & Fun', description: 'circus performances: acrobats, clowns, big-top shows' },

  // ---- Planet & Weather ----
  { id: 'weather', label: 'Weather', icon: '🌤️', group: 'Planet & Weather', description: 'weather stories: forecasts, rain, snow, storms, seasons, tornadoes, weather science' },
  { id: 'environment', label: 'Environment', icon: '🌍', group: 'Planet & Weather', description: 'planet protection: conservation, recycling, climate action, pollution cleanup, Earth Day' },
  { id: 'gardening', label: 'Gardening', icon: '🌱', group: 'Planet & Weather', description: 'gardening with kids: planting seeds, growing vegetables, flowers, garden projects' },
  { id: 'flowers', label: 'Flowers', icon: '🌸', group: 'Planet & Weather', description: 'flower stories: bouquets, blossoms, gardens in bloom, wildflowers' },
  { id: 'seasons', label: 'Seasons', icon: '🍂', group: 'Planet & Weather', description: 'seasonal changes: autumn leaves, first snow, spring blooms, how seasons work' },
  { id: 'snow', label: 'Snow', icon: '❄️', group: 'Planet & Weather', description: 'snow day fun: snowmen, sledding, snowflakes, winter storms' },
  { id: 'clouds', label: 'Clouds', icon: '☁️', group: 'Planet & Weather', description: 'cloud watching: cloud shapes, types of clouds, sky science' },

  // ---- Travel & Places ----
  { id: 'travel', label: 'Travel', icon: '✈️', group: 'Travel & Places', description: 'family travel: vacations, airplanes, hotels, tourist attractions, trip planning' },
  { id: 'camping', label: 'Camping', icon: '🏕️', group: 'Travel & Places', description: 'camping trips: tents, campfires, campgrounds, sleeping under the stars' },
  { id: 'road-trips', label: 'Road Trips', icon: '🚙', group: 'Travel & Places', description: 'road trip stories: car rides, highways, rest stops, scenic drives' },
  { id: 'landmarks', label: 'Landmarks', icon: '🗽', group: 'Travel & Places', description: 'famous places: monuments, statues, world wonders, visiting landmarks' },
  { id: 'maps', label: 'Maps', icon: '🗺️', group: 'Travel & Places', description: 'maps and geography: atlases, learning countries, how maps work' },
  { id: 'languages', label: 'Languages', icon: '🗣️', group: 'Travel & Places', description: 'learning languages: new words, bilingual kids, Spanish, French' },

  // ---- Holidays ----
  { id: 'holidays', label: 'Holidays', icon: '🎄', group: 'Holidays', description: 'holiday celebrations: traditions, festivals, family gatherings' },
  { id: 'christmas', label: 'Christmas', icon: '🎅', group: 'Holidays', description: 'Christmas stories: Santa, gifts, trees, holiday spirit, Christmas morning' },
  { id: 'halloween', label: 'Halloween', icon: '🎃', group: 'Holidays', description: 'Halloween fun: costumes, trick-or-treating, pumpkins, spooky (not scary) stories' },
  { id: 'easter', label: 'Easter', icon: '🐰', group: 'Holidays', description: 'Easter: egg hunts, bunnies, spring celebrations' },
  { id: 'thanksgiving', label: 'Thanksgiving', icon: '🦃', group: 'Holidays', description: 'Thanksgiving: turkey dinner, gratitude, family feasts' },
  { id: 'new-year', label: 'New Year', icon: '🎆', group: 'Holidays', description: 'New Year: fireworks, resolutions, countdowns, fresh starts' },

  // ---- Community & Life ----
  { id: 'community-heroes', label: 'Community Heroes', icon: '🤝', group: 'Community & Life', description: 'local heroes: neighbors helping neighbors, volunteers, acts of kindness, community projects' },
  { id: 'health', label: 'Health', icon: '🩺', group: 'Community & Life', description: 'health news: doctors, wellness, exercise, nutrition, how to stay healthy' },
  { id: 'money', label: 'Money & Saving', icon: '💰', group: 'Community & Life', description: 'money skills: saving, allowance, kid entrepreneurs, how money works' },
  { id: 'history', label: 'History', icon: '🏛️', group: 'Community & Life', description: 'history stories: past eras, ancient civilizations, museums, historical anniversaries' },
  { id: 'volunteering', label: 'Volunteering', icon: '💝', group: 'Community & Life', description: 'giving back: volunteering, charity drives, fundraisers, helping causes' },
]);

export const INTEREST_KEYWORD_IDS = new Set(INTEREST_KEYWORDS.map((k) => k.id));

/** Ordered group names for picker sections. */
export const INTEREST_KEYWORD_GROUPS = Object.freeze(
  [...new Set(INTEREST_KEYWORDS.map((k) => k.group))]
);

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
