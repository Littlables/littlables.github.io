    const AI_CONFIG = {
      workerUrl: 'https://hello-ai.cryptokatiee.workers.dev/'
    };

    async function generateAiSummary(title, rawDescription, articleUrl) {
      const { lang } = getDetectedLocale();
      const description = typeof rawDescription === 'string' ? rawDescription.slice(0, 12_000) : '';
      const response = await fetch(AI_CONFIG.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(title || '').slice(0, 500),
          description,
          articleUrl: String(articleUrl || ''),
          language: lang
        })
      });

      let result;
      try {
        result = await response.json();
      } catch (err) {
        throw new Error(`AI summary service returned invalid JSON (HTTP ${response.status})`);
      }

      if (!response.ok) {
        throw new Error(result.error || `AI summary request failed (HTTP ${response.status})`);
      }
      if (typeof result.error === 'string' && result.error) {
        console.warn('AI summary used partial article sources:', result.error, result.unresolvedUrls || []);
      }
      if (typeof result.summary !== 'string' || !result.summary.trim()) {
        throw new Error('AI summary service returned an empty summary');
      }

      return result.summary.trim();
    }
