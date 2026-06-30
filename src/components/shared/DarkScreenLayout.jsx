import React from 'react';

const NAVY_DARK = '#07111c';
const GOLD = '#c6b583';

const COL1 = [
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/vtzblkk57y33zsf1_f6lijk.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/7u38z54jtr0h1o14_1_pmqyld.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/236yprqvgl4acuaq_aterpu.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/Chief_Wahoo__mascot_character.svg_l1zxwq.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/y5kt81hflbi56t76_dp2lgi.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/l6tqvygf63u3wvho_dllalk.png',
];
const COL2 = [
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/uvrxcl0c44hrmvu6_bb3aqf.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/av99z9xmev36zy31_qm53uc.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/04r7l3jmpy9v0slb_cauron.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/channels4_profile_mniouy.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/lrhijpxhfifva748_czq1yd.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817576/merchantslogo_qqc6md.webp',
];
const COL3 = [
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817780/logo-cmyk_limfsa.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817730/images__1_-removebg-preview_if8az0.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781818906/Sonoma_Stompers_Logo_y5svcw.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/vtzblkk57y33zsf1_f6lijk.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/7u38z54jtr0h1o14_1_pmqyld.png',
];

function CarouselCol({ logos, duration, delay }) {
  const doubled = [...logos, ...logos];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, flexShrink: 0,
      animation: `carouselScroll ${duration}s linear infinite`,
      animationDelay: `${delay}s`,
    }}>
      {doubled.map((url, i) => (
        <img key={i} src={url} alt="" draggable={false}
          style={{ width: 70, height: 70, objectFit: 'contain', flexShrink: 0, opacity: 0.13, filter: 'grayscale(30%) brightness(1.5)', userSelect: 'none', pointerEvents: 'none' }} />
      ))}
    </div>
  );
}

/**
 * Full-screen dark layout with the subtle scrolling logo carousel background.
 * children is rendered in the foreground.
 * If noCarousel=true, still renders dark bg but without the carousel (for Hub).
 */
export default function DarkScreenLayout({ children, noCarousel = false }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: NAVY_DARK, overflow: 'hidden' }}>
      <style>{`
        @keyframes carouselScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .dark-glass-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(198,181,131,0.18);
          border-radius: 12px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .dark-input {
          background: rgba(255,255,255,0.07) !important;
          border: 1px solid rgba(198,181,131,0.25) !important;
          border-radius: 6px !important;
          color: #f0ece0 !important;
          padding: 8px 11px !important;
          font-size: 13px !important;
          font-family: 'Archivo', sans-serif !important;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
        }
        .dark-input:focus {
          border-color: rgba(198,181,131,0.6) !important;
        }
        .dark-input::placeholder { color: rgba(255,255,255,0.25) !important; }
        .dark-input option { background: #0e253a; color: #f0ece0; }
        .dark-back-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(198,181,131,0.22);
          border-radius: 6px;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(240,236,224,0.8);
          cursor: pointer;
          font-family: 'Archivo', sans-serif;
          transition: background 0.15s, border-color 0.15s;
          letter-spacing: 0.2px;
        }
        .dark-back-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(198,181,131,0.45);
        }
        .dark-primary-btn {
          background: ${GOLD};
          color: #07111c;
          border: none;
          border-radius: 8px;
          font-family: 'Archivo', sans-serif;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.12s;
          letter-spacing: -0.2px;
        }
        .dark-primary-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .dark-primary-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .dark-label {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          color: rgba(198,181,131,0.7);
          letter-spacing: 1.2px;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-family: 'Archivo', sans-serif;
        }
      `}</style>

      {/* Carousel background */}
      {!noCarousel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-evenly', alignItems: 'flex-start', overflow: 'hidden' }}>
          <CarouselCol logos={COL1} duration={72} delay={0} />
          <CarouselCol logos={COL2} duration={50} delay={-22} />
          <CarouselCol logos={COL3} duration={38} delay={-9} />
        </div>
      )}

      {/* Vignette */}
      {!noCarousel && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: `radial-gradient(ellipse 95% 75% at 50% 48%, transparent 0%, #07111cbb 58%, #07111cf0 100%)` }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to bottom, #07111c, transparent)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to top, #07111c, transparent)' }} />
        </>
      )}

      {/* Foreground */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}