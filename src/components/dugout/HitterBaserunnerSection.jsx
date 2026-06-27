import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const NAVY = '#0e253a';
const GOLD = '#b8860b';
const CREAM = '#f4f2ec';
const FONT = "'Archivo', system-ui, sans-serif";

const GRADE_LABEL = { plus_plus: '++', plus: '+', average: 'AVG', below: '-', well_below: '--' };
const GRADE_COLOR = { plus_plus: '#16a34a', plus: '#65a30d', average: '#92400e', below: '#b45309', well_below: '#dc2626' };
const SPEED_COLOR = { fast: '#16a34a', average: '#d97706', slow: '#dc2626' };
const AGGR_COLOR  = { aggressive: '#16a34a', average: '#d97706', passive: '#6b7280' };

const KEYFRAMES = `
@keyframes slideInLeft {
  from { transform: translateX(-40px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
@keyframes slideInRight {
  from { transform: translateX(40px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes slideOutLeft {
  from { transform: translateX(0);     opacity: 1; }
  to   { transform: translateX(-40px); opacity: 0; }
}
@keyframes slideInUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes basePulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}
@keyframes goldFlash {
  0%   { color: ${NAVY}; }
  30%  { color: ${GOLD}; }
  100% { color: ${NAVY}; }
}
@keyframes sweepLine {
  from { width: 0; }
  to   { width: 100%; }
}
`;

function GradeBadge({ value }) {
  if (!value) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 3, background: GRADE_COLOR[value] + '22', color: GRADE_COLOR[value], border: `1px solid ${GRADE_COLOR[value]}44`, fontFamily: FONT }}>
      {GRADE_LABEL[value]}
    </span>
  );
}

function StatPill({ label, value }) {
  if (value == null) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(14,37,58,0.06)', borderRadius: 6, padding: '6px 10px', minWidth: 52 }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: NAVY, fontFamily: FONT }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT }}>{label}</span>
    </div>
  );
}

function BaseballDiamond({ runners, newlyOccupied }) {
  const occupied = {};
  runners.forEach(r => { if (r.current_base) occupied[r.current_base] = r; });

  const S = 160;
  const cx = S / 2, cy = S / 2;
  const r = 46;
  const baseSize = 14;

  const bases = {
    '2B': { x: cx,     y: cy - r, label: '2B' },
    '3B': { x: cx - r, y: cy,     label: '3B' },
    '1B': { x: cx + r, y: cy,     label: '1B' },
    'HP': { x: cx,     y: cy + r, label: 'H'  },
  };

  const baseEl = (key) => {
    const b = bases[key];
    const isOcc = key !== 'HP' && occupied[key];
    const isNew = key !== 'HP' && newlyOccupied.includes(key);
    return (
      <g key={key} style={isNew ? { animation: 'basePulse 400ms ease-out both', transformOrigin: `${b.x}px ${b.y}px` } : {}}>
        <rect
          x={b.x - baseSize / 2} y={b.y - baseSize / 2}
          width={baseSize} height={baseSize}
          transform={`rotate(45, ${b.x}, ${b.y})`}
          fill={isOcc ? GOLD : CREAM}
          stroke={NAVY} strokeWidth={isOcc ? 2.5 : 1.5}
        />
        <text x={b.x} y={b.y + 4} textAnchor="middle" fontSize={8} fontWeight={800} fill={isOcc ? '#fff' : NAVY} fontFamily={FONT}>
          {b.label}
        </text>
      </g>
    );
  };

  const pts = [bases['2B'], bases['3B'], bases['HP'], bases['1B'], bases['2B']];
  const polyline = pts.map(b => `${b.x},${b.y}`).join(' ');

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={polyline} fill={`${NAVY}08`} stroke={`${NAVY}44`} strokeWidth={1} />
      {baseEl('2B')}
      {baseEl('3B')}
      {baseEl('1B')}
      {baseEl('HP')}
    </svg>
  );
}

