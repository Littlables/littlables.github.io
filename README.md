# Littlables — A Little Scoop of the World

A cozy, family-friendly news feed for curious minds, bringing together stories about family, animals, creativity, technology, world events, and uplifting news.

## Features

- **React SPA with TypeScript & Vite**: Modular, responsive component structure with high performance.
- **6 Visual Themes**: Dark, Dark Purple, Light, Rainbow, Pastel Rainbow, and Pretty Pink with local persistence and system dark/light mode detection.
- **Category Navigation**: Top Currents (all), Childcare & Family, Animals & Nature, Creative Arts, Future Tech & AI, Global Currents, and Uplifting News.
- **Category-Tailored Native Ads**: Loaded from `ads/` JSON files based on the currently selected category (`animals.json`, `childcare.json`, `arts.json`, `tech.json`, `world.json`), inserted at feed positions #2 and #5 with fallback and Google AdSense support.
- **Multilingual Support (i18n)**: 20+ localized languages (English, Marathi, Hindi, Bengali, Tamil, Telugu, Spanish, French, German, Portuguese, Italian, Chinese, Japanese, Korean, Arabic, Russian, Turkish, Indonesian, Vietnamese) with automatic browser locale and timezone detection.
- **Interactive Reactions**: Love ❤️, Mind Blown 🤯, and Cozy 🧸 reactions with live Supabase integration and offline caching.
- **AI Summary Callouts**: Formatted quick AI briefs (`✨ Quick AI Brief`) for approved and verified stories.
- **About & Disclaimer Dialogs**: Fully accessible modal dialogs for background information and transparency.

## Getting Started

### Development
```bash
npm install
npm run dev
```
The dev server runs at `http://0.0.0.0:3000`.

### Production Build
```bash
npm run build
npm run preview
```
