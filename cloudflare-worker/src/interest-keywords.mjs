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
 * admin/board pickers. Descriptions are embedding prompts — phrases, not bare IDs.
 *
 * Keyword vectors are computed once via Workers AI and persisted to the
 * `keyword_embeddings` Supabase table (see getKeywordEmbeddings), so the
 * 100 descriptions don't cost AI calls on every validation run.
 */

export const INTEREST_KEYWORDS = Object.freeze([
  // ---- Animals & Nature ----
  { id: 'ocean-life', label: 'Ocean Life', icon: '🐋', group: 'Animals & Nature', description: 'ocean life, marine animals, whales, dolphins, sharks, coral reefs, sea creatures, beaches, tide pools' },
  { id: 'pets', label: 'Pets', icon: '🐶', group: 'Animals & Nature', description: 'pets, dogs, cats, puppies, kittens, pet care, hamsters, rabbits, goldfish' },
  { id: 'wildlife', label: 'Wildlife', icon: '🦁', group: 'Animals & Nature', description: 'wildlife, safari, wild animals, lions, elephants, national parks, birdwatching' },
  { id: 'birds', label: 'Birds', icon: '🐦', group: 'Animals & Nature', description: 'birds, parrots, owls, eagles, penguins, birdwatching, nests, feathers, migration' },
  { id: 'bugs', label: 'Bugs & Insects', icon: '🐛', group: 'Animals & Nature', description: 'insects, bugs, butterflies, bees, ants, spiders, ladybugs, caterpillars' },
  { id: 'farm-animals', label: 'Farm Animals', icon: '🐄', group: 'Animals & Nature', description: 'farm animals, cows, horses, pigs, chickens, goats, sheep, barns, farms' },
  { id: 'zoos', label: 'Zoos & Aquariums', icon: '🦒', group: 'Animals & Nature', description: 'zoos, aquariums, safari parks, animal exhibits, zookeepers' },
  { id: 'animal-rescues', label: 'Animal Rescues', icon: '🐾', group: 'Animals & Nature', description: 'animal rescues, shelters, adoption, saving animals, foster pets, rescue stories' },
  { id: 'forests', label: 'Forests', icon: '🌲', group: 'Animals & Nature', description: 'forests, woods, trees, hiking trails, camping in the woods, forest animals' },
  { id: 'mountains', label: 'Mountains', icon: '⛰️', group: 'Animals & Nature', description: 'mountains, climbing, peaks, valleys, hiking, mountain views' },
  { id: 'beaches', label: 'Beaches', icon: '🏖️', group: 'Animals & Nature', description: 'beaches, sand, seashells, tides, seaside, sandcastles, beach days' },
  { id: 'deserts', label: 'Deserts', icon: '🏜️', group: 'Animals & Nature', description: 'deserts, cacti, camels, sand dunes, oasis, desert animals' },
  { id: 'rainforests', label: 'Rainforests', icon: '🌴', group: 'Animals & Nature', description: 'rainforests, jungles, tropical, canopy, exotic animals, rainforest conservation' },
  { id: 'endangered-species', label: 'Endangered Species', icon: '🦏', group: 'Animals & Nature', description: 'endangered species, conservation, wildlife protection, saving animals from extinction' },

  // ---- Science & Discovery ----
  { id: 'space', label: 'Space', icon: '🚀', group: 'Science & Discovery', description: 'space, astronomy, planets, stars, galaxies, NASA, rockets, astronauts, moon, mars, telescopes' },
  { id: 'dinosaurs', label: 'Dinosaurs', icon: '🦕', group: 'Science & Discovery', description: 'dinosaurs, fossils, paleontology, prehistoric creatures, tyrannosaurus, triceratops, extinction' },
  { id: 'science', label: 'Science', icon: '🔬', group: 'Science & Discovery', description: 'science, scientific discovery, experiments, research, physics, chemistry, biology, scientists' },
  { id: 'robots-ai', label: 'Robots & AI', icon: '🤖', group: 'Science & Discovery', description: 'robots, artificial intelligence, AI, robotics, machines, automation' },
  { id: 'inventions', label: 'Inventions', icon: '💡', group: 'Science & Discovery', description: 'inventions, inventors, new gadgets, patents, creative ideas, innovation' },
  { id: 'volcanoes', label: 'Volcanoes', icon: '🌋', group: 'Science & Discovery', description: 'volcanoes, lava, eruptions, magma, volcanic islands' },
  { id: 'natural-disasters', label: 'Natural Disasters', icon: '⛈️', group: 'Science & Discovery', description: 'natural disasters, hurricanes, floods, storms, emergency preparedness, staying safe' },
  { id: 'human-body', label: 'Human Body', icon: '🧠', group: 'Science & Discovery', description: 'human body, brain, heart, bones, muscles, senses, how the body works' },
  { id: 'energy', label: 'Energy', icon: '⚡', group: 'Science & Discovery', description: 'energy, solar power, wind turbines, electricity, renewable energy' },
  { id: 'experiments', label: 'Experiments', icon: '🧪', group: 'Science & Discovery', description: 'experiments, science fair, chemistry, reactions, hypotheses, testing ideas' },
  { id: 'moon', label: 'The Moon', icon: '🌙', group: 'Science & Discovery', description: 'the moon, lunar, moon landing, moon phases, astronauts, craters' },
  { id: 'planets', label: 'Planets', icon: '🪐', group: 'Science & Discovery', description: 'planets, solar system, Jupiter, Saturn, Mars, Venus, Mercury' },

  // ---- Kids & Family ----
  { id: 'parenting', label: 'Parenting', icon: '👨‍👩‍👧', group: 'Kids & Family', description: 'parenting, raising children, parenting tips, moms, dads, family life' },
  { id: 'education', label: 'Education', icon: '🎓', group: 'Kids & Family', description: 'education, learning, school, teachers, students, homework, studying, classrooms' },
  { id: 'kids-crafts', label: 'Kids Crafts', icon: '🎨', group: 'Kids & Family', description: 'kids crafts, DIY projects, art projects, coloring, building, making things, creative play' },
  { id: 'books', label: 'Books & Reading', icon: '📖', group: 'Kids & Family', description: 'books, reading, stories, authors, libraries, book clubs, picture books' },
  { id: 'babies', label: 'Babies', icon: '👶', group: 'Kids & Family', description: 'babies, infants, newborns, first steps, baby milestones' },
  { id: 'toddlers', label: 'Toddlers', icon: '🧒', group: 'Kids & Family', description: 'toddlers, preschoolers, little kids, playtime, early childhood' },
  { id: 'bedtime-stories', label: 'Bedtime Stories', icon: '✨', group: 'Kids & Family', description: 'bedtime stories, fairy tales, once upon a time, bedtime routines, goodnight books' },
  { id: 'fairy-tales', label: 'Fairy Tales', icon: '🏰', group: 'Kids & Family', description: 'fairy tales, princesses, dragons, castles, magic kingdoms, knights' },
  { id: 'superheroes', label: 'Superheroes', icon: '🦸', group: 'Kids & Family', description: 'superheroes, heroes, capes, superpowers, saving the day' },
  { id: 'playgrounds', label: 'Playgrounds', icon: '🛝', group: 'Kids & Family', description: 'playgrounds, slides, swings, parks, playground fun' },
  { id: 'birthday-parties', label: 'Birthday Parties', icon: '🎂', group: 'Kids & Family', description: 'birthday parties, cake, celebrations, presents, party games' },
  { id: 'summer-camp', label: 'Summer Camp', icon: '🔥', group: 'Kids & Family', description: 'summer camp, campfires, cabins, camp activities, making friends at camp' },

  // ---- Food ----
  { id: 'food', label: 'Food', icon: '🍎', group: 'Food', description: 'food, cooking, baking, recipes, restaurants, snacks, treats, meals, chefs, desserts' },
  { id: 'baking', label: 'Baking', icon: '🧁', group: 'Food', description: 'baking, cupcakes, cookies, cakes, ovens, frosting, bakeries' },
  { id: 'desserts', label: 'Desserts', icon: '🍦', group: 'Food', description: 'desserts, ice cream, sweets, treats, candy, milkshakes' },
  { id: 'fruits-veggies', label: 'Fruits & Veggies', icon: '🥦', group: 'Food', description: 'fruits, vegetables, healthy snacks, farms, harvest, farmers markets' },
  { id: 'pizza', label: 'Pizza', icon: '🍕', group: 'Food', description: 'pizza, pasta, Italian food, pizzerias, pizza night' },
  { id: 'breakfast', label: 'Breakfast', icon: '🥞', group: 'Food', description: 'breakfast, pancakes, cereal, mornings, brunch, waffles' },
  { id: 'chocolate', label: 'Chocolate', icon: '🍫', group: 'Food', description: 'chocolate, cocoa, candy making, chocolate factories' },
  { id: 'picnics', label: 'Picnics', icon: '🧺', group: 'Food', description: 'picnics, lunchboxes, outdoor eating, packed lunches' },

  // ---- Sports & Play ----
  { id: 'sports', label: 'Sports', icon: '⚽', group: 'Sports & Play', description: 'sports, soccer, basketball, baseball, football, olympics, athletes, games, exercise, running' },
  { id: 'swimming', label: 'Swimming', icon: '🏊', group: 'Sports & Play', description: 'swimming, pools, swim lessons, beaches, lifeguards, swim teams' },
  { id: 'gymnastics', label: 'Gymnastics', icon: '🤸', group: 'Sports & Play', description: 'gymnastics, tumbling, balance beams, flips, gymnasts' },
  { id: 'dance', label: 'Dance', icon: '💃', group: 'Sports & Play', description: 'dance, ballet, hip hop, recitals, dancers, dance classes' },
  { id: 'martial-arts', label: 'Martial Arts', icon: '🥋', group: 'Sports & Play', description: 'martial arts, karate, taekwondo, discipline, black belts' },
  { id: 'olympics', label: 'Olympics', icon: '🏅', group: 'Sports & Play', description: 'olympics, gold medals, athletes, competitions, Paralympics, world records' },
  { id: 'biking', label: 'Biking', icon: '🚲', group: 'Sports & Play', description: 'biking, bicycles, cycling, bike trails, helmets, bike rides' },
  { id: 'skateboarding', label: 'Skateboarding', icon: '🛹', group: 'Sports & Play', description: 'skateboarding, scooters, ramps, skate parks' },
  { id: 'hiking', label: 'Hiking', icon: '🥾', group: 'Sports & Play', description: 'hiking, trails, backpacks, nature walks, viewpoints' },
  { id: 'fishing', label: 'Fishing', icon: '🎣', group: 'Sports & Play', description: 'fishing, lakes, boats, catching fish, bait, fishing trips' },

  // ---- Arts & Music ----
  { id: 'music', label: 'Music', icon: '🎵', group: 'Arts & Music', description: 'music, songs, singing, instruments, bands, concerts, musicians, piano, guitar' },
  { id: 'painting', label: 'Painting', icon: '🖌️', group: 'Arts & Music', description: 'painting, watercolors, art, artists, canvases, masterpieces' },
  { id: 'drawing', label: 'Drawing', icon: '✏️', group: 'Arts & Music', description: 'drawing, sketching, cartoons, doodles, illustration, how to draw' },
  { id: 'theater', label: 'Theater', icon: '🎭', group: 'Arts & Music', description: 'theater, plays, acting, stage, musicals, drama, school plays' },
  { id: 'magic', label: 'Magic', icon: '🪄', group: 'Arts & Music', description: 'magic tricks, magicians, illusions, card tricks, magic shows' },
  { id: 'lego', label: 'LEGO & Building', icon: '🧱', group: 'Arts & Music', description: 'LEGO, building blocks, construction toys, sets, building creations' },
  { id: 'photography', label: 'Photography', icon: '📸', group: 'Arts & Music', description: 'photography, cameras, pictures, photos, photo tips' },

  // ---- Tech & Games ----
  { id: 'video-games', label: 'Video Games', icon: '🎮', group: 'Tech & Games', description: 'video games, gaming, gamers, Minecraft, Nintendo, PlayStation, Xbox' },
  { id: 'coding', label: 'Coding', icon: '💻', group: 'Tech & Games', description: 'coding, programming, computers, kids who code, Scratch, learning to code' },
  { id: 'apps', label: 'Apps', icon: '📱', group: 'Tech & Games', description: 'apps, tablets, phones, screen time, educational apps' },
  { id: 'internet-safety', label: 'Internet Safety', icon: '🛡️', group: 'Tech & Games', description: 'internet safety, online kindness, passwords, cyberbullying, digital citizenship' },
  { id: 'virtual-reality', label: 'Virtual Reality', icon: '🥽', group: 'Tech & Games', description: 'virtual reality, VR headsets, immersive experiences, virtual worlds' },
  { id: 'drones', label: 'Drones', icon: '🛸', group: 'Tech & Games', description: 'drones, flying, aerial photos, remote control aircraft' },
  { id: 'electric-cars', label: 'Electric Cars', icon: '🚗', group: 'Tech & Games', description: 'electric cars, vehicles, transportation, Tesla, EVs' },
  { id: 'board-games', label: 'Board Games', icon: '🎲', group: 'Tech & Games', description: 'board games, card games, puzzles, family game night, chess' },

  // ---- Shows & Fun ----
  { id: 'family-movies', label: 'Family Movies', icon: '🎬', group: 'Shows & Fun', description: 'family movies, films, animation, cartoons, Disney, Pixar, movie night' },
  { id: 'tv-shows', label: 'TV Shows', icon: '📺', group: 'Shows & Fun', description: 'TV shows, cartoons, episodes, streaming, series, kids shows' },
  { id: 'comics', label: 'Comics', icon: '💬', group: 'Shows & Fun', description: 'comics, graphic novels, manga, comic books, comic strips' },
  { id: 'theme-parks', label: 'Theme Parks', icon: '🎢', group: 'Shows & Fun', description: 'theme parks, roller coasters, Disney World, rides, amusement parks' },
  { id: 'circus', label: 'Circus', icon: '🎪', group: 'Shows & Fun', description: 'circus, clowns, acrobats, big top, trapeze artists' },

  // ---- Planet & Weather ----
  { id: 'weather', label: 'Weather', icon: '🌤️', group: 'Planet & Weather', description: 'weather, rain, snow, storms, hurricanes, climate, seasons, tornadoes, clouds, rainbow' },
  { id: 'environment', label: 'Environment', icon: '🌍', group: 'Planet & Weather', description: 'environment, conservation, recycling, climate change, planet earth, pollution, nature protection' },
  { id: 'gardening', label: 'Gardening', icon: '🌱', group: 'Planet & Weather', description: 'gardening, plants, flowers, growing vegetables, garden, seeds, trees, farming' },
  { id: 'flowers', label: 'Flowers', icon: '🌸', group: 'Planet & Weather', description: 'flowers, bouquets, gardens, blossoms, roses, tulips, wildflowers' },
  { id: 'seasons', label: 'Seasons', icon: '🍂', group: 'Planet & Weather', description: 'seasons, autumn, spring, changing leaves, first snow, seasonal changes' },
  { id: 'snow', label: 'Snow', icon: '❄️', group: 'Planet & Weather', description: 'snow, snowmen, sledding, snowflakes, winter fun, snow days' },
  { id: 'clouds', label: 'Clouds', icon: '☁️', group: 'Planet & Weather', description: 'clouds, cloud shapes, sky, cloud watching' },

  // ---- Travel & Places ----
  { id: 'travel', label: 'Travel', icon: '✈️', group: 'Travel & Places', description: 'travel, vacations, airplanes, road trips, hotels, tourist attractions, exploring new places, camping' },
  { id: 'camping', label: 'Camping', icon: '🏕️', group: 'Travel & Places', description: 'camping, tents, campfires, sleeping bags, campgrounds, outdoor adventures' },
  { id: 'road-trips', label: 'Road Trips', icon: '🚙', group: 'Travel & Places', description: 'road trips, car rides, highways, rest stops, scenic drives' },
  { id: 'landmarks', label: 'Landmarks', icon: '🗽', group: 'Travel & Places', description: 'landmarks, monuments, statues, famous places, wonders of the world' },
  { id: 'maps', label: 'Maps', icon: '🗺️', group: 'Travel & Places', description: 'maps, geography, atlases, exploring, compasses, finding places' },
  { id: 'languages', label: 'Languages', icon: '🗣️', group: 'Travel & Places', description: 'languages, Spanish, French, learning words, bilingual, new words' },

  // ---- Holidays ----
  { id: 'holidays', label: 'Holidays', icon: '🎄', group: 'Holidays', description: 'holidays, christmas, halloween, thanksgiving, easter, celebrations, traditions, festivals, new year' },
  { id: 'christmas', label: 'Christmas', icon: '🎅', group: 'Holidays', description: 'Christmas, Santa, gifts, trees, stockings, reindeer, holiday spirit' },
  { id: 'halloween', label: 'Halloween', icon: '🎃', group: 'Holidays', description: 'Halloween, costumes, trick or treat, pumpkins, spooky fun' },
  { id: 'easter', label: 'Easter', icon: '🐰', group: 'Holidays', description: 'Easter, egg hunts, bunnies, spring, baskets' },
  { id: 'thanksgiving', label: 'Thanksgiving', icon: '🦃', group: 'Holidays', description: 'Thanksgiving, turkey, gratitude, feast, family dinner' },
  { id: 'new-year', label: 'New Year', icon: '🎆', group: 'Holidays', description: 'New Year, fireworks, resolutions, countdown, celebrations' },

  // ---- Community & Life ----
  { id: 'community-heroes', label: 'Community Heroes', icon: '🤝', group: 'Community & Life', description: 'community, neighbors, volunteers, kindness, helping others, local heroes, charity' },
  { id: 'health', label: 'Health', icon: '🩺', group: 'Community & Life', description: 'health, wellness, doctors, hospitals, exercise, nutrition, mental health, medicine' },
  { id: 'money', label: 'Money & Saving', icon: '💰', group: 'Community & Life', description: 'money, saving, allowance, jobs, economy, financial literacy, business, entrepreneurship' },
  { id: 'history', label: 'History', icon: '🏛️', group: 'Community & Life', description: 'history, historical events, ancient civilizations, museums, the past' },
  { id: 'volunteering', label: 'Volunteering', icon: '💝', group: 'Community & Life', description: 'volunteering, helping, charity, giving back, fundraisers, good deeds' },
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
