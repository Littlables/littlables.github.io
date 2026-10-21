import React, { useEffect, useRef } from 'react';
import { NewsCategory } from '../types';
import { CATEGORIES } from '../constants/config';
import { t, TranslationStrings } from '../constants/translations';
import { getTopicHref, isCustomTopic, formatCustomTopicLabel } from '../services/urlService';
import { trackCategoryClick } from '../services/trackingService';

interface CategoryNavProps {
  currentCategory: NewsCategory;
  onSelectCategory: (category: NewsCategory) => void;
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
  onSelectCategory
}) => {
  const hasCustomTopic = isCustomTopic(currentCategory);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      scrollActiveCategoryIntoView(containerRef.current);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [currentCategory]);

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
      <nav className="news-category-bar" id="news-category-bar" aria-label="News Categories">
        {CATEGORIES.map((cat) => {
          const isActive = !hasCustomTopic && currentCategory === cat.id;
          const label = t(cat.i18nKey as keyof TranslationStrings) || cat.id;
          const topicHref = getTopicHref(cat.id);

          return (
            <a
              key={cat.id}
              href={topicHref}
              className={`cat-pill ${isActive ? 'active' : ''}`}
              data-category={cat.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                trackCategoryClick(cat.id);
                onSelectCategory(cat.id);
                window.requestAnimationFrame(() => {
                  scrollActiveCategoryIntoView(containerRef.current);
                });
              }}
            >
              <span>{cat.icon}</span>
              <span className="cat-text">{label}</span>
            </a>
          );
        })}

        {hasCustomTopic && (
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
              onSelectCategory(currentCategory);
              window.requestAnimationFrame(() => {
                scrollActiveCategoryIntoView(containerRef.current);
              });
            }}
          >
            <span>🔍</span>
            <span className="cat-text">{formatCustomTopicLabel(currentCategory)}</span>
          </a>
        )}
      </nav>
    </div>
  );
};
