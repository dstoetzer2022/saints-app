import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PitcherScoutPanel from '@/components/scouting/PitcherScoutPanel';
import CatcherScoutPanel from '@/components/scouting/CatcherScoutPanel';
import RunnerScoutPanel  from '@/components/scouting/RunnerScoutPanel';
import SubstitutionForm  from '@/components/scouting/SubstitutionForm';

const NAVY_DARK = '#07111c';
const GOLD      = '#c6b583';
const CCL_LOGO  = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';
const FONT      = "'Archivo', sans-serif";

const TABS = [
  { key: 'BATTERY', label: 'Battery'  },
  { key: 'LINEUP',  label: 'Lineup'   },
];

// Canonical name key for loose matching (ignores case / punctuation)
const CANON = n => n ? n.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ') : '';

const GRADE_LABEL = { plus_plus: '++', plus: '+', average: 'AVG', below: '-', well_below: '--' };
const SPD_COLOR   = { fast: '#4ade80', average: '#facc15', slow: '#f87171' };
const AGGR_COLOR  = { aggressive: '#4ade80', average: '#facc15', passive: '#94a3b8' };

// ── Top banner ────────────────────────────────────────────────────────────────
function HubBanner({ opponent, game, onCompleteGame, onToggleSub, showSub, dugoutMode, onToggleDugout, togglingMode }) {
  return (
    <div style={{ background: NAVY_DARK, borderBottom: '1px solid rgba(198,181,131,0.18)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
      <img src={opponent?.logo_url || CCL_LOGO} alt="" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: '#f0ece0', fontWeight: 800, fontSize: 15, lineHeight: 1.1, fontFamily: FONT }}>vs {opponent?.name || '—'}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>{game?.date}</div>
      </div>
      <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80', borderRadius: 4, padding: '3px 9px', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8 }}>● LIVE</span>
      {/* Dugout view mode toggle */}
      <button
        onClick={onToggleDugout}
        disabled={togglingMode}
        style={{
          background: dugoutMode === 'hitter' ? 'rgba(59,130,246,0.18)' : 'rgba(198,181,131,0.12)',
          border: `1px solid ${dugoutMode === 'hitter' ? 'rgba(59,130,246,0.5)' : 'rgba(198,181,131,0.3)'}`,
          color: dugoutMode === 'hitter' ? '#93c5fd' : GOLD,
          borderRadius: 6, padding: '7px 12px', fontWeight: 800, fontSize: 11.5,
          cursor: togglingMode ? 'wait' : 'pointer', fontFamily: FONT,
          whiteSpace: 'nowrap', transition: 'all 0.15s', opacity: togglingMode ? 0.6 : 1,
        }}>
        {togglingMode ? '…' : dugoutMode === 'hitter' ? '● HITTER VIEW' : '○ PITCHER VIEW'}
      </button>
      <button onClick={onToggleSub}
        style={{ background: showSub ? 'rgba(239,68,68,0.18)' : 'rgba(198,181,131,0.12)', border: `1px solid ${showSub ? 'rgba(239,68,68,0.45)' : 'rgba(198,181,131,0.3)'}`, color: showSub ? '#f87171' : GOLD, borderRadius: 6, padding: '7px 12px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
        {showSub ? '✕ Cancel' : '⇄ Sub'}
      </button>
      <button onClick={onCompleteGame}
        style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', borderRadius: 6, padding: '7px 13px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: FONT, letterSpacing: 0.2, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; }}>
        ✓ End Game
      </button>
    </div>
  );
}