function RunnerCard({ runner, isNew }) {
  const baseLabel = { '1B': 'ON 1B', '2B': 'ON 2B', '3B': 'ON 3B' };
  const sbText = (runner.steal_attempts || 0) > 0
    ? `${runner.steals_successful || 0}/${runner.steal_attempts} SB`
    : null;

  return (
    <div style={{
      background: CREAM, border: `1.5px solid ${GOLD}55`, borderRadius: 8, padding: '10px 12px', marginBottom: 8,
      ...(isNew ? { animation: 'slideInUp 300ms ease-out both' } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        {runner.jersey_number && (
          <span style={{ fontSize: 12, fontWeight: 800, color: GOLD, fontFamily: FONT }}>#{runner.jersey_number}</span>
        )}
        <span style={{ fontSize: 14, fontWeight: 800, color: NAVY, fontFamily: FONT, flex: 1 }}>{runner.runner_name}</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', background: GOLD, borderRadius: 4, padding: '2px 8px', fontFamily: FONT }}>
          {baseLabel[runner.current_base] || runner.current_base}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {runner.speed_rating && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: SPEED_COLOR[runner.speed_rating] + '22', color: SPEED_COLOR[runner.speed_rating], border: `1px solid ${SPEED_COLOR[runner.speed_rating]}44`, fontFamily: FONT }}>
            {runner.speed_rating}
          </span>
        )}
        {runner.aggression_rating && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: AGGR_COLOR[runner.aggression_rating] + '22', color: AGGR_COLOR[runner.aggression_rating], border: `1px solid ${AGGR_COLOR[runner.aggression_rating]}44`, fontFamily: FONT }}>
            {runner.aggression_rating}
          </span>
        )}
        {sbText && <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', fontFamily: FONT }}>{sbText}</span>}
        {runner.lead_size_1b && runner.current_base === '1B' && (
          <span style={{ fontSize: 11, color: '#6b7280', fontFamily: FONT }}>Lead: {runner.lead_size_1b}</span>
        )}
      </div>
      {runner.notes && <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 4, fontFamily: FONT }}>{runner.notes}</div>}
    </div>
  );
}

// ── Hitter card body (no header — header is in DugoutView) ────
function HitterCardBody({ batter, animKey, isTransitioning }) {
  const pct = v => v != null ? Math.round(v * 100) + '%' : null;

  return (
    <div key={animKey} style={{
      background: '#fff', border: `1.5px solid ${GOLD}55`, borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      position: 'relative', overflow: 'hidden',
      animation: isTransitioning ? 'slideOutLeft 200ms ease-in both' : 'slideInRight 350ms ease-out both',
    }}>
      {!isTransitioning && (
        <div style={{ position: 'absolute', top: 0, left: 0, height: 3, background: GOLD, animation: 'sweepLine 400ms ease-out both' }} />
      )}

      {(batter.approach || batter.bat_speed_grade || batter.contact_grade || batter.power_grade) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {batter.approach && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 4, padding: '2px 7px', fontFamily: FONT }}>
              {batter.approach}
            </span>
          )}
          {batter.bat_speed_grade && <span style={{ fontSize: 10, color: '#6b7280', fontFamily: FONT }}>Bat Spd <GradeBadge value={batter.bat_speed_grade} /></span>}
          {batter.contact_grade && <span style={{ fontSize: 10, color: '#6b7280', fontFamily: FONT }}>Contact <GradeBadge value={batter.contact_grade} /></span>}
          {batter.power_grade && <span style={{ fontSize: 10, color: '#6b7280', fontFamily: FONT }}>Power <GradeBadge value={batter.power_grade} /></span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: batter.notes ? 10 : 0 }}>
        <StatPill label="AB"     value={batter.ab_count} />
        <StatPill label="XBH"    value={batter.xbh_count} />
        <StatPill label="AB/XBH" value={batter.ab_per_xbh != null ? batter.ab_per_xbh.toFixed(1) : null} />
        <StatPill label="Pull%"  value={pct(batter.pull_pct)} />
        <StatPill label="Hard%"  value={pct(batter.hard_hit_pct)} />
        <StatPill label="SLG"    value={batter.slug_pct != null ? batter.slug_pct.toFixed(3).replace(/^0/, '') : null} />
      </div>

      {batter.notes && (
        <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 6, fontFamily: FONT }}>"{batter.notes}"</div>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────
