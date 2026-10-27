import { CATEGORIES, NEWS_CONFIG } from '../constants/config';
import { INTEREST_KEYWORDS } from '../constants/interestKeywords';
import type { PillConfig } from '../contexts/AuthContext';
import type { Space } from './spaceService';

export interface EmojiMatch {
  emoji: string;
  id: string;
  label: string;
  group: string;
  score: number;
}

export interface SpaceEmojiInput {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  pills?: PillConfig[] | null;
  keywords?: string | null;
  icon_emoji?: string | null;
}

const LOCAL_EMOJI_OVERRIDE_KEY = 'littlables_space_emoji_overrides';

export function getSavedEmojiOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_EMOJI_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setSavedEmojiOverride(spaceId: string, emoji: string | null | undefined): void {
  if (typeof window === 'undefined' || !spaceId) return;
  try {
    const current = getSavedEmojiOverrides();
    const validEmoji = extractSingleEmoji(emoji);
    if (validEmoji) {
      current[spaceId] = validEmoji;
    } else {
      delete current[spaceId];
    }
    window.localStorage.setItem(LOCAL_EMOJI_OVERRIDE_KEY, JSON.stringify(current));
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Natural-language embedding descriptions for the 157 interest keywords
 * (mirrored from cloudflare-worker/src/interest-keywords.mjs so client-side
 * vector cosine similarity has the full semantic vocabulary).
 */
const KEYWORD_DESCRIPTIONS: Record<string, string> = {
  'animals-nature': 'general animals and nature news wildlife pets natural world conservation creature fauna flora',
  'ocean-life': 'ocean animals sea life whales dolphins sharks coral reefs tide pools marine biology fish octopus',
  'pets': 'pet ownership dogs cats puppies kittens pet care furry friends adopting pets bark meow',
  'wildlife': 'wild animals nature safaris lions elephants tigers bears national parks wildlife photography animal behavior',
  'birds': 'birds parrots owls eagles penguins birdwatching migration nests baby birds feathers wings flock',
  'bugs': 'insects butterflies bees ants spiders beetles caterpillars ladybugs bug discoveries pollination',
  'farm-animals': 'farm life cows horses pigs chickens goats sheep barns farmers ranch country',
  'zoos': 'zoo aquarium new animal babies exhibits zookeepers giraffes safari parks sanctuaries',
  'animal-rescues': 'animal rescue shelters adoptions saving injured animals heartwarming rescues foster paws',
  'forests': 'forest woods hiking trails forest animals trees woodland pines',
  'mountains': 'mountain climbing peaks alpine summit hiking mountain views adventures hills',
  'beaches': 'beach day sand seashells tides seaside coastline ocean waves sandcastles shore',
  'deserts': 'desert cacti camels sand dunes desert animals oasis arid canyon',
  'rainforests': 'tropical rainforest jungle ecosystems canopy wildlife monkeys toucans amazon conservation',
  'endangered-species': 'conservation endangered animals protection efforts saving species extinction rhinos pandas',
  'rivers-lakes': 'rivers lakes waterfalls ponds river wildlife kayaking canoeing freshwater streams',
  'science-discovery-general': 'general science discoveries research exploration innovation telescope astronomy laboratory',
  'space': 'outer space exploration NASA missions rockets launching astronauts astronomy cosmos galaxy stars universe',
  'dinosaurs': 'dinosaur discoveries fossils paleontology t-rex jurassic cretaceous prehistoric creatures extinction',
  'science': 'science new discoveries research studies how things work scientists physics biology chemistry lab',
  'robots-ai': 'robotics artificial intelligence robots doing jobs AI tools machine learning androids automation',
  'inventions': 'new inventions inventors clever gadgets patents creative problem-solving ideas breakthroughs',
  'volcanoes': 'volcano eruptions lava flows magma craters volcanic islands geology',
  'natural-disasters': 'severe weather hurricanes floods storms earthquakes tornadoes emergency preparedness safety',
  'human-body': 'human body brain heart bones muscles senses anatomy medicine health science',
  'energy': 'energy solar panels wind turbines electricity renewable power batteries clean energy',
  'experiments': 'hands-on science experiments science fair projects chemistry reactions lab test tubes',
  'moon': 'the moon lunar missions moon landings moon phases craters astronauts night sky',
  'planets': 'planets solar system jupiter saturn mars rovers venus neptune exoplanets orbit',
  'archaeology': 'ancient discoveries mummies pyramids buried treasure old ruins artifacts ancient history fossils',
  'childcare-family-general': 'childcare family parenting kids family life home raising children',
  'parenting': 'parenting advice raising babies kids parenting tips family routines moms dads caregivers',
  'education': 'school learning teachers classrooms homework studying students elementary preschool',
  'kids-crafts': 'craft projects kids DIY art coloring paper crafts making things rainy-day activities glue scissors',
  'books': 'reading books children books authors libraries story time literature novels picture books',
  'babies': 'baby newborns first steps baby milestones infant care nursery lullaby',
  'toddlers': 'toddler life preschoolers playtime early learning little kids nursery school',
  'bedtime-stories': 'bedtime reading goodnight books bedtime routines calming stories sleep dreams cozy night',
  'fairy-tales': 'fairy tales princesses dragons castles magic kingdoms knights folklore fables enchanted',
  'superheroes': 'superheroes heroes powers comic heroes saving the day marvel dc capes adventure',
  'playgrounds': 'playground fun slides swings parks recess climbing frames outdoor play',
  'birthday-parties': 'birthday celebrations parties cake presents balloons candles party games',
  'summer-camp': 'summer camp campfires cabins outdoor camp activities s-mores camp friends',
  'teens': 'teen life tweens high school friendships growing up youth achievements',
  'collecting': 'collecting hobbies trading cards pokemon stamps coins rocks shells treasures',
  'toys': 'toys plushies teddy bears dolls action figures playthings toy box',
  'food-general': 'general food cooking recipes restaurants culinary meals kitchen',
  'food': 'food cooking recipes chefs meals snacks treats healthy eating apples',
  'baking': 'baking cupcakes cookies cakes ovens frosting bakeries pastries bread muffins dough',
  'desserts': 'sweet treats ice cream candy milkshakes dessert recipes sundaes Gelato popsicles',
  'fruits-veggies': 'healthy eating fruits vegetables produce farms harvests farmers markets nutrition',
  'pizza': 'pizza pizzerias pizza-making slices cheese pepperoni Italian dinner',
  'breakfast': 'morning meals pancakes cereal waffles eggs toast smoothies breakfast recipes brunch',
  'chocolate': 'chocolate cocoa fudge brownies candy-making chocolate factories truffles sweet',
  'picnics': 'outdoor eating picnics lunchboxes baskets packed lunches park snacks',
  'sports-play-general': 'sports athletics games physical activity running exercise fitness active play',
  'sports': 'youth pro sports soccer football basketball baseball athletes competitions team spirit',
  'swimming': 'swimming pools swim lessons diving water sports aquatic splash',
  'gymnastics': 'gymnastics tumbling balance beams flips acrobatics cheer',
  'dance': 'dance ballet hip hop recitals choreography dancing music movement',
  'martial-arts': 'martial arts karate taekwondo judo kung fu dojo belt tests self-defense',
  'olympics': 'olympic paralympic games gold medals world records athletes championships',
  'biking': 'cycling bike rides bicycles mountain biking trails training wheels',
  'skateboarding': 'skateboarding skate parks tricks scooters rollerblading',
  'hiking': 'hiking adventures trails backpacks nature walks trekking outdoors',
  'fishing': 'fishing trips lakes boats angling catching fish tackle rod',
  'arts-music-general': 'arts music creativity artistic expression performances studio',
  'music': 'music songs concerts bands instruments piano guitar singing melodies choir',
  'painting': 'painting watercolors canvas brushes acrylics oil paintings artists',
  'drawing': 'drawing sketching cartoons doodles illustration pencils markers coloring',
  'theater': 'theater plays acting drama school plays musicals stage performances broadway',
  'magic': 'magic tricks magicians illusions wands sleight of hand magic shows',
  'lego': 'lego building bricks blocks creative constructions architecture sets',
  'photography': 'photography cameras pictures photos portraits lenses snapshots',
  'fashion': 'fashion style outfits clothing designers dress-up costumes sewing',
  'tech-games-general': 'tech gadgets gaming innovation digital computers electronics',
  'video-games': 'video games gaming minecraft nintendo roblox playstation esports controllers console',
  'coding': 'coding programming software kids code scratch python web development computers',
  'apps': 'apps mobile tablets smartphones iPad educational apps digital tools',
  'internet-safety': 'internet safety cybersecurity privacy online kindness passwords digital citizenship',
  'virtual-reality': 'virtual reality VR headsets augmented reality 3d immersive',
  'drones': 'drones flying quadcopters aerial photography remote control',
  'electric-cars': 'electric cars vehicles EVs batteries charging automotive transportation',
  'board-games': 'board games tabletop card games puzzles chess checkers family game night dice',
  'shows-fun-general': 'shows fun entertainment amusement activities',
  'family-movies': 'family movies animated films cinema disney pixar popcorn movie night',
  'tv-shows': 'tv shows cartoons episodes streaming animation series',
  'comics': 'comics graphic novels manga comic strips superheroes illustration',
  'theme-parks': 'theme parks roller coasters amusement parks disneyland rides carnival',
  'circus': 'circus acrobats jugglers big top carnival performers',
  'online-creators': 'online creators youtubers streamers video makers vloggers content',
  'celebrity-entertainment-general': 'celebrity entertainment stars pop culture fame',
  'entertainment': 'entertainment pop culture red carpets showbiz awards',
  'celebrities': 'celebrities famous actors singers athletes interviews stars',
  'hollywood': 'hollywood movie studios film premieres cinema blockbusters',
  'planet-weather-general': 'planet earth weather climate seasons environment',
  'weather': 'weather forecasts rain sunshine rainbow meteorology wind temperature',
  'environment': 'environment conservation recycling climate action earth day sustainability green',
  'gardening': 'gardening planting seeds growing vegetables plants soil backyard garden',
  'flowers': 'flowers bouquets blossoms petals roses tulips wildflowers',
  'seasons': 'seasons autumn leaves fall spring summer winter equinox',
  'snow': 'snow winter snowmen sledding snowflakes ice blizzards skiing',
  'clouds': 'clouds sky cloud watching atmosphere cumulonimbus breeze',
  'travel-places-general': 'travel destinations luggage adventures exploring places',
  'travel': 'travel vacations airplanes flights airports hotels sightseeing trips',
  'camping': 'camping tents campfires campgrounds sleeping bags stargazing outdoors',
  'road-trips': 'road trips car rides highways campervan scenic drives',
  'landmarks': 'landmarks monuments statues wonders architecture towers',
  'maps': 'maps geography atlases compasses globes navigation',
  'languages': 'languages bilingual words vocabulary speaking translation',
  'world-cultures': 'world cultures traditions festivals international heritage',
  'holidays-general': 'holidays celebrations festive party confetti',
  'holidays': 'holidays traditions festivals seasonal celebrations',
  'christmas': 'christmas santa claus presents reindeer christmas tree december winter holiday',
  'halloween': 'halloween pumpkins costumes trick-or-treating spooky autumn october',
  'easter': 'easter egg hunts bunnies spring baskets pastel',
  'thanksgiving': 'thanksgiving turkey gratitude harvest feast autumn family dinner',
  'new-year': 'new year fireworks countdown celebration sparkles january',
  'community-life-general': 'community neighborhoods local life towns people',
  'community-heroes': 'community heroes helpers firefighters paramedics neighbors kindness',
  'health': 'health wellness doctors medicine fitness nutrition medical',
  'money': 'money saving allowance finance piggy bank coins',
  'history': 'history ancient civilizations museums historical eras past',
  'volunteering': 'volunteering charity helping others donations kindness heart',
  'big-feelings': 'big feelings emotions mindfulness empathy mental health calm',
  'religion': 'religion faith peace spirituality traditions',
  'records': 'world records trophies champions achievements firsts medals',
  'stocks': 'stock market investing finance trading wall street',
  'cryptocurrency': 'cryptocurrency bitcoin blockchain digital currency',
  'business-news': 'business corporate economy companies',
  'clickbait': 'clickbait viral',
  'death': 'memorial',
  'politics': 'politics political debates policy',
  'elections': 'elections voting ballots',
  'government': 'government laws civic',
  'countries-general': 'countries nations international world globe',
  'country-us': 'united states america usa american',
  'country-uk': 'united kingdom britain england scotland wales london',
  'country-canada': 'canada canadian toronto vancouver maple',
  'country-australia': 'australia australian sydney outback kangaroo',
  'country-nz': 'new zealand kiwi auckland',
  'country-ireland': 'ireland irish dublin',
  'country-france': 'france french paris',
  'country-germany': 'germany german berlin',
  'country-italy': 'italy italian rome venice',
  'country-spain': 'spain spanish madrid barcelona',
  'country-netherlands': 'netherlands dutch amsterdam',
  'country-sweden': 'sweden swedish stockholm',
  'country-china': 'china chinese beijing shanghai',
  'country-japan': 'japan japanese tokyo anime kyoto',
  'country-india': 'india indian mumbai delhi',
  'country-korea': 'south korea korean seoul k-pop',
  'country-mexico': 'mexico mexican tacos',
  'country-brazil': 'brazil brazilian rio amazon',
  'country-south-africa': 'south africa cape town',
  'country-egypt': 'egypt egyptian pyramids nile',
};

/**
 * Extra semantic emoji concepts so custom space names/descriptions/tags like
 * "Cats & Kittens", "Unicorns", "Trains", "Cozy Tea", "Pirates", "Minecraft",
 * "Basketball", etc. resolve to an even more specific emoji when appropriate.
 */
const EXTRA_EMOJI_CONCEPTS: Array<{
  id: string;
  label: string;
  icon: string;
  group: string;
  description: string;
}> = [
  { id: 'extra-cats', label: 'Cats & Kittens', icon: '🐱', group: 'Animals & Nature', description: 'cats kittens feline meow purr tabby kitty whiskers cat lovers' },
  { id: 'extra-unicorns', label: 'Unicorns & Fantasy', icon: '🦄', group: 'Childcare & Family', description: 'unicorns rainbow magic fantasy mythical creatures pegasus sparkles' },
  { id: 'extra-dragons', label: 'Dragons & Myth', icon: '🐉', group: 'Childcare & Family', description: 'dragons breathing fire mythical beasts fantasy lore dungeons' },
  { id: 'extra-butterflies', label: 'Butterflies', icon: '🦋', group: 'Animals & Nature', description: 'butterflies monarch cocoon caterpillar wings garden insects' },
  { id: 'extra-bees', label: 'Bees & Honey', icon: '🐝', group: 'Animals & Nature', description: 'bees bumblebees honeyhive honeycomb pollinators', },
  { id: 'extra-turtles', label: 'Turtles & Reptiles', icon: '🐢', group: 'Animals & Nature', description: 'turtles tortoises reptiles lizards geckos amphibians frogs shells' },
  { id: 'extra-foxes', label: 'Woodland Critters', icon: '🦊', group: 'Animals & Nature', description: 'foxes woodland critters hedgehogs squirrels raccoons badgers deer' },
  { id: 'extra-pandas', label: 'Pandas & Bears', icon: '🐼', group: 'Animals & Nature', description: 'giant pandas bamboo bears koalas cute cubs' },
  { id: 'extra-frogs', label: 'Frogs & Ponds', icon: '🐸', group: 'Animals & Nature', description: 'frogs tadpoles lily pads toads amphibians pond life' },
  { id: 'extra-horses', label: 'Horses & Ponies', icon: '🐴', group: 'Animals & Nature', description: 'horses ponies riding equestrian stables foals gallop' },
  { id: 'extra-trains', label: 'Trains & Railways', icon: '🚂', group: 'Travel & Places', description: 'trains locomotives railroads railway subway steam engine tracks' },
  { id: 'extra-trucks', label: 'Trucks & Diggers', icon: '🚜', group: 'Tech & Games', description: 'trucks tractors diggers excavators construction vehicles bulldozers fire trucks' },
  { id: 'extra-firetrucks', label: 'Firefighters & Rescue', icon: '🚒', group: 'Community & Life', description: 'fire trucks firefighters rescue emergency sirens fire station' },
  { id: 'extra-boats', label: 'Boats & Sailing', icon: '⛵', group: 'Travel & Places', description: 'boats ships sailing yachts ferries maritime sea voyages' },
  { id: 'extra-pirates', label: 'Pirates & Treasure', icon: '🏴‍☠️', group: 'Shows & Fun', description: 'pirates treasure chests high seas pirate ships doubloons' },
  { id: 'extra-cozy-cafe', label: 'Cozy Drinks & Cafe', icon: '☕', group: 'Food', description: 'coffee tea hot cocoa cafe cozy warm drinks mug matcha latte' },
  { id: 'extra-cookies', label: 'Cookies & Biscuits', icon: '🍪', group: 'Food', description: 'cookies chocolate chip biscuits baking treats snack time' },
  { id: 'extra-noodles', label: 'Noodles & Ramen', icon: '🍜', group: 'Food', description: 'noodles ramen soup pasta spaghetti asian cuisine bowls' },
  { id: 'extra-tacos', label: 'Tacos & Fiesta', icon: '🌮', group: 'Food', description: 'tacos burritos quesadillas nachos salsa mexican food' },
  { id: 'extra-sushi', label: 'Sushi & Seafood', icon: '🍣', group: 'Food', description: 'sushi rolls bento japanese food rice seaweed' },
  { id: 'extra-strawberries', label: 'Berries & Fruit', icon: '🍓', group: 'Food', description: 'strawberries berries cherries watermelon peaches orchards fruit' },
  { id: 'extra-puzzles', label: 'Puzzles & Riddles', icon: '🧩', group: 'Tech & Games', description: 'jigsaw puzzles riddles brainteasers logic games problem solving' },
  { id: 'extra-chess', label: 'Chess & Strategy', icon: '♟️', group: 'Tech & Games', description: 'chess strategy grandmaster checkmate board games' },
  { id: 'extra-basketball', label: 'Basketball', icon: '🏀', group: 'Sports & Play', description: 'basketball hoops nba court dribbling slam dunk' },
  { id: 'extra-baseball', label: 'Baseball & Softball', icon: '⚾', group: 'Sports & Play', description: 'baseball softball home run ballpark pitching batting' },
  { id: 'extra-football', label: 'Football & Rugby', icon: '🏈', group: 'Sports & Play', description: 'american football rugby touchdown quarterback stadium' },
  { id: 'extra-tennis', label: 'Tennis & Racket Sports', icon: '🎾', group: 'Sports & Play', description: 'tennis pickleball badminton racket court' },
  { id: 'extra-skating', label: 'Ice Skating & Hockey', icon: '⛸️', group: 'Sports & Play', description: 'ice skating figure skating ice hockey rink winter sports' },
  { id: 'extra-surfing', label: 'Surfing & Waves', icon: '🏄', group: 'Sports & Play', description: 'surfing surfboards waves ocean sports bodyboarding' },
  { id: 'extra-yoga', label: 'Mindfulness & Yoga', icon: '🧘', group: 'Community & Life', description: 'yoga meditation mindfulness breathing stretching zen calm relaxation' },
  { id: 'extra-guitar', label: 'Guitar & Rock', icon: '🎸', group: 'Arts & Music', description: 'guitar acoustic electric rock bands strumming chords' },
  { id: 'extra-piano', label: 'Piano & Classical', icon: '🎹', group: 'Arts & Music', description: 'piano keyboard classical music composer recitals' },
  { id: 'extra-headphones', label: 'Podcasts & Audio', icon: '🎧', group: 'Arts & Music', description: 'podcasts audiobooks listening headphones playlists radio' },
  { id: 'extra-knitting', label: 'Knitting & Yarn', icon: '🧶', group: 'Arts & Music', description: 'knitting crochet yarn embroidery sewing textiles needlework' },
  { id: 'extra-writing', label: 'Writing & Poetry', icon: '✍️', group: 'Arts & Music', description: 'writing creative writing poetry journaling diaries storytelling authors' },
  { id: 'extra-math', label: 'Math & Numbers', icon: '🧮', group: 'Science & Discovery', description: 'mathematics numbers geometry algebra counting puzzles calculators' },
  { id: 'extra-dna', label: 'Biology & Genetics', icon: '🧬', group: 'Science & Discovery', description: 'dna genetics biology cells evolution microbiology' },
  { id: 'extra-mushrooms', label: 'Mushrooms & Fungi', icon: '🍄', group: 'Animals & Nature', description: 'mushrooms fungi toadstools foraging forest floor' },
  { id: 'extra-sunflowers', label: 'Sunflowers & Sunshine', icon: '🌻', group: 'Planet & Weather', description: 'sunflowers summer sunshine bright blooms yellow' },
  { id: 'extra-rainbows', label: 'Rainbows & Joy', icon: '🌈', group: 'Planet & Weather', description: 'rainbows colorful prism sky hope joy' },
];

interface ConceptEntry {
  id: string;
  label: string;
  icon: string;
  group: string;
  description: string;
  isBroadCategory?: boolean;
  tokens: Map<string, number>;
  norm: number;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'about', 'from', 'that', 'this', 'are', 'was',
  'were', 'have', 'has', 'had', 'not', 'but', 'what', 'all', 'can', 'when',
  'your', 'our', 'their', 'how', 'who', 'why', 'where', 'into', 'out', 'new',
  'news', 'stories', 'story', 'general', 'space', 'spaces', 'playroom',
  'little', 'littlables', 'more', 'other', 'some', 'such', 'than', 'then',
]);

function stemWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('tion') && word.length > 6) return word.slice(0, -4);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * Extracts weighted lexical + character n-gram features from a text string,
 * producing a dense-like subword representation that captures both exact words
 * and morphological/partial matches (e.g. "dino" <-> "dinosaurs", "bake" <-> "baking").
 */
