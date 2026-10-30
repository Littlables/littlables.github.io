import React, { useMemo, useState } from 'react';
import {
  scoreTasteReaderWord,
  saveTasteReaderNote,
  generateTasteReaderReason,
  normalizeTasteReaderWord,
  TasteReaderRunItem,
  TasteReaderWordAction,
} from '../services/tasteReaderService';

interface ReaderToken {
  display: string;
  source: 'title' | 'description';
  position: number;
}

interface TasteReaderReaderProps {
  item: TasteReaderRunItem;
  runId: string;
  accessToken: string;
  onClose: () => void;
  /** Move to the next balloon on this page; the page closes the reader when there is none left. */
  onAdvanceBalloon: () => void;
}

/**
 * Word-by-word reader for one content balloon (title + description only).
 * Seven words visible: the current word bigger and bolder, three behind
 * and three ahead smaller and dimmer. Up/down mark the current word
 * (+1 / -1); Next (-1), Ignore (-3) and Ban (-5) score the word the
 * reader is stopped at, then move on. Notes and AI reasons save to the
 * database under the signed-in admin.
 */
export const TasteReaderReader: React.FC<TasteReaderReaderProps> = ({
  item,
  runId,
  accessToken,
  onClose,
  onAdvanceBalloon,
}) => {
  const tokens = useMemo<ReaderToken[]>(() => {
    const titleTokens = (item.title || '').split(/\s+/).filter(Boolean)
      .map((display, position) => ({ display, source: 'title' as const, position }));
    const descriptionTokens = (item.description || '').split(/\s+/).filter(Boolean)
      .map((display, position) => ({ display, source: 'description' as const, position }));
    return [...titleTokens, ...descriptionTokens];
  }, [item]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [marks, setMarks] = useState<Record<number, 'up' | 'down'>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [generatedReason, setGeneratedReason] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [generating, setGenerating] = useState(false);

  const current = tokens[currentIndex];
  const currentScoreable = current ? normalizeTasteReaderWord(current.display) !== '' : false;
  const visibleStart = Math.max(0, currentIndex - 3);
  const visibleEnd = Math.min(tokens.length, currentIndex + 4);
  const visible = tokens.slice(visibleStart, visibleEnd);

  const scoreCurrent = async (action: TasteReaderWordAction): Promise<boolean> => {
    if (!current) return false;
    if (!currentScoreable) return true;
    setBusy(true);
    setError(null);
    try {
      await scoreTasteReaderWord(accessToken, {
        contentId: item.contentId,
        runId,
        wordDisplay: current.display,
        source: current.source,
        wordPosition: current.position,
        action,
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the word score');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleMark = async (action: 'up' | 'down') => {
    if (busy || !current) return;
    const ok = await scoreCurrent(action);
    if (ok) setMarks((prev) => ({ ...prev, [currentIndex]: action }));
  };

  const handleStep = async (action: 'next') => {
    if (busy || !current) return;
    const ok = await scoreCurrent(action);
    if (!ok) return;
    if (currentIndex < tokens.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onAdvanceBalloon();
    }
  };

  const handleSkipBalloon = async (action: 'ignore' | 'ban') => {
    if (busy) return;
    if (current) {
      const ok = await scoreCurrent(action);
      if (!ok) return;
    }
    onAdvanceBalloon();
  };

  const handleSaveNote = async () => {
    if (busy || !note.trim()) return;
    setBusy(true);
    setError(null);
    setNoteSaved(false);
    try {
      const isGenerated = generatedReason !== null && note.trim() === generatedReason.trim();
      await saveTasteReaderNote(accessToken, {
        contentId: item.contentId,
        runId,
        kind: isGenerated ? 'ai_reason' : 'user_note',
        body: note.trim(),
        actionContext: 'viewed',
        stoppedWordNormalized: current ? normalizeTasteReaderWord(current.display) || null : null,
        stoppedPosition: current ? current.position : null,
        aiModel: isGenerated ? 'llama-3.2-3b-instruct' : null,
      });
      setNoteSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the note');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateReason = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateTasteReaderReason(accessToken, item.title, item.description);
      setNote(result.reason);
      setGeneratedReason(result.reason);
      setNoteSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a reason');
    } finally {
      setGenerating(false);
    }
  };

  if (tokens.length === 0) {
    return (
      <div className="dialog-overlay" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
          <h2 className="dialog-title">Nothing to read</h2>
          <p>This balloon has no title or description text.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="dialog-title">Reading: {item.title || 'Untitled balloon'}</h2>
        <p className="dialog-subtitle">
          {item.source} · {item.space} · word {currentIndex + 1} of {tokens.length}
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '0.5rem',
            minHeight: '3.5rem',
            margin: '1rem 0',
          }}
        >
          {visible.map((token, offset) => {
            const index = visibleStart + offset;
            const isCurrent = index === currentIndex;
            const mark = marks[index];
            return (
              <button
                key={`${index}-${token.display}`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: isCurrent ? '1.6rem' : '0.95rem',
                  fontWeight: isCurrent ? 700 : 400,
                  opacity: isCurrent ? 1 : 0.55,
                  color: 'inherit',
                }}
              >
                {token.display}
                {mark === 'up' && ' ↑'}
                {mark === 'down' && ' ↓'}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className="refresh-news-button" type="button" disabled={busy || currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)}>← Prev word</button>
          <button className="refresh-news-button" type="button" disabled={busy} onClick={() => handleStep('next')}>Next word →</button>
          <button className="refresh-news-button" type="button" disabled={busy || !currentScoreable} onClick={() => handleMark('up')}>👍 Up (+1)</button>
          <button className="refresh-news-button" type="button" disabled={busy || !currentScoreable} onClick={() => handleMark('down')}>👎 Down (−1)</button>
          <button className="refresh-news-button" type="button" disabled={busy} onClick={() => handleSkipBalloon('ignore')}>Ignore (−3)</button>
          <button className="refresh-news-button" type="button" disabled={busy} onClick={() => handleSkipBalloon('ban')}>Ban (−5)</button>
        </div>

        {error && (
          <div className="news-feed-error" role="alert">
            <p>{error}</p>
          </div>
        )}

        <label htmlFor="taste-reader-note" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
          Notes
        </label>
        <textarea
          id="taste-reader-note"
          value={note}
          onChange={(e) => { setNote(e.target.value); setNoteSaved(false); }}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.5rem' }}
          placeholder="Why was this skipped, or worth a second look?"
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button className="refresh-news-button" type="button" disabled={busy || !note.trim()} onClick={handleSaveNote}>Save note</button>
          <button className="refresh-news-button" type="button" disabled={generating} onClick={handleGenerateReason}>
            {generating ? 'Generating…' : 'Generate Reason'}
          </button>
          {noteSaved && <span role="status">Saved.</span>}
        </div>
      </div>
    </div>
  );
};
