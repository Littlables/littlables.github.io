import React, { useEffect, useState } from 'react';
import { getPlayroomBySlug } from '../services/playroomService';
import { PlayroomPage } from './PlayroomPage';
import { BoardPage } from './BoardPage';

interface SpaceRoutePageProps {
  username: string;
  slug: string;
  onHome: () => void;
  onOpenProfile: () => void;
}

/**
 * Resolves `/@username/<slug>`: a playroom slug renders the playroom page,
 * otherwise falls back to the board (space) page.
 */
export const SpaceRoutePage: React.FC<SpaceRoutePageProps> = (props) => {
  const { username, slug } = props;
  const [kind, setKind] = useState<'playroom' | 'board' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setKind(null);
    getPlayroomBySlug(username, slug)
      .then((result) => {
        if (!cancelled) setKind(result ? 'playroom' : 'board');
      })
      .catch(() => {
        if (!cancelled) setKind('board');
      });
    return () => {
      cancelled = true;
    };
  }, [username, slug]);

  if (kind === null) {
    return (
      <main className="news-grid">
        <div className="news-loading-skeleton" role="status">
          Fetching the freshest stories...
        </div>
      </main>
    );
  }

  if (kind === 'playroom') {
    return <PlayroomPage username={username} slug={slug} onHome={props.onHome} />;
  }
  return <BoardPage username={username} slug={slug} onHome={props.onHome} onOpenProfile={props.onOpenProfile} />;
};

export default SpaceRoutePage;