function extractFeatures(text: string, weight = 1): Map<string, number> {
  const features = new Map<string, number>();
  if (!text) return features;
  const cleaned = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  const rawWords = cleaned.split(/\s+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  for (let i = 0; i < rawWords.length; i++) {
    const word = rawWords[i];
    const stem = stemWord(word);
    // Exact word & stem features
    features.set(`w:${word}`, (features.get(`w:${word}`) || 0) + weight * 1.4);
    if (stem !== word) {
      features.set(`s:${stem}`, (features.get(`s:${stem}`) || 0) + weight * 1.25);
    }
    // Prefix feature (4 chars) for subword similarity (e.g. "dino", "astr", "robo")
    if (word.length >= 4) {
      const prefix = word.slice(0, 4);
      features.set(`p:${prefix}`, (features.get(`p:${prefix}`) || 0) + weight * 0.55);
    }
    // Character 3-grams within words >= 4 chars
    if (word.length >= 4) {
      const padded = `^${stem}$`;
      for (let j = 0; j <= padded.length - 3; j++) {
        const tri = padded.slice(j, j + 3);
        features.set(`g:${tri}`, (features.get(`g:${tri}`) || 0) + weight * 0.22);
      }
    }
    // Word bigrams
    if (i < rawWords.length - 1) {
      const nextStem = stemWord(rawWords[i + 1]);
      const bg = `b:${stem}_${nextStem}`;
      features.set(bg, (features.get(bg) || 0) + weight * 1.1);
    }
  }
  return features;
}

function mergeFeatures(target: Map<string, number>, source: Map<string, number>, scale = 1) {
  for (const [k, v] of source) {
    target.set(k, (target.get(k) || 0) + v * scale);
  }
}

// Build the full concept index once at module load
const CATEGORY_CONCEPT_META: Array<{ id: string; label: string; icon: string; group: string; description: string }> = [
  { id: 'childcare', label: 'Childcare & Family', icon: '👨‍👩‍👧', group: 'Childcare & Family', description: 'parenting childcare raising children family life kids activities babies toddlers' },
  { id: 'animals', label: 'Animals & Nature', icon: '🐾', group: 'Animals & Nature', description: 'animals wildlife pets dogs cats nature conservation endangered species zoos' },
  { id: 'arts', label: 'Arts & Creativity', icon: '🎨', group: 'Arts & Music', description: 'arts creativity music painting crafts theater dance literature culture artists' },
  { id: 'tech', label: 'Tech & Science', icon: '🤖', group: 'Tech & Games', description: 'technology artificial intelligence gadgets innovation robots space science future tech' },
  { id: 'world', label: 'World & Places', icon: '🌍', group: 'Planet & Weather', description: 'world news global events international countries climate environment travel' },
  { id: 'uplifting', label: 'Uplifting & Good News', icon: '✨', group: 'Community & Life', description: 'uplifting news positive stories heartwarming inspiring kindness community heroes joy' },
];

const ALL_CONCEPTS: ConceptEntry[] = [];
const IDF_MAP = new Map<string, number>();

function buildConceptIndex() {
  if (ALL_CONCEPTS.length > 0) return;

  const rawEntries: Array<{
    id: string;
    label: string;
    icon: string;
    group: string;
    description: string;
    isBroadCategory?: boolean;
  }> = [];

  for (const cat of CATEGORY_CONCEPT_META) {
    rawEntries.push({ ...cat, isBroadCategory: true });
  }

  for (const kw of INTEREST_KEYWORDS) {
    const isGeneral = kw.id.endsWith('-general');
    rawEntries.push({
      id: kw.id,
      label: kw.label,
      icon: kw.icon,
      group: kw.group,
      description: KEYWORD_DESCRIPTIONS[kw.id] || kw.label,
      isBroadCategory: isGeneral,
    });
  }

  for (const extra of EXTRA_EMOJI_CONCEPTS) {
    rawEntries.push(extra);
  }

  // First pass: extract raw features per concept and compute document frequency
  const docFreq = new Map<string, number>();
  const rawFeatureMaps = rawEntries.map((entry) => {
    const map = new Map<string, number>();
    mergeFeatures(map, extractFeatures(entry.label, 3.0));
    mergeFeatures(map, extractFeatures(entry.id.replace(/[-_]/g, ' '), 2.5));
    mergeFeatures(map, extractFeatures(entry.description, 1.2));
    mergeFeatures(map, extractFeatures(entry.group, 0.5));
    for (const key of map.keys()) {
      docFreq.set(key, (docFreq.get(key) || 0) + 1);
    }
    return map;
  });

  const N = rawEntries.length;
  for (const [term, df] of docFreq) {
    IDF_MAP.set(term, Math.log((N + 1) / (df + 0.5)) + 1);
  }

  // Second pass: apply IDF weighting and precompute L2 norm for fast cosine similarity
  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    const weighted = new Map<string, number>();
    let sumSq = 0;
    for (const [term, tf] of rawFeatureMaps[i]) {
      const idf = IDF_MAP.get(term) || 1;
      const val = tf * idf;
      weighted.set(term, val);
      sumSq += val * val;
    }
    ALL_CONCEPTS.push({
      ...entry,
      tokens: weighted,
      norm: Math.sqrt(sumSq) || 1,
    });
  }
}

