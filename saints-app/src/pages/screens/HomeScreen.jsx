import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { warmLeagueCache } from '@/lib/leagueCache';

const NAVY_DARK = '#07111c';
const GOLD = '#c6b583';

import { cldImg } from '@/lib/cloudinaryImg';

const SAINTS_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/av99z9xmev36zy31_qm53uc.png';
const CCL_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';

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
const COL4 = [
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/04r7l3jmpy9v0slb_cauron.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/channels4_profile_mniouy.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/l6tqvygf63u3wvho_dllalk.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817576/merchantslogo_qqc6md.webp',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/vtzblkk57y33zsf1_f6lijk.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781818906/Sonoma_Stompers_Logo_y5svcw.png',
];
const COL5 = [
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/236yprqvgl4acuaq_aterpu.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/Chief_Wahoo__mascot_character.svg_l1zxwq.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/y5kt81hflbi56t76_dp2lgi.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817780/logo-cmyk_limfsa.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817730/images__1_-removebg-preview_if8az0.png',
  'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/uvrxcl0c44hrmvu6_bb3aqf.png',
];

const TRACKMAN_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781850858/Big_Grey_o4nxgb.webp';

function NavCard({ logoUrl, title, onClick }) {
  return (
    <div className="home-glass-card" onClick={onClick} style={{ alignItems: 'center' }}>
      <div style={{ width: 52, height: 52, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={cldImg(logoUrl, 120)} alt={title} style={{ maxWidth: 52, maxHeight: 52, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
      </div>
      <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 14.5, color: '#f0ece0', lineHeight: 1.2, textAlign: 'center' }}>
        {title}
      </div>
    </div>
  );
}

function CarouselCol({ logos, duration, delay }) {
  const doubled = [...logos, ...logos];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, flexShrink: 0,
      animation: `carouselScroll ${duration}s linear infinite`,
      animationDelay: `${delay}s`,
    }}>
      {doubled.map((url, i) => (
        <img
          key={i} src={cldImg(url, 160)} alt="" draggable={false}
          style={{ width: 78, height: 78, objectFit: 'contain', flexShrink: 0, opacity: 0.19, filter: 'grayscale(40%) brightness(1.4)', userSelect: 'none', pointerEvents: 'none' }}
        />
      ))}
    </div>
  );
}

export default function HomeScreen({ setScreen }) {
  const [dugoutLogoUrl, setDugoutLogoUrl] = useState(CCL_LOGO);

  // PERF: kick off the league pitch pool fetch as soon as the app lands on
  // HomeScreen, instead of waiting for the first profile to be opened. By the
  // time someone navigates into Data Repository, the cache is usually warm.
  useEffect(() => {
    warmLeagueCache();
  }, []);

  useEffect(() => {
    Promise.all([
      base44.entities.Game.list('-date', 10),
      base44.entities.Team.list('name', 100),
    ]).then(([games, teams]) => {
      const activeGame = games.find(g => g.status === 'imported' || g.status === 'active');
      if (!activeGame) return;
      const opponentCode = activeGame.away_team_code === 'ARR' ? activeGame.home_team_code : activeGame.away_team_code;
      const opponentName = activeGame.away_team_code === 'ARR' ? activeGame.home_team : activeGame.away_team;
      const team = teams.find(t => t.code === opponentCode || t.name === opponentName);
      if (team?.logo_url) setDugoutLogoUrl(team.logo_url);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: NAVY_DARK, overflow: 'hidden' }}>
      <style>{`
        @keyframes carouselScroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .home-glass-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(198, 181, 131, 0.18);
          border-radius: 12px;
          padding: 22px 18px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.18s ease, box-shadow 0.18s ease;
        }
        .home-glass-card:hover {
          background: rgba(255, 255, 255, 0.085);
          border-color: rgba(198, 181, 131, 0.5);
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        }
        .home-glass-card:active {
          transform: translateY(-1px);
        }
      `}</style>

      {/* ── Layer 1: Scrolling logo carousel ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', justifyContent: 'space-evenly', alignItems: 'flex-start',
        overflow: 'hidden',
      }}>
        <CarouselCol logos={COL1} duration={72} delay={0} />
        <CarouselCol logos={COL4} duration={58} delay={-14} />
        <CarouselCol logos={COL2} duration={50} delay={-22} />
        <CarouselCol logos={COL5} duration={44} delay={-6} />
        <CarouselCol logos={COL3} duration={38} delay={-9} />
      </div>

      {/* ── Layer 2: Vignette overlays ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `radial-gradient(ellipse 95% 75% at 50% 48%, transparent 0%, ${NAVY_DARK}bb 58%, ${NAVY_DARK}f0 100%)`,
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 1, pointerEvents: 'none',
        background: `linear-gradient(to bottom, ${NAVY_DARK}, transparent)`,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, zIndex: 1, pointerEvents: 'none',
        background: `linear-gradient(to top, ${NAVY_DARK}, transparent)`,
      }} />

      {/* ── Layer 3: Foreground content ── */}
      <div style={{
        position: 'relative', zIndex: 2,
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px 80px',
      }}>

        {/* Hero section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 44 }}>

          {/* Logos mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 30 }}>
            <img
              src={cldImg(SAINTS_LOGO, 240)} alt="Arroyo Seco Saints"
              style={{ width: 116, height: 116, objectFit: 'contain', filter: 'drop-shadow(0 0 32px rgba(198,181,131,0.3))' }}
            />
            <div style={{ width: 1, height: 68, background: 'rgba(198,181,131,0.22)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(198,181,131,0.5)', letterSpacing: 2, textTransform: 'uppercase' }}>Member of</span>
              <img src={cldImg(CCL_LOGO, 120)} alt="California Collegiate League" style={{ width: 56, height: 56, objectFit: 'contain', opacity: 0.8 }} />
            </div>
          </div>

          {/* Title */}
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, lineHeight: 1.0, letterSpacing: '-0.025em', textTransform: 'uppercase', marginBottom: 14 }}>
            <div style={{ fontSize: 'clamp(26px, 5.5vw, 50px)', color: '#f0ece0' }}>Arroyo Seco Saints</div>
            <div style={{ fontSize: 'clamp(26px, 5.5vw, 50px)', color: GOLD }}>Data / Scouting</div>
          </div>

          {/* Subtitle */}
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            2026 California Collegiate League · Powered by Trackman
          </div>
        </div>

        {/* Gold rule */}
        <div style={{ width: 38, height: 2, background: GOLD, borderRadius: 1, opacity: 0.45, marginBottom: 38 }} />

        {/* Navigation cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 13,
          width: '100%',
          maxWidth: 500,
        }}>
          <NavCard logoUrl={SAINTS_LOGO} title="Live Scout" onClick={() => setScreen('ADD_DATA')} />
          <NavCard logoUrl={CCL_LOGO} title="Data Repository" onClick={() => setScreen('VIEW_EXPORT')} />
          <NavCard logoUrl={TRACKMAN_LOGO} title="Import Trackman" onClick={() => setScreen('IMPORT_CSV')} />
          <NavCard logoUrl={dugoutLogoUrl} title="Dugout View" onClick={() => setScreen('DUGOUT')} />
        </div>
      </div>
    </div>
  );
}