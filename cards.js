    function decodeHtmlEntities(value) {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = String(value ?? '').replace(/[<>]/g, character => (
        character === '<' ? '&lt;' : '&gt;'
      ));
      return textarea.value;
    }

    function createNewsStoryCard(item, index, categoryBadge) {
      const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]);
      const title = item.title || 'Untitled Update';
      const cleanDesc = item.description || '';
      const imageUrl = resolveImageUrl(item, index, currentCategory);
      const summary = item.aiSummary || '';
      const pubDate = new Date(item.pubDate || item.fetchedAt || Date.now()).toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short'
      });
      const link = item.link || '#';
      const safeTitle = escapeHtml(title);
      const safeImageUrl = escapeHtml(imageUrl);
      const safeCategoryBadge = escapeHtml(categoryBadge);
      const safePubDate = escapeHtml(pubDate);
      const safeLink = escapeHtml(link);

      const storyId = getStoryId(title, link);
      const votedLove = hasUserReacted(storyId, 'love');
      const votedMind = hasUserReacted(storyId, 'mind');
      const votedCozy = hasUserReacted(storyId, 'cozy');
      const reactionsDisabled = !supabaseClient;

      const card = document.createElement('article');
      card.className = 'news-card';
      card.innerHTML = `
        <div class="news-card-image-wrap">
          <img src="${safeImageUrl}" alt="${safeTitle}" class="news-card-image" loading="lazy">
          <span class="news-card-badge">${safeCategoryBadge}</span>
        </div>
        <div class="news-card-content">
          <div class="news-card-meta">
            <span>🕒 ${safePubDate}</span>
            ${item.approved === true ? `<span>${t('verifiedWire')}</span>` : ''}
          </div>
          <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="news-card-title">${safeTitle}</a>
          <p class="news-card-desc">${escapeHtml(cleanDesc || '')}</p>
          ${summary.trim() ? `
            <div class="news-card-ai-summary">
              <div class="news-card-ai-label">${t('aiBriefTag')}</div>
              <div class="ai-summary-text">${escapeHtml(summary)}</div>
            </div>` : ''}
          <div class="news-card-footer">
            <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="news-read-more-btn">
              ${t('readMore')}
            </a>
            <div class="news-card-reactions">
              <button class="reaction-pill ${votedLove ? 'voted' : ''}" onclick="handleReaction(this, '${storyId}', 'love')" title="Love it" ${reactionsDisabled ? 'disabled' : ''}>
                <span>❤️</span> <span class="reaction-count" data-story="${storyId}" data-type="love">${reactionsDisabled ? '—' : '0'}</span>
              </button>
              <button class="reaction-pill ${votedMind ? 'voted' : ''}" onclick="handleReaction(this, '${storyId}', 'mind')" title="Mind Blown" ${reactionsDisabled ? 'disabled' : ''}>
                <span>🤯</span> <span class="reaction-count" data-story="${storyId}" data-type="mind">${reactionsDisabled ? '—' : '0'}</span>
              </button>
              <button class="reaction-pill ${votedCozy ? 'voted' : ''}" onclick="handleReaction(this, '${storyId}', 'cozy')" title="Cozy" ${reactionsDisabled ? 'disabled' : ''}>
                <span>🧸</span> <span class="reaction-count" data-story="${storyId}" data-type="cozy">${reactionsDisabled ? '—' : '0'}</span>
              </button>
            </div>
          </div>
        </div>
      `;

      return card;
    }

    let categoryAdsCache = {};

    async function getCategoryAds(category) {
      const cat = category || 'all';
      if (categoryAdsCache[cat]) return categoryAdsCache[cat];

      const paths = [`ads/${cat}.json`, `/ads/${cat}.json`, `./ads/${cat}.json`, `ads/all.json`, `/ads/all.json`];
      let mainAds = [];

      for (const p of paths) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              mainAds = data;
              break;
            }
          }
        } catch (e) {}
      }

      // Load Amazon affiliate search ads for category (5 searches per category)
      const amazonPaths = ['ads/amazon.json', '/ads/amazon.json', './ads/amazon.json'];
      for (const ap of amazonPaths) {
        try {
          const aRes = await fetch(ap);
          if (aRes.ok) {
            const aData = await aRes.json();
            if (Array.isArray(aData) && aData.length > 0) {
              const catAmazon = aData.filter(ad => ad.category === cat);
              if (catAmazon.length > 0) {
                mainAds = [...mainAds, ...catAmazon];
              }
              break;
            }
          }
        } catch (e) {}
      }

      // If category is Creative Arts or Future Tech & AI, load TikTok affiliate ads alongside Gumroad and Amazon ads
      if (cat === 'arts' || cat === 'tech') {
        const tiktokPaths = ['ads/tiktok.json', '/ads/tiktok.json', './ads/tiktok.json'];
        for (const tp of tiktokPaths) {
          try {
            const tRes = await fetch(tp);
            if (tRes.ok) {
              const tiktokData = await tRes.json();
              if (Array.isArray(tiktokData) && tiktokData.length > 0) {
                mainAds = [...mainAds, ...tiktokData];
                break;
              }
            }
          } catch (e) {}
        }
      }

      if (mainAds.length > 0) {
        // Randomly mix all the ads for the category together (Gumroad, Amazon, TikTok)
        for (let i = mainAds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [mainAds[i], mainAds[j]] = [mainAds[j], mainAds[i]];
        }
        categoryAdsCache[cat] = mainAds;
        return mainAds;
      }
      return [];
    }

    function createInFeedAdCard(adIndex) {
      const adCard = document.createElement('article');
      adCard.className = 'news-card news-card-ad';
      adCard.style.cursor = 'pointer';
      adCard.tabIndex = 0;
      adCard.setAttribute('role', 'link');

      let currentAdUrl = '#';

      adCard.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        if (currentAdUrl && currentAdUrl !== '#') {
          window.open(currentAdUrl, '_blank', 'noopener,noreferrer');
        }
      });

      adCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (currentAdUrl && currentAdUrl !== '#') {
            window.open(currentAdUrl, '_blank', 'noopener,noreferrer');
          }
        }
      });

      const sponsoredText = t('sponsored') || 'Sponsored';
      const activeCat = (typeof currentCategory !== 'undefined') ? currentCategory : 'all';

      const renderAdContent = (ad) => {
        const title = ad.name || ad.title || 'Featured Discovery';
        const desc = ad.description || ad.desc || '';
        const img = ad.thumbnailUrl || ad.img || `img/${activeCat}_1.jpg`;
        const sponsor = ad.sellerName || ad.sponsor || 'Littlables Partner';
        const url = ad.url || '#';
        currentAdUrl = url;
        adCard.setAttribute('aria-label', `Sponsored: ${title}`);
        const price = ad.priceUsd ? `$${ad.priceUsd}` : (ad.priceCents ? `$${(ad.priceCents / 100).toFixed(2)}` : '');
        const ctaText = ad.cta || (price ? `Get for ${price} →` : 'Learn More →');

        adCard.innerHTML = `
          <div class="news-card-image-wrap">
            <img src="${img}" alt="${title.replace(/"/g, '&quot;')}" class="news-card-image" loading="lazy" onerror="this.src='img/${activeCat}_1.jpg'">
            <span class="news-card-badge ad-badge">${sponsoredText}</span>
          </div>
          <div class="news-card-content">
            <div class="news-card-meta">
              <span class="ad-sponsor-label">📢 ${sponsor}</span>
              <span class="ad-network-label">Featured Partner</span>
            </div>
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="news-card-title ad-card-title">
              ${title}
            </a>
            <p class="news-card-desc ad-card-description">
              ${desc}
            </p>

            <ins class="adsbygoogle"
                 data-ad-format="fluid"
                 data-ad-layout-key="-fb+5w+4e-db+86"
                 data-ad-client="ca-pub-6117076538261387"
                 data-ad-slot="1234567890"></ins>

            <div class="news-card-footer">
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="ad-cta-btn">
                ${ctaText}
              </a>
            </div>
          </div>
        `;

        try {
          (adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {}
      };

      const pickAdFromList = (ads) => {
        if (!ads || ads.length === 0) return null;
        // Randomly pick an ad from the mixed pool without forcing TikTok first
        const index = (adIndex ?? 0) % ads.length;
        return ads[index] || ads[Math.floor(Math.random() * ads.length)];
      };

      // Check cache first for instant synchronous render
      const cached = categoryAdsCache[activeCat];
      if (cached && cached.length > 0) {
        const picked = pickAdFromList(cached);
        if (picked) renderAdContent(picked);
      } else {
        // Render initial placeholder and populate once fetched
        renderAdContent({
          title: "Loading featured partner...",
          description: "Discover curated tools and creative resources tailored to your interests.",
          img: `img/${activeCat}_1.jpg`,
          sellerName: "Littlables Showcase",
          cta: "Discover More →",
          url: "#"
        });

        getCategoryAds(activeCat).then(ads => {
          if (ads && ads.length > 0) {
            const picked = pickAdFromList(ads);
            if (picked) renderAdContent(picked);
          }
        });
      }

      return adCard;
    }
