import React from 'react';
import { NewsCategory } from '../types';
import { CATEGORIES } from '../constants/config';
import { t, TranslationStrings } from '../constants/translations';

interface CategoryNavProps {
  currentCategory: NewsCategory;
  onSelectCategory: (category: NewsCategory) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  currentCategory,
  onSelectCategory
}) => {
  return (
    <div className="news-category-container">
      <nav className="news-category-bar" id="news-category-bar" aria-label="News Categories">
        {CATEGORIES.map((cat) => {
          const isActive = currentCategory === cat.id;
          const label = t(cat.i18nKey as keyof TranslationStrings) || cat.id;
          return (
            <button
              key={cat.id}
              className={`cat-pill ${isActive ? 'active' : ''}`}
              data-category={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              type="button"
            >
              <span>{cat.icon}</span>
              <span className="cat-text">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
