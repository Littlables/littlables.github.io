    /**
     * Fallback renderer if offline or API limit reached
     */
    function renderFallbackStories(container) {
      const categoryBadge = getActiveCategoryBadge();
      const demoStories = [
        {
          title: "Groundbreaking Research Highlights Exciting Positive Shifts Worldwide",
          desc: "Field teams and global research groups logged unprecedented progress in community sustainability and collaborative innovation.",
          ai: `${t('aiTakeaway')} Ongoing experiments indicate substantial community momentum and long-term vitality.`,
          img: getCategoryFallbackImage(currentCategory, 0),
          time: `12m ${t('recent').toLowerCase()}`
        },
        {
          title: "New Advances in Animal Care & Compassionate Wellness Initiatives",
          desc: "Veterinary and behavioral wellness panels validate enriched sensory environments for companion animal happiness.",
          ai: `${t('aiTakeaway')} Intentional play and tailored nutrition produce noticeable vitality benefits.`,
          img: getCategoryFallbackImage(currentCategory, 1),
          time: `25m ${t('recent').toLowerCase()}`
        },
        {
          title: "Next-Generation Creative Artisan Collectives Expand Worldwide",
          desc: "Makers, crafters, and independent designers celebrate tactile handmade arts as a meaningful cultural connection.",
          ai: `${t('aiTakeaway')} Tactile creative hobbies continue providing joyful mental focus and community warmth.`,
          img: getCategoryFallbackImage(currentCategory, 2),
          time: `1h ${t('recent').toLowerCase()}`
        }
      ];

      container.innerHTML = '';
      demoStories.forEach(s => {
        const card = document.createElement('article');
        card.className = 'news-card';
        card.innerHTML = `
          <div class="news-card-image-wrap">
            <img src="${s.img}" class="news-card-image" alt="${s.title}">
            <span class="news-card-badge">${categoryBadge}</span>
          </div>
          <div class="news-card-content">
            <div class="news-card-meta">
              <span>🕒 ${s.time}</span>
              <span>${t('liveFeed')}</span>
            </div>
            <a href="#" class="news-card-title">${s.title}</a>
            <p class="news-card-desc">${s.desc}</p>
            <div class="news-card-ai-summary">
              <div class="news-card-ai-label">${t('aiBriefTag')}</div>
              <div>${s.ai}</div>
            </div>
            <div class="news-card-footer">
              <a href="#" class="news-read-more-btn">${t('readMore')}</a>
              <div class="news-card-reactions">
                <button class="reaction-pill" onclick="handleReaction(this, 'fb_${demoStories.indexOf(s)}', 'love')" title="Love it">
                  <span>❤️</span> <span class="reaction-count" data-story="fb_${demoStories.indexOf(s)}" data-type="love">${14 + demoStories.indexOf(s) * 3}</span>
                </button>
                <button class="reaction-pill" onclick="handleReaction(this, 'fb_${demoStories.indexOf(s)}', 'mind')" title="Mind Blown">
                  <span>🤯</span> <span class="reaction-count" data-story="fb_${demoStories.indexOf(s)}" data-type="mind">${9 + demoStories.indexOf(s) * 2}</span>
                </button>
                <button class="reaction-pill" onclick="handleReaction(this, 'fb_${demoStories.indexOf(s)}', 'cozy')" title="Cozy">
                  <span>🧸</span> <span class="reaction-count" data-story="fb_${demoStories.indexOf(s)}" data-type="cozy">${21 + demoStories.indexOf(s) * 4}</span>
                </button>
              </div>
            </div>
          </div>
        `;
        container.appendChild(card);
        if (demoStories.indexOf(s) === 1) {
          container.appendChild(createInFeedAdCard(0));
        }
      });
    }