// ── Battery tab (pitcher + catcher combined) ──────────────────────────────────
function BatteryTab({ currentPitcher, relievers, catcherObs }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      {/* PITCHER section */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 3, height: 14, background: GOLD, borderRadius: 2 }} />
          <span style={{ fontWeight: 800, fontSize: 10.5, color: GOLD, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: FONT }}>Pitcher</span>
        </div>
        {currentPitcher ? (
          <>
            <div style={{ border: '1.5px solid rgba(74,222,128,0.35)', borderRadius: 10, boxShadow: '0 0 20px rgba(74,222,128,0.08)', marginBottom: 12 }}>
              <PitcherScoutPanel key={currentPitcher.id} obs={currentPitcher} />
            </div>
            {relievers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 9.5, color: 'rgba(198,181,131,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: FONT }}>Previous</div>
                {relievers.map(p => (
                  <div key={p.id} style={{ opacity: 0.55, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                    <PitcherScoutPanel obs={p} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0', fontSize: 13, fontFamily: FONT }}>No pitcher set. Use substitution to add one.</div>
        )}
      </div>

      {/* Vertical divider */}
      <div style={{ width: 1, background: 'rgba(198,181,131,0.15)', alignSelf: 'stretch', flexShrink: 0 }} />

      {/* CATCHER section */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 3, height: 14, background: GOLD, borderRadius: 2 }} />
          <span style={{ fontWeight: 800, fontSize: 10.5, color: GOLD, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: FONT }}>Catcher</span>
        </div>
        {catcherObs
          ? <CatcherScoutPanel key={catcherObs.id} obs={catcherObs} />
          : <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0', fontSize: 13, fontFamily: FONT }}>No catcher observation. Add via lineup or substitution.</div>
        }
      </div>
    </div>
  );
}

// ── Inline base buttons ───────────────────────────────────────────────────────
function InlineBaseControls({ obs, saving, onSetBase, onClear }) {
  // Always show 1B / 2B / 3B regardless of on-base status.
  // Active base is highlighted; tapping it again clears.
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {['1B', '2B', '3B'].map(b => {
        const active = obs?.is_on_base && obs?.current_base === b;
        return (
          <button key={b} onClick={() => active ? onClear() : onSetBase(b)} disabled={saving}
            style={{
              padding: '5px 10px', borderRadius: 5, border: 'none',
              background: active ? GOLD : 'rgba(198,181,131,0.12)',
              color: active ? '#07111c' : 'rgba(198,181,131,0.5)',
              fontFamily: FONT, fontSize: 11, fontWeight: 900,
              cursor: 'pointer', opacity: saving ? 0.4 : 1,
              boxShadow: active ? '0 0 8px rgba(198,181,131,0.45)' : 'none',
              transition: 'all 0.12s',
            }}>
            {b}
          </button>
        );
      })}
      {obs?.is_on_base && (
        <button onClick={onClear} disabled={saving}
          style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontFamily: FONT, fontSize: 11, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.4 : 1 }}>
          ×
        </button>
      )}
    </div>
  );
}

