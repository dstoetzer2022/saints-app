import React, { useState } from 'react';
import { NAVY, GOLD, BORDER } from '@/lib/ds';

const HAND_COLORS = { L: '#3b82f6', R: '#ef4444', S: '#a855f7' };

function HandBadge({ hand }) {
  if (!hand) return <span style={{ fontSize: 11, color: '#666' }}>—</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: 4, fontWeight: 800, fontSize: 11,
      background: HAND_COLORS[hand] || '#888', color: '#fff',
    }}>{hand}</span>
  );
}

function Stat({ label, value, color }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 12.5 }}>
      <span style={{ color: '#8a8a8a', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4, minWidth: 72 }}>{label}</span>
      <span style={{ fontWeight: 700, color: color || '#ddd' }}>{value}</span>
    </div>
  );
}

function ReadingsList({ label, readings }) {
  const arr = Array.isArray(readings) ? readings : readings != null ? [readings] : [];
  if (!arr.length) return null;
  const avg = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
  return (
    <Stat label={label} value={`${arr.map(r => r.toFixed(2) + 's').join(', ')}  (avg ${avg}s)`} />
  );
}

function RatingDot({ value, type }) {
  const colorMap = {
    fast: '#22c55e', average: '#eab308', slow: '#ef4444',
    aggressive: '#22c55e', passive: '#ef4444',
  };
  const c = colorMap[value] || '#eab308';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
      <span style={{ fontWeight: 700, color: '#ddd', fontSize: 12.5 }}>{value}</span>
    </span>
  );
}

function PlayerProfile({ runner, catcher, pitcher }) {
  const hasRunner = runner && (runner.speed_rating || runner.aggression_rating || runner.pickoff_attempts || runner.dirt_ball_advances || runner.notes);
  const hasCatcher = catcher && (catcher.warmup_pop_time || (catcher.steal_attempts?.length > 0) || catcher.notes);
  const hasPitcher = pitcher;
  const hasData = hasRunner || hasCatcher || hasPitcher;

  if (!hasData) {
    return <div style={{ padding: '10px 0 2px', fontSize: 12, color: '#666', fontStyle: 'italic' }}>No observations recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0 2px' }}>
      {hasRunner && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>Baserunner</div>
          {runner.speed_rating && <div style={{ marginBottom: 3, display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: '#8a8a8a', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4, minWidth: 72 }}>Speed</span>
            <RatingDot value={runner.speed_rating} />
          </div>}
          {runner.aggression_rating && <div style={{ marginBottom: 3, display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: '#8a8a8a', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.4, minWidth: 72 }}>Aggression</span>
            <RatingDot value={runner.aggression_rating} />
          </div>}
          {runner.pickoff_attempts > 0 && <Stat label="Pickoff Att" value={runner.pickoff_attempts} />}
          {runner.dirt_ball_advances > 0 && <Stat label="Dirt Ball" value={runner.dirt_ball_advances} />}
          {runner.notes && <Stat label="Notes" value={runner.notes} color="#aaa" />}
        </div>
      )}

      {hasCatcher && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>Catcher</div>
          {catcher.warmup_pop_time && <Stat label="Warmup Pop" value={`${catcher.warmup_pop_time}s`} />}
          {catcher.steal_attempts?.length > 0 && (
            <Stat label="Steal Att" value={catcher.steal_attempts.map(a =>
              `${a.base}: ${a.pop_time ? a.pop_time + 's' : '—'} (${a.result})`
            ).join(' · ')} />
          )}
          {catcher.notes && <Stat label="Notes" value={catcher.notes} color="#aaa" />}
        </div>
      )}

      {hasPitcher && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
            Pitcher{pitcher.pitcher_hand ? ` (${pitcher.pitcher_hand}HP)` : ''}
          </div>
          <ReadingsList label="TTP 1B" readings={pitcher.time_to_plate_1b} />
          <ReadingsList label="TTP 2B" readings={pitcher.time_to_plate_2b} />
          {pitcher.slide_step_type && <Stat label="Slide Step" value={`${pitcher.slide_step_type}${pitcher.slide_step_notes ? ' — ' + pitcher.slide_step_notes : ''}`} />}
          {pitcher.pickoff_moves?.length > 0 && <Stat label="Pickoff" value={pitcher.pickoff_moves.join(', ')} />}
          {pitcher.notes && <Stat label="Notes" value={pitcher.notes} color="#aaa" />}
        </div>
      )}
    </div>
  );
}

export default function LineupCard({ lineup, runnerObs, catcherObs, pitcherObsList }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  if (!lineup?.length) {
    return <div style={{ color: '#888', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>No lineup data available.</div>;
  }

  function findRunner(name) {
    return (runnerObs || []).find(r => r.runner_name === name);
  }
  function findCatcher(name) {
    if (!catcherObs) return null;
    return catcherObs.catcher_name === name ? catcherObs : null;
  }
  function findPitcher(name) {
    return (pitcherObsList || []).find(p => p.pitcher_name === name);
  }

  return (
    <div style={{ background: NAVY, borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${BORDER}` }}>
      {/* Header */}
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${GOLD}33`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 18, background: GOLD, borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontWeight: 800, fontSize: 13, color: GOLD, textTransform: 'uppercase', letterSpacing: 1 }}>Lineup Card</span>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '34px 44px 1fr 48px 32px', gap: 0, padding: '8px 18px', borderBottom: `1px solid #1e3a52`, alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#5a7a94', textTransform: 'uppercase' }}>#</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#5a7a94', textTransform: 'uppercase' }}>No.</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#5a7a94', textTransform: 'uppercase' }}>Name</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#5a7a94', textTransform: 'uppercase' }}>Pos</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#5a7a94', textTransform: 'uppercase' }}>Bat</span>
      </div>

      {/* Rows */}
      {lineup.map((slot, i) => {
        const isOpen = expandedIdx === i;
        const runner = findRunner(slot.name);
        const catcher = findCatcher(slot.name);
        const pitcher = findPitcher(slot.name);

        return (
          <div key={i}>
            <div
              onClick={() => setExpandedIdx(isOpen ? null : i)}
              style={{
                display: 'grid', gridTemplateColumns: '34px 44px 1fr 48px 32px', gap: 0,
                padding: '10px 18px', alignItems: 'center', cursor: 'pointer',
                background: isOpen ? '#132f44' : i % 2 === 0 ? '#0e253a' : '#112a3f',
                borderBottom: isOpen ? 'none' : `1px solid #1a3448`,
                transition: 'background 0.15s',
              }}
            >
              {/* Order */}
              <span style={{ fontWeight: 800, fontSize: 14, color: '#5a7a94' }}>{i + 1}</span>

              {/* Jersey */}
              <span style={{ fontWeight: 700, fontSize: 13, color: GOLD }}>
                {slot.jersey ? `#${slot.jersey}` : '—'}
              </span>

              {/* Name */}
              <span style={{ fontWeight: 700, fontSize: 14, color: '#e8e6e0', display: 'flex', alignItems: 'center', gap: 6 }}>
                {slot.name || '—'}
                <span style={{ fontSize: 10, color: '#5a7a94', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
              </span>

              {/* Hand badge */}
              <HandBadge hand={slot.hand} />
            </div>

            {/* Expanded profile */}
            {isOpen && (
              <div style={{ background: '#0b1f30', padding: '4px 18px 14px 52px', borderBottom: `1px solid #1a3448` }}>
                <PlayerProfile runner={runner} catcher={catcher} pitcher={pitcher} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}