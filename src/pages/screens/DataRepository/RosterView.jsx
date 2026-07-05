import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { normalizeName, canonicalNameKey } from '@/lib/statsUtils';
import PlayerProfile from './PlayerProfile';
import BaserunnerReport from '@/components/reports/BaserunnerReport';
import PitcherCatcherReport from '@/components/reports/PitcherCatcherReport';
import { C, FONT } from '@/lib/darkTheme';

// Which sources a player has data in
function DataPips({ hasTrackman, hasScout }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0, alignItems: 'flex-start', paddingTop: 2 }}>
      {hasTrackman && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.gold }} />}
      {hasScout    && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a90c8' }} />}
    </div>
  );
}

function PlayerRow({ player, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isPitcher = player.role === 'Pitcher';
  const handLabel = isPitcher
    ? (player.hand ? player.hand + 'HP' : '')
    : [player.positions?.[0], player.hand].filter(Boolean).join(' · ');

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 0,
        padding: '10px 10px 10px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.035)',
        cursor: 'pointer',
        background: (active || hovered) ? C.raised : 'transparent',
        borderLeft: active ? `3px solid ${C.gold}` : '3px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ width: 34, flexShrink: 0, marginRight: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, letterSpacing: -1, color: active ? C.gold : C.white, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>
          {player.jerseyNumber || '—'}
        </div>
        {handLabel && (
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: active ? C.goldDim : C.muted, marginTop: 2, fontFamily: FONT }}>
            {handLabel}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: active ? C.white : C.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: FONT }}>
          {player.lastName || player.name}
        </div>
        <div style={{ fontSize: 10, fontWeight: 500, color: C.muted, marginTop: 1, fontFamily: FONT }}>
          {player.firstName || ''}
        </div>
      </div>
      <DataPips hasTrackman={player.hasTrackman} hasScout={player.hasScout} />
    </div>
  );
}

