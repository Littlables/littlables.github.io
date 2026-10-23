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

export const KEYWORD_DESCRIPTIONS_VERSION = 11;

export const INTEREST_KEYWORDS = Object.freeze([
  // ---- Animals & Nature ----
  { id: 'animals-nature', label: 'Animals & Nature', icon: '🌿', group: 'Animals & Nature', description: 'general animals and nature news: wildlife, pets, natural world, conservation' },
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
  { id: 'rainforests', label: 'Rainforests', icon: '🌴', group: 'Animals & Nature', description: 'tropical rainforest nature: jungle ecosystems, canopy wildlife, monkeys, toucans, wild rainforest conservation' },
  { id: 'endangered-species', label: 'Endangered Species', icon: '🦏', group: 'Animals & Nature', description: 'conservation news: endangered animals, protection efforts, saving species from extinction' },
  { id: 'rivers-lakes', label: 'Rivers & Lakes', icon: '🏞️', group: 'Animals & Nature', description: 'rivers and lakes: waterfalls, ponds, river wildlife, kayaking, lake adventures' },

  // ---- Science & Discovery ----
  { id: 'science-discovery-general', label: 'Science & Discovery', icon: '🔭', group: 'Science & Discovery', description: 'general science news: discoveries, research, exploration, innovation' },
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
  { id: 'archaeology', label: 'Archaeology', icon: '🏺', group: 'Science & Discovery', description: 'ancient discoveries: mummies, pyramids, buried treasure, old ruins, fossils of human history' },

  // ---- Childcare & Family ----
  { id: 'childcare-family-general', label: 'Childcare & Family', icon: '👨‍👩‍👧‍👦', group: 'Childcare & Family', description: 'general childcare and family news: parenting, kids, family life' },
  { id: 'parenting', label: 'Parenting', icon: '👨‍👩‍👧', group: 'Childcare & Family', description: 'parenting advice: raising babies and kids, parenting tips, family routines' },
  { id: 'education', label: 'Education', icon: '🎓', group: 'Childcare & Family', description: 'school and learning: teachers, classrooms, homework help, studying tips, school news' },
  { id: 'kids-crafts', label: 'Kids Crafts', icon: '🎨', group: 'Childcare & Family', description: 'craft projects for kids: DIY art, coloring, building things, creative rainy-day activities' },
  { id: 'books', label: 'Books & Reading', icon: '📖', group: 'Childcare & Family', description: 'reading and books: new children\'s books, authors, libraries, story time, book lists' },
  { id: 'babies', label: 'Babies', icon: '👶', group: 'Childcare & Family', description: 'baby stories: newborns, first steps, baby milestones, infant care' },
  { id: 'toddlers', label: 'Toddlers', icon: '🧒', group: 'Childcare & Family', description: 'toddler life: preschoolers, playtime, early learning, funny toddler moments' },
  { id: 'bedtime-stories', label: 'Bedtime Stories', icon: '✨', group: 'Childcare & Family', description: 'bedtime reading: goodnight books, bedtime routines, calming stories before sleep' },
  { id: 'fairy-tales', label: 'Fairy Tales', icon: '🏰', group: 'Childcare & Family', description: 'fairy tale stories: princesses, dragons, castles, magic kingdoms, classic tales retold' },
  { id: 'superheroes', label: 'Superheroes', icon: '🦸', group: 'Childcare & Family', description: 'superhero stories: heroes with powers, comic heroes, saving the day' },
  { id: 'playgrounds', label: 'Playgrounds', icon: '🛝', group: 'Childcare & Family', description: 'playground fun: slides, swings, parks, new playgrounds opening' },
  { id: 'birthday-parties', label: 'Birthday Parties', icon: '🎂', group: 'Childcare & Family', description: 'birthday celebrations: parties, cake, presents, party games and themes' },
  { id: 'summer-camp', label: 'Summer Camp', icon: '🔥', group: 'Childcare & Family', description: 'camp stories: summer camp activities, campfires, cabins, making camp friends' },
  { id: 'teens', label: 'Teens & Tweens', icon: '🧑‍🎤', group: 'Childcare & Family', description: 'teen life: high school, friendships, growing up, teen achievements and milestones' },
  { id: 'collecting', label: 'Collecting', icon: '🃏', group: 'Childcare & Family', description: 'collecting hobbies: trading cards, stamps, coins, rocks and shells, prized collections' },
  { id: 'toys', label: 'Toys', icon: '🧸', group: 'Childcare & Family', description: 'toy news: new toys, toy safety recalls, classic toys, how toys are made' },

  // ---- Food ----
  { id: 'food-general', label: 'Food', icon: '🍽️', group: 'Food', description: 'general food news: cooking, recipes, restaurants, culinary trends' },
  { id: 'food', label: 'Food', icon: '🍎', group: 'Food', description: 'food and cooking: recipes to try, restaurants, chefs, meals, snacks and treats' },
  { id: 'baking', label: 'Baking', icon: '🧁', group: 'Food', description: 'baking projects: cupcakes, cookies, cakes, ovens, frosting, bakeries' },
  { id: 'desserts', label: 'Desserts', icon: '🍦', group: 'Food', description: 'sweet treats: ice cream, candy, milkshakes, dessert recipes' },
  { id: 'fruits-veggies', label: 'Fruits & Veggies', icon: '🥦', group: 'Food', description: 'healthy eating: fruits, vegetables, farms, harvests, farmers markets' },
  { id: 'pizza', label: 'Pizza', icon: '🍕', group: 'Food', description: 'pizza stories: pizzerias, pizza-making, pizza night' },
  { id: 'breakfast', label: 'Breakfast', icon: '🥞', group: 'Food', description: 'morning meals: pancakes, cereal, waffles, breakfast recipes' },
  { id: 'chocolate', label: 'Chocolate', icon: '🍫', group: 'Food', description: 'chocolate stories: cocoa, candy-making, chocolate factories' },
  { id: 'picnics', label: 'Picnics', icon: '🧺', group: 'Food', description: 'outdoor eating: picnics, lunchboxes, packed lunches' },

  // ---- Sports & Play ----
  { id: 'sports-play-general', label: 'Sports & Play', icon: '🏃', group: 'Sports & Play', description: 'general sports news: games, athletics, play, physical activity' },
  { id: 'sports', label: 'Sports', icon: '⚽', group: 'Sports & Play', description: 'youth and pro sports: soccer, basketball, baseball games, athletes, competitions, team spirit' },
  { id: 'swimming', label: 'Swimming', icon: '🏊', group: 'Sports & Play', description: 'swimming stories: pools, swim lessons, swim teams, water safety' },
  { id: 'gymnastics', label: 'Gymnastics', icon: '🤸', group: 'Sports & Play', description: 'gymnastics: tumbling, balance beams, flips, gymnasts competing' },
  { id: 'dance', label: 'Dance', icon: '💃', group: 'Sports & Play', description: 'dance stories: ballet, hip hop, recitals, dance classes and performances' },
  { id: 'martial-arts', label: 'Martial Arts', icon: '🥋', group: 'Sports & Play', description: 'martial arts training: karate, taekwondo, discipline, belt tests' },
  { id: 'olympics', label: 'Olympics', icon: '🏅', group: 'Sports & Play', description: 'Olympic and Paralympic games: gold medals, world records, athletes competing for their countries' },
  { id: 'biking', label: 'Biking', icon: '🚲', group: 'Sports & Play', description: 'cycling stories: bike rides, bike trails, learning to ride, bike safety' },
  { id: 'skateboarding', label: 'Skateboarding', icon: '🛹', group: 'Sports & Play', description: 'skateboarding: skate parks, tricks, scooters' },
  { id: 'hiking', label: 'Hiking', icon: '🥾', group: 'Sports & Play', description: 'hiking adventures: trails, backpacks, nature walks, scenic viewpoints' },
  { id: 'fishing', label: 'Fishing', icon: '🎣', group: 'Sports & Play', description: 'fishing trips: lakes, boats, catching fish, fishing with family' },

  // ---- Arts & Music ----
  { id: 'arts-music-general', label: 'Arts & Music', icon: '🎨', group: 'Arts & Music', description: 'general arts and music news: creativity, artistic expression, performances' },
  { id: 'music', label: 'Music', icon: '🎵', group: 'Arts & Music', description: 'music stories: songs, concerts, bands, learning instruments, piano, guitar, young musicians' },
  { id: 'painting', label: 'Painting', icon: '🖌️', group: 'Arts & Music', description: 'painting and art: watercolors, famous paintings, artists, art projects' },
  { id: 'drawing', label: 'Drawing', icon: '✏️', group: 'Arts & Music', description: 'drawing: sketching, cartoons, doodles, learn-to-draw guides' },
  { id: 'theater', label: 'Theater', icon: '🎭', group: 'Arts & Music', description: 'theater and plays: acting, school plays, musicals, stage performances' },
  { id: 'magic', label: 'Magic', icon: '🪄', group: 'Arts & Music', description: 'magic tricks: magicians, illusions, learn-a-trick guides, magic shows' },
  { id: 'lego', label: 'LEGO & Building', icon: '🧱', group: 'Arts & Music', description: 'LEGO building: new sets, building challenges, creative constructions' },
  { id: 'photography', label: 'Photography', icon: '📸', group: 'Arts & Music', description: 'photography: cameras, taking great pictures, photo tips for kids' },
  { id: 'fashion', label: 'Fashion', icon: '👗', group: 'Arts & Music', description: 'fashion and style: fun outfits, designers, dress-up, costumes, runway shows' },

  // ---- Tech & Games ----
  { id: 'tech-games-general', label: 'Tech & Games', icon: '💡', group: 'Tech & Games', description: 'general tech news: gadgets, gaming, innovation, digital world' },
  { id: 'video-games', label: 'Video Games', icon: '🎮', group: 'Tech & Games', description: 'video game news: new game releases, Minecraft, Nintendo, esports tournaments, gaming tips, kid-friendly games' },
  { id: 'coding', label: 'Coding', icon: '💻', group: 'Tech & Games', description: 'learning to code: programming for kids, Scratch, building apps and games' },
  { id: 'apps', label: 'Apps', icon: '📱', group: 'Tech & Games', description: 'app news: educational apps, tablets, phones, screen-time tips for families' },
  { id: 'internet-safety', label: 'Internet Safety', icon: '🛡️', group: 'Tech & Games', description: 'staying safe online: passwords, cyberbullying prevention, kind online behavior, privacy for kids' },
  { id: 'virtual-reality', label: 'Virtual Reality', icon: '🥽', group: 'Tech & Games', description: 'VR experiences: virtual reality headsets, immersive games and tours' },
  { id: 'drones', label: 'Drones', icon: '🛸', group: 'Tech & Games', description: 'drone stories: flying drones, aerial photos, how drones work' },
  { id: 'electric-cars', label: 'Electric Cars', icon: '🚗', group: 'Tech & Games', description: 'electric vehicles families can buy: EV reviews, charging stations, battery range, going electric' },
  { id: 'board-games', label: 'Board Games', icon: '🎲', group: 'Tech & Games', description: 'tabletop games: board games, card games, puzzles, family game night ideas, chess' },

  // ---- Shows & Fun ----
  { id: 'shows-fun-general', label: 'Shows & Fun', icon: '🎪', group: 'Shows & Fun', description: 'general shows and fun news: entertainment, activities, amusement' },
  { id: 'family-movies', label: 'Family Movies', icon: '🎬', group: 'Shows & Fun', description: 'family film news: new animated movies, Disney, Pixar, movie night picks' },
  { id: 'tv-shows', label: 'TV Shows', icon: '📺', group: 'Shows & Fun', description: 'kids\' TV: new shows, cartoons, episodes, what to watch streaming' },
  { id: 'comics', label: 'Comics', icon: '💬', group: 'Shows & Fun', description: 'comics and graphic novels: manga, comic books, visual storytelling' },
  { id: 'theme-parks', label: 'Theme Parks', icon: '🎢', group: 'Shows & Fun', description: 'theme park news: new rides, Disney World, roller coasters, planning a park visit' },
  { id: 'circus', label: 'Circus', icon: '🎪', group: 'Shows & Fun', description: 'circus performances: acrobats, clowns, big-top shows' },
  { id: 'online-creators', label: 'Online Creators', icon: '🎥', group: 'Shows & Fun', description: 'online video stars: YouTubers, streamers, viral videos, kid creators, family channels' },

  // ---- Celebrity & Entertainment ----
  { id: 'celebrity-entertainment-general', label: 'Celebrity & Entertainment', icon: '✨', group: 'Celebrity & Entertainment', description: 'general celebrity and entertainment news: stars, Hollywood, pop culture' },
  { id: 'entertainment', label: 'Entertainment', icon: '🌟', group: 'Celebrity & Entertainment', description: 'entertainment and pop culture news: celebrities, Hollywood, red carpets, viral stars, showbiz stories' },
  { id: 'celebrities', label: 'Celebrities', icon: '⭐', group: 'Celebrity & Entertainment', description: 'celebrity news: famous actors, musicians, athletes, star interviews, red carpet moments' },
  { id: 'hollywood', label: 'Hollywood', icon: '🎞️', group: 'Celebrity & Entertainment', description: 'Hollywood news: movie studios, film premieres, entertainment industry, blockbusters' },

  // ---- Planet & Weather ----
  { id: 'planet-weather-general', label: 'Planet & Weather', icon: '🌎', group: 'Planet & Weather', description: 'general planet and weather news: earth, climate, seasons, environment' },
  { id: 'weather', label: 'Weather', icon: '🌤️', group: 'Planet & Weather', description: 'weather stories: forecasts, rain, snow, storms, seasons, tornadoes, weather science' },
  { id: 'environment', label: 'Environment', icon: '🌍', group: 'Planet & Weather', description: 'planet protection: conservation, recycling, climate action, pollution cleanup, Earth Day' },
  { id: 'gardening', label: 'Gardening', icon: '🌱', group: 'Planet & Weather', description: 'gardening with kids: planting seeds, growing vegetables, flowers, garden projects' },
  { id: 'flowers', label: 'Flowers', icon: '🌸', group: 'Planet & Weather', description: 'flower stories: bouquets, blossoms, gardens in bloom, wildflowers' },
  { id: 'seasons', label: 'Seasons', icon: '🍂', group: 'Planet & Weather', description: 'seasonal changes: autumn leaves, first snow, spring blooms, how seasons work' },
  { id: 'snow', label: 'Snow', icon: '❄️', group: 'Planet & Weather', description: 'snow day fun: snowmen, sledding, snowflakes, winter storms' },
  { id: 'clouds', label: 'Clouds', icon: '☁️', group: 'Planet & Weather', description: 'cloud watching: cloud shapes, types of clouds, sky science' },

  // ---- Travel & Places ----
  { id: 'travel-places-general', label: 'Travel & Places', icon: '🧳', group: 'Travel & Places', description: 'general travel news: destinations, adventures, exploring places' },
  { id: 'travel', label: 'Travel', icon: '✈️', group: 'Travel & Places', description: 'family travel: vacations, airplanes, hotels, tourist attractions, trip planning' },
  { id: 'camping', label: 'Camping', icon: '🏕️', group: 'Travel & Places', description: 'camping trips: tents, campfires, campgrounds, sleeping under the stars' },
  { id: 'road-trips', label: 'Road Trips', icon: '🚙', group: 'Travel & Places', description: 'road trip stories: car rides, highways, rest stops, scenic drives' },
  { id: 'landmarks', label: 'Landmarks', icon: '🗽', group: 'Travel & Places', description: 'famous places: monuments, statues, world wonders, visiting landmarks' },
  { id: 'maps', label: 'Maps', icon: '🗺️', group: 'Travel & Places', description: 'maps and geography: atlases, learning countries, how maps work' },
  { id: 'languages', label: 'Languages', icon: '🗣️', group: 'Travel & Places', description: 'learning languages: new words, bilingual kids, Spanish, French' },
  { id: 'world-cultures', label: 'World Cultures', icon: '🌏', group: 'Travel & Places', description: 'kids around the world: traditions, festivals, daily life in other countries, cultural celebrations' },

  // ---- Holidays ----
  { id: 'holidays-general', label: 'Holidays', icon: '🎉', group: 'Holidays', description: 'general holiday news: celebrations, traditions, festive events' },
  { id: 'holidays', label: 'Holidays', icon: '🎄', group: 'Holidays', description: 'holiday celebrations: traditions, festivals, family gatherings' },
  { id: 'christmas', label: 'Christmas', icon: '🎅', group: 'Holidays', description: 'Christmas stories: Santa, gifts, trees, holiday spirit, Christmas morning' },
  { id: 'halloween', label: 'Halloween', icon: '🎃', group: 'Holidays', description: 'Halloween fun: costumes, trick-or-treating, pumpkins, spooky (not scary) stories' },
  { id: 'easter', label: 'Easter', icon: '🐰', group: 'Holidays', description: 'Easter: egg hunts, bunnies, spring celebrations' },
  { id: 'thanksgiving', label: 'Thanksgiving', icon: '🦃', group: 'Holidays', description: 'Thanksgiving: turkey dinner, gratitude, family feasts' },
  { id: 'new-year', label: 'New Year', icon: '🎆', group: 'Holidays', description: 'New Year: fireworks, resolutions, countdowns, fresh starts' },

  // ---- Community & Life ----
  { id: 'community-life-general', label: 'Community & Life', icon: '🏘️', group: 'Community & Life', description: 'general community news: people, volunteering, local heroes, daily life' },
  { id: 'community-heroes', label: 'Community Heroes', icon: '🤝', group: 'Community & Life', description: 'local heroes: neighbors helping neighbors, volunteers, acts of kindness, community projects' },
  { id: 'health', label: 'Health', icon: '🩺', group: 'Community & Life', description: 'health news: doctors, wellness, exercise, nutrition, how to stay healthy' },
  { id: 'money', label: 'Money & Saving', icon: '💰', group: 'Community & Life', description: 'money skills: saving, allowance, kid entrepreneurs, how money works' },
  { id: 'history', label: 'History', icon: '🏛️', group: 'Community & Life', description: 'history stories: past eras, ancient civilizations, museums, historical anniversaries' },
  { id: 'volunteering', label: 'Volunteering', icon: '💝', group: 'Community & Life', description: 'giving back: volunteering, charity drives, fundraisers, helping causes' },
  { id: 'big-feelings', label: 'Big Feelings', icon: '💛', group: 'Community & Life', description: 'understanding emotions: managing big feelings, calming down, mindfulness for kids, being kind to yourself' },
  { id: 'religion', label: 'Religion', icon: '🕊️', group: 'Community & Life', description: 'faith and religion news: religious holidays, traditions, churches, mosques, temples, interfaith community stories' },
  { id: 'records', label: 'Records & Firsts', icon: '🏆', group: 'Community & Life', description: 'amazing achievements: world records, incredible firsts, extraordinary feats by kids and everyday people' },

  // ---- Flagged (excluded from front-page feeds) ----
  // These keywords label content we do NOT want on the front page (it never
  // shows in category feeds, including "all"). They still classify normally,
  // show distinctly in the admin panel, and ARE available for custom boards.
  { id: 'stocks', label: 'Stocks', icon: '📈', group: 'Flagged', excluded: true, description: 'stock market news: stock prices, investing, VIX index, market sell-offs, shareholder news' },
  { id: 'cryptocurrency', label: 'Crypto', icon: '₿', group: 'Flagged', excluded: true, description: 'cryptocurrency news: Bitcoin, crypto prices, blockchain coins, crypto markets' },
  { id: 'business-news', label: 'Business News', icon: '💼', group: 'Flagged', excluded: true, description: 'corporate business news: earnings reports, mergers and acquisitions, company layoffs, CEO announcements' },
  { id: 'clickbait', label: 'Clickbait', icon: '🎣', group: 'Flagged', excluded: true, description: 'clickbait stories: sensationalist headlines, misleading titles, exaggerated claims designed to get clicks' },

  // ---- Politics (excluded from front page, available for boards) ----
  { id: 'politics', label: 'Politics', icon: '🏛️', group: 'Politics', excluded: true, description: 'political news: politicians, political parties, campaigns, political debates and commentary' },
  { id: 'elections', label: 'Elections', icon: '🗳️', group: 'Politics', excluded: true, description: 'elections and voting news: election campaigns, candidates, voting, election results' },
  { id: 'government', label: 'Government', icon: '🏢', group: 'Politics', excluded: true, description: 'government and policy news: new laws, government decisions, public policy, regulations' },

  // ---- Countries ----
  { id: 'countries-general', label: 'Countries', icon: '🌐', group: 'Countries', description: 'general country news: nations around the world, international stories' },
  // Geographic grouping: tag stories by the country they are about/from.
  // Powers country boards today; pairs with the planned region/country_code
  // columns for per-country content serving later.
  { id: 'country-us', label: 'United States', icon: '🇺🇸', group: 'Countries', description: 'stories about the United States: American news, US cities, states, American culture' },
  { id: 'country-uk', label: 'United Kingdom', icon: '🇬🇧', group: 'Countries', description: 'stories about the United Kingdom: Britain, England, London, British culture and news' },
  { id: 'country-canada', label: 'Canada', icon: '🇨🇦', group: 'Countries', description: 'stories about Canada: Canadian news, Toronto, Vancouver, Canadian culture and wildlife' },
  { id: 'country-australia', label: 'Australia', icon: '🇦🇺', group: 'Countries', description: 'stories about Australia: Sydney, the outback, kangaroos, Australian news and culture' },
  { id: 'country-nz', label: 'New Zealand', icon: '🇳🇿', group: 'Countries', description: 'stories about New Zealand: Kiwi culture, Auckland, New Zealand landscapes and news' },
  { id: 'country-ireland', label: 'Ireland', icon: '🇮🇪', group: 'Countries', description: 'stories about Ireland: Dublin, Irish culture, music, and news' },
  { id: 'country-france', label: 'France', icon: '🇫🇷', group: 'Countries', description: 'stories about France: Paris, French culture, food, art, and news' },
  { id: 'country-germany', label: 'Germany', icon: '🇩🇪', group: 'Countries', description: 'stories about Germany: Berlin, German engineering, culture, and news' },
  { id: 'country-italy', label: 'Italy', icon: '🇮🇹', group: 'Countries', description: 'stories about Italy: Rome, Venice, Italian food, art, history, and news' },
  { id: 'country-spain', label: 'Spain', icon: '🇪🇸', group: 'Countries', description: 'stories about Spain: Madrid, Barcelona, Spanish culture, festivals, and news' },
  { id: 'country-netherlands', label: 'Netherlands', icon: '🇳🇱', group: 'Countries', description: 'stories about the Netherlands: Amsterdam, tulips, windmills, Dutch culture and news' },
  { id: 'country-sweden', label: 'Sweden', icon: '🇸🇪', group: 'Countries', description: 'stories about Sweden: Stockholm, Swedish design, nature, and news' },
  { id: 'country-china', label: 'China', icon: '🇨🇳', group: 'Countries', description: 'stories about China: Beijing, Shanghai, pandas, Chinese culture and news' },
  { id: 'country-japan', label: 'Japan', icon: '🇯🇵', group: 'Countries', description: 'stories about Japan: Tokyo, Kyoto, cherry blossoms, anime, Japanese culture and news' },
  { id: 'country-india', label: 'India', icon: '🇮🇳', group: 'Countries', description: 'stories about India: Mumbai, Delhi, Diwali, Indian culture, food, and news' },
  { id: 'country-korea', label: 'South Korea', icon: '🇰🇷', group: 'Countries', description: 'stories about South Korea: Seoul, K-pop, Korean food, technology, and news' },
  { id: 'country-mexico', label: 'Mexico', icon: '🇲🇽', group: 'Countries', description: 'stories about Mexico: Mexico City, tacos, Day of the Dead, Mexican culture and news' },
  { id: 'country-brazil', label: 'Brazil', icon: '🇧🇷', group: 'Countries', description: 'stories about Brazil: Rio de Janeiro, the Amazon, carnival, football, and news' },
  { id: 'country-south-africa', label: 'South Africa', icon: '🇿🇦', group: 'Countries', description: 'stories about South Africa: Cape Town, safaris, wildlife, and news' },
  { id: 'country-egypt', label: 'Egypt', icon: '🇪🇬', group: 'Countries', description: 'stories about Egypt: pyramids, the Nile, ancient history, and news' },
]);

