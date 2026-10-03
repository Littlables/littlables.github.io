# littlables.github.io
Little snippets of current events

## Project files

- `index.html` contains the page structure and loads the app assets.
- `styles.css` contains the site styles and theme definitions.
- `i18n.js` contains the translation dictionaries and locale helpers.
- `theme.js` contains theme configuration, management, and profile sync.
- `cards.js` builds news and in-feed ad cards.
- `fallback.js` renders the offline/API-error story cards.
- `app.js` contains feed loading, category, and reaction logic.

The early theme initializer remains in `index.html` so the saved theme is applied before the page styles load.
The JavaScript files are loaded in dependency order as classic scripts so their shared helpers are available to the app.
