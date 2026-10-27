import { upsertNewsStories, supabaseUrl, supabaseHeaders, readRows, STORIES_TABLE } from './news-storage.mjs';

// One-time kid-safe Halloween batch (Oct 2026): 20 stories across all
// six front-page categories. These are staged as
// UNAPPROVED stories: they land in Pending Approval for the normal
// approve/reject flow and never get the curated/approved placement until
// an admin approves them. Re-running is safe:
//  - upsertNewsStories dedups on provider + category + article_url and
//    merges the image/description onto existing rows;
//  - interest keywords are only patched onto rows whose
//    interest_keywords are still NULL, so hand-set tags are never clobbered.
// Images are the articles' own hero images where one could be read, else the
// site's own category fallback image (absolute URL, so deep routes resolve).
export const HALLOWEEN_BATCH_PROVIDER = 'halloween-batch';

const FALLBACK_IMG = category => 'https://littlables.com/img/' + category + '_1.jpg';

export const HALLOWEEN_BATCH = [
  {
    title: 'Paper Plate Pumpkin',
    link: 'https://www.thebestideasforkids.com/paper-plate-pumpkin/',
    description: 'Paint a paper plate orange, add a funny face and a pipe-cleaner stem — an easy pumpkin craft for little hands.',
    source: 'The Best Ideas for Kids',
    category: 'arts',
    image: 'https://www.thebestideasforkids.com/wp-content/uploads/2022/10/Paper-Plate-Pumpkin-Craft-640x960.jpg',
    interests: ['kids-crafts', 'holidays', 'halloween']
  },
  {
    title: 'Tissue Paper Pumpkins',
    link: 'https://smashedpeasandcarrots.com/tissue-paper-pumpkins-tutorial/',
    description: 'Layer orange tissue paper squares onto contact paper to make a pumpkin suncatcher for the window.',
    source: 'Smashed Peas and Carrots',
    category: 'arts',
    image: 'https://smashedpeasandcarrots.com/wp-content/uploads/2011/10/IMG_5214.1.jpg',
    interests: ['kids-crafts', 'holidays', 'halloween']
  },
  {
    title: 'Making a Paper Mache Pumpkin',
    link: 'https://www.rhs.org.uk/education-learning/children-young-people/family-activities/do-it/make-a-paper-mache-pumpkin',
    description: 'Build a pumpkin from straw circles, cling film and paper mache — a windowsill decoration to keep (no candles).',
    source: 'RHS',
    category: 'arts',
    image: 'https://www.rhs.org.uk/getmedia/2307c2da-453c-47ee-9fcf-8bba57683de2/paper-mache-pumpkin-final_940x627.jpg?width=940&height=627&ext=.jpg',
    interests: ['kids-crafts', 'holidays', 'halloween']
  },
  {
    title: '75+ Easy Halloween Crafts for Kids',
    link: 'https://sarahscoop.com/easy-halloween-crafts-for-kids/',
    description: 'A big roundup of simple, affordable Halloween crafts using paper, cardboard, pipe cleaners and felt.',
    source: 'Sarah Scoop',
    category: 'arts',
    image: FALLBACK_IMG('arts'),
    interests: ['kids-crafts', 'holidays', 'halloween']
  },
  {
    title: 'Halloween Crafts for a 3-Year-Old',
    link: 'https://learningcorner.co/explain-anything/20654',
    description: 'Three toddler-safe crafts: a paper plate pumpkin, a handprint ghost and a toilet-paper-roll bat.',
    source: 'Learning Corner',
    category: 'childcare',
    image: FALLBACK_IMG('arts'),
    interests: ['toddlers', 'kids-crafts', 'halloween']
  },
  {
    title: 'Easy Halloween Kid Crafts: Spooky Fun & Learning',
    link: 'https://www.imthecheftoo.com/blogs/stem-for-kids/easy-halloween-kid-crafts-spooky-fun-learning',
    description: 'No-carve pumpkin monsters, stained-glass window jack-o-lanterns and pumpkin name puzzles — no carving tools needed.',
    source: "I'm the Chef Too",
    category: 'arts',
    image: FALLBACK_IMG('arts'),
    interests: ['kids-crafts', 'holidays', 'halloween']
  },
  {
    title: 'Halloween Season at LEGOLAND California: Brick or Treat Fun the Whole Family Will Love',
    link: 'https://www.funwithkidsinla.com/post/halloween-season-at-legoland-california-brick-or-treat-fun-the-whole-family-will-love',
    description: 'Silly monsters, LEGO decorations, character meet-and-greets and not-too-scary fun, September 20 through October 30, 2026.',
    source: 'Fun With Kids in LA',
    category: 'world',
    image: 'https://static.wixstatic.com/media/f7111f_2c4e63fda0f64621b3080d6fb5fed527~mv2.jpg/v1/fill/w_800,h_555,al_c,q_85,enc_avif,quality_auto/f7111f_2c4e63fda0f64621b3080d6fb5fed527~mv2.jpg',
    interests: ['theme-parks', 'holidays', 'halloween']
  },
  {
    title: 'Florida Family Halloween Events: LEGOLAND Brick or Treat & SeaWorld Spooktacular',
    link: 'https://portcharlotte.macaronikid.com/articles/6a918d2cd85a1b102f61c5d7/2026-halloween-events-worth-the-drive-from-port-charlotte',
    description: 'LEGOLAND Florida Brick or Treat (select dates September 5–October 31, 2026) and SeaWorld Orlando Halloween Spooktacular (August 29–November 1, 2026): daytime trick-or-treating and playful seasonal characters for younger kids.',
    source: 'Macaroni KID Port Charlotte',
    category: 'world',
    image: 'https://api.macaronikid.com/assets/uploads/width_900,height_600,crop_true/21a95d03-e67b-41f4-b848-60150b3c804d.png',
    interests: ['theme-parks', 'zoos', 'halloween']
  },
  {
    title: "Best Halloween Theme Parks in 2026: Mickey's Not-So-Scary Halloween Party",
    link: 'https://ftjtravelbystacie.wixsite.com/fairytale-journeys/post/best-halloween-theme-parks-in-2026-a-travel-advisor-s-guide-to-the-ultimate-spooky-getaway',
    description: 'Trick-or-treating, characters in Halloween costumes, the Boo-to-You parade and fireworks — fun, not fear.',
    source: 'Fairytale Journeys',
    category: 'world',
    image: 'https://static.wixstatic.com/media/0eaea1_81912993c88742478ef75af43c414ebe~mv2.png/v1/fill/w_980,h_513,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/0eaea1_81912993c88742478ef75af43c414ebe~mv2.png',
    interests: ['theme-parks', 'holidays', 'halloween']
  },
  {
    title: 'Spooky Fun: Easy Halloween Crafts Kids Will Love',
    link: 'https://www.imthecheftoo.com/blogs/stem-for-kids/spooky-fun-easy-halloween-crafts-kids-will-love',
    description: 'Paper plate spiders and bats, ghost garlands, no-carve pumpkin decorating, mummy jars and edible monster treats.',
    source: "I'm the Chef Too",
    category: 'arts',
    image: FALLBACK_IMG('arts'),
    interests: ['kids-crafts', 'holidays', 'halloween']
  },
  {
    title: 'Easy Halloween Crafts Using Things You Already Have at Home',
    link: 'https://www.yourzenmama.com/new-blog/easy-halloween-crafts-using-things-you-already-have-at-home',
    description: 'Paper plate ghosts, toilet roll bats, egg carton spiders, ghost jars and cardboard haunted houses — all from the recycling box.',
    source: 'Your Zen Mama',
    category: 'arts',
    image: FALLBACK_IMG('arts'),
    interests: ['kids-crafts', 'holidays', 'halloween']
  },
  {
    title: 'Easy Halloween Crafts for Kids: Spooky Fun for Growing Voices',
    link: 'https://speechblubs.com/blog/easy-halloween-crafts-for-kids-spooky-fun-for-growing-voices',
    description: 'Toddler and preschooler crafts — sensory ghosts, no-carve pumpkin monsters, yarn mummies and straw-blown ghost art.',
    source: 'Speech Blubs',
    category: 'childcare',
    image: FALLBACK_IMG('arts'),
    interests: ['toddlers', 'kids-crafts', 'halloween']
  },
  {
    title: '18 Halloween Party Ideas for Kids 2025: Fun, Safe, and Creative Celebrations',
    link: 'https://approachinghome.com/halloween-party-ideas-for-kids/',
    description: 'Pumpkin painting, scavenger hunts, spooky science, costume parades, pumpkin bowling and trick-or-treat bag decorating.',
    source: 'Approaching Home',
    category: 'childcare',
    image: 'https://approachinghome.com/wp-content/uploads/2025/08/a-fun-kids-halloween-party-in-a-living-r_ODEEO6iZS5W3WZKn8trLZQ_9QaHD12-TC2h8dE47iVddw-683x1024.avif',
    interests: ['holidays', 'kids-crafts', 'halloween']
  },
  {
    title: '10 Spooktacular & Affordable Halloween Family Activities',
    link: 'https://janetknowsbest.com/10-spooktacular-affordable-halloween-family-activities',
    description: 'DIY decorations, a costume fashion show, a spooky sensory bin, game night, haunted treats and a dance party — all budget-friendly.',
    source: 'Janet Knows Best',
    category: 'childcare',
    image: 'https://janetknowsbest.com/wp-content/uploads/2024/07/affordable-halloween-activites-576x1024.png',
    interests: ['toddlers', 'holidays', 'halloween']
  },
  {
    title: 'Spooky STEM: Halloween Science Activities for Kids',
    link: 'https://www.johnson.k-state.edu/programs/4-h/agent-articles/spooky-stem-halloween-science-activities-for-kids.html',
    description: 'Fizzy pumpkin volcanoes, pumpkin seed slime, bone bridges, candy catapults and shadow puppets — hands-on Halloween science.',
    source: 'K-State Research and Extension',
    category: 'childcare',
    image: 'https://www.johnson.k-state.edu/images/programs/4h/agent-articles/Pic%203%20Cyla%20KFL%20October.jpg',
    interests: ['experiments', 'science', 'halloween']
  },
  {
    title: 'Halloween With Kids: 10 Budget-Friendly Ways to Have Fun',
    link: 'https://thebookishmama.com/halloween-activities-for-kids-on-a-budget/',
    description: 'Ghost bowling, closet costumes, a Halloween treasure hunt, a witch’s potion and a kitchen day — no craft-store splurge needed.',
    source: 'The Bookish Mama',
    category: 'childcare',
    image: 'https://thebookishmama.com/wp-content/uploads/2026/08/thumbnail-768x1024.jpg',
    interests: ['holidays', 'kids-crafts', 'halloween']
  },
  {
    title: 'Halloween Around the World',
    link: 'https://whereverfamily.com/halloween-around-the-world-2/',
    description: 'How other countries mark the season: Mexico’s Day of the Dead, Ireland’s Samhain roots and Spain’s Day of the Witches.',
    source: 'Wherever Family',
    category: 'world',
    image: FALLBACK_IMG('world'),
    interests: ['holidays', 'world-cultures', 'halloween']
  },
  {
    title: '8 Halloween Animals | Animals for Kids',
    link: 'https://classx.org/8-halloween-animals-animals-for-kids-wild-animals/',
    description: 'Owls, rats, bats, cats, spiders, ravens, wolves and toads — why the spookiest animals are actually nature’s helpers.',
    source: 'ClassX',
    category: 'animals',
    image: FALLBACK_IMG('animals'),
    interests: ['animals-nature', 'wildlife', 'halloween']
  },
  {
    title: 'Spooky STEM and Coding: Halloween Activities for Kids',
    link: 'https://www.whalesbot.ai/blog/spooky-stem-and-coding-halloween-activities-for-kids',
    description: 'Scratch Halloween games — Whack-a-Ghost, Candy Clicker, Flying Witch — plus secret coding pictures and melting monsters.',
    source: 'WhalesBot',
    category: 'tech',
    image: FALLBACK_IMG('tech'),
    interests: ['coding', 'experiments', 'halloween']
  },
  {
    title: 'Exploring the Significance of the Teal Pumpkin Project',
    link: 'https://www.care.com/c/teal-pumpkin-project/',
    description: 'A teal pumpkin on the porch means non-food treats for trick-or-treaters — making Halloween safer and more inclusive for kids with food allergies.',
    source: 'Care.com',
    category: 'uplifting',
    image: FALLBACK_IMG('uplifting'),
    interests: ['holidays', 'community-heroes', 'halloween']
  }
];