export const INTEREST_KEYWORD_IDS = new Set(INTEREST_KEYWORDS.map((k) => k.id));

/** Ids of keywords flagged as excluded from front-page feeds. */
export const EXCLUDED_KEYWORD_IDS = new Set(
  INTEREST_KEYWORDS.filter((k) => k.excluded === true).map((k) => k.id)
);

/** True when the keyword is flagged as excluded from front-page feeds. */
export function isExcludedKeyword(id) {
  const kw = getInterestKeyword(id);
  return kw !== null && kw.excluded === true;
}

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

/**
 * Country keyword id -> ISO 3166-1 alpha-2 code.
 * Used to derive a story's country_code from its interest keywords.
 */
export const COUNTRY_KEYWORD_TO_ISO = {
  'country-us': 'US',
  'country-uk': 'GB',
  'country-canada': 'CA',
  'country-australia': 'AU',
  'country-nz': 'NZ',
  'country-ireland': 'IE',
  'country-france': 'FR',
  'country-germany': 'DE',
  'country-italy': 'IT',
  'country-spain': 'ES',
  'country-netherlands': 'NL',
  'country-sweden': 'SE',
  'country-china': 'CN',
  'country-japan': 'JP',
  'country-india': 'IN',
  'country-korea': 'KR',
  'country-mexico': 'MX',
  'country-brazil': 'BR',
  'country-south-africa': 'ZA',
  'country-egypt': 'EG',
};

