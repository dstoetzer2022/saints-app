import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import toast from 'react-hot-toast';
import PitcherScoutPanel from '@/components/scouting/PitcherScoutPanel';
import CatcherScoutPanel from '@/components/scouting/CatcherScoutPanel';
import RunnerScoutPanel  from '@/components/scouting/RunnerScoutPanel';
import SubstitutionForm  from '@/components/scouting/SubstitutionForm';
import { NAVY_DARK, GOLD, CREAM, LINE, LINE_SOFT, PANEL, PANEL_HI, GREEN, RED, AMBER, FONT } from '@/lib/liveScoutTheme';

const CCL_LOGO  = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';

const TABS = [
  { key: 'BATTERY', label: 'Battery'  },
  { key: 'LINEUP',  label: 'Lineup'   },
];

// Canonical name key for loose matching (ignores case / punctuation)
const CANON = n => n ? n.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ') : '';

const GRADE_LABEL = { plus_plus: '++', plus: '+', average: 'AVG', below: '-', well_below: '--' };
const SPD_COLOR   = { fast: GREEN, average: AMBER, slow: RED };
const AGGR_COLOR  = { aggressive: GREEN, average: AMBER, passive: 'rgba(255,255,255,0.5)' };

// Long names ("Noah Aguilar-Tanphanich") no longer truncate in hero cards —
// they wrap and step down in size instead. Approved mockup v3, 2026-07-15.
function heroNameSize(name) {
  if (!name) return 26;
  if (name.length <= 14) return 26;
  if (name.length <= 20) return 22;
  if (name.length <= 26) return 18;
  return 16;
}
function ordinal(n) {
  if (n == null) return '';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Top banner ────────────────────────────────────────────────────────────────
function HubBanner({ opponent, game, onCompleteGame, onToggleSub, showSub, dugoutMode, onToggleDugout, togglingMode, orientation, onToggleOrientation, togglingOrientation, onHome }) {
  return (
    <div style={{ background: NAVY_DARK, borderBottom: `1px solid ${LINE}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
      {onHome && (
        <button onClick={onHome} title="Back to home"
          style={{ background: 'rgba(255,255,255,.07)', border: '0.5px solid rgba(255,255,255,.15)', borderRadius: 8, color: GOLD, fontSize: 16, width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: FONT }}>
          ‹
        </button>
      )}
      <img src={opponent?.logo_url || CCL_LOGO} alt="" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: CREAM, fontWeight: 800, fontSize: 15, lineHeight: 1.1, fontFamily: FONT }}>vs {opponent?.name || '—'}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>{game?.date}</div>
      </div>
      <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: GREEN, borderRadius: 5, padding: '4px 10px', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8 }}>● LIVE</span>
      <button
        onClick={onToggleDugout}
        disabled={togglingMode}
        style={{
          background: dugoutMode === 'hitter' ? 'rgba(59,130,246,0.18)' : 'rgba(198,181,131,0.12)',
          border: `1px solid ${dugoutMode === 'hitter' ? 'rgba(59,130,246,0.5)' : 'rgba(198,181,131,0.3)'}`,
          color: dugoutMode === 'hitter' ? '#93c5fd' : GOLD,
          borderRadius: 8, padding: '9px 14px', minHeight: 44, fontWeight: 800, fontSize: 11.5,
          cursor: togglingMode ? 'wait' : 'pointer', fontFamily: FONT,
          whiteSpace: 'nowrap', transition: 'all 0.15s', opacity: togglingMode ? 0.6 : 1,
        }}>
        {togglingMode ? '…' : dugoutMode === 'hitter' ? '● HITTER VIEW' : '○ PITCHER VIEW'}
      </button>
      <button
        onClick={onToggleOrientation}
        disabled={togglingOrientation}
        title="Toggle Dugout View layout for portrait vs landscape monitor"
        style={{
          background: orientation === 'vertical' ? 'rgba(198,181,131,0.22)' : 'rgba(198,181,131,0.12)',
          border: `1px solid ${orientation === 'vertical' ? GOLD : 'rgba(198,181,131,0.3)'}`,
          color: GOLD,
          borderRadius: 8, padding: '9px 14px', minHeight: 44, fontWeight: 800, fontSize: 11.5,
          cursor: togglingOrientation ? 'wait' : 'pointer', fontFamily: FONT,
          whiteSpace: 'nowrap', transition: 'all 0.15s', opacity: togglingOrientation ? 0.6 : 1,
        }}>
        {togglingOrientation ? '…' : orientation === 'vertical' ? '▯ VERTICAL' : '▭ HORIZONTAL'}
      </button>
      <button onClick={onToggleSub}
        style={{ background: showSub ? 'rgba(239,68,68,0.18)' : 'rgba(198,181,131,0.12)', border: `1px solid ${showSub ? 'rgba(239,68,68,0.45)' : 'rgba(198,181,131,0.3)'}`, color: showSub ? RED : GOLD, borderRadius: 8, padding: '9px 14px', minHeight: 44, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
        {showSub ? '✕ Cancel' : '⇄ Sub'}
      </button>
      <div style={{ width: 1, alignSelf: 'stretch', minHeight: 28, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
      <button onClick={onCompleteGame}
        style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: RED, borderRadius: 8, padding: '9px 16px', minHeight: 44, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: FONT, letterSpacing: 0.2, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; }}>
        ✓ End Game
      </button>
    </div>
  );
}

// ── Shared small pieces ─────────────────────────────────────────────────────
function CycleBtn({ children, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(198,181,131,0.12)', border: '1.5px solid rgba(198,181,131,0.35)',
      color: GOLD, fontSize: 21, fontWeight: 900, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
    }}>{children}</button>
  );
}
function DotStrip({ items, activeIdx, onJump, dotContent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <div key={it.key ?? it.id ?? i} onClick={() => onJump(i)} style={{
          width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
          background: i === activeIdx ? GOLD : 'rgba(255,255,255,0.06)',
          color: i === activeIdx ? '#07111c' : 'rgba(255,255,255,0.4)',
          border: `1.5px solid ${i === activeIdx ? GOLD : 'rgba(255,255,255,0.12)'}`,
          boxShadow: i === activeIdx ? '0 0 10px rgba(198,181,131,0.4)' : 'none',
        }}>{dotContent(it)}</div>
      ))}
    </div>
  );
}
function Explainer({ title, steps }) {
  return (
    <div style={{ background: 'rgba(198,181,131,0.06)', border: '1px solid rgba(198,181,131,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: GOLD, marginBottom: 10, fontFamily: FONT }}>{title}</div>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: i < steps.length - 1 ? 7 : 0, fontFamily: FONT }}>
          <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: 'rgba(198,181,131,0.2)', color: GOLD, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
          {s}
        </div>
      ))}
    </div>
  );
}

// ── Bases diamond — the single interaction for placing/clearing runners ────
// Approved mockup v2/v3, 2026-07-15. Tap empty base -> pick who's on it from
// the full lineup; tap filled base -> move or clear. A runner can only be on
// one base at a time. Occupancy comes straight from BaserunnerObservation
// (is_on_base / current_base) via `rows` — same data LineupAndRunnersTab
// already builds, no separate state.
function BasesDiamond({ rows, onSetBase, onClear, saving }) {
  const [pickerBase, setPickerBase] = useState(null); // '1B' | '2B' | '3B' | null

  const occupant = base => rows.find(r => r.obs?.is_on_base && r.obs?.current_base === base) || null;
  const occupiedNames = new Set(['1B', '2B', '3B'].map(occupant).filter(Boolean).map(r => r.key));

  const pick = async row => {
    const base = pickerBase;
    setPickerBase(null);
    await onSetBase(row, base);
  };
  const clearBase = async base => {
    const row = occupant(base);
    setPickerBase(null);
    if (row) await onClear(row);
  };

  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE_SOFT}`, borderRadius: 16, padding: '22px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 16, fontFamily: FONT }}>
        Tap a base to place or clear a runner
      </div>
      <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
        <div style={{ position: 'absolute', inset: 28, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.1)', transform: 'rotate(45deg)', borderRadius: 4 }} />
        {[
          { base: '1B', style: { right: 4, top: '50%', transform: 'translateY(-50%)' } },
          { base: '2B', style: { left: '50%', top: 4, transform: 'translateX(-50%)' } },
          { base: '3B', style: { left: 4, top: '50%', transform: 'translateY(-50%)' } },
        ].map(({ base, style }) => {
          const row = occupant(base);
          const isSaving = row && saving === row.key;
          return (
            <div key={base} onClick={() => setPickerBase(base)} style={{
              position: 'absolute', ...style, width: 60, height: 60, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
              transition: 'all 0.12s', opacity: isSaving ? 0.5 : 1,
              background: row ? GOLD : 'rgba(255,255,255,0.05)',
              border: row ? `2px solid ${GOLD}` : '2px dashed rgba(198,181,131,0.35)',
              color: row ? '#07111c' : 'rgba(198,181,131,0.5)',
              boxShadow: row ? '0 0 20px rgba(198,181,131,0.45)' : 'none',
            }}>
              {row ? (
                <>
                  <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.75 }}>#{row.jersey || '—'}</span>
                  <span style={{ fontSize: 11, fontWeight: 900, lineHeight: 1.1, maxWidth: 52, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(row.name || '').split(' ').pop()}</span>
                </>
              ) : <span style={{ fontSize: 19, fontWeight: 800 }}>+</span>}
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: '50%', bottom: -2, transform: 'translateX(-50%)', width: 32, height: 32, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>⌂</div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 14, fontFamily: FONT }}>Filled = runner on base · tap again to clear or move</div>

      {pickerBase && (
        <div onClick={() => setPickerBase(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0e253a', border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, width: 280, maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: GOLD, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: FONT }}>
              Place runner on {pickerBase}
            </div>
            {rows.filter(r => r.name && (!occupiedNames.has(r.key) || occupant(pickerBase)?.key === r.key)).map(r => (
              <div key={r.key} onClick={() => pick(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, color: CREAM, fontFamily: FONT }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, minWidth: 26 }}>{r.jersey ? `#${r.jersey}` : ''}</span>
                {r.name}
              </div>
            ))}
            {occupant(pickerBase) && (
              <button onClick={() => clearBase(pickerBase)} style={{ marginTop: 10, width: '100%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: RED, borderRadius: 8, padding: 11, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT }}>
                Clear this base
              </button>
            )}
            <button onClick={() => setPickerBase(null)} style={{ marginTop: 8, width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Battery tab (pitcher + catcher, hero-cycle + segmented focus) ──────────
// Approved mockup v3, 2026-07-15. Rebuilt in the same visual language as the
// Lineup redesign: hero card + big visual widget + secondary reference list,
// instead of the old side-by-side two-column layout.
function BatteryTab({ pitcherObs, catcherObs }) {
  const [focus, setFocus] = useState('pitcher'); // 'pitcher' | 'catcher'
  const [pIdx, setPIdx] = useState(() => Math.max(0, pitcherObs.findIndex(p => p.is_current_pitcher)));

  useEffect(() => {
    const idx = pitcherObs.findIndex(p => p.is_current_pitcher);
    if (idx >= 0) setPIdx(idx);
  }, [pitcherObs.length]);

  if (!pitcherObs.length && !catcherObs) {
    return <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 40, fontSize: 13, fontFamily: FONT }}>No pitcher or catcher set. Use substitution to add one.</div>;
  }

  const p = pitcherObs[pIdx] || null;

  return (
    <div>
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE_SOFT}`, borderRadius: 10, padding: 4, gap: 4, marginBottom: 16 }}>
        {[['pitcher', 'Pitcher'], ['catcher', 'Catcher']].map(([k, label]) => (
          <button key={k} onClick={() => setFocus(k)} style={{
            flex: 1, background: focus === k ? GOLD : 'transparent', border: 'none', borderRadius: 7,
            color: focus === k ? '#07111c' : 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 12.5, padding: 11, cursor: 'pointer', fontFamily: FONT,
          }}>{label}</button>
        ))}
      </div>

      {focus === 'pitcher' && (
        p ? (
          <>
            <div style={{ background: 'linear-gradient(155deg, rgba(198,181,131,.09) 0%, rgba(255,255,255,.03) 100%)', border: `1.5px solid ${p.is_current_pitcher ? 'rgba(74,222,128,0.4)' : 'rgba(198,181,131,0.35)'}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: GOLD, fontFamily: FONT }}>Now Pitching</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontFamily: FONT }}>{pIdx + 1} of {pitcherObs.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '12px 0' }}>
                <CycleBtn disabled={pIdx === 0} onClick={() => setPIdx(i => i - 1)}>‹</CycleBtn>
                <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: p.is_current_pitcher ? GREEN : 'rgba(255,255,255,0.35)', fontFamily: FONT }}>
                    {p.is_current_pitcher ? '● CURRENT' : '○ PREVIOUS'}
                  </div>
                  <div style={{ fontSize: heroNameSize(p.pitcher_name), fontWeight: 900, color: '#fff', letterSpacing: -0.4, margin: '2px 0', lineHeight: 1.15, overflowWrap: 'break-word', fontFamily: FONT }}>{p.pitcher_name}</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                    {p.pitcher_hand && <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(198,181,131,0.15)', borderRadius: 5, padding: '2px 8px', color: GOLD }}>{p.pitcher_hand}HP</span>}
                    {p.jersey_number && <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>#{p.jersey_number}</span>}
                  </div>
                </div>
                <CycleBtn disabled={pIdx === pitcherObs.length - 1} onClick={() => setPIdx(i => i + 1)}>›</CycleBtn>
              </div>
              {pitcherObs.length > 1 && (
                <DotStrip items={pitcherObs} activeIdx={pIdx} onJump={setPIdx} dotContent={h => h.jersey_number ? `#${h.jersey_number}` : '—'} />
              )}
            </div>

            <PitcherScoutPanel key={p.id} obs={p} />

            {pitcherObs.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px 4px', fontFamily: FONT }}>Pitching Changes — tap to jump</div>
                <div style={{ background: PANEL, border: `1px solid ${LINE_SOFT}`, borderRadius: 12, overflow: 'hidden' }}>
                  {pitcherObs.map((h, i) => (
                    <div key={h.id} onClick={() => setPIdx(i)} style={{
                      padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      borderBottom: i < pitcherObs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      background: h.is_current_pitcher ? 'rgba(34,197,94,0.06)' : 'transparent',
                      borderLeft: `3px solid ${h.is_current_pitcher ? GREEN : 'transparent'}`,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 11.5, color: 'rgba(255,255,255,0.35)', minWidth: 26 }}>{h.jersey_number ? `#${h.jersey_number}` : ''}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: CREAM, flex: 1 }}>{h.pitcher_name}</span>
                      {h.pitcher_hand && <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(198,181,131,0.15)', borderRadius: 5, padding: '2px 8px', color: GOLD }}>{h.pitcher_hand}HP</span>}
                      {h.is_current_pitcher && <span style={{ fontSize: 9.5, fontWeight: 900, padding: '2px 7px', borderRadius: 9, background: 'rgba(198,181,131,0.2)', color: GOLD }}>CURRENT</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0', fontSize: 13, fontFamily: FONT }}>No pitcher set. Use substitution to add one.</div>
        )
      )}

      {focus === 'catcher' && (
        catcherObs ? (
          <>
            <div style={{ background: 'linear-gradient(155deg, rgba(198,181,131,.09) 0%, rgba(255,255,255,.03) 100%)', border: '1.5px solid rgba(198,181,131,0.35)', borderRadius: 16, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: GOLD, fontFamily: FONT }}>Now Catching</span>
              <div style={{ fontSize: heroNameSize(catcherObs.catcher_name), fontWeight: 900, color: '#fff', letterSpacing: -0.4, margin: '8px 0 2px', lineHeight: 1.15, overflowWrap: 'break-word', fontFamily: FONT }}>{catcherObs.catcher_name}</div>
              {catcherObs.jersey_number && <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>#{catcherObs.jersey_number}</span>}
            </div>
            <CatcherScoutPanel key={catcherObs.id} obs={catcherObs} />
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0', fontSize: 13, fontFamily: FONT }}>No catcher observation. Add via lineup or substitution.</div>
        )
      )}
    </div>
  );
}

// ── Lineup tab (hero-cycle batter + bases diamond + secondary list) ────────
// Approved mockups v2/v3, 2026-07-15. Rows built from game.lineup_data array
// to preserve entry order — same join logic as before. Each row joins
// HitterObservation (at-bat state) + BaserunnerObservation (base state).
function LineupAndRunnersTab({ hitterObs, runnerObs, lineup, onSetCurrentBatter, onAdvanceBatter, onSetBase, onRunnerSaved, onEnsureHitterObs }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [saving,      setSaving]      = useState(null);
  const [heroIdx,     setHeroIdx]     = useState(0);

  const rows = (() => {
    if (lineup.length > 0) {
      const built = lineup.map((slot, i) => {
        const h   = hitterObs.find(h => CANON(h.hitter_name) === CANON(slot.name)) || null;
        const obs = runnerObs.find(r => CANON(r.runner_name) === CANON(slot.name)) || null;
        return {
          key:     `slot-${i}`,
          order:   i + 1,
          name:    slot.name,
          jersey:  slot.jersey  || h?.jersey_number,
          hand:    slot.hand    || h?.hitter_hand,
          h, obs,
        };
      });
      const lineupNames = new Set(lineup.map(s => CANON(s.name)));
      hitterObs
        .filter(h => !lineupNames.has(CANON(h.hitter_name)))
        .forEach((h, i) => {
          const obs = runnerObs.find(r => CANON(r.runner_name) === CANON(h.hitter_name)) || null;
          built.push({ key: `orphan-${i}`, order: null, name: h.hitter_name, jersey: h.jersey_number, hand: h.hitter_hand, h, obs });
        });
      return built;
    }
    return [...hitterObs]
      .sort((a, b) => (a.lineup_position || 99) - (b.lineup_position || 99))
      .map(h => {
        const obs = runnerObs.find(r => CANON(r.runner_name) === CANON(h.hitter_name)) || null;
        return { key: h.id, order: h.lineup_position, name: h.hitter_name, jersey: h.jersey_number, hand: h.hitter_hand, h, obs };
      });
  })();

  const currentBatter = hitterObs.find(h => h.is_current_batter);

  // Keep the hero focused on whoever is actually at bat, unless the user has
  // manually browsed elsewhere (handled by leaving heroIdx alone otherwise).
  useEffect(() => {
    if (!currentBatter) return;
    const idx = rows.findIndex(r => r.h?.id === currentBatter.id);
    if (idx >= 0) setHeroIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBatter?.id]);

  if (!rows.length) {
    return <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 40, fontSize: 13, fontFamily: FONT }}>No lineup data. Add players via Substitution.</div>;
  }

  const heroIdxSafe = Math.min(heroIdx, rows.length - 1);
  const hero = rows[heroIdxSafe];
  const heroIsCurrent = !!hero.h?.is_current_batter;

  const handleSetBase = async (row, base) => {
    setSaving(row.key);
    const updated = await onSetBase(row.name, base);
    if (updated && onRunnerSaved) onRunnerSaved(updated);
    setSaving(null);
  };
  const handleClear = async row => {
    setSaving(row.key);
    const updated = await onSetBase(row.name, null);
    if (updated && onRunnerSaved) onRunnerSaved(updated);
    setSaving(null);
  };
  const handleSetCurrent = async row => {
    setSaving(row.key + '-bat');
    const h = await onEnsureHitterObs(row.name, row.order);
    await onSetCurrentBatter(h);
    setSaving(null);
  };
  const handleNext = async () => {
    // Mirror advanceBatter's own lineup-order logic so the hero jumps
    // immediately instead of waiting on the async reload.
    setHeroIdx(i => (i + 1) % rows.length);
    await onAdvanceBatter();
  };

  return (
    <div>
      {/* Now Batting hero */}
      <div style={{ background: 'linear-gradient(155deg, rgba(198,181,131,.09) 0%, rgba(255,255,255,.03) 100%)', border: `1.5px solid rgba(198,181,131,0.35)`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: GOLD, fontFamily: FONT }}>Now Batting</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontFamily: FONT }}>{heroIdxSafe + 1} of {rows.length}</span>
            <button onClick={handleNext} style={{ background: GOLD, color: '#07111c', border: 'none', borderRadius: 7, padding: '7px 14px', minHeight: 32, fontFamily: FONT, fontSize: 11, fontWeight: 900, cursor: 'pointer', letterSpacing: 0.3 }}>NEXT →</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '12px 0' }}>
          <CycleBtn disabled={heroIdxSafe === 0} onClick={() => setHeroIdx(i => i - 1)}>‹</CycleBtn>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', fontFamily: FONT }}>{hero.order ? ordinal(hero.order) : '—'}</div>
            <div style={{ fontSize: heroNameSize(hero.name), fontWeight: 900, color: '#fff', letterSpacing: -0.4, margin: '2px 0', lineHeight: 1.15, overflowWrap: 'break-word', fontFamily: FONT }}>{hero.name || '—'}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              {hero.jersey && <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>#{hero.jersey}</span>}
              {hero.hand && <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 8px', color: 'rgba(255,255,255,0.5)' }}>{hero.hand}</span>}
              {hero.obs?.speed_rating && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, color: '#07111c', background: SPD_COLOR[hero.obs.speed_rating] || GOLD }}>{hero.obs.speed_rating}</span>}
            </div>
          </div>
          <CycleBtn disabled={heroIdxSafe === rows.length - 1} onClick={() => setHeroIdx(i => i + 1)}>›</CycleBtn>
        </div>
        <DotStrip items={rows} activeIdx={heroIdxSafe} onJump={setHeroIdx} dotContent={r => r.order ?? '—'} />
        <button
          onClick={() => handleSetCurrent(hero)}
          disabled={heroIsCurrent || saving === hero.key + '-bat'}
          style={{
            display: 'block', margin: '14px auto 0', borderRadius: 10, padding: '13px 28px', minHeight: 48,
            fontFamily: FONT, fontSize: 13.5, fontWeight: 900, cursor: heroIsCurrent ? 'default' : 'pointer',
            background: heroIsCurrent ? 'rgba(34,197,94,0.18)' : GOLD,
            color: heroIsCurrent ? GREEN : '#07111c',
            border: heroIsCurrent ? '1.5px solid rgba(34,197,94,0.4)' : 'none',
            opacity: saving === hero.key + '-bat' ? 0.5 : 1,
          }}>
          {saving === hero.key + '-bat' ? '…' : heroIsCurrent ? '✓ At Bat' : '✓ Set as Current At-Bat'}
        </button>
      </div>

      {/* Bases diamond */}
      <Explainer title="How the bases switcher works" steps={[
        <>Tap an <b style={{ color: CREAM }}>empty base</b> (dashed circle) to open a list of hitters and pick who's on it.</>,
        <>Tap a <b style={{ color: CREAM }}>filled base</b> (solid gold) to move that runner elsewhere or clear them off.</>,
        <>A runner can only be on one base at a time — placing them on a new base automatically removes them from wherever they were.</>,
      ]} />
      <BasesDiamond rows={rows} onSetBase={handleSetBase} onClear={handleClear} saving={saving} />

      {/* Secondary lineup list */}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px 4px', fontFamily: FONT }}>Full Lineup — tap to jump</div>
      <div style={{ background: PANEL, border: `1px solid ${LINE_SOFT}`, borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((row, ri) => {
          const { h, obs } = row;
          const isCurrent  = !!h?.is_current_batter;
          const isOnBase   = !!obs?.is_on_base;
          const isExpanded = expandedKey === row.key;

          return (
            <div key={row.key} style={{
              borderBottom: ri < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: isCurrent ? 'rgba(34,197,94,0.05)' : row.key === hero.key ? 'rgba(198,181,131,0.05)' : 'transparent',
              borderLeft: `3px solid ${isCurrent ? GREEN : row.key === hero.key ? GOLD : 'transparent'}`,
              transition: 'background 0.15s',
            }}>
              <div onClick={() => setHeroIdx(ri)} style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: isCurrent ? GREEN : 'rgba(255,255,255,0.3)', minWidth: 18, fontFamily: FONT }}>{row.order ?? '—'}</span>
                {row.jersey && <span style={{ fontWeight: 700, fontSize: 11.5, color: 'rgba(255,255,255,0.35)', minWidth: 26 }}>#{row.jersey}</span>}
                <div style={{ flex: 1, minWidth: 110 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: isCurrent ? '#fff' : CREAM, fontFamily: FONT }}>{row.name || '—'}</span>
                    {row.hand && <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 5px', color: 'rgba(255,255,255,0.45)' }}>{row.hand}</span>}
                    {isOnBase && <span style={{ fontSize: 9.5, fontWeight: 900, padding: '2px 7px', borderRadius: 9, background: 'rgba(198,181,131,0.2)', color: GOLD }}>{obs.current_base}</span>}
                  </div>
                  {(obs?.speed_rating || obs?.aggression_rating || h?.approach || h?.bat_speed_grade || h?.contact_grade || h?.power_grade) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      {obs?.speed_rating      && <span style={{ fontSize: 9, fontWeight: 700, color: SPD_COLOR[obs.speed_rating]  || GOLD }}>{obs.speed_rating}</span>}
                      {obs?.aggression_rating && <span style={{ fontSize: 9, fontWeight: 700, color: AGGR_COLOR[obs.aggression_rating] || GOLD }}>{obs.aggression_rating}</span>}
                      {obs?.steal_attempts > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: FONT }}>{obs.steals_successful || 0}/{obs.steal_attempts} SB</span>}
                      {h?.approach            && <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(198,181,131,0.5)' }}>{h.approach}</span>}
                      {h?.bat_speed_grade     && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Spd {GRADE_LABEL[h.bat_speed_grade]}</span>}
                      {h?.contact_grade       && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Con {GRADE_LABEL[h.contact_grade]}</span>}
                      {h?.power_grade         && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Pwr {GRADE_LABEL[h.power_grade]}</span>}
                    </div>
                  )}
                </div>
                {obs && (
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedKey(isExpanded ? null : row.key); }}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14, width: 36, height: 36, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                    ▾
                  </button>
                )}
              </div>

              {isExpanded && obs && (
                <div style={{ borderTop: '1px solid rgba(198,181,131,0.1)', background: 'rgba(0,0,0,0.2)', padding: 12 }}>
                  <RunnerScoutPanel key={obs.id} obs={obs} onSaved={updated => onRunnerSaved && onRunnerSaved(updated)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveScoutingHub({ game, opponent, initialLineup, onBack, onHome }) {
  const [tab,         setTab]         = useState('BATTERY');
  const [pitcherObs,  setPitcherObs]  = useState([]);
  const [catcherObs,  setCatcherObs]  = useState(null);
  const [runnerObs,   setRunnerObs]   = useState([]);
  const [hitterObs,   setHitterObs]   = useState([]);
  const [lineup,      setLineup]      = useState(initialLineup || []);
  const [showSub,     setShowSub]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [completing,  setCompleting]  = useState(false);
  const [confirmEnd,  setConfirmEnd]  = useState(false);
  const [dugoutMode,  setDugoutMode]  = useState(game?.dugout_display_mode || 'pitcher');
  const [togglingMode, setTogglingMode] = useState(false);
  const [orientation, setOrientation] = useState(game?.dugout_orientation || 'horizontal');
  const [togglingOrientation, setTogglingOrientation] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [po, co, ro, ho] = await Promise.all([
        base44.entities.PitcherObservation.filter({ game_id: game.id }),
        base44.entities.CatcherObservation.filter({ game_id: game.id }),
        base44.entities.BaserunnerObservation.filter({ game_id: game.id }),
        base44.entities.HitterObservation.filter({ game_id: game.id }, 'lineup_position', 50),
      ]);
      setPitcherObs(po);
      setCatcherObs(co[0] || null);
      setRunnerObs(ro);
      setHitterObs(ho || []);
    } catch (e) {
      console.error('LiveScout reload error:', e);
    } finally {
      setLoading(false);
    }
  }, [game.id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!initialLineup?.length && game.lineup_data?.length) setLineup(game.lineup_data);
  }, [game]);

  // ── Pitcher sub ───────────────────────────────────────────────────────────
  async function handlePitcherSub({ name, jersey, hand }) {
    try {
      if (currentPitcher) {
        await base44.entities.PitcherObservation.update(currentPitcher.id, { is_current_pitcher: false });
      }
      await base44.entities.PitcherObservation.create({
        game_id: game.id, pitcher_name: name,
        pitcher_team: opponent?.name || '', pitcher_hand: hand || null,
        jersey_number: jersey || null, is_current_pitcher: true,
      });
      setShowSub(false);
      setTab('BATTERY');
      reload();
    } catch (e) {
      toast.error(`Pitcher sub failed — ${e?.message || 'network error'}. Try again.`);
    }
  }

  // ── Hitter sub ────────────────────────────────────────────────────────────
  async function handleHitterSub({ name, jersey, hand, slotIndex }) {
    try {
    const newObs = await base44.entities.BaserunnerObservation.create({
      game_id: game.id, runner_name: name, runner_team: opponent?.name || '',
      jersey_number: jersey || null, bats: hand || null,
    });
    setRunnerObs(prev => [...prev, newObs]);
    setLineup(prev => prev.map((s, i) => i === slotIndex ? { ...s, name, jersey, hand } : s));
    setShowSub(false);
    setTab('LINEUP');
    } catch (e) {
      toast.error(`Hitter sub failed — ${e?.message || 'network error'}. Try again.`);
    }
  }

  // ── Ensure HitterObservation exists (creates on demand) ───────────────────
  async function ensureHitterObs(name, order) {
    const existing = hitterObs.find(h => CANON(h.hitter_name) === CANON(name));
    if (existing) return existing;
    const slot = lineup.find(s => CANON(s.name) === CANON(name)) || {};
    const newH = await base44.entities.HitterObservation.create({
      game_id:        game.id,
      hitter_name:    name,
      hitter_team:    opponent?.name || '',
      hitter_hand:    slot.hand || null,
      jersey_number:  slot.jersey || null,
      lineup_position: order || null,
      is_current_batter: false,
    });
    setHitterObs(prev => [...prev, newH]);
    return newH;
  }

  // ── Set current batter ────────────────────────────────────────────────────
  async function setCurrentBatter(hitter) {
    try {
    await Promise.all(
      hitterObs.filter(h => h.is_current_batter).map(h =>
        base44.entities.HitterObservation.update(h.id, { is_current_batter: false })
      )
    );
    await base44.entities.HitterObservation.update(hitter.id, { is_current_batter: true });
    setHitterObs(prev => prev.map(h => ({ ...h, is_current_batter: h.id === hitter.id })));
    } catch (e) {
      toast.error(`Couldn't set current batter — ${e?.message || 'network error'}.`);
    }
  }

  // ── Advance batter by lineup order ────────────────────────────────────────
  async function advanceBatter() {
    const orderedNames = lineup.length > 0
      ? lineup.map(s => s.name).filter(Boolean)
      : [...hitterObs].sort((a,b) => (a.lineup_position||99)-(b.lineup_position||99)).map(h => h.hitter_name);

    if (!orderedNames.length) return;
    const currentName = hitterObs.find(h => h.is_current_batter)?.hitter_name || null;
    const curIdx  = currentName ? orderedNames.findIndex(n => CANON(n) === CANON(currentName)) : -1;
    const nextIdx = (curIdx + 1) % orderedNames.length;
    const nextName = orderedNames[nextIdx];
    const next = await ensureHitterObs(nextName, nextIdx + 1);
    await setCurrentBatter(next);
  }

  // ── Ensure BaserunnerObservation exists + set base ────────────────────────
  async function handleSetBase(name, base) {
    let obs = runnerObs.find(r => CANON(r.runner_name) === CANON(name));
    if (!obs) {
      const slot = lineup.find(s => CANON(s.name) === CANON(name)) || {};
      obs = await base44.entities.BaserunnerObservation.create({
        game_id:       game.id,
        runner_name:   name,
        runner_team:   opponent?.name || '',
        jersey_number: slot.jersey || null,
        bats:          slot.hand   || null,
      });
      setRunnerObs(prev => [...prev, obs]);
    }
    const patch = base
      ? { is_on_base: true,  current_base: base }
      : { is_on_base: false, current_base: null  };
    const updated = await base44.entities.BaserunnerObservation.update(obs.id, patch);
    setRunnerObs(prev => prev.map(r => r.id === updated.id ? updated : r));
    return updated;
  }

  // ── Dugout mode toggle ────────────────────────────────────────────────────
  async function toggleDugoutMode() {
    if (togglingMode) return;
    setTogglingMode(true);
    const next = dugoutMode === 'pitcher' ? 'hitter' : 'pitcher';
    try {
      await base44.entities.Game.update(game.id, { dugout_display_mode: next });
      setDugoutMode(next);
    } catch (e) {
      console.error('Failed to set dugout mode:', e);
    } finally {
      setTogglingMode(false);
    }
  }

  // ── Dugout orientation toggle ─────────────────────────────────────────────
  async function toggleOrientation() {
    if (togglingOrientation) return;
    setTogglingOrientation(true);
    const next = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    try {
      await base44.entities.Game.update(game.id, { dugout_orientation: next });
      setOrientation(next);
    } catch (e) {
      console.error('Failed to set dugout orientation:', e);
    } finally {
      setTogglingOrientation(false);
    }
  }

  // ── Complete game ─────────────────────────────────────────────────────────
  async function completeGame() {
    setCompleting(true);
    await base44.entities.Game.update(game.id, { status: 'complete' });
    setCompleting(false);
    onBack();
  }

  const currentPitcher = pitcherObs.find(p => p.is_current_pitcher);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY_DARK }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(198,181,131,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: NAVY_DARK }}>
      <style>{`
        .dark-input { background: rgba(255,255,255,0.07) !important; border: 1px solid rgba(198,181,131,0.2) !important; border-radius: 6px !important; color: #f0ece0 !important; padding: 7px 10px !important; font-size: 13px !important; font-family: 'Archivo', sans-serif !important; width: 100%; outline: none; }
        .dark-input:focus { border-color: rgba(198,181,131,0.5) !important; }
        .dark-input::placeholder { color: rgba(255,255,255,0.22) !important; }
        .dark-input option { background: #0e253a; color: #f0ece0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <HubBanner
        opponent={opponent} game={game}
        onCompleteGame={() => setConfirmEnd(true)}
        onToggleSub={() => setShowSub(s => !s)} showSub={showSub}
        dugoutMode={dugoutMode} onToggleDugout={toggleDugoutMode} togglingMode={togglingMode}
        orientation={orientation} onToggleOrientation={toggleOrientation} togglingOrientation={togglingOrientation}
        onHome={onHome}
      />

      {/* Tab bar */}
      <div style={{ background: NAVY_DARK, display: 'flex', borderBottom: `2px solid ${LINE}`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? `3px solid ${GOLD}` : '3px solid transparent',
              color: tab === t.key ? GOLD : 'rgba(255,255,255,0.35)',
              fontWeight: 800, fontSize: 11.5, padding: '13px 4px 11px',
              cursor: 'pointer', fontFamily: FONT,
              letterSpacing: tab === t.key ? 0.5 : 0,
              transition: 'all 0.12s', textTransform: 'uppercase',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Confirm end */}
      {confirmEnd && (
        <div style={{ background: 'rgba(220,38,38,0.1)', borderBottom: '1px solid rgba(220,38,38,0.3)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: RED, flex: 1, fontSize: 13, fontFamily: FONT }}>Mark game as complete?</span>
          <button onClick={completeGame} disabled={completing}
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 16px', minHeight: 40, fontWeight: 800, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
            {completing ? 'Saving…' : 'Yes, Complete'}
          </button>
          <button onClick={() => setConfirmEnd(false)}
            style={{ background: 'rgba(255,255,255,0.08)', color: CREAM, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, padding: '9px 16px', minHeight: 40, fontWeight: 800, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
            Cancel
          </button>
        </div>
      )}

      {/* Sub form */}
      {showSub && (
        <div style={{ padding: '0 16px', background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${LINE_SOFT}` }}>
          <SubstitutionForm
            lineup={lineup}
            currentPitcher={currentPitcher?.pitcher_name}
            opponentName={opponent?.name}
            onPitcherSub={handlePitcherSub}
            onHitterSub={handleHitterSub}
            onCancel={() => setShowSub(false)}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {tab === 'BATTERY' && (
          <BatteryTab pitcherObs={pitcherObs} catcherObs={catcherObs} />
        )}

        {tab === 'LINEUP' && (
          <LineupAndRunnersTab
            hitterObs={hitterObs}
            runnerObs={runnerObs}
            lineup={lineup}
            onSetCurrentBatter={setCurrentBatter}
            onAdvanceBatter={advanceBatter}
            onSetBase={handleSetBase}
            onEnsureHitterObs={ensureHitterObs}
            onRunnerSaved={updated => setRunnerObs(prev => prev.map(r => r.id === updated.id ? updated : r))}
          />
        )}
      </div>
    </div>
  );
}
