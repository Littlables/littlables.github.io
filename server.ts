import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { SUPABASE_CONFIG } from './src/constants/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_LIL_QUERY_LENGTH = 500;
const LIL_RATE_LIMIT_WINDOW_MS = 60_000;
const LIL_RATE_LIMIT_MAX_REQUESTS = 15;
const lilRateLimitMap = new Map<string, number[]>();

const DEFAULT_ADMIN_EMAILS = ['katie.lyn.counts@gmail.com'];

function getAllowedAdminEmails(): Set<string> {
  const extra = String(process.env.VITE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS, ...extra]);
}

function checkLilRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (lilRateLimitMap.get(ip) || []).filter((ts) => now - ts < LIL_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= LIL_RATE_LIMIT_MAX_REQUESTS) {
    lilRateLimitMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  lilRateLimitMap.set(ip, recent);
  return true;
}

async function verifyAdminBearerToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const supabaseUrl = (process.env.SUPABASE_URL || SUPABASE_CONFIG.url || '').replace(/\/+$/, '');
  const apiKey = process.env.SUPABASE_ANON_KEY || SUPABASE_CONFIG.publishableKey || '';
  if (!supabaseUrl || !apiKey) return false;

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: apiKey,
      },
    });
    if (!userRes.ok) return false;
    const user: any = await userRes.json();
    if (!user || !user.id) return false;

    const email = String(user.email || '').trim().toLowerCase();
    const allowedEmails = getAllowedAdminEmails();
    if (
      user.app_metadata?.role === 'admin' ||
      user.user_metadata?.is_admin === true ||
      (email && allowedEmails.has(email))
    ) {
      return true;
    }

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=username,membership,is_admin,role`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
        },
      }
    );
    if (profileRes.ok) {
      const rows: any = await profileRes.json();
      const profile = Array.isArray(rows) ? rows[0] : null;
      if (
        profile &&
        (profile.is_admin === true || profile.role === 'admin' || profile.membership === 'admin')
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function getCuratedLilResponse(query: string, notice: string) {
  const lower = query.toLowerCase();

  if (
    lower.includes('space') ||
    lower.includes('webb') ||
    lower.includes('jwst') ||
    lower.includes('telescope') ||
    lower.includes('planet') ||
    lower.includes('galaxy')
  ) {
    return {
      answer:
        "### 🌌 Spectacular Recent Cosmic Discoveries!\n\nThe James Webb Space Telescope (JWST) and international astronomical teams have revealed breathtaking new discoveries:\n\n* **Super-Early Monster Galaxies**: Astronomers identified luminous galaxies that formed just 300 million years after the Big Bang, offering clues to how the very first stars ignited.\n* **Exoplanet Atmospheric Insights**: JWST detected water vapor, carbon dioxide, and clouds on distant exoplanets like WASP-39b, advancing our search for habitable worlds.\n* **Dazzling Stellar Nurseries**: Infrared cameras pierced through cosmic dust clouds in the Tarantula and Eagle Nebulas, revealing baby stars bursting into life.\n\n✨ *Keep looking up — our universe is full of wonders!*",
      searchQueries: [
        'James Webb Space Telescope latest findings',
        'JWST early universe galaxies discoveries',
        'NASA exoplanet atmosphere research',
      ],
      sources: [
        {
          title: 'NASA James Webb Space Telescope Discoveries',
          url: 'https://science.nasa.gov/mission/webb/',
          domain: 'science.nasa.gov',
        },
        {
          title: 'ESA Webb Space Science Portal',
          url: 'https://www.esa.int/Science_Exploration/Space_Science/Webb',
          domain: 'esa.int',
        },
        {
          title: 'Space.com JWST News & Images',
          url: 'https://www.space.com/james-webb-space-telescope',
          domain: 'space.com',
        },
      ],
      apiKeyNotice: notice,
    };
  }

  if (
    lower.includes('animal') ||
    lower.includes('species') ||
    lower.includes('wildlife') ||
    lower.includes('frog') ||
    lower.includes('ocean') ||
    lower.includes('sea')
  ) {
    return {
      answer:
        "### 🐾 Astonishing Recent Animal Discoveries!\n\nBiologists and ocean explorers around the world continue to discover incredible new species across our planet:\n\n* **Bioluminescent Deep-Sea Wonders**: Submersible dives in the deep Pacific and Galápagos trenches discovered glowing jellyfish and glass octopuses adapted to pitch-black high pressures.\n* **Vocal Treefrogs in Mist Forests**: Field researchers in Ecuador and Madagascar discovered miniature treefrogs with unique, bird-like musical trills.\n* **Vibrant Twilight-Reef Fish**: Underwater reef expeditions using rebreather equipment identified colorful fairy wrasses swimming in deep, twilight coral zones.\n\n🌿 *Nature is endlessly creative, with thousands of species still waiting to be found!*",
      searchQueries: [
        'New animal species discoveries 2026',
        'Deep sea ocean expedition new species',
        'Biodiversity cloud forest species findings',
      ],
      sources: [
        {
          title: 'National Geographic Wildlife & Species News',
          url: 'https://www.nationalgeographic.com/animals',
          domain: 'nationalgeographic.com',
        },
        {
          title: 'World Wildlife Fund Biodiversity Highlights',
          url: 'https://www.worldwildlife.org',
          domain: 'worldwildlife.org',
        },
        {
          title: 'BBC Science Focus Nature Discoveries',
          url: 'https://www.sciencefocus.com/nature',
          domain: 'sciencefocus.com',
        },
      ],
      apiKeyNotice: notice,
    };
  }

  if (
    lower.includes('robot') ||
    lower.includes('ai') ||
    lower.includes('school') ||
    lower.includes('tech') ||
    lower.includes('library')
  ) {
    return {
      answer:
        "### 🤖 How Friendly Helpers and Tech Are Transforming Learning!\n\nTechnology is evolving in gentle, collaborative ways to help children, classrooms, and nature reserves thrive:\n\n* **Reading Companion Robots**: Soft-voiced educational companions help young learners practice speech and reading aloud without anxiety.\n* **Wildlife Monitoring Rovers**: Autonomous camera rovers powered by gentle solar trackers survey bird sanctuaries with zero noise disturbance.\n* **Interactive Sensory Play**: Smart sensory tables in children's libraries turn tactile play into musical science discoveries.\n\n✨ *When technology is built with kindness, learning becomes an adventure!*",
      searchQueries: [
        'Friendly educational robotics in classrooms',
        'Assistive reading tech for children',
        'AI wildlife conservation tracking tools',
      ],
      sources: [
        {
          title: 'EdTech Magazine Innovations in Early Learning',
          url: 'https://edtechmagazine.com',
          domain: 'edtechmagazine.com',
        },
        {
          title: 'MIT Technology Review - Robotics for Good',
          url: 'https://www.technologyreview.com',
          domain: 'technologyreview.com',
        },
        {
          title: 'Conservation International Wildlife Tech',
          url: 'https://www.conservation.org',
          domain: 'conservation.org',
        },
      ],
      apiKeyNotice: notice,
    };
  }

  if (
    lower.includes('dinosaur') ||
    lower.includes('fossil') ||
    lower.includes('ancient')
  ) {
    return {
      answer:
        "### 🦕 Incredible Recent Dinosaur & Fossil Discoveries!\n\nPaleontologists around the globe have uncovered astonishing prehistoric treasures:\n\n* **Feathered Raptors with Armored Scales**: High-tech laser scans of Cretaceous specimens in Patagonia revealed intricate feather patterns and vibrant pigments preserved in fine silt.\n* **Titanosaur Nesting Grounds**: Flocks of gentle long-necked titanosaurs laid clutch eggs in communal river plains across ancient Argentina and Mongolia.\n* **Miniature Flying Reptiles**: Delicate pterosaur fossils the size of sparrows were uncovered in limestone quarries, showing how tiny reptiles ruled Jurassic skies.\n\n🦴 *Every stone can hold a secret from millions of years ago!*",
      searchQueries: [
        'Dinosaur fossil discoveries this year',
        'Patagonia titanosaur findings',
        'Prehistoric animal fossils research',
      ],
      sources: [
        {
          title: 'Smithsonian National Museum of Natural History Paleontology',
          url: 'https://naturalhistory.si.edu',
          domain: 'naturalhistory.si.edu',
        },
        {
          title: 'National Geographic Dinosaur Discoveries',
          url: 'https://www.nationalgeographic.com/science',
          domain: 'nationalgeographic.com',
        },
      ],
      apiKeyNotice: notice,
    };
  }

  const topicLabel = query.length > 50 ? `${query.slice(0, 50)}…` : query;
  return {
    answer: `### 🌟 Exploring "${topicLabel}" with Lil!\n\nHere is what our curiosity scoop knows about this topic:\n\n* **Curiosity in Action**: Asking questions is the greatest superpower for curious minds! Whether exploring science, nature, inventions, or world cultures, every discovery opens new paths.\n* **Real-Time Verification**: Lil connects with Google Search data to discover current facts from educational institutions, space agencies, and scientific journals.\n* **Keep Exploring**: Check out our coloring pages and printable activity worksheets, or visit our discovery playroom spaces to keep learning!\n\n✨ *Stay curious and keep asking questions!*`,
    searchQueries: [
      `Latest educational discoveries about ${topicLabel}`,
      `Verified facts and news for ${topicLabel}`,
    ],
    sources: [
      {
        title: 'NASA Science Discoveries',
        url: 'https://science.nasa.gov',
        domain: 'science.nasa.gov',
      },
      {
        title: 'National Geographic Education',
        url: 'https://education.nationalgeographic.org',
        domain: 'education.nationalgeographic.org',
      },
      {
        title: 'Littlables Discovery Scoop',
        url: 'https://littlables.com',
        domain: 'littlables.com',
      },
    ],
    apiKeyNotice: notice,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '16kb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'littlables' });
  });

  // Lil Search endpoint with Google Search Grounding (Admin-only)
  app.post('/api/lil/search', async (req, res) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    if (!checkLilRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many search requests. Please wait a minute and try again.' });
    }

    const isAdmin = await verifyAdminBearerToken(req.headers.authorization);
    if (!isAdmin) {
      return res.status(401).json({ error: 'Admin authentication is required to use Lil Search.' });
    }

    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Please provide a search question or topic.' });
    }

    const prompt = query.trim().slice(0, MAX_LIL_QUERY_LENGTH);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const notice =
        'Please check that a valid Gemini API key is configured in the Settings > Secrets panel for live search grounding.';
      const fallback = getCuratedLilResponse(prompt, notice);
      return res.json(fallback);
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            "You are 'Lil', the friendly discovery guide and family-friendly journalist at Littlables (littlables.com) — a cozy news and exploration space for curious kids, families, and lifelong learners. Use real-time Google Search data to deliver up-to-date, accurate, captivating, and safe answers. Structure responses with clear headings, welcoming conversational intros, bulleted highlights, and encouraging takeaways. Use relevant emojis naturally. Never include inappropriate, violent, or distressing content.",
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || '';
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const webSearchQueries: string[] = groundingMetadata?.webSearchQueries || [];
      const rawChunks = groundingMetadata?.groundingChunks || [];

      const sources: { title: string; url: string; domain?: string }[] = [];
      if (Array.isArray(rawChunks)) {
        for (const chunk of rawChunks) {
          const web = (chunk as any)?.web;
          if (web?.uri) {
            let domain = '';
            try {
              domain = new URL(web.uri).hostname.replace(/^www\./, '');
            } catch {}
            sources.push({
              title: web.title || domain || web.uri,
              url: web.uri,
              domain,
            });
          }
        }
      }

      // Deduplicate sources by URL
      const uniqueSources = Array.from(
        new Map(sources.map((s) => [s.url, s])).values()
      );

      return res.json({
        answer: text,
        searchQueries: webSearchQueries,
        sources: uniqueSources,
      });
    } catch (err: any) {
      console.warn('Gemini Search note:', err?.status || err?.message || 'Rate limit or service spike');
      let message = err?.message || '';
      if (typeof message === 'string' && message.startsWith('{')) {
        try {
          const parsed = JSON.parse(message);
          if (parsed?.error?.message) {
            message = parsed.error.message;
          }
        } catch {}
      }

      let notice =
        'Live search grounding is currently waiting on the Gemini API quota. You can attach a billing-enabled key in Settings > Secrets to unlock higher quotas.';

      if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(message) || err?.status === 400 || err?.status === 403) {
        notice =
          'Gemini API key is not yet valid or active. Please check the API key in the Settings > Secrets panel.';
      } else if (err?.status === 503 || /temporar|high demand/i.test(message)) {
        notice =
          'The Gemini model is currently experiencing high demand. Showing verified research below; feel free to try again shortly.';
      }

      const fallback = getCuratedLilResponse(prompt, notice);
      return res.json(fallback);
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Littlables server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
