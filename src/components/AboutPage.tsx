import React from 'react';

interface AboutPageProps {
  onExplore?: () => void;
  onSignIn?: () => void;
}

const FEATURES = [
  {
    emoji: '📰',
    title: 'Curated topics',
    text: 'Family & childcare, animals & nature, creative arts, future tech, world currents, and uplifting news — picked for curious minds, not outrage.',
  },
  {
    emoji: '🗂️',
    title: 'Boards',
    text: 'Group your favorite topics into boards with their own name, logo, theme, and shareable link — like @you/pets.',
  },
  {
    emoji: '👤',
    title: 'Your Space',
    text: 'Create a profile with an avatar, bio, and social links. Your public page shows the world what you\'re into.',
  },
  {
    emoji: '🎨',
    title: 'Make it yours',
    text: 'Six cozy themes plus custom background colors. Your space, your vibe — on your profile, boards, and everywhere.',
  },
  {
    emoji: '🤖',
    title: 'Smart curation',
    text: 'Stories are scored and reviewed with a little AI help, so the good stuff rises and the noise stays out.',
  },
  {
    emoji: '💛',
    title: 'Brand-safe by design',
    text: 'Family-friendly, always. A calm corner of the internet advertisers and parents can trust.',
  },
];

const FAQS = [
  {
    q: 'What is Littlables?',
    a: 'Littlables is a cozy, independent news site that gathers stories about family, animals, arts, tech, the world, and uplifting news into one colorful, easy-to-explore place. Think of it as a little scoop of the world — without the doomscroll.',
  },
  {
    q: 'Is it free?',
    a: 'Yes! Browsing stories, creating a profile, and building boards are all free. We keep the lights on with thoughtful advertising from brands we trust.',
  },
  {
    q: 'Where do the stories come from?',
    a: 'We collect stories from publishers across the web — news outlets, blogs, and creators. Stories marked with the Little Scoop badge have been reviewed by our team.',
  },
  {
    q: 'What does the Little Scoop badge mean?',
    a: 'It means a human (with a little AI help) reviewed the story and gave it a thumbs-up for quality and family-friendliness. Stories without the badge haven\'t been reviewed yet.',
  },
  {
    q: 'What are boards?',
    a: 'Boards let you group topics into themed collections — each with its own name, logo, colors, and shareable link like @you/pets. Perfect for sharing your interests with friends or followers.',
  },
  {
    q: 'Do I need an account?',
    a: 'Nope — you can read everything without one. An account unlocks your profile, boards, themes, and personalization. Sign in with Google or email, no password needed.',
  },
];

export const AboutPage: React.FC<AboutPageProps> = ({ onExplore, onSignIn }) => {
  return (
    <div className="about-landing">
      {/* Hero */}
      <section className="about-hero">
        <img
          src="/android-chrome-192x192.png"
          width="96"
          height="96"
          alt="Littlables logo"
          className="about-hero-logo"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <h1 className="about-hero-title">Littlables</h1>
        <p className="about-hero-tagline">A Little Scoop of the World</p>
        <p className="about-hero-sub">
          Your cozy corner of the internet — curated news for curious families,
          animal lovers, makers, and optimists.
        </p>
        <div className="about-hero-ctas">
          {onExplore && (
            <button className="primary-button about-cta" onClick={onExplore}>
              Start exploring
            </button>
          )}
          {onSignIn && (
            <button className="secondary-button about-cta" onClick={onSignIn}>
              Create your space
            </button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="about-features">
        <h2>What you can do here</h2>
        <div className="about-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="about-feature-card">
              <span className="about-feature-emoji" aria-hidden="true">{f.emoji}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="about-faq" id="about-faq">
        <h2>Questions, answered</h2>
        <div className="about-faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="about-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* About us */}
      <section className="about-story" id="about-us-section">
        <h2>About us</h2>
        <p>
          Littlables is a small, independent project built to make keeping up
          with the world feel a little more welcoming. We bring together
          stories about family and childcare, animals and nature, creative
          arts, future technology, global currents, and uplifting news in one
          colorful, easy-to-explore place.
        </p>
        <p>
          Our goal is to help curious people discover useful, interesting
          stories without losing sight of the good happening around us. We're
          growing thoughtfully — improving our sources, making our curation
          clearer, and keeping the site friendly, accessible, and fun.
        </p>
        <p className="about-story-sign">— Katie, founder of Littlables 💛</p>
      </section>
    </div>
  );
};
