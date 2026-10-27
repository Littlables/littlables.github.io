import React, { useEffect, useRef, useState } from 'react';
import { NewsCategory } from '../types';
import { CATEGORIES } from '../constants/config';
import { t, TranslationStrings } from '../constants/translations';
import { getTopicHref, isCustomTopic, formatCustomTopicLabel } from '../services/urlService';
import { trackCategoryClick } from '../services/trackingService';
import { useAuth, type PillConfig } from '../contexts/AuthContext';
import { getUserSpaces, type Space } from '../services/spaceService';
import { getPillEmoji, getClosestEmojiForText } from '../services/spaceEmojiService';

interface CategoryNavProps {
  currentCategory: NewsCategory;
  onSelectCategory: (category: NewsCategory) => void;
  userPills?: PillConfig[] | null;
}

export function getPillTopicId(pill: PillConfig): NewsCategory {
  if (pill.type === 'category') {
    return pill.id;
  }
  if (pill.type === 'space' || pill.type === 'board') {
    const firstKeyword = (pill.keywords || '')
      .split(',')
      .map((k) => k.trim())
      .find(Boolean);
    return (firstKeyword || pill.label || pill.id).trim().toLowerCase();
  }
  return (pill.keywords || pill.label || pill.id).trim().toLowerCase();
}

export function scrollActiveCategoryIntoView(containerEl?: HTMLElement | null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const container =
    containerEl ||
    (document.querySelector('.news-category-container') as HTMLElement | null);
  if (!container) return;

  const activePill = container.querySelector('.cat-pill.active') as HTMLElement | null;
  if (!activePill) return;

  if (container.scrollWidth > container.clientWidth) {
    const containerRect = container.getBoundingClientRect();
    const pillRect = activePill.getBoundingClientRect();
    const pillCenterInContainer =
      pillRect.left - containerRect.left + container.scrollLeft + pillRect.width / 2;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const targetScrollLeft = Math.min(
      maxScroll,
      Math.max(0, pillCenterInContainer - container.clientWidth / 2)
    );

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    } else {
      container.scrollLeft = targetScrollLeft;
    }
  }
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  currentCategory,
  onSelectCategory,
  userPills
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);

  const effectivePills: PillConfig[] =
    userPills && userPills.length > 0
      ? userPills
      : CATEGORIES.map((c) => ({ id: c.id, type: 'category' as const }));

  const hasSpacePill = effectivePills.some((p) => p.type === 'space' || p.type === 'board');

  useEffect(() => {
    if (!user?.id || !hasSpacePill) return;
    let cancelled = false;
    const fetchSpaces = () => {
      getUserSpaces(user.id)
        .then((loaded) => {
          if (!cancelled) setUserSpaces(loaded);
        })
        .catch(() => {});
    };
    fetchSpaces();
    const onSpacesChanged = () => fetchSpaces();
    window.addEventListener('littlables:spaces-changed', onSpacesChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('littlables:spaces-changed', onSpacesChanged);
    };
  }, [user?.id, hasSpacePill]);

  const normalizedCurrent = currentCategory.trim().toLowerCase();
  const isCurrentInPills = effectivePills.some(
    (pill) => getPillTopicId(pill).trim().toLowerCase() === normalizedCurrent
  );
  const showUnlistedCustomPill = isCustomTopic(currentCategory) && !isCurrentInPills;

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      scrollActiveCategoryIntoView(containerRef.current);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [currentCategory, userPills]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Let a vertical mouse wheel scroll the bar horizontally when hovering it.
    // Native listener (non-passive) so we can preventDefault the page scroll.
    const onWheel = (event: WheelEvent) => {
      // No-op when the bar fits without scrolling, or when the gesture is
      // already horizontal (trackpads, shift+wheel) — leave those alone.
      if (container.scrollWidth <= container.clientWidth + 1) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      container.scrollLeft += event.deltaY;
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div ref={containerRef} className="news-category-container">
      <nav className="news-category-bar" id="news-category-bar" aria-label="Spaces">
        {effectivePills.map((pill) => {
          const cat = pill.type === 'category' ? CATEGORIES.find((c) => c.id === pill.id) : undefined;
          const topicId = getPillTopicId(pill);
          const isActive = topicId.trim().toLowerCase() === normalizedCurrent;
          const label = cat
            ? t(cat.i18nKey as keyof TranslationStrings) || cat.id
            : pill.label || formatCustomTopicLabel(topicId);
          const icon = cat ? cat.icon : getPillEmoji(pill, userSpaces);
          const topicHref = getTopicHref(topicId);

          return (
            <a
              key={pill.id}
              href={topicHref}
              className={`cat-pill ${isActive ? 'active' : ''}`}
              data-category={topicId}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                trackCategoryClick(topicId);
                onSelectCategory(topicId);
                window.requestAnimationFrame(() => {
                  scrollActiveCategoryIntoView(containerRef.current);
                });
              }}
            >
              <span>{icon}</span>
              <span className="cat-text">{label}</span>
            </a>
          );
        })}

        {showUnlistedCustomPill && (
          <a
            href={getTopicHref(currentCategory)}
            className="cat-pill active custom-topic-pill"
            data-category={currentCategory}
            aria-current="page"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                return;
              }
              e.preventDefault();
              trackCategoryClick(currentCategory);
              onSelectCategory(currentCategory);
              window.requestAnimationFrame(() => {
                scrollActiveCategoryIntoView(containerRef.current);
              });
            }}
          >
            <span>{getClosestEmojiForText(currentCategory)}</span>
            <span className="cat-text">{formatCustomTopicLabel(currentCategory)}</span>
          </a>
        )}
      </nav>
    </div>
  );
};
