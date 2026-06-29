import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PitcherScoutPanel from '@/components/scouting/PitcherScoutPanel';
import CatcherScoutPanel from '@/components/scouting/CatcherScoutPanel';
import RunnerScoutPanel from '@/components/scouting/RunnerScoutPanel';
import SubstitutionForm from '@/components/scouting/SubstitutionForm';

const NAVY_DARK = '#07111c';
const GOLD = '#c6b583';
const CCL_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';

const TABS = [
  { key: 'PITCHER', label: 'Pitcher' },
  { key: 'CATCHER', label: 'Catcher' },
  { key: 'HITTERS', label: 'Hitters' },
  { key: 'BASERUNNERS', label: 'Runners' },
];

function HubBanner({ opponent, game, onCompleteGame, onToggleSub, showSub, dugoutMode, onToggleDugout, togglingMode }) {
  return (
    <div style={{ background: NAVY_DARK, borderBottom: `1px solid rgba(198,181,131,0.18)`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
      <img src={opponent?.logo_url || CCL_LOGO} alt="" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: '#f0ece0', fontWeight: 800, fontSize: 15, lineHeight: 1.1, fontFamily: "'Archivo', sans-serif" }}>vs {opponent?.name || '—'}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>{game?.date}</div>
      </div>
      <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80', borderRadius: 4, padding: '3px 9px', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8 }}>● LIVE</span>
      {/* Dugout view mode toggle — writes Game.dugout_display_mode */}
      <button
        onClick={onToggleDugout}
        disabled={togglingMode}
        style={{
          background: dugoutMode === 'hitter' ? 'rgba(59,130,246,0.18)' : 'rgba(198,181,131,0.12)',
          border: `1px solid ${dugoutMode === 'hitter' ? 'rgba(59,130,246,0.5)' : 'rgba(198,181,131,0.3)'}`,
          color: dugoutMode === 'hitter' ? '#93c5fd' : GOLD,
          borderRadius: 6, padding: '7px 12px', fontWeight: 800, fontSize: 11.5,
          cursor: togglingMode ? 'wait' : 'pointer',
          fontFamily: "'Archivo', sans-serif",
          whiteSpace: 'nowrap', transition: 'all 0.15s',
          opacity: togglingMode ? 0.6 : 1,
        }}>
        {togglingMode ? '…' : dugoutMode === 'hitter' ? '● HITTER VIEW' : '○ PITCHER VIEW'}
      </button>
      <button onClick={onToggleSub}
        style={{ background: showSub ? 'rgba(239,68,68,0.18)' : 'rgba(198,181,131,0.12)', border: `1px solid ${showSub ? 'rgba(239,68,68,0.45)' : 'rgba(198,181,131,0.3)'}`, color: showSub ? '#f87171' : GOLD, borderRadius: 6, padding: '7px 12px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
        {showSub ? '✕ Cancel' : '⇄ Sub'}
      </button>
      <button onClick={onCompleteGame}
        style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', borderRadius: 6, padding: '7px 13px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", letterSpacing: 0.2, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; }}>
        ✓ End Game
      </button>
    </div>
  );
}

// ── Hitters tab ───────────────────────────────────────────────
function HittersTab({ hitterObs, onSetCurrentBatter }) {
  const [saving, setSaving] = useState(null);
  const sorted = [...hitterObs].sort((a, b) => (a.lineup_position || 99) - (b.lineup_position || 99));

  if (!sorted.length) {
    return <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 40, fontSize: 13 }}>No hitter observations for this game.</div>;
  }

  const GRADE_LABEL = { plus_plus: '++', plus: '+', average: 'AVG', below: '-', well_below: '--' };

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(198,181,131,0.13)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(198,181,131,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 3, height: 14, background: GOLD, borderRadius: 2 }} />
        <span style={{ fontWeight: 800, fontSize: 10.5, color: GOLD, textTransform: 'uppercase', letterSpacing: 1 }}>Batting Order</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>— tap "Current" to set active batter</span>
      </div>
      {sorted.map(h => (
        <div key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,0.3)', minWidth: 18 }}>{h.lineup_position || '—'}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#f0ece0', fontFamily: "'Archivo', sans-serif" }}>{h.hitter_name}</span>
            {h.hitter_hand && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 5px', color: 'rgba(255,255,255,0.5)' }}>{h.hitter_hand}</span>}
            {h.approach && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'rgba(198,181,131,0.6)' }}>{h.approach}</span>}
            {(h.bat_speed_grade || h.contact_grade || h.power_grade) && (
              <div style={{ marginTop: 3, display: 'flex', gap: 6 }}>
                {h.bat_speed_grade && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Spd {GRADE_LABEL[h.bat_speed_grade]}</span>}
                {h.contact_grade && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Con {GRADE_LABEL[h.contact_grade]}</span>}
                {h.power_grade && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Pwr {GRADE_LABEL[h.power_grade]}</span>}
              </div>
            )}
          </div>
          {h.is_current_batter && (
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80', borderRadius: 4, padding: '3px 8px' }}>
              ● CURRENT
            </span>
          )}
          <button
            disabled={saving === h.id || h.is_current_batter}
            onClick={async () => { setSaving(h.id); await onSetCurrentBatter(h); setSaving(null); }}
            style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: h.is_current_batter ? 'default' : 'pointer',
              fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 800,
              background: h.is_current_batter ? 'rgba(34,197,94,0.1)' : 'rgba(198,181,131,0.18)',
              color: h.is_current_batter ? '#4ade80' : GOLD,
              opacity: saving === h.id ? 0.5 : 1,
            }}
          >
            {saving === h.id ? '…' : h.is_current_batter ? '✓ At Bat' : 'Set Current'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── On Base controls (inline in runner rows) ──────────────────
function OnBaseControls({ obs, onUpdated }) {
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    const newVal = !obs.is_on_base;
    const updated = await base44.entities.BaserunnerObservation.update(obs.id, {
      is_on_base: newVal,
      current_base: newVal ? (obs.current_base || '1B') : null,
    });
    onUpdated && onUpdated(updated);
    setSaving(false);
  };

  const setBase = async (base) => {
    setSaving(true);
    const updated = await base44.entities.BaserunnerObservation.update(obs.id, { current_base: base, is_on_base: true });
    onUpdated && onUpdated(updated);
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {obs.is_on_base && (
        <>
          {['1B', '2B', '3B'].map(b => (
            <button key={b} onClick={() => setBase(b)} disabled={saving}
              style={{ padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 900,
                background: obs.current_base === b ? GOLD : 'rgba(198,181,131,0.15)',
                color: obs.current_base === b ? '#fff' : GOLD }}>
              {b}
            </button>
          ))}
        </>
      )}
      <button onClick={toggle} disabled={saving}
        style={{ padding: '5px 11px', borderRadius: 5, border: `1px solid ${obs.is_on_base ? 'rgba(34,197,94,0.4)' : 'rgba(198,181,131,0.3)'}`, cursor: 'pointer',
          fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 800,
          background: obs.is_on_base ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
          color: obs.is_on_base ? '#4ade80' : GOLD, opacity: saving ? 0.5 : 1 }}>
        {obs.is_on_base ? `● ON ${obs.current_base || 'BASE'}` : 'On Base'}
      </button>
    </div>
  );
}

