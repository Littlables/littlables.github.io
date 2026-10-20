import React from 'react';
import { NewsCategory } from '../types';
import { CATEGORIES } from '../constants/config';
import { t, TranslationStrings } from '../constants/translations';
import { getTopicHref, isCustomTopic, formatCustomTopicLabel } from '../services/urlService';
import { RIBBON_UMAMI_EVENTS, trackCategoryClick } from '../services/trackingService';

interface CategoryNavProps {
  currentCategory: NewsCategory;
  onSelectCategory: (category: NewsCategory) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  currentCategory,
  onSelectCategory
}) => {
  const hasCustomTopic = isCustomTopic(currentCategory);

  return (
    <div className="news-category-container">
      <nav className="news-category-bar" id="news-category-bar" aria-label="News Categories">
        {CATEGORIES.map((cat) => {
          const isActive = !hasCustomTopic && currentCategory === cat.id;
          const label = t(cat.i18nKey as keyof TranslationStrings) || cat.id;
          const eventName = RIBBON_UMAMI_EVENTS[cat.id] || `Ribbon-${cat.id}`;
          const topicHref = getTopicHref(cat.id);

          return (
            <a
              key={cat.id}
              href={topicHref}
              className={`cat-pill ${isActive ? 'active' : ''}`}
              data-category={cat.id}
              data-umami-event={eventName}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                trackCategoryClick(cat.id);
                onSelectCategory(cat.id);
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
