import { upsertNewsStories } from './news-storage.mjs';

// One-time kid-safe Halloween batch (Oct 2026). These are staged as
// UNAPPROVED stories: they land in Pending Approval for the normal
// approve/reject flow and never get the curated/approved placement until
// an admin approves them. Re-running is safe: upsertNewsStories dedups on
// provider + category + article_url, so a second run merges, not duplicates.
export const HALLOWEEN_BATCH_PROVIDER = 'halloween-batch';

export const HALLOWEEN_BATCH = [
  {
    title: 'Paper Plate Pumpkin',
    link: 'https://www.thebestideasforkids.com/paper-plate-pumpkin/',
    description: 'Paint a paper plate orange, add a funny face and a pipe-cleaner stem — an easy pumpkin craft for little hands.',
    source: 'The Best Ideas for Kids',
    category: 'arts'
  },
  {
    title: 'Tissue Paper Pumpkins',
    link: 'https://smashedpeasandcarrots.com/tissue-paper-pumpkins-tutorial/',
    description: 'Layer orange tissue paper squares onto contact paper to make a pumpkin suncatcher for the window.',
    source: 'Smashed Peas and Carrots',
    category: 'arts'
  },
  {
    title: 'Making a Paper Mache Pumpkin',
    link: 'https://www.rhs.org.uk/education-learning/children-young-people/family-activities/do-it/make-a-paper-mache-pumpkin',
    description: 'Build a pumpkin from straw circles, cling film and paper mache — a windowsill decoration to keep (no candles).',
    source: 'RHS',
    category: 'arts'
  },
  {
    title: '75+ Easy Halloween Crafts for Kids',
    link: 'https://sarahscoop.com/easy-halloween-crafts-for-kids/',
    description: 'A big roundup of simple, affordable Halloween crafts using paper, cardboard, pipe cleaners and felt.',
    source: 'Sarah Scoop',
    category: 'arts'
  },
  {
    title: 'Halloween Crafts for a 3-Year-Old',
    link: 'https://learningcorner.co/explain-anything/20654',
    description: 'Three toddler-safe crafts: a paper plate pumpkin, a handprint ghost and a toilet-paper-roll bat.',
    source: 'Learning Corner',
    category: 'childcare'
  },
  {
    title: 'Easy Halloween Kid Crafts: Spooky Fun & Learning',
    link: 'https://www.imthecheftoo.com/blogs/stem-for-kids/easy-halloween-kid-crafts-spooky-fun-learning',
    description: 'No-carve pumpkin monsters, stained-glass window jack-o-lanterns and pumpkin name puzzles — no carving tools needed.',
    source: "I'm the Chef Too",
    category: 'arts'
  },
  {
    title: 'Halloween Season at LEGOLAND California: Brick or Treat Fun the Whole Family Will Love',
    link: 'https://www.funwithkidsinla.com/post/halloween-season-at-legoland-california-brick-or-treat-fun-the-whole-family-will-love',
    description: 'Silly monsters, LEGO decorations, character meet-and-greets and not-too-scary fun, September 20 through October 30, 2026.',
    source: 'Fun With Kids in LA',
    category: 'world'
  },
  {
    title: "Knott's Spooky Farm 2026: Guide for Families",
    link: 'https://www.funwithkidsinla.com/post/knotts-spooky-farm-guide-for-families',
    description: "Daytime trick-or-treating through Ghost Town with Snoopy and the Peanuts gang — 'All Fun. No Fear.', September 24 through October 31, 2026.",
    source: 'Fun With Kids in LA',
    category: 'world'
  },
  {
    title: 'LEGOLAND Florida Brick or Treat',
    link: 'https://portcharlotte.macaronikid.com/articles/6a918d2cd85a1b102f61c5d7/2026-halloween-events-worth-the-drive-from-port-charlotte',
    description: 'Brick or Treat Street, LEGO monster experiences, hands-on builds and trick-or-treating, select dates September 5 through October 31, 2026.',
    source: 'Macaroni KID Port Charlotte',
    category: 'world'
  },
  {
    title: 'SeaWorld Orlando Halloween Spooktacular',
    link: 'https://portcharlotte.macaronikid.com/articles/6a918d2cd85a1b102f61c5d7/2026-halloween-events-worth-the-drive-from-port-charlotte',
    description: 'Daytime trick-or-treating and playful seasonal characters, select dates August 29 through November 1, 2026.',
    source: 'Macaroni KID Port Charlotte',
    category: 'world'
  },
  {
    title: "Best Halloween Theme Parks in 2026: Mickey's Not-So-Scary Halloween Party",
    link: 'https://ftjtravelbystacie.wixsite.com/fairytale-journeys/post/best-halloween-theme-parks-in-2026-a-travel-advisor-s-guide-to-the-ultimate-spooky-getaway',
    description: 'Trick-or-treating, characters in Halloween costumes, the Boo-to-You parade and fireworks — fun, not fear.',
    source: 'Fairytale Journeys',
    category: 'world'
  },
  {
    title: "Kennywood's Phantom Fall Fest and Hersheypark's Trick-or-Treat Trail",
    link: 'https://www.theweather.com/news/lifestyle/the-5-spookiest-halloween-destinations-haunted-towns-ghosts-and-legends.html',
    description: 'Hersheypark trick-or-treat trail: kids 12 and under collect candy at 14 stops, plus a scare-free Avenue of the Afterlife, through November 1, 2026.',
    source: 'The Weather',
    category: 'world'
  },
  {
    title: 'Boo at the Zoo — Santa Barbara',
    link: 'https://lafamilytravel.com/halloween-in-la-and-around-california/',
    description: 'Daytime Boo October 16–31: scavenger hunt, costume parade, story time and a hay maze — no scares at all, best for ages 2–10.',
    source: 'LA Family Travel',
    category: 'animals'
  },
  {
    title: 'Stage Fright: A Halloween Family Festival at Klyde Warren Park',
    link: 'https://cravedfw.com/2026/10/13/family-friendly-dfw-halloween/',
    description: 'A free family festival in Dallas on October 31, 10am–1pm: crafts, performances and one more round of costumes before trick-or-treating.',
    source: 'Crave DFW',
    category: 'world'
  },
  {
    title: 'Best Halloween Destinations for Families in the USA (2026)',
    link: 'https://themomtrotter.com/the-best-places-for-families-to-celebrate-halloween-in-the-usa/',
    description: 'Anoka, Sleepy Hollow, Salem, St. Helens and New Orleans — family Halloween trips from parades to pumpkin displays.',
    source: 'The Mom Trotter',
    category: 'world'
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
  return { staged, duplicatesSkipped, byCategory: perCategory };
}