export default function HitterBaserunnerSection({ gameId, isLive }) {
  const [currentBatter, setCurrentBatter] = useState(null);
  const [allHitters, setAllHitters]       = useState([]);
  const [runnersOnBase, setRunnersOnBase] = useState([]);
  const [advancing, setAdvancing]         = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const prevBatterName   = useRef(null);
  const prevRunnerKeys   = useRef(new Set());
  const [hitterAnimKey,  setHitterAnimKey]  = useState(0);
  const [newlyOccupied,  setNewlyOccupied]  = useState([]);
  const [newRunnerKeys,  setNewRunnerKeys]  = useState(new Set());
  const initialized      = useRef(false);

  const pollData = useCallback(() => {
    if (!gameId) return;
    Promise.all([
      base44.entities.HitterObservation.filter({ game_id: gameId, is_current_batter: true }, '-updated_date', 1),
      base44.entities.HitterObservation.filter({ game_id: gameId }, 'lineup_position', 50),
      base44.entities.BaserunnerObservation.filter({ game_id: gameId, is_on_base: true }, 'runner_name', 20),
    ]).then(([batters, hitters, runners]) => {
      const newBatter  = batters && batters[0] ? batters[0] : null;
      const newRunners = runners || [];

      if (initialized.current) {
        if (newBatter?.hitter_name !== prevBatterName.current) {
          setHitterAnimKey(k => k + 1);
        }
        const currentKeys = new Set(newRunners.map(r => r.runner_name + (r.current_base || '')));
        const added = newRunners.filter(r => !prevRunnerKeys.current.has(r.runner_name + (r.current_base || '')));
        if (added.length) {
          setNewlyOccupied(added.map(r => r.current_base).filter(Boolean));
          setNewRunnerKeys(new Set(added.map(r => r.runner_name + (r.current_base || ''))));
          setTimeout(() => { setNewlyOccupied([]); setNewRunnerKeys(new Set()); }, 500);
        }
        prevRunnerKeys.current = currentKeys;
      } else {
        initialized.current = true;
        prevRunnerKeys.current = new Set(newRunners.map(r => r.runner_name + (r.current_base || '')));
      }

      prevBatterName.current = newBatter?.hitter_name ?? null;
      setCurrentBatter(newBatter);
      setAllHitters(hitters || []);
      setRunnersOnBase(newRunners);
    }).catch(() => {});
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    initialized.current = false;
    prevBatterName.current = null;
    prevRunnerKeys.current = new Set();
    pollData();
    const interval = setInterval(pollData, 10000);
    return () => clearInterval(interval);
  }, [gameId, pollData]);

  const handleNextBatter = async () => {
    if (advancing) return;
    setAdvancing(true);
    setIsTransitioning(true);
    await new Promise(r => setTimeout(r, 200));
    setIsTransitioning(false);
    try {
      const sorted = [...allHitters].sort((a, b) => (a.lineup_position || 99) - (b.lineup_position || 99));
      if (!sorted.length) return;
      const curIdx  = currentBatter ? sorted.findIndex(h => h.id === currentBatter.id) : -1;
      const nextIdx = (curIdx + 1) % sorted.length;
      const next    = sorted[nextIdx];
      if (currentBatter) {
        await base44.entities.HitterObservation.update(currentBatter.id, { is_current_batter: false });
      }
      await base44.entities.HitterObservation.update(next.id, { is_current_batter: true });
      pollData();
    } finally {
      setAdvancing(false);
    }
  };

  if (!gameId) return null;

  // ── Derived identity for header ───────────────────────────────
  const handLabel = currentBatter?.hitter_hand
    ? (currentBatter.hitter_hand === 'S' ? 'SHH' : currentBatter.hitter_hand + 'HH')
    : null;
  const jerseyNumber = currentBatter?.jersey_number || null;
  const batterTeam = currentBatter?.hitter_team || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: FONT }}>
      <style>{KEYFRAMES}</style>

      {/* Player header — navy card matching pitcher style */}
      <div style={{ background: NAVY, padding: '12px 20px', flexShrink: 0 }}>
        {currentBatter ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Jersey number */}
            <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: -2, color: GOLD, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'center', flexShrink: 0 }}>
              {jerseyNumber ? `#${jerseyNumber}` : '—'}
            </div>
            {/* Identity block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: -0.5, fontFamily: FONT }}>
                  {currentBatter.hitter_name}
                </span>
                {handLabel && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(184,134,11,0.2)', color: '#c6b583', fontFamily: FONT }}>
                    {handLabel}
                  </span>
                )}
                {isLive && (
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '0.5px solid rgba(74,222,128,0.35)', borderRadius: 4, padding: '3px 7px', fontFamily: FONT }}>
                    ● LIVE
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: FONT }}>
                {batterTeam || '—'} · Batter
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontFamily: FONT }}>Waiting for batter…</div>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 100px', background: CREAM }}>
        {/* Hitter card body */}
        {currentBatter && (
          <HitterCardBody
            batter={currentBatter}
            animKey={hitterAnimKey}
            isTransitioning={isTransitioning}
          />
        )}

        {/* Diamond + runners */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: NAVY, fontFamily: FONT, marginBottom: 10, alignSelf: 'flex-start' }}>Baserunners</div>
          <BaseballDiamond runners={runnersOnBase} newlyOccupied={newlyOccupied} />
          {runnersOnBase.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 8, fontFamily: FONT }}>Bases empty</div>
          ) : (
            <div style={{ width: '100%', marginTop: 10 }}>
              {['3B', '2B', '1B'].map(base => {
                const r = runnersOnBase.find(r => r.current_base === base);
                if (!r) return null;
                const key = r.runner_name + base;
                return <RunnerCard key={key} runner={r} isNew={newRunnerKeys.has(key)} />;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Next Batter bar at bottom */}
      <button
        onClick={handleNextBatter}
        disabled={advancing || allHitters.length === 0}
        style={{
          flexShrink: 0,
          width: '100%', padding: '18px 0',
          background: advancing ? '#9a7209' : GOLD,
          color: NAVY, border: 'none', borderRadius: 0, fontFamily: FONT,
          fontSize: 15, fontWeight: 900, letterSpacing: '0.08em',
          textTransform: 'uppercase', cursor: advancing ? 'wait' : 'pointer',
          opacity: allHitters.length === 0 ? 0.4 : 1,
        }}
      >
        {advancing ? 'Advancing…' : 'Next Batter →'}
      </button>
    </div>
  );
}