export async function stageHalloweenBatch(env) {
  const byCategory = new Map();
  for (const story of HALLOWEEN_BATCH) {
    if (!byCategory.has(story.category)) byCategory.set(story.category, []);
    byCategory.get(story.category).push(story);
  }
  let staged = 0;
  let duplicatesSkipped = 0;
  const perCategory = {};
  for (const [category, stories] of byCategory) {
    const result = await upsertNewsStories(env, HALLOWEEN_BATCH_PROVIDER, category, stories);
    perCategory[category] = result;
    staged += result.savedCount;
    duplicatesSkipped += result.duplicatesSkipped;
  }

  // Interest keywords are not part of the ingest row shape, so tag them in a
  // second pass. Rows with no tags get the full batch list; rows with fewer
  // than 3 tags are topped up to it (every batch story carries at least 3).
  // Rows already at 3+ tags are left alone, so hand-set tags are preserved
  // once a story is fully tagged.
  const interestsByUrl = new Map(HALLOWEEN_BATCH.map(story => [story.link, story.interests]));
  const lookupQuery = new URLSearchParams({
    select: 'id,article_url,interest_keywords',
    provider: 'eq.' + HALLOWEEN_BATCH_PROVIDER
  });
  const lookupResponse = await fetch(supabaseUrl(env, STORIES_TABLE, lookupQuery), {
    headers: supabaseHeaders(env)
  });
  const batchRows = await readRows(lookupResponse, 'Halloween batch rows lookup');
  let interestsSet = 0;
  let interestsFailed = 0;
  for (const row of batchRows) {
    const interests = interestsByUrl.get(row.article_url);
    if (!interests) continue;
    // Skip rows already fully tagged (3+); only NULL and short rows get patched.
    if (Array.isArray(row.interest_keywords) && row.interest_keywords.length >= 3) continue;
    const patchQuery = new URLSearchParams({ id: 'eq.' + row.id });
    try {
      const patchResponse = await fetch(supabaseUrl(env, STORIES_TABLE, patchQuery), {
        method: 'PATCH',
        headers: supabaseHeaders(env, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ interest_keywords: interests })
      });
      if (!patchResponse.ok) throw new Error('HTTP ' + patchResponse.status);
      interestsSet++;
    } catch {
      interestsFailed++;
    }
  }
  return { staged, duplicatesSkipped, interestsSet, interestsFailed, byCategory: perCategory };
}
