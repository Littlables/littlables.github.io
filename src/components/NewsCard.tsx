import React, { useState, useEffect, useRef } from 'react';
import { NewsItem, NewsCategory, ReactionType, ReactionCounts } from '../types';
import { resolveImageUrl } from '../services/newsService';
import { getStoryId, hasUserReacted } from '../services/supabaseService';
import {
  getStoryHref,
  getStoryProviderName,
  shareStoryWithImage
} from '../services/urlService';
import { t } from '../constants/translations';
import { trackStoryClick, trackStoryView, trackStoryEngagementClick } from '../services/trackingService';

interface NewsCardProps {
  item: NewsItem;
  index: number;
  category: NewsCategory;
  categoryBadge: string;
  reactions: ReactionCounts;
  onReact: (storyId: string, type: ReactionType) => void;
  onOpenStory: (item: NewsItem, index: number) => void;
  onAdminEdit?: (item: NewsItem) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  item,
  index,
  category,
  categoryBadge,
  reactions,
  onReact,
  onOpenStory,
  onAdminEdit
}) => {
  const storyId = getStoryId(item.title, item.link);
  const imageUrl = resolveImageUrl(item, index, category);
  const effectiveCategory = item.category || category;
  const storyHref = getStoryHref(item, effectiveCategory);
  const providerName = getStoryProviderName(item);

  const [bouncing, setBouncing] = useState<ReactionType | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const viewTrackedRef = useRef(false);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    } else {
      setImageLoaded(false);
    }
  }, [imageUrl]);

  // Track view when card becomes visible (IntersectionObserver, once per mount)
  useEffect(() => {
    const el = cardRef.current;
    if (!el || viewTrackedRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      trackStoryView(item, effectiveCategory);
      viewTrackedRef.current = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewTrackedRef.current) {
            viewTrackedRef.current = true;
            trackStoryView(item, effectiveCategory);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.link]);

  const isVotedLove = hasUserReacted(storyId, 'love');
  const isVotedMind = hasUserReacted(storyId, 'mind');
  const isVotedCozy = hasUserReacted(storyId, 'cozy');

  const pubDate = new Date(item.pubDate || item.fetchedAt || Date.now()).toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  const handleReactionClick = (e: React.MouseEvent, type: ReactionType) => {
    e.stopPropagation();
    setBouncing(type);
    setTimeout(() => setBouncing(null), 450);
    onReact(storyId, type);
  };

  const handleStoryLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackStoryClick(item);
    trackStoryEngagementClick(item, effectiveCategory);
  };

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.news-read-more-btn') || target.closest('button')) {
      return;
    }
    trackStoryEngagementClick(item, effectiveCategory);
    onOpenStory(item, index);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onOpenStory(item, index);
    }
  };

  const handleTitleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onOpenStory(item, index);
  };

  const handleShareClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ok = await shareStoryWithImage(item, effectiveCategory, imageUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Long-press to open admin edit (only when onAdminEdit is provided)
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const startLongPress = () => {
    if (!onAdminEdit) return;
    longPressFired.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onAdminEdit(item);
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = () => startLongPress();
  const handleTouchEnd = () => cancelLongPress();
  const handleTouchMove = () => cancelLongPress();
  const handleMouseDown = (e: React.MouseEvent) => {
    // Right-click also opens admin edit on desktop
    if (e.button === 2 && onAdminEdit) {
      e.preventDefault();
      onAdminEdit(item);
      return;
    }
    startLongPress();
  };
  const handleMouseUp = () => cancelLongPress();
  const handleMouseLeave = () => cancelLongPress();
  const handleContextMenu = (e: React.MouseEvent) => {
    if (onAdminEdit) e.preventDefault();
  };

  // Suppress click if long-press fired
  const handleCardClickWrapper = (e: React.MouseEvent<HTMLElement>) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleCardClick(e);
  };

  return (
    <article
      ref={cardRef}
      className="news-card news-card-clickable"
      tabIndex={0}
      role="article"
      aria-label={item.title}
      onClick={handleCardClickWrapper}
      onKeyDown={handleCardKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      <div className={`news-card-image-wrap ${imageLoaded ? 'is-loaded' : ''}`}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt={item.title}
          className={`news-card-image ${imageLoaded ? 'is-loaded' : ''}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = `img/${effectiveCategory}_1.jpg`;
            if (target.src !== fallback && !target.src.endsWith(fallback)) {
              target.src = fallback;
            } else {
              setImageLoaded(true);
            }
          }}
        />
        <span className="news-card-badge">{categoryBadge}</span>
      </div>

      <div className="news-card-content">
        <div className="news-card-meta">
          <span>🕒 {pubDate}</span>
          {providerName && (
            <span className="story-provider-badge">🌐 {providerName}</span>
          )}
          {item.approved === true && (
            <span className="story-scoop-badge">{t('verifiedWire') || "🧸 Littlables' Little Scoop"}</span>
          )}
        </div>

        <a
          href={storyHref}
          className="news-card-title"
          onClick={handleTitleClick}
        >
          {item.title}
        </a>

        {item.description && (
          <p className="news-card-desc">
            {item.description.length > 750 ? item.description.slice(0, 750) + '...' : item.description}
          </p>
        )}

        {item.aiSummary && item.aiSummary.trim().length > 0 && (
          <div className="news-card-ai-summary">
            <div className="news-card-ai-label">{t('aiBriefTag') || '✨ Quick AI Brief'}</div>
            <div className="ai-summary-text">{item.aiSummary}</div>
          </div>
        )}

        <div className="news-card-footer">
          <a
            href={item.link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="news-read-more-btn"
            data-umami-event="Clicked-Story"
            data-umami-event-url={item.link || ''}
            data-umami-event-title={item.title}
            onClick={handleStoryLinkClick}
          >
            {t('readMore') || 'Read Full Story →'}
          </a>

          <div className="news-card-reactions">
            <button
              className={`reaction-pill ${isVotedLove ? 'voted' : ''} ${bouncing === 'love' ? 'pop-bounce' : ''}`}
              onClick={(e) => handleReactionClick(e, 'love')}
              title="Love it"
              type="button"
              data-umami-event="Reaction-Love"
              data-umami-event-story={item.title}
            >
              <span>❤️</span>
              <span className="reaction-count">{reactions.love}</span>
            </button>

            <button
              className={`reaction-pill ${isVotedMind ? 'voted' : ''} ${bouncing === 'mind' ? 'pop-bounce' : ''}`}
              onClick={(e) => handleReactionClick(e, 'mind')}
              title="Mind Blown"
              type="button"
              data-umami-event="Reaction-Mind"
              data-umami-event-story={item.title}
            >
              <span>🤯</span>
              <span className="reaction-count">{reactions.mind}</span>
            </button>

            <button
              className={`reaction-pill ${isVotedCozy ? 'voted' : ''} ${bouncing === 'cozy' ? 'pop-bounce' : ''}`}
              onClick={(e) => handleReactionClick(e, 'cozy')}
              title="Cozy"
              type="button"
              data-umami-event="Reaction-Cozy"
              data-umami-event-story={item.title}
            >
              <span>🧸</span>
              <span className="reaction-count">{reactions.cozy}</span>
            </button>

            <button
              type="button"
              className={`reaction-pill story-share-btn ${copied ? 'copied' : ''}`}
              onClick={handleShareClick}
              title="Share story link & image"
              aria-label="Share story"
            >
              <span>{copied ? '✓' : '🔗'}</span>
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
