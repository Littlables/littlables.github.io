import React, { useState } from 'react';
import { NewsItem, NewsCategory, ReactionType, ReactionCounts } from '../types';
import { resolveImageUrl } from '../services/newsService';
import { getStoryId, hasUserReacted } from '../services/supabaseService';
import { t } from '../constants/translations';
import { trackStoryClick } from '../services/trackingService';

interface NewsCardProps {
  item: NewsItem;
  index: number;
  category: NewsCategory;
  categoryBadge: string;
  reactions: ReactionCounts;
  onReact: (storyId: string, type: ReactionType) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  item,
  index,
  category,
  categoryBadge,
  reactions,
  onReact
}) => {
  const storyId = getStoryId(item.title, item.link);
  const imageUrl = resolveImageUrl(item, index, category);

  const [bouncing, setBouncing] = useState<ReactionType | null>(null);

  const isVotedLove = hasUserReacted(storyId, 'love');
  const isVotedMind = hasUserReacted(storyId, 'mind');
  const isVotedCozy = hasUserReacted(storyId, 'cozy');

  const pubDate = new Date(item.pubDate || item.fetchedAt || Date.now()).toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  const handleReactionClick = (type: ReactionType) => {
    setBouncing(type);
    setTimeout(() => setBouncing(null), 450);
    onReact(storyId, type);
  };

  const handleStoryLinkClick = () => {
    trackStoryClick(item);
  };

  return (
    <article className="news-card">
      <div className="news-card-image-wrap">
        <img
          src={imageUrl}
          alt={item.title}
          className="news-card-image"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = `img/${item.category || category}_1.jpg`;
            if (target.src !== fallback && !target.src.endsWith(fallback)) {
              target.src = fallback;
            }
          }}
        />
        <span className="news-card-badge">{categoryBadge}</span>
      </div>

      <div className="news-card-content">
        <div className="news-card-meta">
          <span>🕒 {pubDate}</span>
          {item.approved === true && (
            <span>{t('verifiedWire') || "🧸 Littlables' Little Scoop"}</span>
          )}
        </div>

        <a
          href={item.link || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="news-card-title"
          data-umami-event="Clicked-Story"
          data-umami-event-url={item.link || ''}
          data-umami-event-title={item.title}
          onClick={handleStoryLinkClick}
        >
          {item.title}
        </a>

        {item.description && (
          <p className="news-card-desc">{
            item.description.length > 750 ? item.description.slice(0, 750) + "..." : item.description}</p>
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
              onClick={() => handleReactionClick('love')}
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
              onClick={() => handleReactionClick('mind')}
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
              onClick={() => handleReactionClick('cozy')}
              title="Cozy"
              type="button"
              data-umami-event="Reaction-Cozy"
              data-umami-event-story={item.title}
            >
              <span>🧸</span>
              <span className="reaction-count">{reactions.cozy}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