function sparseCosineSimilarity(
  queryMap: Map<string, number>,
  queryNorm: number,
  concept: ConceptEntry
): number {
  if (queryNorm === 0 || concept.norm === 0) return 0;
  let dot = 0;
  const smaller = queryMap.size <= concept.tokens.size ? queryMap : concept.tokens;
  const larger = queryMap.size <= concept.tokens.size ? concept.tokens : queryMap;
  for (const [k, v] of smaller) {
    const other = larger.get(k);
    if (other !== undefined) {
      dot += v * other;
    }
  }
  return dot / (queryNorm * concept.norm);
}

const DEFAULT_CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

/**
 * Cache for async Cloudflare Worker 768-dim BGE embedding matches,
 * keyed by space signature so UI components can use neural matches when available.
 */
const workerEmojiCache = new Map<string, EmojiMatch[]>();

export function getSpaceSignature(space?: SpaceEmojiInput | null): string {
  if (!space) return '';
  const name = (space.name || '').trim().toLowerCase();
  const desc = (space.description || '').trim().toLowerCase();
  const slug = (space.slug || '').trim().toLowerCase();
  const kw = (space.keywords || '').trim().toLowerCase();
  const pillSig = (space.pills || [])
    .map((p) => `${p.type}:${p.id}:${p.label || ''}:${p.keywords || ''}`)
    .join('|')
    .toLowerCase();
  return `${name}::${desc}::${slug}::${kw}::${pillSig}`;
}