// ── Consolidated lineup + runners tab ─────────────────────────────────────────
// Rows built from game.lineup_data array to preserve the exact order entered.
// Each row joins HitterObservation (for at-bat state) + BaserunnerObservation
// (for base state). Both are created on demand if missing.
function LineupAndRunnersTab({ hitterObs, runnerObs, lineup, onSetCurrentBatter, onAdvanceBatter, onSetBase, onRunnerSaved, onEnsureHitterObs }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [saving,      setSaving]      = useState(null);

  // ── Build rows: lineup array is primary (preserves entry order) ──────────
  const rows = (() => {
    // If lineup data exists, use it as the backbone
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
      // Orphan hitter obs not in lineup (shouldn't happen often, but handle gracefully)
      const lineupNames = new Set(lineup.map(s => CANON(s.name)));
      hitterObs
        .filter(h => !lineupNames.has(CANON(h.hitter_name)))
        .forEach((h, i) => {
          const obs = runnerObs.find(r => CANON(r.runner_name) === CANON(h.hitter_name)) || null;
          built.push({ key: `orphan-${i}`, order: null, name: h.hitter_name, jersey: h.jersey_number, hand: h.hitter_hand, h, obs });
        });
      return built;
    }
    // Fallback: build from hitterObs sorted by lineup_position
    return [...hitterObs]
      .sort((a, b) => (a.lineup_position || 99) - (b.lineup_position || 99))
      .map(h => {
        const obs = runnerObs.find(r => CANON(r.runner_name) === CANON(h.hitter_name)) || null;
        return { key: h.id, order: h.lineup_position, name: h.hitter_name, jersey: h.jersey_number, hand: h.hitter_hand, h, obs };
      });
  })();

  const currentBatter = hitterObs.find(h => h.is_current_batter);

  if (!rows.length) {
    return <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 40, fontSize: 13, fontFamily: FONT }}>No lineup data. Add players via Substitution.</div>;
  }

  const handleSetBase = async (row, base) => {
    setSaving(row.key);
    const updated = await onSetBase(row.name, base);
    if (updated && onRunnerSaved) onRunnerSaved(updated);
    setSaving(null);
  };

  const handleClear = async (row) => {
    setSaving(row.key);
    const updated = await onSetBase(row.name, null);
    if (updated && onRunnerSaved) onRunnerSaved(updated);
    setSaving(null);
  };

  const handleSetCurrent = async (row) => {
    setSaving(row.key + '-bat');
    // Ensure a HitterObservation exists for this slot (creates on demand if missing)
    const h = await onEnsureHitterObs(row.name, row.order);
    await onSetCurrentBatter(h);
    setSaving(null);
  };

  return (
    <div>
      {/* Next batter strip */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        {currentBatter ? (
          <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#4ade80', fontFamily: FONT }}>
              {currentBatter.lineup_position ? `${currentBatter.lineup_position}. ` : ''}{currentBatter.hitter_name}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: FONT }}>at bat</span>
          </div>
        ) : (
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontStyle: 'italic', fontFamily: FONT }}>
            Tap SET on a batter to begin
          </div>
        )}
        <button onClick={onAdvanceBatter}
          style={{ background: GOLD, color: '#07111c', border: 'none', borderRadius: 8, padding: '10px 18px', fontFamily: FONT, fontSize: 12, fontWeight: 900, cursor: 'pointer', letterSpacing: 0.3, whiteSpace: 'nowrap', flexShrink: 0 }}>
          NEXT →
        </button>
      </div>

      {/* Lineup rows */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(198,181,131,0.13)', borderRadius: 10, overflow: 'hidden' }}>
        {rows.map((row, ri) => {
          const { h, obs } = row;
          const isCurrent  = !!h?.is_current_batter;
          const isOnBase   = !!obs?.is_on_base;
          const isExpanded = expandedKey === row.key;
          const isSaving   = saving === row.key || saving === row.key + '-bat';
          const isBatSaving = saving === row.key + '-bat';

          return (
            <div key={row.key} style={{
              borderBottom: ri < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: isCurrent ? 'rgba(34,197,94,0.05)' : 'transparent',
              borderLeft: isCurrent ? '3px solid #4ade80' : '3px solid transparent',
              transition: 'background 0.15s',
            }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Order */}
                <span style={{ fontWeight: 800, fontSize: 13, color: isCurrent ? '#4ade80' : 'rgba(255,255,255,0.25)', minWidth: 18, fontFamily: FONT }}>
                  {row.order ?? '—'}
                </span>
                {/* Jersey */}
                {row.jersey && <span style={{ fontWeight: 700, fontSize: 12, color: GOLD, minWidth: 28, fontFamily: FONT }}>#{row.jersey}</span>}

                {/* Name + metadata */}
                <div style={{ flex: 1, minWidth: 110 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: isCurrent ? '#ffffff' : '#f0ece0', fontFamily: FONT }}>
                      {row.name || '—'}
                    </span>
                    {row.hand && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 5px', color: 'rgba(255,255,255,0.45)' }}>{row.hand}</span>
                    )}
                    {isOnBase && (
                      <span style={{ fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 3, background: 'rgba(198,181,131,0.2)', color: GOLD }}>● {obs.current_base}</span>
                    )}
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

                {/* SET / AT BAT button — always shown, creates HitterObs on demand */}
                <button
                  disabled={isCurrent || isBatSaving}
                  onClick={() => handleSetCurrent(row)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none',
                    fontFamily: FONT, fontSize: 11, fontWeight: 900,
                    cursor: isCurrent ? 'default' : 'pointer',
                    background: isCurrent ? 'rgba(34,197,94,0.15)' : 'rgba(198,181,131,0.18)',
                    color: isCurrent ? '#4ade80' : GOLD,
                    opacity: isBatSaving ? 0.5 : 1, flexShrink: 0,
                  }}>
                  {isBatSaving ? '…' : isCurrent ? '✓ AT BAT' : 'SET'}
                </button>

                {/* Inline base controls */}
                <InlineBaseControls
                  obs={obs}
                  saving={saving === row.key}
                  onSetBase={b => handleSetBase(row, b)}
                  onClear={() => handleClear(row)}
                />

                {/* Expand for runner scouting detail */}
                {obs && (
                  <button
                    onClick={() => setExpandedKey(isExpanded ? null : row.key)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 14, padding: '2px 4px', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                    ▾
                  </button>
                )}
              </div>

              {/* Expanded runner scout panel */}
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
export default function LiveScoutingHub({ game, opponent, initialLineup, onBack }) {
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
  }

  // ── Hitter sub ────────────────────────────────────────────────────────────
  async function handleHitterSub({ name, jersey, hand, slotIndex }) {
    const newObs = await base44.entities.BaserunnerObservation.create({
      game_id: game.id, runner_name: name, runner_team: opponent?.name || '',
      jersey_number: jersey || null, bats: hand || null,
    });
    setRunnerObs(prev => [...prev, newObs]);
    setLineup(prev => prev.map((s, i) => i === slotIndex ? { ...s, name, jersey, hand } : s));
    setShowSub(false);
    setTab('LINEUP');
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
    await Promise.all(
      hitterObs.filter(h => h.is_current_batter).map(h =>
        base44.entities.HitterObservation.update(h.id, { is_current_batter: false })
      )
    );
    await base44.entities.HitterObservation.update(hitter.id, { is_current_batter: true });
    setHitterObs(prev => prev.map(h => ({ ...h, is_current_batter: h.id === hitter.id })));
  }

  // ── Advance batter by lineup order ────────────────────────────────────────
  async function advanceBatter() {
    // Build ordered name list from lineup (preserves entry order)
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

  // ── Complete game ─────────────────────────────────────────────────────────
  async function completeGame() {
    setCompleting(true);
    await base44.entities.Game.update(game.id, { status: 'complete' });
    setCompleting(false);
    onBack();
  }

  const currentPitcher = pitcherObs.find(p => p.is_current_pitcher);
  const relievers      = pitcherObs.filter(p => !p.is_current_pitcher);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY_DARK }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(198,181,131,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0b1d2e' }}>
      <style>{`
        .hub-panel { background: rgba(255,255,255,0.04); border: 1px solid rgba(198,181,131,0.13); border-radius: 10px; }
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
      />

      {/* Tab bar */}
      <div style={{ background: NAVY_DARK, display: 'flex', borderBottom: '2px solid rgba(198,181,131,0.15)', flexShrink: 0 }}>
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
          <span style={{ fontWeight: 700, color: '#f87171', flex: 1, fontSize: 13, fontFamily: FONT }}>Mark game as complete?</span>
          <button onClick={completeGame} disabled={completing}
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
            {completing ? 'Saving…' : 'Yes, Complete'}
          </button>
          <button onClick={() => setConfirmEnd(false)}
            style={{ background: 'rgba(255,255,255,0.08)', color: '#f0ece0', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, padding: '6px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
            Cancel
          </button>
        </div>
      )}

      {/* Sub form */}
      {showSub && (
        <div style={{ padding: '0 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(198,181,131,0.12)' }}>
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
          <BatteryTab
            currentPitcher={currentPitcher}
            relievers={relievers}
            catcherObs={catcherObs}
          />
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
