import React, { useEffect, useRef } from 'react';

interface InfoDialogProps {
  id: 'about' | 'disclaimer';
  isOpen: boolean;
  onClose: () => void;
}

export const InfoDialog: React.FC<InfoDialogProps> = ({ id, isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
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
        <>
          <img
            src="/android-chrome-192x192.png"
            width="192"
            height="192"
            alt="Littlables pastel icon with colorful stacked blocks"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <h2 id="about-title">About Littlables</h2>
          <p>
            Littlables is a small, independent project built to make keeping up with the world feel a little more welcoming. We bring together stories about family and childcare, animals and nature, creative arts, future technology, global currents, and uplifting news in one colorful, easy-to-explore place.
          </p>
          <p>
            Our goal is to help curious people discover useful, interesting stories without losing sight of the good happening around us. Our roadmap is to keep improving the quality and variety of our sources, make our summaries and moderation clearer, and grow the site thoughtfully while keeping it friendly, accessible, and fun.
          </p>
        </>
      ) : (
        <>
          <h2 id="disclaimer-title">A little note about our stories</h2>
          <p>
            Stories are collected from third-party publishers and may be reviewed by Littlables before receiving the Littlables' Little Scoop badge; stories without the badge may still appear in the feed and have not necessarily been reviewed. AI summaries are generated to help readers get a quick overview, can make mistakes or miss context, and are not a replacement for the original article. Please follow the source link to read the publisher's full story and verify important details. Littlables does not own or endorse linked articles, and publishers remain responsible for their content.
          </p>
        </>
      )}
    </dialog>
  );
};