/**
 * Ranks the closest emojis for a Space based on its interest tags (`pills`),
 * `name`, `description`, `slug`, and custom keywords using semantic vector cosine similarity.
 */
export function getRankedSpaceEmojis(
  space?: SpaceEmojiInput | null,
  limit = 10
): EmojiMatch[] {
  buildConceptIndex();
  if (!space) {
    return [{ emoji: '✨', id: 'uplifting', label: 'Uplifting', group: 'Community & Life', score: 0.1 }];
  }

  const sig = getSpaceSignature(space);
  const cachedWorker = sig ? workerEmojiCache.get(sig) : undefined;
  if (cachedWorker && cachedWorker.length > 0) {
    return cachedWorker.slice(0, limit);
  }

  const rawQueryFeatures = new Map<string, number>();

  // 1. Space Name (highest semantic signal)
  if (space.name) {
    mergeFeatures(rawQueryFeatures, extractFeatures(space.name, 3.8));
  }
  // 2. Space Description
  if (space.description) {
    mergeFeatures(rawQueryFeatures, extractFeatures(space.description, 2.4));
  }
  // 3. Space Slug (if meaningful and distinct from generic 'space')
  if (space.slug && space.slug !== 'space' && space.slug !== 'my-playroom') {
    mergeFeatures(rawQueryFeatures, extractFeatures(space.slug.replace(/[-_]/g, ' '), 1.4));
  }
  // 4. Standalone keywords string (e.g. from a PillConfig)
  if (space.keywords) {
    mergeFeatures(rawQueryFeatures, extractFeatures(space.keywords.replace(/[,_-]/g, ' '), 2.8));
  }

  // 5. Space Interest Tags (pills)
  const pills = Array.isArray(space.pills) ? space.pills : [];
  const selectedIds = new Set<string>();
  const selectedSpecificIds = new Set<string>();

  // Check if the pills are just the untouched 7 default categories
  const categoryPills = pills.filter((p) => p.type === 'category');
  const hasAllDefaultCategories =
    categoryPills.length >= 6 &&
    categoryPills.every((p) => DEFAULT_CATEGORY_IDS.has(p.id));

  for (const pill of pills) {
    if (!pill || pill.id === 'all') continue;
    selectedIds.add(pill.id);
    if (pill.type === 'keyword') {
      selectedSpecificIds.add(pill.id);
      const kw = INTEREST_KEYWORDS.find((k) => k.id === pill.id);
      if (kw) {
        mergeFeatures(rawQueryFeatures, extractFeatures(kw.label, 2.6));
        mergeFeatures(rawQueryFeatures, extractFeatures(KEYWORD_DESCRIPTIONS[kw.id] || '', 1.1));
      } else {
        mergeFeatures(rawQueryFeatures, extractFeatures(pill.id.replace(/[-_]/g, ' '), 2.2));
      }
    } else if (pill.type === 'custom') {
      if (pill.label) mergeFeatures(rawQueryFeatures, extractFeatures(pill.label, 3.0));
      if (pill.keywords) mergeFeatures(rawQueryFeatures, extractFeatures(pill.keywords, 2.5));
    } else if (pill.type === 'category') {
      if (!hasAllDefaultCategories) {
        selectedSpecificIds.add(pill.id);
        const catMeta = CATEGORY_CONCEPT_META.find((c) => c.id === pill.id);
        if (catMeta) {
          mergeFeatures(rawQueryFeatures, extractFeatures(catMeta.label, 1.8));
          mergeFeatures(rawQueryFeatures, extractFeatures(catMeta.description, 0.8));
        }
      }
    }
  }

  // Apply IDF to query features
  const queryVector = new Map<string, number>();
  let querySumSq = 0;
  for (const [term, tf] of rawQueryFeatures) {
    const idf = IDF_MAP.get(term) || 1.2;
    const val = tf * idf;
    queryVector.set(term, val);
    querySumSq += val * val;
  }
  const queryNorm = Math.sqrt(querySumSq);

  // Also build a separate text-only vector (name + description + custom pills)
  // so we can measure how well each selected tag aligns with the space's name/desc
  const textOnlyRaw = new Map<string, number>();
  if (space.name) mergeFeatures(textOnlyRaw, extractFeatures(space.name, 3.5));
  if (space.description) mergeFeatures(textOnlyRaw, extractFeatures(space.description, 2.2));
  for (const pill of pills) {
    if (pill?.type === 'custom') {
      if (pill.label) mergeFeatures(textOnlyRaw, extractFeatures(pill.label, 2.8));
      if (pill.keywords) mergeFeatures(textOnlyRaw, extractFeatures(pill.keywords, 2.2));
    }
  }
  const textOnlyVector = new Map<string, number>();
  let textOnlySumSq = 0;
  for (const [term, tf] of textOnlyRaw) {
    const idf = IDF_MAP.get(term) || 1.2;
    const val = tf * idf;
    textOnlyVector.set(term, val);
    textOnlySumSq += val * val;
  }
  const textOnlyNorm = Math.sqrt(textOnlySumSq);

  const scoredByEmoji = new Map<string, EmojiMatch>();

  for (const concept of ALL_CONCEPTS) {
    let sim = sparseCosineSimilarity(queryVector, queryNorm, concept);
    const textSim = textOnlyNorm > 0 ? sparseCosineSimilarity(textOnlyVector, textOnlyNorm, concept) : 0;

    // Combine overall space embedding similarity with direct text embedding similarity
    let score = sim * 0.65 + textSim * 0.55;

    // Direct interest tag selection bonus
    if (selectedSpecificIds.has(concept.id)) {
      const tagBaseBonus = concept.isBroadCategory ? 0.14 : 0.24;
      // If the selected tag also matches the name/description, boost synergy
      const synergyBonus = textSim * 0.35;
      score += tagBaseBonus + synergyBonus;
    } else if (selectedIds.has(concept.id)) {
      score += 0.04;
    }

    // Slight specificity preference for concrete concepts over generic "-general" buckets
    if (concept.isBroadCategory) {
      score *= 0.9;
    }

    const existing = scoredByEmoji.get(concept.icon);
    if (!existing || score > existing.score) {
      scoredByEmoji.set(concept.icon, {
        emoji: concept.icon,
        id: concept.id,
        label: concept.label,
        group: concept.group,
        score: Math.round(score * 10000) / 10000,
      });
    }
  }

  const ranked = [...scoredByEmoji.values()].sort((a, b) => b.score - a.score);

  // If no signal matched at all (e.g. completely empty new space), provide friendly defaults
  if (ranked.length === 0 || ranked[0].score <= 0) {
    const defaults: EmojiMatch[] = [
      { emoji: '✨', id: 'uplifting', label: 'Sparkles', group: 'Community & Life', score: 0.1 },
      { emoji: '🚀', id: 'space', label: 'Space', group: 'Science & Discovery', score: 0.09 },
      { emoji: '🌿', id: 'animals-nature', label: 'Animals & Nature', group: 'Animals & Nature', score: 0.08 },
      { emoji: '🎨', id: 'arts', label: 'Arts & Crafts', group: 'Arts & Music', score: 0.07 },
      { emoji: '📖', id: 'books', label: 'Books & Reading', group: 'Childcare & Family', score: 0.06 },
      { emoji: '🐾', id: 'animals', label: 'Animals', group: 'Animals & Nature', score: 0.05 },
      { emoji: '🤖', id: 'robots-ai', label: 'Robots & AI', group: 'Science & Discovery', score: 0.04 },
      { emoji: '🌈', id: 'extra-rainbows', label: 'Rainbows', group: 'Planet & Weather', score: 0.03 },
    ];
    return defaults.slice(0, limit);
  }

  return ranked.slice(0, limit);
}

