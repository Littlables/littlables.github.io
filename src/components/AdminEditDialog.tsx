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

interface AdminEditDialogProps {
  story: NewsItem | null;
  onClose: () => void;
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

export const AdminEditDialog: React.FC<AdminEditDialogProps> = ({ story, onClose }) => {
  const [details, setDetails] = useState<StoryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [keywordFilter, setKeywordFilter] = useState('');

  useEffect(() => {
    if (!story) return;
    setLoading(true);
    setError(null);
    adminFetch(`/admin/api/stories/by-url?url=${encodeURIComponent(story.link)}`)
      .then((data: StoryDetails) => {
        setDetails(data);
        setSelectedKeywords(data.interest_keywords || []);
        setSelectedCategories(data.display_categories || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [story]);

  if (!story) return null;

  const handleAction = async (action: 'approve' | 'disapprove' | 'ban' | 'undo') => {
    if (!details) return;
    setSaving(true);
    try {
      await adminFetch(`/admin/api/stories/${details.id}/${action}`, { method: 'POST' });
      const updated = await adminFetch(`/admin/api/stories/by-url?url=${encodeURIComponent(story.link)}`);
      setDetails(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKeywords = async () => {
    if (!details) return;
    setSaving(true);
    try {
      await adminFetch(`/admin/api/stories/${details.id}/interest-keywords`, {
        method: 'PATCH',
        body: JSON.stringify({ interest_keywords: selectedKeywords }),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategories = async () => {
    if (!details) return;
    setSaving(true);
    try {
      await adminFetch(`/admin/api/stories/${details.id}/display-categories`, {
        method: 'PATCH',
        body: JSON.stringify({ display_categories: selectedCategories.length > 0 ? selectedCategories : null }),
      });
      setError(null);
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
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const filteredKeywords = INTEREST_KEYWORDS.filter((k) => {
    if (!keywordFilter) return true;
    const f = keywordFilter.toLowerCase();
    return k.label.toLowerCase().includes(f) || k.id.toLowerCase().includes(f) || k.group.toLowerCase().includes(f);
  });

  // Group keywords by group for display
  const grouped: Record<string, typeof INTEREST_KEYWORDS> = {};
  filteredKeywords.forEach((k) => {
    if (!grouped[k.group]) grouped[k.group] = [];
    grouped[k.group].push(k);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">Edit Balloon</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-4 line-clamp-2">{story.title}</p>

        {loading && <p className="text-gray-400">Loading story details…</p>}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {details && (
          <>
            {/* Approval actions */}
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

            {/* Keywords */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                Interest Keywords ({selectedKeywords.length}/3)
              </h3>
              <input
                type="text"
                placeholder="Filter keywords…"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                className="w-full px-3 py-2 mb-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
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
              <button
                onClick={handleSaveKeywords}
                disabled={saving}
                className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                Save Keywords
              </button>
            </div>

            {/* Category override */}
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                Category Override {selectedCategories.length > 0 && `(${selectedCategories.join(', ')})`}
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Query category: <span className="text-gray-300">{details.category}</span>
                {' '}— select override categories, or clear all to use the query category.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {CATEGORIES.map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
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
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCategories}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  Save Categories
                </button>
                {selectedCategories.length > 0 && (
                  <button
                    onClick={() => setSelectedCategories([])}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
