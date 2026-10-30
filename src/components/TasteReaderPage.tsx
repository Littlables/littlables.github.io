import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { runTasteReader, TasteReaderRunResult } from '../services/tasteReaderService';

interface TasteReaderPageProps {
  onSignIn?: () => void;
}

/**
 * Taste Reader shell: route + admin gate + manual Run button + first
 * page of content balloons. The word-by-word reader, paging, filters,
 * and the weighted-keyword summary come in later steps; this page
 * deliberately shows only what step 2 already returns.
 */
export const TasteReaderPage: React.FC<TasteReaderPageProps> = ({ onSignIn }) => {
  const { session, profile, loading } = useAuth();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<TasteReaderRunResult | null>(null);

  if (loading) {
    return (
      <div className="news-feed-error" role="status">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="news-feed-error" role="status">
        <h2>The Reading Room (Taste Reader)</h2>
        <p>This page is for admins only. Sign in to continue.</p>
        {onSignIn && (
          <button className="refresh-news-button" onClick={onSignIn} style={{ marginTop: '0.75rem' }}>
            Sign in
          </button>
        )}
      </div>
    );
  }

  // Profile loads asynchronously after the session; a null profile here
  // means "still loading", not "not an admin" — do not flash a denial.
  if (!profile) {
    return (
      <div className="news-feed-error" role="status">
        <p>Loading your profile…</p>
      </div>
    );
  }

  if (profile.is_admin !== true) {
    return (
      <div className="news-feed-error" role="status">
        <h2>The Reading Room (Taste Reader)</h2>
        <p>
          This page is for admins only
          {profile.username ? `, and @${profile.username} is not flagged as an admin.` : '.'}
        </p>
      </div>
    );
  }

  const handleRun = async () => {
    const accessToken = session.access_token;
    if (!accessToken) {
      setError('Sign-in is required');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const result = await runTasteReader(accessToken);
      setRun(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run Taste Reader');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <h2>The Reading Room (Taste Reader)</h2>
      <p>
        Start a manual run to pick the next 10 balloons from the past 24 hours,
        scored against your taste profile. The reader comes next; this page
        shows the first page only for now.
      </p>
      <button
        className="refresh-news-button"
        onClick={handleRun}
        disabled={running}
        style={{ marginTop: '0.75rem', marginBottom: '1rem' }}
      >
        {running ? 'Running…' : run ? 'Run again' : 'Run Taste Reader'}
      </button>
      {error && (
        <div className="news-feed-error" role="alert">
          <p>{error}</p>
        </div>
      )}
      {run && (
        <p role="status">
          {run.totalCount} balloons in this run
          {run.totalCount > run.items.length ? ` — showing the first ${run.items.length}` : '.'}
        </p>
      )}
      {run && run.items.length === 0 && (
        <div className="news-feed-error" role="status">
          <p>No balloons matched in the past 24 hours. Try again later.</p>
        </div>
      )}
      {run && run.items.length > 0 && (
        <div>
          {run.items.map((item) => (
            <article key={item.contentId} className="news-card">
              {item.image && (
                <div className="news-card-image-wrap is-loaded">
                  <img className="news-card-image is-loaded" src={item.image} alt="" loading="lazy" />
                </div>
              )}
              <div className="news-card-content">
                <span className="news-card-badge">{item.space}</span>
                <h3 className="news-card-title">
                  <a href={item.link} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                </h3>
                {item.description && <p className="news-card-desc">{item.description}</p>}
                <div className="news-card-meta">
                  <span>{item.source}</span>
                  <span>Score {item.score}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