const SINGLE_EMOJI_CLUSTER_RE =
  /^(?:[\u{1F1E6}-\u{1F1FF}]{2}|[#*0-9]\uFE0F?\u20E3|(?!.*[\p{L}\p{N}])(?=.*(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u2600-\u27BF\u2B50\u2B55]))[\p{Emoji}\p{Emoji_Modifier}\uFE0F\u200D\u{E0020}-\u{E007F}]+)$/u;

function splitGraphemes(text: string): string[] {
  const intlWithSegmenter = typeof Intl !== 'undefined' ? (Intl as any) : null;
  if (intlWithSegmenter && typeof intlWithSegmenter.Segmenter === 'function') {
    const segmenter = new intlWithSegmenter.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s: { segment: string }) => s.segment);
  }
  return Array.from(text);
}

/**
 * Extracts a single valid emoji grapheme cluster from a string.
 * Rejects plain text, letters, numbers, and punctuation.
 * If `previousEmoji` is provided and the string contains multiple emojis,
 * prefers the newly added emoji.
 */
export function extractSingleEmoji(
  input?: string | null,
  previousEmoji?: string | null
): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  const clusters = splitGraphemes(trimmed);
  const valid = clusters.filter((c) => SINGLE_EMOJI_CLUSTER_RE.test(c));
  if (valid.length === 0) return '';
  if (valid.length === 1) return valid[0];
  if (previousEmoji && valid[0] === previousEmoji) {
    return valid[valid.length - 1];
  }
  return valid[0];
}

