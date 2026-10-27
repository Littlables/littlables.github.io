import React, { useEffect, useRef, useState } from 'react';
import { NewsItem } from '../types';
import { INTEREST_KEYWORDS } from '../constants/interestKeywords';

const WORKER_URL = 'https://hello-ai.cryptokatiee.workers.dev';

interface StoryDetails {
  id: number;
  title: string;
  approved: boolean;
  removed: boolean;
  display_categories: string[] | null;
  interest_keywords: string[] | null;
  category: string;
}

interface StoryEditViewProps {
  story: NewsItem;
  onClose: () => void;
  onSaved?: () => void;
}

const CATEGORIES = ['childcare', 'animals', 'arts', 'tech', 'world', 'uplifting'];

async function adminFetch(path: string, options: RequestInit = {}) {
  const resp = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${resp.status}`);
  }
  return resp.json();
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time; the API wants ISO.
function toInputValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputValue(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

// NOTE: this project has no Tailwind — all styling here uses custom classes
// defined in index.css (.story-edit-*). Utility class names generate nothing
// in this codebase, which is why the previous fixed-div version rendered
// in-flow at the end of the page instead of as an overlay.
export const StoryEditView: React.FC<StoryEditViewProps> = ({ story, onClose, onSaved }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<StoryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('');

  // Draft starts from the card's feed item, which mirrors the DB row
  // (title, link, image, description, content, aiSummary, pubDate, source).
  const [draft, setDraft] = useState({
    title: story.title || '',
    link: story.link || '',
    image: story.image || '',
    description: story.description || '',
    content: story.content || '',
    aiSummary: story.aiSummary || '',
    pubDate: story.pubDate || '',
    source: story.source || '',
    category: story.category || '',
  });
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(story.interestKeywords || []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [origKeywords, setOrigKeywords] = useState<string[]>(story.interestKeywords || []);
  const [origCategories, setOrigCategories] = useState<string[]>([]);

  // Native dialog, same pattern as the expanded balloon view (StoryModal):
  // showModal puts it in the top layer, so it always opens as its own
  // window above the feed regardless of page CSS.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    dialog.scrollTop = 0;
  }, [story]);

  useEffect(() => {
    if (!story) return;
    setLoading(true);
    setError(null);
    adminFetch(`/admin/api/stories/by-url?url=${encodeURIComponent(story.link)}`)
      .then((data: StoryDetails) => {
        setDetails(data);
        setSelectedKeywords(data.interest_keywords || []);
        setOrigKeywords(data.interest_keywords || []);
        setSelectedCategories(data.display_categories || []);
        setOrigCategories(data.display_categories || []);
        // Fresh DB category wins unless the user already changed the select.
        if (!categoryTouched && data.category) {
          setDraft((d) => ({ ...d, category: data.category }));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [story]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const set = (field: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setDraft((d) => ({ ...d, [field]: e.target.value }));
    setSavedMessage('');
  };

  const handleAction = async (action: 'approve' | 'disapprove' | 'ban' | 'undo') => {
    if (!details) return;
    setSaving(true);
    try {
      await adminFetch(`/admin/api/stories/${details.id}/${action}`, { method: 'POST' });
      const updated = await adminFetch(`/admin/api/stories/by-url?url=${encodeURIComponent(story.link)}`);
      setDetails(updated);
      setSavedMessage(`Action applied: ${action}`);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!details) return;
    if (!draft.title.trim()) {
      setError('A title is required');
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMessage('');
    try {
      // Core fields: the worker writes all 9 columns, so send the full draft
      // (initialized from the feed item, which mirrors the DB row). An empty
      // category means "use the query category", so fall back to the DB value
      // rather than wiping the column.
      await adminFetch(`/admin/api/stories/${details.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: draft.title,
          link: draft.link,
          image: draft.image,
          description: draft.description,
          content: draft.content,
          aiSummary: draft.aiSummary,
          source: draft.source,
          category: draft.category || details.category,
          pubDate: draft.pubDate,
        }),
      });
      // Keywords / display categories only when changed, like the admin preview.
      if (JSON.stringify(selectedKeywords) !== JSON.stringify(origKeywords)) {
        await adminFetch(`/admin/api/stories/${details.id}/interest-keywords`, {
          method: 'PATCH',
          body: JSON.stringify({ interest_keywords: selectedKeywords }),
        });
        setOrigKeywords(selectedKeywords);
      }
      if (JSON.stringify(selectedCategories) !== JSON.stringify(origCategories)) {
        await adminFetch(`/admin/api/stories/${details.id}/display-categories`, {
          method: 'PATCH',
          body: JSON.stringify({ display_categories: selectedCategories.length > 0 ? selectedCategories : null }),
        });
        setOrigCategories(selectedCategories);
      }
      setSavedMessage('Saved ✓');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleKeyword = (id: string) => {
    setSelectedKeywords((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id].slice(0, 3)
    );
    setSavedMessage('');
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setSavedMessage('');
  };

  const filteredKeywords = INTEREST_KEYWORDS.filter((k) => {
    if (!keywordFilter) return true;
    const f = keywordFilter.toLowerCase();
    return k.label.toLowerCase().includes(f) || k.id.toLowerCase().includes(f) || k.group.toLowerCase().includes(f);
  });
  const grouped: Record<string, typeof INTEREST_KEYWORDS> = {};
  filteredKeywords.forEach((k) => {
    if (!grouped[k.group]) grouped[k.group] = [];
    grouped[k.group].push(k);
  });

  const rawJson = {
    ...draft,
    id: details?.id ?? null,
    approved: details?.approved ?? null,
    removed: details?.removed ?? null,
    interest_keywords: selectedKeywords,
    display_categories: selectedCategories.length > 0 ? selectedCategories : null,
  };

  return (
    <dialog
      ref={dialogRef}
      className="story-edit-dialog"
      aria-labelledby="story-edit-title"
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <div className="story-edit-body">
        <div className="story-edit-head">
          <button type="button" onClick={onClose} className="story-edit-back">
            ← Back
          </button>
          <h2 id="story-edit-title" className="story-edit-title">Edit Balloon</h2>
          <button type="button" onClick={onClose} className="story-edit-x" aria-label="Close">
            ×
          </button>
        </div>

        {draft.image && (
          <img
            src={draft.image}
            alt=""
            className="story-edit-image"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {error && <p className="story-edit-error">{error}</p>}
        {savedMessage && <p className="story-edit-saved">{savedMessage}</p>}

        <div className="story-edit-section">
          <h3 className="story-edit-section-title">Status</h3>
          {details ? (
            <>
              <div className="story-edit-actions">
                <span className={`story-edit-badge ${details.approved ? 'story-edit-badge-green' : ''}`}>
                  {details.approved ? '✓ Approved' : 'Not approved'}
                </span>
                {details.removed && (
                  <span className="story-edit-badge story-edit-badge-red">Banned</span>
                )}
              </div>
              <div className="story-edit-actions">
                {!details.approved && (
                  <button type="button" onClick={() => handleAction('approve')} disabled={saving} className="story-edit-btn story-edit-btn-green">
                    Approve
                  </button>
                )}
                {details.approved && (
                  <button type="button" onClick={() => handleAction('disapprove')} disabled={saving} className="story-edit-btn story-edit-btn-yellow">
                    Disapprove
                  </button>
                )}
                <button type="button" onClick={() => handleAction('ban')} disabled={saving} className="story-edit-btn story-edit-btn-red">
                  Ban
                </button>
                {(details.approved || details.removed) && (
                  <button type="button" onClick={() => handleAction('undo')} disabled={saving} className="story-edit-btn story-edit-btn-gray">
                    Undo
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="story-edit-actions">
                <span className="story-edit-badge">
                  {loading ? 'Loading status…' : 'Status unavailable'}
                </span>
              </div>
              <div className="story-edit-actions">
                <button type="button" disabled className="story-edit-btn story-edit-btn-green">
                  Approve
                </button>
                <button type="button" disabled className="story-edit-btn story-edit-btn-red">
                  Ban
                </button>
              </div>
            </>
          )}
        </div>

        <label className="story-edit-field">
          <span className="story-edit-label">Title</span>
          <input type="text" value={draft.title} onChange={set('title')} maxLength={500} className="story-edit-input" />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">Article URL</span>
          <input type="url" value={draft.link} onChange={set('link')} className="story-edit-input" />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">Image URL</span>
          <input type="url" value={draft.image} onChange={set('image')} className="story-edit-input" />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">Description</span>
          <textarea value={draft.description} onChange={set('description')} rows={4} className="story-edit-input" />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">AI summary</span>
          <textarea value={draft.aiSummary} onChange={set('aiSummary')} rows={3} className="story-edit-input" />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">Content (AI summary source)</span>
          <textarea value={draft.content} onChange={set('content')} rows={5} className="story-edit-input" />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">Publication date</span>
          <input
            type="datetime-local"
            value={toInputValue(draft.pubDate)}
            onChange={(e) => {
              setDraft((d) => ({ ...d, pubDate: fromInputValue(e.target.value) }));
              setSavedMessage('');
            }}
            className="story-edit-input"
          />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">Source name</span>
          <input type="text" value={draft.source} onChange={set('source')} className="story-edit-input" />
        </label>

        <label className="story-edit-field">
          <span className="story-edit-label">Category</span>
          <select
            value={draft.category}
            onChange={(e) => {
              setCategoryTouched(true);
              setDraft((d) => ({ ...d, category: e.target.value }));
              setSavedMessage('');
            }}
            className="story-edit-input"
          >
            <option value="">Use query category{details ? ` (${details.category})` : ''}</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="story-edit-option">
                {cat}
              </option>
            ))}
          </select>
        </label>

        <div className="story-edit-section">
          <h3 className="story-edit-section-title">
            Interest Keywords ({selectedKeywords.length}/3)
          </h3>
          <input
            type="text"
            placeholder="Filter keywords…"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            className="story-edit-input"
          />
          <div className="story-edit-keywords">
            {Object.entries(grouped).map(([group, kws]) => (
              <div key={group}>
                <p className="story-edit-group">{group}</p>
                <div className="story-edit-chips">
                  {kws.map((k) => {
                    const selected = selectedKeywords.includes(k.id);
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => toggleKeyword(k.id)}
                        className={`story-edit-chip ${selected ? 'story-edit-chip-selected' : ''} ${k.excluded ? 'story-edit-chip-excluded' : ''}`}
                      >
                        {k.icon} {k.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="story-edit-section">
          <h3 className="story-edit-section-title">Display Categories (override)</h3>
          <p className="story-edit-note">
            Select override categories, or clear all to use the query category.
          </p>
          <div className="story-edit-chips">
            {CATEGORIES.map((cat) => {
              const selected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`story-edit-chip ${selected ? 'story-edit-chip-blue' : ''}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="story-edit-section story-edit-meta">
          <p>
            Story ID: <span>{details ? details.id : loading ? '…' : '—'}</span>
          </p>
          {story.provider && (
            <p>
              Provider: <span>{story.provider}</span>
            </p>
          )}
        </div>

        <div className="story-edit-section">
          <button
            type="button"
            onClick={() => setShowRawJson((v) => !v)}
            className="story-edit-btn story-edit-btn-gray"
          >
            {showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
          </button>
          {showRawJson && (
            <pre className="story-edit-raw">
              {JSON.stringify(rawJson, null, 2)}
            </pre>
          )}
        </div>

        <div className="story-edit-actions">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !details}
            className="story-edit-btn story-edit-btn-purple"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="story-edit-btn story-edit-btn-gray"
          >
            Back
          </button>
        </div>
      </div>
    </dialog>
  );
};
