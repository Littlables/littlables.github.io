import React, { useEffect, useState } from 'react';
import { getPlayroomBySlug, Playroom } from '../services/playroomService';
import { getSpaceBySlug, Space } from '../services/spaceService';
import type { Profile } from '../contexts/AuthContext';
import { PlayroomPage, OpenProfileTarget } from './PlayroomPage';
import { SpacePage } from './SpacePage';
import { t } from '../constants/translations';

interface SpaceRoutePageProps {
  username: string;
  slug: string;
  onHome: () => void;
  onOpenProfile: (target?: OpenProfileTarget) => void;
}

type ResolvedRoute =
  | { kind: 'playroom'; data: { playroom: Playroom; ownerId: string; owner: Profile } }
  | { kind: 'space'; data: { space: Space; ownerId: string; owner: Profile } | null };

/**
 * Resolves `/@username/<slug>`: a playroom slug renders the playroom page,
 * otherwise falls back to the space page. Passes the resolved record
 * down so the child page never has to re-query it.
 */
export const SpaceRoutePage: React.FC<SpaceRoutePageProps> = (props) => {
  const { username, slug } = props;
  const [resolved, setResolved] = useState<ResolvedRoute | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    (async () => {
      try {
        const playroomResult = await getPlayroomBySlug(username, slug);
        if (cancelled) return;
        if (playroomResult) {
          setResolved({ kind: 'playroom', data: playroomResult });
          return;
        }
        const spaceResult = await getSpaceBySlug(username, slug).catch(() => null);
        if (!cancelled) {
          setResolved({ kind: 'space', data: spaceResult });
        }
      } catch {
        if (!cancelled) {
          setResolved({ kind: 'space', data: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, slug]);

  if (resolved === null) {
    return (
      <main className="news-grid">
        <div className="news-loading-skeleton" role="status">
          {t('loading') || 'Fetching the freshest stories...'}
        </div>
        {Array.from({ length: 6 }).map((_, idx) => (
          <article key={`skeleton-${idx}`} className="news-card news-skeleton-card" aria-hidden="true">
            <div className="news-card-image-wrap" />
            <div className="news-card-content">
              <div className="news-skeleton-line short" />
              <div className="news-skeleton-line title" />
              <div className="news-skeleton-line" />
              <div className="news-skeleton-line medium" />
            </div>
          </article>
        ))}
      </main>
    );
  }

  if (resolved.kind === 'playroom') {
    return (
      <PlayroomPage
        username={username}
        slug={slug}
        onHome={props.onHome}
        onOpenProfile={props.onOpenProfile}
        initialData={resolved.data}
      />
    );
  }
  return (
    <SpacePage
      username={username}
      slug={slug}
      onHome={props.onHome}
      onOpenProfile={props.onOpenProfile}
      initialData={resolved.data}
    />
  );
};

export default SpaceRoutePage;
