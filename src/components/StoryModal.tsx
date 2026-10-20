import React, { useEffect, useRef, useState } from 'react';
import { NewsItem, NewsCategory, ReactionType, ReactionCounts } from '../types';
import { resolveImageUrl } from '../services/newsService';
import { getStoryId, hasUserReacted } from '../services/supabaseService';
import {
  getStoryShareUrl,
  getTopicHref,
  getStoryProviderName,
  shareStoryWithImage,
  updateStoryOpenGraphTags
} from '../services/urlService';
import { trackStoryClick } from '../services/trackingService';
import { t } from '../constants/translations';

interface StoryModalProps {
  story: NewsItem | null;
  index: number;
  category: NewsCategory;
  categoryBadge: string;
  reactions: ReactionCounts;
  onReact: (storyId: string, type: ReactionType) => void;
  onClose: () => void;
  onSelectCategory?: (category: NewsCategory) => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({
  story,
  index,
  category,
  categoryBadge,
  reactions,
  onReact,
  onClose,
  onSelectCategory
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [bouncing, setBouncing] = useState<ReactionType | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (story) {
      const effectiveCategory = story.category || category;
      const imageUrl = resolveImageUrl(story, index, category);
      const shareUrl = getStoryShareUrl(story, effectiveCategory);
      updateStoryOpenGraphTags(story, imageUrl, shareUrl);

      document.documentElement.classList.add('story-modal-open');
      document.body.classList.add('story-modal-open');
      if (!dialog.open) {
        dialog.showModal();
      }
      dialog.scrollTop = 0;
    } else {
      updateStoryOpenGraphTags(null);
      document.documentElement.classList.remove('story-modal-open');
      document.body.classList.remove('story-modal-open');
      if (dialog.open) {
        dialog.close();
      }
    }

    return () => {
      document.documentElement.classList.remove('story-modal-open');
      document.body.classList.remove('story-modal-open');
    };
  }, [story, index, category]);

  useEffect(() => {
    setCopied(false);
  }, [story?.link, story?.title]);

  if (!story) return null;

  const storyId = getStoryId(story.title, story.link);
  const imageUrl = resolveImageUrl(story, index, category);
  const effectiveCategory = story.category || category;
  const providerName = getStoryProviderName(story);

  const isVotedLove = hasUserReacted(storyId, 'love');
  const isVotedMind = hasUserReacted(storyId, 'mind');
  const isVotedCozy = hasUserReacted(storyId, 'cozy');

  const pubDate = new Date(story.pubDate || story.fetchedAt || Date.now()).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleReactionClick = (type: ReactionType) => {
    setBouncing(type);
    setTimeout(() => setBouncing(null), 450);
    onReact(storyId, type);
  };

  const handleShareClick = async () => {
    const ok = await shareStoryWithImage(story, effectiveCategory, imageUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleCategoryBadgeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onSelectCategory) {
      e.preventDefault();
      onClose();
      onSelectCategory(effectiveCategory);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="story-modal-dialog"
      aria-labelledby="story-modal-title"
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <article className="story-modal-card">
        <div className="story-modal-image-wrap">
          <img
            src={imageUrl}
            alt={story.title}
            className="story-modal-image"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallback = `img/${effectiveCategory}_1.jpg`;
              if (target.src !== fallback && !target.src.endsWith(fallback)) {
                target.src = fallback;
              }
            }}
          />
          <a
            href={getTopicHref(effectiveCategory)}
            className="news-card-badge story-modal-badge-link"
            onClick={handleCategoryBadgeClick}
            title="View all stories in this topic"
          >
            {categoryBadge}
          </a>
          <button
            type="button"
            className="story-modal-close-btn"
            aria-label="Close story window"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="story-modal-content">
          <div className="news-card-meta story-modal-meta">
            <span>🕒 {pubDate}</span>
            {providerName && (
              <span className="story-provider-badge">🌐 {providerName}</span>
            )}
            {story.approved === true && (
              <span className="story-scoop-badge">{t('verifiedWire') || "🧸 Littlables' Little Scoop"}</span>
            )}
          </div>

          <h2 id="story-modal-title" className="story-modal-title">
            {story.title}
          </h2>

          {story.aiSummary && story.aiSummary.trim().length > 0 && (
            <div className="news-card-ai-summary story-modal-ai-summary">
              <div className="news-card-ai-label">{t('aiBriefTag') || '✨ Quick AI Brief'}</div>
              <div className="ai-summary-text">{story.aiSummary}</div>
            </div>
          )}

          {story.description && (
            <p className="story-modal-desc">{story.description}</p>
          )}

          <div className="news-card-footer story-modal-footer">
            <a
              href={story.link || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="news-read-more-btn story-modal-read-btn"
              data-umami-event="Clicked-Story"
              data-umami-event-url={story.link || ''}
              data-umami-event-title={story.title}
              onClick={() => trackStoryClick(story)}
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
                data-umami-event-story={story.title}
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
                data-umami-event-story={story.title}
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
                data-umami-event-story={story.title}
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
    </dialog>
  );
};