function RunnersLineupList({ lineup, runnerObs, onRunnerSaved }) {
  const [expandedKey, setExpandedKey] = useState(null);

  if (!lineup.length && !runnerObs.length) {
    return <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 40, fontSize: 13 }}>No lineup data.</div>;
  }

  // Rows: one per lineup slot; fall back to obs not in lineup
  const lineupNames = new Set(lineup.map(s => s.name).filter(Boolean));
  const orphanObs = runnerObs.filter(o => !lineupNames.has(o.runner_name));

  const rows = [
    ...lineup.map((slot, i) => ({
      key: `slot-${i}`,
      order: i + 1,
      name: slot.name,
      jersey: slot.jersey,
      position: slot.position,
      hand: slot.hand,
      obs: runnerObs.find(r => r.runner_name === slot.name) || null,
    })),
    ...orphanObs.map((o, i) => ({
      key: `orphan-${i}`,
      order: null,
      name: o.runner_name,
      jersey: o.jersey_number,
      position: o.position,
      hand: o.bats,
      obs: o,
    })),
  ];

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(198,181,131,0.13)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(198,181,131,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 3, height: 14, background: GOLD, borderRadius: 2 }} />
        <span style={{ fontWeight: 800, fontSize: 10.5, color: GOLD, textTransform: 'uppercase', letterSpacing: 1 }}>Batting Order</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>— tap a player to scout</span>
      </div>
      {rows.map((row) => {
        const isOpen = expandedKey === row.key;
        const obs = row.obs;
        return (
          <div key={row.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Row header — clickable */}
            <div
              onClick={() => setExpandedKey(isOpen ? null : row.key)}
              style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isOpen ? 'rgba(198,181,131,0.07)' : 'transparent', transition: 'background 0.12s' }}
            >
              <span style={{ fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,0.3)', minWidth: 18 }}>{row.order ?? '—'}</span>
              {row.jersey && <span style={{ fontWeight: 700, fontSize: 12, color: GOLD, minWidth: 30 }}>#{row.jersey}</span>}
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#f0ece0' }}>{row.name || '—'}</span>
                {row.position && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{row.position}</span>}
                {row.hand && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 5px', color: 'rgba(255,255,255,0.5)' }}>{row.hand}</span>}
              </div>
              {obs && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {obs.speed_rating && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: obs.speed_rating === 'fast' ? 'rgba(34,197,94,0.15)' : obs.speed_rating === 'slow' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)', color: obs.speed_rating === 'fast' ? '#4ade80' : obs.speed_rating === 'slow' ? '#f87171' : '#facc15' }}>{obs.speed_rating}</span>}
                  {obs.aggression_rating && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>{obs.aggression_rating}</span>}
                  <OnBaseControls obs={obs} onUpdated={updated => onRunnerSaved && onRunnerSaved(updated)} />
                </div>
              )}
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', marginLeft: 4, transition: 'transform 0.15s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </div>
            {/* Expanded scout panel */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(198,181,131,0.1)', background: 'rgba(0,0,0,0.2)', padding: 12 }}>
                {obs
                  ? <RunnerScoutPanel key={obs.id} obs={obs} onSaved={updated => onRunnerSaved && onRunnerSaved(updated)} />
                  : <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>No scouting data yet for {row.name}.</div>
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function LiveScoutingHub({ game, opponent, initialLineup, onBack }) {
  const [tab, setTab] = useState('PITCHER');
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState(null);
  const [runnerObs, setRunnerObs] = useState([]);
  const [hitterObs, setHitterObs] = useState([]);
  const [lineup, setLineup] = useState(initialLineup || []);
  const [showSub, setShowSub] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [dugoutMode, setDugoutMode] = useState(game?.dugout_display_mode || 'pitcher');
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
    if (!initialLineup?.length && game.lineup_data?.length) {
      setLineup(game.lineup_data);
    }
  }, [game]);

  const currentPitcher = pitcherObs.find(p => p.is_current_pitcher);
  const relievers = pitcherObs.filter(p => !p.is_current_pitcher);

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
    setTab('PITCHER');
    reload();
  }

  async function handleHitterSub({ name, jersey, hand, slotIndex }) {
    const newObs = await base44.entities.BaserunnerObservation.create({
      game_id: game.id, runner_name: name, runner_team: opponent?.name || '',
      jersey_number: jersey || null, bats: hand || null,
    });
    setRunnerObs(prev => [...prev, newObs]);
    setLineup(prev => prev.map((s, i) => i === slotIndex ? { ...s, name, jersey, hand } : s));
    setShowSub(false);
    setTab('BASERUNNERS');
  }

  async function setCurrentBatter(hitter) {
    // Clear all current batters for this game
    await Promise.all(
      hitterObs.filter(h => h.is_current_batter).map(h =>
        base44.entities.HitterObservation.update(h.id, { is_current_batter: false })
      )
    );
    await base44.entities.HitterObservation.update(hitter.id, { is_current_batter: true });
    setHitterObs(prev => prev.map(h => ({ ...h, is_current_batter: h.id === hitter.id })));
  }

  async function completeGame() {
    setCompleting(true);
    await base44.entities.Game.update(game.id, { status: 'complete' });
    setCompleting(false);
    onBack();
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY_DARK }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(198,181,131,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0b1d2e' }}>
      <style>{`
        .hub-panel { background: rgba(255,255,255,0.04); border: 1px solid rgba(198,181,131,0.13); border-radius: 10px; }
        .dark-input { background: rgba(255,255,255,0.07) !important; border: 1px solid rgba(198,181,131,0.2) !important; border-radius: 6px !important; color: #f0ece0 !important; padding: 7px 10px !important; font-size: 13px !important; font-family: 'Archivo', sans-serif !important; width: 100%; outline: none; }
        .dark-input:focus { border-color: rgba(198,181,131,0.5) !important; }
        .dark-input::placeholder { color: rgba(255,255,255,0.22) !important; }
        .dark-input option { background: #0e253a; color: #f0ece0; }
      `}</style>

      {/* Top banner */}
      <HubBanner opponent={opponent} game={game} onCompleteGame={() => setConfirmEnd(true)} onToggleSub={() => setShowSub(s => !s)} showSub={showSub} dugoutMode={dugoutMode} onToggleDugout={toggleDugoutMode} togglingMode={togglingMode} />

      {/* Tab bar — top */}
      <div style={{ background: NAVY_DARK, display: 'flex', borderBottom: `2px solid rgba(198,181,131,0.15)`, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? `3px solid ${GOLD}` : '3px solid transparent',
              color: tab === t.key ? GOLD : 'rgba(255,255,255,0.35)',
              fontWeight: 800, fontSize: 11.5, padding: '13px 4px 11px',
              cursor: 'pointer', fontFamily: "'Archivo', sans-serif",
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
          <span style={{ fontWeight: 700, color: '#f87171', flex: 1, fontSize: 13 }}>Mark game as complete?</span>
          <button onClick={completeGame} disabled={completing}
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 12, fontFamily: "'Archivo', sans-serif" }}>
            {completing ? 'Saving…' : 'Yes, Complete'}
          </button>
          <button onClick={() => setConfirmEnd(false)}
            style={{ background: 'rgba(255,255,255,0.08)', color: '#f0ece0', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, padding: '6px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 12, fontFamily: "'Archivo', sans-serif" }}>
            Cancel
          </button>
        </div>
      )}

      {/* Substitution form */}
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

        {tab === 'PITCHER' && (
          <div>
            {currentPitcher ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
                  <span style={{ fontWeight: 800, fontSize: 10.5, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 1.2 }}>Current Pitcher</span>
                </div>
                <div style={{ border: '1.5px solid rgba(74,222,128,0.35)', borderRadius: 10, boxShadow: '0 0 20px rgba(74,222,128,0.08)', marginBottom: 20 }}>
                  <PitcherScoutPanel key={currentPitcher.id} obs={currentPitcher} />
                </div>
              </div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 40, fontSize: 13 }}>No pitcher set. Use substitution to add one.</div>
            )}

            {relievers.length > 0 && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 10.5, color: 'rgba(198,181,131,0.5)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Previous Pitchers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {relievers.map(p => (
                    <div key={p.id} style={{ opacity: 0.6, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                      <PitcherScoutPanel obs={p} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'CATCHER' && (
          catcherObs
            ? <CatcherScoutPanel key={catcherObs.id} obs={catcherObs} />
            : <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: 40, fontSize: 13 }}>No catcher observation. Add via lineup or substitution.</div>
        )}

        {tab === 'HITTERS' && (
          <HittersTab
            hitterObs={hitterObs}
            onSetCurrentBatter={setCurrentBatter}
          />
        )}

        {tab === 'BASERUNNERS' && (
          <RunnersLineupList
            lineup={lineup}
            runnerObs={runnerObs}
            onRunnerSaved={updated => setRunnerObs(prev => prev.map(r => r.id === updated.id ? updated : r))}
          />
        )}
      </div>

    </div>
  );
}