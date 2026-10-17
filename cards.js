    function createNewsStoryCard(item, index, categoryBadge) {
      const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]);
      const title = item.title || 'Untitled Update';
      const cleanDesc = item.description;
      const imageUrl = resolveImageUrl(item, index, currentCategory);
      const pubDate = new Date(item.pubDate || Date.now()).toLocaleString([], {
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
          ${typeof item.aiSummary === 'string' && item.aiSummary.trim() ? `
            <div class="news-card-ai-summary">
              <div class="news-card-ai-label">${t('aiBriefTag')}</div>
              <div class="ai-summary-text">${escapeHtml(item.aiSummary)}</div>
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

    function createInFeedAdCard(adIndex) {
      const adCard = document.createElement('article');
      adCard.className = 'news-card news-card-ad';

      const previewAds = [
        {
          title: "Nova Horizon Electric Longboards — Fall Cruising Series",
          desc: "Smooth pneumatic wheels, regenerative braking, up to 34 miles range. Engineered for daily carve and commute thrill.",
          img: "img/tech_1.jpg",
          cta: "Explore Fleet →",
          sponsor: "Nova Mobility Co."
        },
        {
          title: "PawGentle Orthopedic Canine Wellness Beds",
          desc: "Veterinarian-approved memory foam with joint-soothing pressure relief for deeply restorative pet sleep.",
          img: "img/animals_1.jpg",
          cta: "Shop Pet Beds →",
          sponsor: "PawGentle Living"
        },
        {
          title: "KandiCraft Neon Acrylic Bead Studio Set",
          desc: "5,000+ vibrant glow-in-the-dark pony beads, reinforced elastic cord & organizing trays for makers.",
          img: "img/arts_1.jpg",
          cta: "Start Crafting →",
          sponsor: "KandiCraft Studio"
        }
      ];

      const currentAd = previewAds[adIndex % previewAds.length];
      const sponsoredText = t('sponsored') || 'Sponsored';

      adCard.innerHTML = `
        <div class="news-card-image-wrap">
          <img src="${currentAd.img}" alt="${currentAd.title}" class="news-card-image" loading="lazy">
          <span class="news-card-badge ad-badge">${sponsoredText}</span>
        </div>
        <div class="news-card-content">
          <div class="news-card-meta">
            <span class="ad-sponsor-label">📢 ${currentAd.sponsor}</span>
            <span class="ad-network-label">Google AdSense</span>
          </div>
          <div class="news-card-title ad-card-title">
            ${currentAd.title}
          </div>
          <p class="news-card-desc ad-card-description">
            ${currentAd.desc}
          </p>

          <!-- Official Google AdSense In-Feed Responsive Fluid Tag -->
          <ins class="adsbygoogle"
               data-ad-format="fluid"
               data-ad-layout-key="-fb+5w+4e-db+86"
               data-ad-client="ca-pub-6117076538261387"
               data-ad-slot="1234567890"></ins>

          <div class="news-card-footer">
            <a href="#" class="ad-cta-btn" onclick="return false;">
              ${currentAd.cta}
            </a>
          </div>
        </div>
      `;

      // Trigger AdSense push for this inserted ad unit
      try {
        (adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {}

      return adCard;
    }