/**
 * Returns true if the input string is a single valid emoji grapheme cluster.
 */
export function isValidEmoji(input?: string | null): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  const clusters = splitGraphemes(trimmed);
  return clusters.length === 1 && SINGLE_EMOJI_CLUSTER_RE.test(clusters[0]);
}

/**
 * Returns true if the input string contains any non-whitespace characters that are not valid emojis.
 */
export function hasNonEmojiCharacters(input?: string | null): boolean {
  if (!input) return false;
  const clusters = splitGraphemes(input);
  return clusters.some((c) => c.trim().length > 0 && !SINGLE_EMOJI_CLUSTER_RE.test(c));
}

/**
 * Returns the closest auto-matched emoji for a Space (ignoring any user override).
 */
export function getAutoSpaceEmoji(space?: SpaceEmojiInput | null): string {
  const matches = getRankedSpaceEmojis(space, 1);
  return matches[0]?.emoji || '✨';
}

/**
 * Returns the effective emoji for a Space:
 * 1. Explicit user override (`space.icon_emoji` or local storage override fallback), validated as emoji-only
 * 2. Auto-matched closest embedding emoji (`getAutoSpaceEmoji(space)`)
 */
export function getSpaceEmoji(space?: SpaceEmojiInput | null): string {
  if (!space) return '✨';
  const explicit = extractSingleEmoji(space.icon_emoji);
  if (explicit) return explicit;
  if (space.id) {
    const localOverride = extractSingleEmoji(getSavedEmojiOverrides()[space.id]);
    if (localOverride) return localOverride;
  }
  return getAutoSpaceEmoji(space);
}

