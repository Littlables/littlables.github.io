import React, { useEffect, useState } from 'react';
import { getPlayroomBySlug } from '../services/playroomService';
import { PlayroomPage } from './PlayroomPage';

interface SpaceRoutePageProps {
  username: string;
  slug: string;
  onHome: () => void;
  onOpenProfile: () => void;
  onBrand: (brand: { name: string; logoUrl: string | null } | null) => void;
}

/**
 * Resolves the legacy `/@username/<slug>` route: a playroom slug renders the
 * playroom page; anything else redirects to the canonical `/@username/spaces/<slug>`
 * space URL (which 404s if it's not a space either).
 */
export const SpaceRoutePage: React.FC<SpaceRoutePageProps> = (props) => {
  const { username, slug } = props;
  const [isPlayroom, setIsPlayroom] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsPlayroom(null);
    const redirectToSpace = () => {
      window.history.replaceState({}, '', `/@${username}/spaces/${slug}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    getPlayroomBySlug(username, slug)
      .then((result) => {
        if (cancelled) return;
        if (result) setIsPlayroom(true);
        else redirectToSpace();
      })
      .catch(() => {
        if (!cancelled) redirectToSpace();
      });
    return () => {
      cancelled = true;
    };
  }, [username, slug]);

  if (!isPlayroom) {
    return (
      <main className="news-grid">
        <div className="news-loading-skeleton" role="status">
          Fetching the freshest stories...
        </div>
      </main>
    );
  }

  return <PlayroomPage {...props} />;
};

export default SpaceRoutePage;
