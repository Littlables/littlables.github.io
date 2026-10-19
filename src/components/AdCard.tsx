import React, { useEffect, useRef } from 'react';
import { AdItem, NewsCategory } from '../types';
import { t } from '../constants/translations';

interface AdCardProps {
  ad: AdItem;
  category: NewsCategory;
}

export const AdCard: React.FC<AdCardProps> = ({ ad, category }) => {
  const adPushedRef = useRef(false);

  useEffect(() => {
    if (!adPushedRef.current && typeof window !== 'undefined') {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        adPushedRef.current = true;
      } catch {}
    }
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
    if (ad.url && ad.url !== '#') {
      const target = e.target as HTMLElement;
      // If user clicked directly on an <a> element, let native link behavior handle it
      if (target.closest('a')) return;
      window.open(ad.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && ad.url && ad.url !== '#') {
      e.preventDefault();
      window.open(ad.url, '_blank', 'noopener,noreferrer');
    }
  };

  const sponsoredText = t('sponsored') || 'Sponsored';

  return (
    <article
      className="news-card news-card-ad"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`Sponsored: ${ad.title}`}
    >
      <div className="news-card-image-wrap">
        <img
          src={ad.img}
          alt={ad.title}
          className="news-card-image"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `img/${category}_1.jpg`;
          }}
        />
        <span className="news-card-badge ad-badge">{sponsoredText}</span>
      </div>

      <div className="news-card-content">
        <div className="news-card-meta">
          <span className="ad-sponsor-label">📢 {ad.sponsor}</span>
          <span className="ad-network-label">Featured Partner</span>
        </div>

        <a
          href={ad.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="news-card-title ad-card-title"
        >
          {ad.title}
        </a>

        <p className="news-card-desc ad-card-description">
          {ad.desc.length > 750 ? ad.desc.slice(0, 750) + "..." : ad.desc}
        </p>

        {/* Official Google AdSense In-Feed Responsive Fluid Tag */}
        <ins
          className="adsbygoogle"
          data-ad-format="fluid"
          data-ad-layout-key="-fb+5w+4e-db+86"
          data-ad-client="ca-pub-6117076538261387"
          data-ad-slot="1234567890"
        ></ins>

        <div className="news-card-footer">
          <a
            href={ad.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="ad-cta-btn"
          >
            {ad.cta}
          </a>
        </div>
      </div>
    </article>
  );
};
