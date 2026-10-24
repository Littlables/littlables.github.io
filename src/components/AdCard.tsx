import React, { useEffect, useRef, useState } from 'react';
import { AdItem, NewsCategory } from '../types';
import { t } from '../constants/translations';
import { getAdNetwork, trackAdClick, trackAdView, trackAdEngagementClick } from '../services/trackingService';
import { isValidCategory } from '../services/urlService';

interface AdCardProps {
  ad: AdItem;
  category: NewsCategory;
}

export const AdCard: React.FC<AdCardProps> = ({ ad, category }) => {
  const adPushedRef = useRef(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const viewTrackedRef = useRef(false);

  // Track impression when ad becomes visible (once per mount)
  useEffect(() => {
    const el = cardRef.current;
    if (!el || viewTrackedRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      trackAdView(ad);
      viewTrackedRef.current = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewTrackedRef.current) {
            viewTrackedRef.current = true;
            trackAdView(ad);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id]);

  useEffect(() => {
    if (!adPushedRef.current && typeof window !== 'undefined') {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        adPushedRef.current = true;
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    } else {
      setImageLoaded(false);
    }
  }, [ad.img]);

  const network = getAdNetwork(ad.url, ad.sponsor);
  const umamiEvent = `Clicked-${network}-Card`;

  const handleCardClick = (e: React.MouseEvent) => {
    if (ad.url && ad.url !== '#') {
      trackAdClick(ad);
      trackAdEngagementClick(ad);
      const target = e.target as HTMLElement;
      // If user clicked directly on an <a> element, let native link behavior handle it
      if (target.closest('a')) return;
      window.open(ad.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLinkClick = () => {
    if (ad.url && ad.url !== '#') {
      trackAdClick(ad);
      trackAdEngagementClick(ad);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && ad.url && ad.url !== '#') {
      e.preventDefault();
      trackAdClick(ad);
      trackAdEngagementClick(ad);
      window.open(ad.url, '_blank', 'noopener,noreferrer');
    }
  };

  const sponsoredText = t('sponsored') || 'Sponsored';
  const fallbackImgCategory = ad.category && isValidCategory(ad.category)
    ? ad.category
    : (isValidCategory(category) ? category : 'all');

  return (
    <article
      ref={cardRef}
      className="news-card news-card-ad"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`Sponsored: ${ad.title}`}
      data-umami-event={umamiEvent}
      data-umami-event-url={ad.url || ''}
      data-umami-event-title={ad.title}
      data-umami-event-network={network}
    >
      <div className={`news-card-image-wrap ${imageLoaded ? 'is-loaded' : ''}`}>
        <img
          ref={imgRef}
          src={ad.img}
          alt={ad.title}
          className={`news-card-image ${imageLoaded ? 'is-loaded' : ''}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = `/img/${fallbackImgCategory}_1.jpg`;
            if (target.src !== fallback && !target.src.endsWith(fallback)) {
              target.src = fallback;
            } else {
              setImageLoaded(true);
            }
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
          data-umami-event={umamiEvent}
          data-umami-event-url={ad.url || ''}
          data-umami-event-title={ad.title}
          onClick={handleLinkClick}
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
            data-umami-event={umamiEvent}
            data-umami-event-url={ad.url || ''}
            data-umami-event-title={ad.title}
            onClick={handleLinkClick}
          >
            {ad.cta}
          </a>
        </div>
      </div>
    </article>
  );
};

