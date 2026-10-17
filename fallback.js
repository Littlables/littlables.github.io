    function renderFallbackStories(container, error) {
      const message = document.createElement('p');
      message.className = 'news-feed-error';
      message.setAttribute('role', 'alert');
      message.textContent = error instanceof Error
        ? `${t('error')} ${error.message}`
        : t('error');
      container.replaceChildren(message);
    }