/**
 * Resolves the closest emoji for a freeform text label + optional keywords
 * (used for custom interest pills and unlisted topic pills).
 */
export function getClosestEmojiForText(label?: string | null, keywords?: string | null): string {
  const cleanLabel = (label || '').trim();
  const cleanKeywords = (keywords || '').trim();
  if (!cleanLabel && !cleanKeywords) return '✨';
  return getAutoSpaceEmoji({
    name: cleanLabel,
    keywords: cleanKeywords,
  });
}

/**
 * Resolves the icon emoji for any PillConfig in CategoryNav or ProfileDialog.
 */
export function getPillEmoji(pill: PillConfig, userSpaces?: Space[] | null): string {
  if (pill.type === 'category') {
    const cat = CATEGORIES.find((c) => c.id === pill.id);
    if (cat?.icon) return cat.icon;
  }
  if (pill.type === 'keyword') {
    const kw = INTEREST_KEYWORDS.find((k) => k.id === pill.id);
    if (kw?.icon) return kw.icon;
  }
  if (pill.type === 'space' || pill.type === 'board') {
    if (userSpaces && userSpaces.length > 0) {
      const matchedSpace = userSpaces.find(
        (s) => pill.id === `space-${s.id}` || pill.id === `board-${s.id}` || s.id === pill.id
      );
      if (matchedSpace) {
        return getSpaceEmoji(matchedSpace);
      }
    }
    const explicitPillEmoji = extractSingleEmoji(pill.icon);
    if (explicitPillEmoji) {
      return explicitPillEmoji;
    }
    return getAutoSpaceEmoji({
      name: pill.label || pill.id.replace(/^(space|board)-/, ''),
      keywords: pill.keywords,
    });
  }
  const explicitIcon = extractSingleEmoji(pill.icon);
  if (explicitIcon) {
    return explicitIcon;
  }
  return getClosestEmojiForText(pill.label || pill.id, pill.keywords);
}

