import React, { useEffect, useState } from 'react';
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

const inputCls =
  'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500';

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

export const StoryEditView: React.FC<StoryEditViewProps> = ({ story, onClose, onSaved }) => {
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
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [origKeywords, setOrigKeywords] = useState<string[]>([]);
  const [origCategories, setOrigCategories] = useState<string[]>([]);

  // NOTE: no body-overflow effect here on purpose — App's single
  // useLockBodyScroll owns that (see App.tsx). A second save/restore owner
  // raced it during the modal→view transition and left the page stuck
  // unscrollable or unlocked behind the view.

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
    // Full-screen view: dynamic viewport height so the mobile browser
    // toolbar showing/hiding doesn't resize it mid-scroll (the flicker),
    // and overscroll-contain so scrolling can't chain out to the page behind.
    <div className="fixed inset-x-0 top-0 z-50 h-[100dvh] overflow-y-auto overscroll-contain bg-[#0f172a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-4 pb-12">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium"
          >
            ← Back
          </button>
          <h2 className="text-xl font-bold">Edit Balloon</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {draft.image && (
          <img
            src={draft.image}
            alt=""
            className="w-full max-h-64 object-cover rounded-2xl mb-4"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {loading && <p className="text-gray-400 mb-4">Loading story details…</p>}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {savedMessage && <p className="text-green-400 text-sm mb-4">{savedMessage}</p>}

        {details && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Status</h3>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs ${details.approved ? 'bg-green-600' : 'bg-gray-700'} text-white`}>
                {details.approved ? '✓ Approved' : 'Not approved'}
              </span>
              {details.removed && (
                <span className="px-3 py-1 rounded-full text-xs bg-red-600 text-white">Banned</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {!details.approved && (
                <button
                  onClick={() => handleAction('approve')}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  Approve
                </button>
              )}
              {details.approved && (
                <button
                  onClick={() => handleAction('disapprove')}
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  Disapprove
                </button>
              )}
              <button
                onClick={() => handleAction('ban')}
                disabled={saving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                Ban
              </button>
              {(details.approved || details.removed) && (
                <button
                  onClick={() => handleAction('undo')}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        )}

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Title</span>
          <input type="text" value={draft.title} onChange={set('title')} maxLength={500} className={inputCls} />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Article URL</span>
          <input type="url" value={draft.link} onChange={set('link')} className={inputCls} />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Image URL</span>
          <input type="url" value={draft.image} onChange={set('image')} className={inputCls} />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Description</span>
          <textarea value={draft.description} onChange={set('description')} rows={4} className={inputCls} />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">AI summary</span>
          <textarea value={draft.aiSummary} onChange={set('aiSummary')} rows={3} className={inputCls} />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Content (AI summary source)</span>
          <textarea value={draft.content} onChange={set('content')} rows={5} className={inputCls} />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Publication date</span>
          <input
            type="datetime-local"
            value={toInputValue(draft.pubDate)}
            onChange={(e) => {
              setDraft((d) => ({ ...d, pubDate: fromInputValue(e.target.value) }));
              setSavedMessage('');
            }}
            className={inputCls}
          />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Source name</span>
          <input type="text" value={draft.source} onChange={set('source')} className={inputCls} />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-semibold text-gray-300 mb-1">Category</span>
          <select
            value={draft.category}
            onChange={(e) => {
              setCategoryTouched(true);
              setDraft((d) => ({ ...d, category: e.target.value }));
              setSavedMessage('');
            }}
            className={inputCls}
          >
            <option value="">Use query category{details ? ` (${details.category})` : ''}</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="capitalize">
                {cat}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">
            Interest Keywords ({selectedKeywords.length}/3)
          </h3>
          <input
            type="text"
            placeholder="Filter keywords…"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            className={`${inputCls} mb-3`}
          />
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {Object.entries(grouped).map(([group, kws]) => (
              <div key={group}>
                <p className="text-xs text-gray-500 font-medium mb-1">{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {kws.map((k) => {
                    const selected = selectedKeywords.includes(k.id);
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => toggleKeyword(k.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        } ${k.excluded ? 'border border-red-500/50' : ''}`}
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

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Display Categories (override)</h3>
          <p className="text-xs text-gray-500 mb-2">
            Select override categories, or clear all to use the query category.
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const selected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6 text-sm text-gray-400 space-y-1">
          {details && (
            <p>
              Story ID: <span className="text-gray-200">{details.id}</span>
            </p>
          )}
          {story.provider && (
            <p>
              Provider: <span className="text-gray-200">{story.provider}</span>
            </p>
          )}
        </div>

        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowRawJson((v) => !v)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium"
          >
            {showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
          </button>
          {showRawJson && (
            <pre className="mt-3 p-3 bg-gray-900 border border-gray-700 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(rawJson, null, 2)}
            </pre>
          )}
        </div>

        <div className="flex gap-2 pb-4">
          <button
            onClick={handleSaveAll}
            disabled={saving || !details}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
