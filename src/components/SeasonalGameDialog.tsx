import React, { useEffect, useRef } from 'react';

interface SeasonalGameDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Explains the falling-emoji seasonal game, in the same native-dialog style
 * as the About / Disclaimer dialogs. The points are just for fun — but more
 * seasonal events (with leaderboards and prizes) are on the way, so the copy
 * leans into coming back for the next one.
 */
export const SeasonalGameDialog: React.FC<SeasonalGameDialogProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="site-info-dialog seasonal-game-dialog"
      id="seasonal-game-dialog"
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <div className="site-info-scroll">
        <button
          type="button"
          className="site-info-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="seasonal-game-hero">
          <div className="seasonal-game-emoji-row" aria-hidden="true">
            <span>🎃</span>
            <span>👻</span>
            <span>🦇</span>
            <span>🍬</span>
            <span>🍭</span>
          </div>
          <h2 className="seasonal-game-title">A seasonal game!</h2>
        </div>
        <p>
          Catch the treats raining down on littlables, stack up points, and have fun —
          this is just a seasonal game, and your points don&apos;t count towards anything.
        </p>
        <p>
          But don&apos;t wander off for too long! More seasonal events are on the way,
          with <strong>leaderboards</strong> and <strong>prizes</strong> — so keep coming
          back, keep catching, and be ready when the next one drops.
        </p>
        <button type="button" className="primary-button seasonal-game-cta" onClick={onClose}>
          Keep catching! 🎃
        </button>
      </div>
    </dialog>
  );
};