/**
 * Queries the Cloudflare Worker's `/api/space/emoji` BGE neural embedding endpoint
 * to compute 768-dim cosine similarity against `keyword_embeddings` in Supabase.
 * Caches the result and returns the ranked matches (or null if offline/unavailable).
 */
export async function fetchWorkerSpaceEmojiMatches(
  space: SpaceEmojiInput
): Promise<EmojiMatch[] | null> {
  const sig = getSpaceSignature(space);
  if (!sig) return null;
  if (workerEmojiCache.has(sig)) {
    return workerEmojiCache.get(sig) || null;
  }

  const workerUrl = NEWS_CONFIG.workerUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${workerUrl}/api/space/emoji`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: space.name || '',
        description: space.description || '',
        slug: space.slug || '',
        pills: space.pills || [],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data?.matches) && data.matches.length > 0) {
      const matches: EmojiMatch[] = data.matches.map((m: any) => ({
        emoji: m.emoji,
        id: m.id || '',
        label: m.label || '',
        group: m.group || '',
        score: Number(m.confidence ?? m.score ?? 0),
      }));
      workerEmojiCache.set(sig, matches);
      return matches;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Grouped emoji catalog for the Space emoji override picker UI.
 */
export interface EmojiPickerGroup {
  group: string;
  items: Array<{ emoji: string; label: string; id: string }>;
}

let cachedPickerGroups: EmojiPickerGroup[] | null = null;

export function getEmojiPickerGroups(): EmojiPickerGroup[] {
  if (cachedPickerGroups) return cachedPickerGroups;
  buildConceptIndex();

  const groupMap = new Map<string, Array<{ emoji: string; label: string; id: string }>>();
  const seenEmojis = new Set<string>();

  for (const concept of ALL_CONCEPTS) {
    if (seenEmojis.has(concept.icon)) continue;
    seenEmojis.add(concept.icon);
    const groupName = concept.group || 'More';
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName)!.push({
      emoji: concept.icon,
      label: concept.label,
      id: concept.id,
    });
  }

  cachedPickerGroups = [...groupMap.entries()].map(([group, items]) => ({
    group,
    items,
  }));
  return cachedPickerGroups;
}