/**
 * Derive a story's ISO country code from its interest keywords.
 * Returns the first matching country keyword's ISO code, or null.
 */
export function deriveCountryFromKeywords(keywords) {
  if (!Array.isArray(keywords)) return null;
  for (const kw of keywords) {
    const iso = COUNTRY_KEYWORD_TO_ISO[kw];
    if (iso) return iso;
  }
  return null;
}

/**
 * ISO country code -> broad region. Mirrors the country_regions SQL table.
 * Keep in sync when adding new country keywords.
 */
export const COUNTRY_TO_REGION = {
  US: 'north-america', CA: 'north-america', MX: 'north-america',
  GB: 'europe', IE: 'europe', FR: 'europe', DE: 'europe', IT: 'europe',
  ES: 'europe', NL: 'europe', SE: 'europe',
  BR: 'south-america',
  AU: 'oceania', NZ: 'oceania',
  CN: 'asia', JP: 'asia', IN: 'asia', KR: 'asia',
  ZA: 'africa', EG: 'africa',
};

/**
 * Derive { country_code, region } from a story's interest keywords.
 * Returns { country_code: null, region: 'global' } when no country keyword matches.
 */
export function deriveStoryRegion(keywords) {
  const iso = deriveCountryFromKeywords(keywords);
  if (!iso) return { country_code: null, region: 'global' };
  return { country_code: iso, region: COUNTRY_TO_REGION[iso] || 'global' };
}