// ── Wide roster table for desktop/TV ──────────────────────────
function WideRosterTable({ pitchers, hitters, activePlayer, onSelect, team }) {
  const accentColor = team?.primary_color || C.gold;
  const allPlayers = [
    ...pitchers.map(p => ({ ...p, _section: 'Pitchers' })),
    ...hitters.map(p => ({ ...p, _section: 'Hitters' })),
  ];

  const thStyle = {
    padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800,
    letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
    borderBottom: `2px solid rgba(255,255,255,0.15)`, whiteSpace: 'nowrap',
    background: accentColor !== C.gold ? accentColor : C.surface,
    position: 'sticky', top: 0, zIndex: 2,
  };

  const sections = ['Pitchers', 'Hitters'];

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, tableLayout: 'fixed', minWidth: 700 }}>
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr>
            {['#', 'Name', 'Role', 'Pos / Hand', 'Key Stat', 'Speed', 'TM', 'Scout'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(section => {
            const rows = allPlayers.filter(p => p._section === section);
            if (!rows.length) return null;
            return (
              <React.Fragment key={section}>
                <tr>
                  <td colSpan={8} style={{ padding: '8px 14px 4px', fontSize: 9, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gold, background: C.base, borderBottom: `1px solid ${C.edge}` }}>
                    {section} &nbsp;<span style={{ color: C.faint }}>{rows.length}</span>
                  </td>
                </tr>
                {rows.map((p, i) => {
                  const isActive = activePlayer?.name === p.name;
                  const isPitcher = p.role === 'Pitcher';
                  const posHand = isPitcher
                    ? (p.hand ? p.hand + 'HP' : '—')
                    : [p.positions?.[0] || '', p.hand || ''].filter(Boolean).join(' · ') || '—';
                  const keyStat = p.quickStat || '—';

                  return (
                    <tr
                      key={p.name}
                      onClick={() => onSelect(p)}
                      style={{
                        background: isActive ? C.raised : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)',
                        borderLeft: isActive ? `3px solid ${C.gold}` : '3px solid transparent',
                        cursor: 'pointer',
                        borderBottom: `1px solid rgba(255,255,255,0.03)`,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.raised; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)'; }}
                    >
                      <td style={{ padding: '9px 14px', fontSize: 18, fontWeight: 900, color: isActive ? C.gold : C.white, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>
                        {p.jerseyNumber || '—'}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? C.white : C.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: C.muted }}>{p.role}</td>
                      <td style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: C.muted }}>{posHand}</td>
                      <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: C.cream }}>{keyStat}</td>
                      <td style={{ padding: '9px 14px' }}>
                        {p.speedRating && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: p.speedRating === 'fast' ? C.green : p.speedRating === 'slow' ? C.red : C.amber, textTransform: 'capitalize' }}>
                            {p.speedRating}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        {p.hasTrackman && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.gold }} />}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        {p.hasScout && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4a90c8' }} />}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RosterView({ team, onSelectPlayer, onBack, initialTab }) {
  const [loading, setLoading] = useState(true);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [batterPitches, setBatterPitches] = useState([]);
  const [activePlayer, setActivePlayer] = useState(null);
  const [_scope, _setScope] = useState('season');
  const [sidebarTab, setSidebarTab] = useState(initialTab === 'hitters' ? 'hitters' : 'pitchers');
  const [showRunnerReport, setShowRunnerReport] = useState(false);
  const [showPitcherCatcherReport, setShowPitcherCatcherReport] = useState(false);

  const teamName = team.name;
  const trackmanCode = team.trackman_code || teamName;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAllFiltered(base44.entities.PitcherObservation, { pitcher_team: teamName }, 'pitcher_name'),
      fetchAllFiltered(base44.entities.CatcherObservation, { catcher_team: teamName }, 'catcher_name'),
      fetchAllFiltered(base44.entities.BaserunnerObservation, { runner_team: teamName }, 'runner_name'),
      // PitcherArsenal rows carry the team's trackman_code in pitcher_team. We want the
      // COMPLETE list of the team's pitchers, so we do NOT restrict to game_id:'season' —
      // a pitcher who has per-game arsenal rows but whose season-aggregate row was never
      // built (e.g. a game missed by the last aggregation run) must still appear. The
      // roster dedups by canonical name key, so pulling every row per pitcher is fine.
      // Query both the trackman_code and the full name, since rows may use either.
      Promise.all([
        fetchAllFiltered(base44.entities.PitcherArsenal, { pitcher_team: trackmanCode }, 'pitcher_name'),
        trackmanCode !== teamName
          ? fetchAllFiltered(base44.entities.PitcherArsenal, { pitcher_team: teamName }, 'pitcher_name')
          : Promise.resolve([]),
      ]).then(([a, b]) => {
        const seen = new Set();
        return [...(a||[]), ...(b||[])].filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      }),
      fetchAllFiltered(base44.entities.TrackmanPitch, { batter_team: teamName }, 'batter_name'), // AUDIT: was capped 2000
      Promise.all([
        fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_team: teamName }, 'pitcher_name'),
        fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_team: trackmanCode }, 'pitcher_name'),
      ]).then(([a, b]) => {
        const seen = new Set();
        return [...(a||[]), ...(b||[])].filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      }),
    ]).then(([po, co, ro, teamArsenal, bp, tp]) => {
      setPitcherObs(po);
      setCatcherObs(co);
      setRunnerObs(ro);

      // teamArsenal is already scoped to this team server-side — every season pitcher
      // for the team appears here regardless of the raw-pitch page. Use it directly.
      setPitches([...tp, ...teamArsenal.map(a => ({
        pitcher_name: a.pitcher_name,
        pitcher_hand: a.pitcher_hand || '',
        pitcher_team: a.pitcher_team,
        _fromArsenal: true,
      }))]);
      setBatterPitches(bp);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamName]);

  const { pitchers, hitters } = useMemo(() => {
    const pitcherMap = {};
    pitcherObs.forEach(o => {
      if (!o.pitcher_name) return;
      const key = canonicalNameKey(o.pitcher_name);
      if (!pitcherMap[key]) {
        const norm = normalizeName(o.pitcher_name);
        const parts = norm.split(' ');
        pitcherMap[key] = {
          name: norm,
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts[parts.length - 1],
          role: 'Pitcher',
          jerseyNumber: o.jersey_number || '',
          hand: o.pitcher_hand || '',
          hasScout: true,
          hasTrackman: false,
        };
      } else {
        pitcherMap[key].hasScout = true;
      }
    });
    pitches.forEach(p => {
      if (!p.pitcher_name) return;
      const normalized = normalizeName(p.pitcher_name);
      const key = canonicalNameKey(p.pitcher_name);
      const parts = normalized.split(' ');
      if (!pitcherMap[key]) {
        pitcherMap[key] = {
          name: normalized,
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts[parts.length - 1],
          role: 'Pitcher',
          jerseyNumber: '',
          hand: p.pitcher_hand || '',
          hasScout: false,
          hasTrackman: true,
        };
      } else {
        pitcherMap[key].hasTrackman = true;
      }
    });

    const hitterMap = {};
    const positionsMap = {};
    runnerObs.forEach(o => {
      if (!o.runner_name || !o.position) return;
      const key = canonicalNameKey(o.runner_name);
      if (!positionsMap[key]) positionsMap[key] = new Set();
      positionsMap[key].add(o.position);
    });

    catcherObs.forEach(o => {
      if (!o.catcher_name) return;
      const normalized = normalizeName(o.catcher_name);
      const key = canonicalNameKey(o.catcher_name);
      if (pitcherMap[key]) return;
      if (!positionsMap[key]) positionsMap[key] = new Set();
      positionsMap[key].add('C');
      const parts = normalized.split(' ');
      if (!hitterMap[key]) {
        hitterMap[key] = {
          name: normalized,
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts[parts.length - 1],
          role: 'Hitter',
          jerseyNumber: o.jersey_number || '',
          hand: o.bats || '',
          hasScout: true,
          hasTrackman: false,
        };
      } else {
        hitterMap[key].hasScout = true;
        if (!hitterMap[key].jerseyNumber && o.jersey_number) hitterMap[key].jerseyNumber = o.jersey_number;
      }
    });

    runnerObs.forEach(o => {
      if (!o.runner_name) return;
      const normalized = normalizeName(o.runner_name);
      const key = canonicalNameKey(o.runner_name);
      if (pitcherMap[key]) return;
      const parts = normalized.split(' ');
      if (!hitterMap[key]) {
        hitterMap[key] = {
          name: normalized,
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts[parts.length - 1],
          role: 'Hitter',
          jerseyNumber: o.jersey_number || '',
          hand: o.bats || '',
          hasScout: true,
          hasTrackman: false,
        };
      } else {
        hitterMap[key].hasScout = true;
        if (!hitterMap[key].jerseyNumber && o.jersey_number) hitterMap[key].jerseyNumber = o.jersey_number;
      }
    });

    batterPitches.forEach(p => {
      if (!p.batter_name) return;
      const normalized = normalizeName(p.batter_name);
      const key = canonicalNameKey(p.batter_name);
      if (pitcherMap[key]) return;
      const parts = normalized.split(' ');
      if (!hitterMap[key]) {
        hitterMap[key] = {
          name: normalized,
          firstName: parts.slice(0, -1).join(' '),
          lastName: parts[parts.length - 1],
          role: 'Hitter',
          jerseyNumber: '',
          hand: p.batter_hand || '',
          hasScout: false,
          hasTrackman: true,
        };
      } else {
        hitterMap[key].hasTrackman = true;
      }
    });

    Object.entries(hitterMap).forEach(([key, h]) => {
      h.positions = positionsMap[key] ? [...positionsMap[key]] : [];
    });

    const sortByJersey = arr => arr.sort((a, b) => {
      const na = parseInt(a.jerseyNumber) || 999;
      const nb = parseInt(b.jerseyNumber) || 999;
      return na - nb || a.name.localeCompare(b.name);
    });

    // Attach quick stats for wide table
    const pitcherList = sortByJersey(Object.values(pitcherMap));
    pitcherList.forEach(p => {
      const obs = pitcherObs.filter(o => canonicalNameKey(o.pitcher_name) === canonicalNameKey(p.name));
      const allTtp = obs.flatMap(o => o.time_to_plate_1b || []).filter(v => v != null);
      if (allTtp.length) {
        const avgTtp = allTtp.reduce((a, b) => a + b, 0) / allTtp.length;
        p.quickStat = `TTP 1B: ${avgTtp.toFixed(2)}s avg`;
      }
    });

    const hitterList = sortByJersey(Object.values(hitterMap));
    hitterList.forEach(h => {
      // Check catcher pop times
      const cObs = catcherObs.filter(o => canonicalNameKey(o.catcher_name) === canonicalNameKey(h.name));
      if (cObs.length) {
        const pops = cObs.map(o => o.warmup_pop_time).filter(v => v != null);
        if (pops.length) h.quickStat = `Pop: ${Math.min(...pops).toFixed(2)}s best`;
      }
      // Speed rating from runner obs
      const rObs = runnerObs.filter(o => canonicalNameKey(o.runner_name) === canonicalNameKey(h.name));
      if (rObs.length) {
        const speed = rObs.map(o => o.speed_rating).filter(Boolean)[0];
        if (speed) h.speedRating = speed;
        const steals = rObs.reduce((a, o) => a + (o.steal_attempts || 0), 0);
        const succ   = rObs.reduce((a, o) => a + (o.steals_successful || 0), 0);
        if (steals > 0 && !h.quickStat) h.quickStat = `SB: ${succ}/${steals}`;
      }
    });

    return {
      pitchers: pitcherList,
      hitters: hitterList,
    };
  }, [pitcherObs, catcherObs, runnerObs, pitches, batterPitches]);

  // Total game count (rough) — exclude synthetic arsenal rows
  const gameCount = useMemo(() => {
    const ids = new Set([
      ...pitches.filter(p => !p._fromArsenal).map(p => p.game_id),
      ...batterPitches.map(p => p.game_id)
    ].filter(Boolean));
    return ids.size;
  }, [pitches, batterPitches]);

  const initials = team.name ? team.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.base, fontFamily: FONT, overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 240, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.edge}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top section */}
        <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${C.edge}` }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, fontFamily: FONT, padding: 0, marginBottom: 14 }}
          >
            ← {team.name}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {team.logo_url
              ? <img src={team.logo_url} alt={team.name} style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 5, border: `1px solid ${C.rim}`, background: C.raised }} />
              : (
                <div style={{ width: 40, height: 40, borderRadius: 5, background: C.raised, border: `1px solid ${C.rim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: C.gold, fontFamily: FONT }}>
                  {initials}
                </div>
              )
            }
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.white, letterSpacing: -0.3, fontFamily: FONT }}>{team.name}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 1, fontFamily: FONT }}>
                {[team.division && team.division + ' Division', gameCount > 0 && gameCount + ' games'].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        </div>

        {/* Print report buttons */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.edge}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => setShowRunnerReport(true)}
            style={{
              width: '100%', background: 'rgba(200,146,12,.1)', border: `1px solid rgba(200,146,12,.3)`,
              borderRadius: 5, padding: '7px 10px', fontSize: 11, fontWeight: 700, color: C.gold,
              fontFamily: FONT, cursor: 'pointer', textAlign: 'left', letterSpacing: 0.2,
            }}
          >
            🖨 Baserunner Report
          </button>
          <button
            onClick={() => setShowPitcherCatcherReport(true)}
            style={{
              width: '100%', background: 'rgba(200,146,12,.1)', border: `1px solid rgba(200,146,12,.3)`,
              borderRadius: 5, padding: '7px 10px', fontSize: 11, fontWeight: 700, color: C.gold,
              fontFamily: FONT, cursor: 'pointer', textAlign: 'left', letterSpacing: 0.2,
            }}
          >
            🖨 Pitcher & Catcher Report
          </button>
        </div>

        {/* Pitchers / Hitters toggle */}
        <div style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', background: C.raised, borderRadius: 6, border: `1px solid ${C.rim}`, overflow: 'hidden' }}>
            {[['pitchers', 'Pitchers'], ['hitters', 'Hitters']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSidebarTab(key)}
                style={{
                  flex: 1, background: sidebarTab === key ? C.gold : 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '8px 0', fontFamily: FONT, fontSize: 11, fontWeight: 800,
                  letterSpacing: 0.8, textTransform: 'uppercase',
                  color: sidebarTab === key ? C.base : C.muted,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main panel ── */}
      {activePlayer ? (
        <PlayerProfile
          player={activePlayer}
          team={team}
          onBack={() => setActivePlayer(null)}
          roster={sidebarTab === 'pitchers' ? pitchers : hitters}
          onNavigate={p => setActivePlayer(p)}
        />
      ) : (
        <div style={{ flex: 1, background: C.base, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Wide table — shown on desktop/TV, hidden below 768px via inline media is not possible,
              so we use a CSS class trick via the <style> tag already present */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 24, height: 24, border: `3px solid ${C.faint}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <>
              <div className="wide-roster-table" style={{ flex: 1, overflow: 'hidden' }}>
                <WideRosterTable
                  pitchers={sidebarTab === 'pitchers' ? pitchers : []}
                  hitters={sidebarTab === 'hitters' ? hitters : []}
                  activePlayer={activePlayer}
                  onSelect={p => { setActivePlayer(p); if (typeof onSelectPlayer === 'function') onSelectPlayer(p); }}
                  team={team}
                />
              </div>
              <div className="narrow-roster-empty" style={{ flex: 1, display: 'none', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: C.faint }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>⚾</div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT }}>Select a player</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 767px) {
          .wide-roster-table { display: none !important; }
          .narrow-roster-empty { display: flex !important; }
        }
        @media (min-width: 1920px) {
          .wide-roster-table table { font-size: 15px !important; }
          .wide-roster-table td { padding: 12px 18px !important; }
          .wide-roster-table th { padding: 13px 18px !important; font-size: 11px !important; }
        }
      `}</style>

      {showRunnerReport && (
        <BaserunnerReport team={team} onClose={() => setShowRunnerReport(false)} />
      )}
      {showPitcherCatcherReport && (
        <PitcherCatcherReport team={team} onClose={() => setShowPitcherCatcherReport(false)} />
      )}
    </div>
  );
}