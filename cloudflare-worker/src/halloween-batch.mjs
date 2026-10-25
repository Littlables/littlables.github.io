import { upsertNewsStories, supabaseUrl, supabaseHeaders, readRows, STORIES_TABLE } from './news-storage.mjs';

// One-time kid-safe Halloween batch (Oct 2026). These are staged as
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
    interests: ['kids-crafts', 'halloween']
  },
  {
    title: 'Tissue Paper Pumpkins',
    link: 'https://smashedpeasandcarrots.com/tissue-paper-pumpkins-tutorial/',
    description: 'Layer orange tissue paper squares onto contact paper to make a pumpkin suncatcher for the window.',
    source: 'Smashed Peas and Carrots',
    category: 'arts',
    image: 'https://smashedpeasandcarrots.com/wp-content/uploads/2011/10/IMG_5214.1.jpg',
    interests: ['kids-crafts', 'halloween']
  },
  {
    title: 'Making a Paper Mache Pumpkin',
    link: 'https://www.rhs.org.uk/education-learning/children-young-people/family-activities/do-it/make-a-paper-mache-pumpkin',
    description: 'Build a pumpkin from straw circles, cling film and paper mache — a windowsill decoration to keep (no candles).',
    source: 'RHS',
    category: 'arts',
    image: 'https://www.rhs.org.uk/getmedia/2307c2da-453c-47ee-9fcf-8bba57683de2/paper-mache-pumpkin-final_940x627.jpg?width=940&height=627&ext=.jpg',
    interests: ['kids-crafts', 'halloween']
  },
  {
    title: '75+ Easy Halloween Crafts for Kids',
    link: 'https://sarahscoop.com/easy-halloween-crafts-for-kids/',
    description: 'A big roundup of simple, affordable Halloween crafts using paper, cardboard, pipe cleaners and felt.',
    source: 'Sarah Scoop',
    category: 'arts',
    image: FALLBACK_IMG('arts'),
    interests: ['kids-crafts', 'halloween']
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
    interests: ['kids-crafts', 'halloween']
  },
  {
    title: 'Halloween Season at LEGOLAND California: Brick or Treat Fun the Whole Family Will Love',
    link: 'https://www.funwithkidsinla.com/post/halloween-season-at-legoland-california-brick-or-treat-fun-the-whole-family-will-love',
    description: 'Silly monsters, LEGO decorations, character meet-and-greets and not-too-scary fun, September 20 through October 30, 2026.',
    source: 'Fun With Kids in LA',
    category: 'world',
    image: 'https://static.wixstatic.com/media/f7111f_2c4e63fda0f64621b3080d6fb5fed527~mv2.jpg/v1/fill/w_800,h_555,al_c,q_85,enc_avif,quality_auto/f7111f_2c4e63fda0f64621b3080d6fb5fed527~mv2.jpg',
    interests: ['theme-parks', 'halloween']
  },
  {
    title: "Knott's Spooky Farm 2026: Guide for Families",
    link: 'https://www.funwithkidsinla.com/post/knotts-spooky-farm-guide-for-families',
    description: "Daytime trick-or-treating through Ghost Town with Snoopy and the Peanuts gang — 'All Fun. No Fear.', September 24 through October 31, 2026.",
    source: 'Fun With Kids in LA',
    category: 'world',
    image: 'https://static.wixstatic.com/media/f7111f_5bf0962b703c4bd3b42d3bb14468d49d~mv2.webp/v1/fill/w_980,h_653,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/f7111f_5bf0962b703c4bd3b42d3bb14468d49d~mv2.webp',
    interests: ['theme-parks', 'halloween']
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
    interests: ['theme-parks', 'halloween']
  },
  {
    title: "Kennywood's Phantom Fall Fest and Hersheypark's Trick-or-Treat Trail",
    link: 'https://www.theweather.com/news/lifestyle/the-5-spookiest-halloween-destinations-haunted-towns-ghosts-and-legends.html',
    description: 'Hersheypark trick-or-treat trail: kids 12 and under collect candy at 14 stops, plus a scare-free Avenue of the Afterlife, through November 1, 2026.',
    source: 'The Weather',
    category: 'world',
    image: 'https://services.meteored.com/img/article/the-5-spookiest-halloween-destinations-haunted-towns-ghosts-and-legends-1792335091938_1280.jpg',
    interests: ['theme-parks', 'halloween']
  },
  {
    title: 'Boo at the Zoo — Santa Barbara',
    link: 'https://lafamilytravel.com/halloween-in-la-and-around-california/',
    description: 'Daytime Boo October 16–31: scavenger hunt, costume parade, story time and a hay maze — no scares at all, best for ages 2–10.',
    source: 'LA Family Travel',
    category: 'animals',
    image: 'https://lafamilytravelwordpressbucket.s3.us-east-2.amazonaws.com/wp-content/uploads/2023/10/09122857/boo_at_the_zoo_3_pumpkin_lion.webp',
    interests: ['zoos', 'halloween']
  },
  {
    title: 'Stage Fright: A Halloween Family Festival at Klyde Warren Park',
    link: 'https://cravedfw.com/2026/10/13/family-friendly-dfw-halloween/',
    description: 'A free family festival in Dallas on October 31, 10am–1pm: crafts, performances and one more round of costumes before trick-or-treating.',
    source: 'Crave DFW',
    category: 'world',
    image: FALLBACK_IMG('world'),
    interests: ['holidays', 'halloween']
  },
  {
    title: 'Best Halloween Destinations for Families in the USA (2026)',
    link: 'https://themomtrotter.com/the-best-places-for-families-to-celebrate-halloween-in-the-usa/',
    description: 'Anoka, Sleepy Hollow, Salem, St. Helens and New Orleans — family Halloween trips from parades to pumpkin displays.',
    source: 'The Mom Trotter',
    category: 'world',
    image: 'https://themomtrotter.com/wp-content/uploads/2022/10/Best-Halloween-Destinations-for-Families-in-the-USA.jpg-1024x683.jpeg',
    interests: ['travel', 'halloween']
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
  // second pass — but only rows that have no tags yet, so re-runs enrich
  // first-push rows without clobbering hand-set tags.
  const interestsByUrl = new Map(HALLOWEEN_BATCH.map(story => [story.link, story.interests]));
  const lookupQuery = new URLSearchParams({
    select: 'id,article_url',
    provider: 'eq.' + HALLOWEEN_BATCH_PROVIDER,
    interest_keywords: 'is.null'
  });
  const lookupResponse = await fetch(supabaseUrl(env, STORIES_TABLE, lookupQuery), {
    headers: supabaseHeaders(env)
  });
  const untaggedRows = await readRows(lookupResponse, 'Halloween batch untagged rows lookup');
  let interestsSet = 0;
  let interestsFailed = 0;
  for (const row of untaggedRows) {
    const interests = interestsByUrl.get(row.article_url);
    if (!interests) continue;
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
