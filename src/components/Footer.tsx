import React from 'react';

interface FooterProps {
  onOpenAbout: () => void;
  onOpenDisclaimer: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAbout, onOpenDisclaimer }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <span>© <span id="copyright-year">{currentYear}</span> <span className="site-footer-brand">littlables</span></span>
      <nav aria-label="About littlables">
        <a
          href="#about-us"
          data-umami-event="Open-About"
          onClick={(e) => {
            e.preventDefault();
            onOpenAbout();
          }}
        >
          About us
        </a>
        <a
          href="#disclaimer"
          data-umami-event="Open-Disclaimer"
          onClick={(e) => {
            e.preventDefault();
            onOpenDisclaimer();
          }}
        >
          Disclaimer
        </a>
      </nav>
    </footer>
  );
};
