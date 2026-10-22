import React, { useEffect, useRef } from 'react';
import { AboutPage } from './AboutPage';

interface InfoDialogProps {
  id: 'about' | 'disclaimer';
  isOpen: boolean;
  onClose: () => void;
  onSignIn?: () => void;
}

export const InfoDialog: React.FC<InfoDialogProps> = ({ id, isOpen, onClose, onSignIn }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      // When opened from the footer, jump straight to the FAQ / about sections.
      if (id === 'about') {
        requestAnimationFrame(() => {
          dialog.querySelector('#about-faq')?.scrollIntoView({ block: 'start' });
        });
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, id]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="site-info-dialog"
      id={`${id}-dialog`}
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <button
        className="site-info-close"
        type="button"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>

      {id === 'about' ? (
        <AboutPage
          onExplore={onClose}
          onSignIn={onSignIn}
        />
      ) : (
        <div className="disclaimer-body">
          <h2 id="disclaimer-title">A quick note 📝</h2>
          <ul className="disclaimer-points">
            <li>
              <span className="disclaimer-point-icon" aria-hidden="true">📰</span>
              <span><strong>Stories come from publishers across the web.</strong> We don't own them, and linking isn't an endorsement — publishers are responsible for their own content.</span>
            </li>
            <li>
              <span className="disclaimer-point-icon" aria-hidden="true">✅</span>
              <span><strong>The Little Scoop badge means we reviewed it.</strong> Stories without the badge haven't been reviewed yet.</span>
            </li>
            <li>
              <span className="disclaimer-point-icon" aria-hidden="true">🤖</span>
              <span><strong>Summaries are AI-generated</strong> to give you the gist fast. They can miss context or get things wrong — always check the original article for important details.</span>
            </li>
            <li>
              <span className="disclaimer-point-icon" aria-hidden="true">🔗</span>
              <span><strong>Follow the source link</strong> to read the full story and verify anything that matters.</span>
            </li>
          </ul>
          <p className="disclaimer-foot">
            Questions? Reach us at <strong>hello@littlables.com</strong> 💛
          </p>
        </div>
      )}
    </dialog>
  );
};
