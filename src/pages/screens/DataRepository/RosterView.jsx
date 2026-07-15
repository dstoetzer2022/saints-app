import React, { useState, useEffect, useMemo } from 'react';
import reportError from '@/lib/reportError';
import { cldImg } from '@/lib/cloudinaryImg';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { normalizeName, canonicalNameKey, normalizeHandLabel, splitDisplayName } from '@/lib/statsUtils';
import PlayerProfile from './PlayerProfile';
import BaserunnerReport from '@/components/reports/BaserunnerReport';
import PitcherCatcherReport from '@/components/reports/PitcherCatcherReport';
import BatchPrintReport from '@/components/reports/BatchPrintReport';
import TeamReportBuilder from '@/components/reports/TeamReportBuilder';
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
    ? (player.hand ? (player.hand[0]?.toUpperCase() === 'L' ? 'LHP' : 'RHP') : '')
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

// Inline-editable jersey number cell. Click to edit, Enter/blur to save.
// Writes to the Player entity — the canonical, editable source of jersey numbers.
function JerseyCell({ value, onSave, color }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = React.useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value || '')) onSave(trimmed);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
        }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 44, fontSize: 18, fontWeight: 900, color: C.white, fontFamily: FONT,
          background: 'rgba(255,255,255,0.07)', border: `1.5px solid ${C.gold}`, borderRadius: 5,
          padding: '2px 6px', outline: 'none', fontVariantNumeric: 'tabular-nums',
        }}
      />
    );
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      style={{ fontSize: 18, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, cursor: 'pointer' }}
      title="Click to edit"
    >
      {value || '—'}
    </span>
  );
}

// ── Wide roster table for desktop/TV ──────────────────────────
// selected: Set of canonical name keys currently checked. onToggle(name):
// flip one player. onToggleAllVisible(names, checked): header checkbox —
// bulk-set every currently visible row (this section's pitchers OR
// hitters, whichever tab is open) without touching selections made on the
// other tab, since selection is tracked globally by canonical key.
function WideRosterTable({ pitchers, hitters, activePlayer, onSelect, team, onSaveJersey, selected, onToggle, onToggleAllVisible }) {
  const accentColor = team?.primary_color || C.gold;
  const isPitcherView = pitchers.length > 0;
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
  const headers = isPitcherView
    ? ['#', 'Name', 'Hand', 'School', 'Time to Plate']
    : ['#', 'Name', 'Hand', 'School', 'Speed', 'Aggressiveness'];
  const colCount = headers.length + 1; // +1 for the checkbox column

  const visibleKeys = allPlayers.map(p => canonicalNameKey(p.name));
  const allVisibleChecked = visibleKeys.length > 0 && visibleKeys.every(k => selected.has(k));

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, tableLayout: 'fixed', minWidth: 700 }}>
        <colgroup>
          <col style={{ width: 34 }} />
          {isPitcherView ? (
            <>
              <col style={{ width: '6%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '28%' }} />
            </>
          ) : (
            <>
              <col style={{ width: '6%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
            </>
          )}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 34 }}>
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={e => onToggleAllVisible(visibleKeys, e.target.checked)}
                style={{ width: 14, height: 14, accentColor: C.gold, cursor: 'pointer', display: 'block' }}
              />
            </th>
            {headers.map(h => (
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
                  <td colSpan={colCount} style={{ padding: '8px 14px 4px', fontSize: 9, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gold, background: C.base, borderBottom: `1px solid ${C.edge}` }}>
                    {section} &nbsp;<span style={{ color: C.faint }}>{rows.length}</span>
                  </td>
                </tr>
                {rows.map((p, i) => {
                  const isActive = activePlayer?.name === p.name;
                  const isPitcher = p.role === 'Pitcher';
                  const posHand = isPitcher
                    ? (p.hand ? (p.hand[0]?.toUpperCase() === 'L' ? 'LHP' : 'RHP') : '—')
                    : (p.hand || '—');
                  const keyStat = p.quickStat || '—';
                  const rowKey = canonicalNameKey(p.name);
                  const isChecked = selected.has(rowKey);

                  return (
                    <tr
                      key={p.name}
                      onClick={() => onSelect(p)}
                      style={{
                        background: isActive ? C.raised : isChecked ? 'rgba(200,146,12,.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)',
                        borderLeft: isActive ? `3px solid ${C.gold}` : isChecked ? `3px solid ${C.gold}` : '3px solid transparent',
                        cursor: 'pointer',
                        borderBottom: `1px solid rgba(255,255,255,0.03)`,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.raised; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isChecked ? 'rgba(200,146,12,.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)'; }}
                    >
                      <td style={{ padding: '9px 14px' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggle(rowKey)}
                          style={{ width: 14, height: 14, accentColor: C.gold, cursor: 'pointer', display: 'block' }}
                        />
                      </td>
                      <td style={{ padding: '9px 14px', fontWeight: 900 }}>
                        <JerseyCell
                          value={p.jerseyNumber}
                          color={isActive ? C.gold : C.white}
                          onSave={val => onSaveJersey(p.name, val)}
                        />
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? C.white : C.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: C.muted }}>{posHand}</td>
                      <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: C.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.school || '—'}</td>
                      {isPitcherView ? (
                        <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: C.cream }}>{keyStat}</td>
                      ) : (
                        <>
                          <td style={{ padding: '9px 14px' }}>
                            {p.speedRating && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: p.speedRating === 'fast' ? C.green : p.speedRating === 'slow' ? C.red : C.amber, textTransform: 'capitalize' }}>
                                {p.speedRating}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '9px 14px' }}>
                            {p.aggressionRating && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: p.aggressionRating === 'aggressive' ? C.green : p.aggressionRating === 'passive' ? C.red : C.amber, textTransform: 'capitalize' }}>
                                {p.aggressionRating}
                              </span>
                            )}
                          </td>
                        </>
                      )}
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
  const sidebarTab = initialTab === 'hitters' ? 'hitters' : 'pitchers';
  // ── ?player= deep link (Phase 2.1) ────────────────────────────────
  // The URL is the source of truth for the open profile: selecting a
  // player pushes ?player=<name>, back/forward and shared links restore
  // it once the roster lists have loaded. QR codes on printed reports
  // can point straight at a profile.
  const location = useLocation();
  const navigate = useNavigate();
  const playerParam = useMemo(() => new URLSearchParams(location.search).get('player'), [location.search]);
  const [showRunnerReport, setShowRunnerReport] = useState(false);
  const [showPitcherCatcherReport, setShowPitcherCatcherReport] = useState(false);
  const [playerRoster, setPlayerRoster] = useState([]);
  // Batch print selection — canonical name keys, tracked globally across the
  // Pitchers/Hitters tab toggle so a coach can check arms on one tab, bats
  // on the other, then print one combined PDF (pitchers first, then hitters).
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showTeamReport, setShowTeamReport] = useState(false);
  // ── ?report=1 deep link ────────────────────────────────────────────
  // TeamHub's "Team Report" card routes here (pitchers tab, which already
  // loads everything TeamReportBuilder needs) with ?report=1 instead of
  // duplicating this screen's roster/pitch data-loading in TeamHub itself.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('report') === '1') {
      setShowTeamReport(true);
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      fetchAllFiltered(base44.entities.Player, { team: teamName }, 'name'),
    ]).then(([po, co, ro, teamArsenal, bp, tp, playerRosterRows]) => {
      setPitcherObs(po);
      setCatcherObs(co);
      setRunnerObs(ro);
      setPlayerRoster(playerRosterRows || []);

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
    }).catch(err => { setLoading(false); reportError(err, 'Could not load roster data'); });
  }, [teamName]);

  const { pitchers, hitters } = useMemo(() => {
    const pitcherMap = {};
    pitcherObs.forEach(o => {
      if (!o.pitcher_name) return;
      const key = canonicalNameKey(o.pitcher_name);
      if (!pitcherMap[key]) {
        const norm = normalizeName(o.pitcher_name);
        const { firstName, lastName } = splitDisplayName(norm);
        pitcherMap[key] = {
          name: norm,
          firstName,
          lastName,
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
      const { firstName, lastName } = splitDisplayName(normalized);
      if (!pitcherMap[key]) {
        pitcherMap[key] = {
          name: normalized,
          firstName,
          lastName,
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
    const trackmanHandsSeen = {}; // key -> Set of normalized hands ('Right'/'Left') seen in Trackman rows
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
      // NOTE: previously `if (pitcherMap[key]) return;` here — that silently
      // dropped every two-way player's hitting-side data the moment they had
      // ANY pitching appearance, so they could never show up on the Hitters
      // tab. pitcherMap and hitterMap are independent lists rendered on
      // separate tabs (no cross-dedupe below), so a two-way player now gets
      // one row in each — a Pitcher entry AND a Hitter entry, same as a
      // real two-way roster spot.
      if (!positionsMap[key]) positionsMap[key] = new Set();
      positionsMap[key].add('C');
      const { firstName, lastName } = splitDisplayName(normalized);
      if (!hitterMap[key]) {
        hitterMap[key] = {
          name: normalized,
          firstName,
          lastName,
          role: 'Hitter',
          jerseyNumber: o.jersey_number || '',
          hand: normalizeHandLabel(o.bats),
          hasScout: true,
          hasTrackman: false,
        };
      } else {
        hitterMap[key].hasScout = true;
        if (!hitterMap[key].jerseyNumber && o.jersey_number) hitterMap[key].jerseyNumber = o.jersey_number;
        if (!hitterMap[key].hand && o.bats) hitterMap[key].hand = normalizeHandLabel(o.bats);
      }
    });

    runnerObs.forEach(o => {
      if (!o.runner_name) return;
      const normalized = normalizeName(o.runner_name);
      const key = canonicalNameKey(o.runner_name);
      const { firstName, lastName } = splitDisplayName(normalized);
      if (!hitterMap[key]) {
        hitterMap[key] = {
          name: normalized,
          firstName,
          lastName,
          role: 'Hitter',
          jerseyNumber: o.jersey_number || '',
          hand: normalizeHandLabel(o.bats),
          hasScout: true,
          hasTrackman: false,
        };
      } else {
        hitterMap[key].hasScout = true;
        if (!hitterMap[key].jerseyNumber && o.jersey_number) hitterMap[key].jerseyNumber = o.jersey_number;
        if (!hitterMap[key].hand && o.bats) hitterMap[key].hand = normalizeHandLabel(o.bats);
      }
    });

    batterPitches.forEach(p => {
      if (!p.batter_name) return;
      const normalized = normalizeName(p.batter_name);
      const key = canonicalNameKey(p.batter_name);
      const { firstName, lastName } = splitDisplayName(normalized);
      const normalizedHand = normalizeHandLabel(p.batter_hand);
      if (normalizedHand === 'Right' || normalizedHand === 'Left') {
        if (!trackmanHandsSeen[key]) trackmanHandsSeen[key] = new Set();
        trackmanHandsSeen[key].add(normalizedHand);
      }
      if (!hitterMap[key]) {
        hitterMap[key] = {
          name: normalized,
          firstName,
          lastName,
          role: 'Hitter',
          jerseyNumber: '',
          hand: normalizedHand,
          hasScout: false,
          hasTrackman: true,
        };
      } else {
        hitterMap[key].hasTrackman = true;
        if (!hitterMap[key].hand && p.batter_hand) hitterMap[key].hand = normalizedHand;
      }
    });

    // A hitter with BOTH Right and Left recorded across their Trackman rows is a
    // switch hitter — override whichever single side happened to be set above.
    Object.entries(trackmanHandsSeen).forEach(([key, hands]) => {
      if (hands.has('Right') && hands.has('Left') && hitterMap[key]) {
        hitterMap[key].hand = 'Switch';
      }
    });

    Object.entries(hitterMap).forEach(([key, h]) => {
      h.positions = positionsMap[key] ? [...positionsMap[key]] : [];
    });

    // Player entity is the canonical, editable source for jersey numbers (via the
    // roster editor below) — it overrides whatever scouting rows happened to record.
    playerRoster.forEach(pl => {
      if (!pl.name) return;
      const key = canonicalNameKey(pl.name);
      if (pl.jersey_number) {
        if (pitcherMap[key]) pitcherMap[key].jerseyNumber = pl.jersey_number;
        if (hitterMap[key]) hitterMap[key].jerseyNumber = pl.jersey_number;
      }
      if (pl.school) {
        if (pitcherMap[key]) pitcherMap[key].school = pl.school;
        if (hitterMap[key]) hitterMap[key].school = pl.school;
      }
      // Manual "bats" override on the Player record takes final precedence over
      // whatever the observation/Trackman-derived hand (including switch-hitter
      // auto-detection) resolved to — needed when Trackman mislabels a hand on
      // a mis-configured session, which would otherwise look like a switch hitter.
      if (pl.bats && hitterMap[key]) {
        hitterMap[key].hand = normalizeHandLabel(pl.bats);
      }
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
      // Speed / aggressiveness rating from runner obs
      const rObs = runnerObs.filter(o => canonicalNameKey(o.runner_name) === canonicalNameKey(h.name));
      if (rObs.length) {
        const speed = rObs.map(o => o.speed_rating).filter(Boolean)[0];
        if (speed) h.speedRating = speed;
        const aggression = rObs.map(o => o.aggression_rating).filter(Boolean)[0];
        if (aggression) h.aggressionRating = aggression;
        const steals = rObs.reduce((a, o) => a + (o.steal_attempts || 0), 0);
        const succ   = rObs.reduce((a, o) => a + (o.steals_successful || 0), 0);
        if (steals > 0 && !h.quickStat) h.quickStat = `SB: ${succ}/${steals}`;
      }
    });

    return {
      pitchers: pitcherList,
      hitters: hitterList,
    };
  }, [pitcherObs, catcherObs, runnerObs, pitches, batterPitches, playerRoster]);

  // URL → open profile: resolve ?player= against both lists (covers two-way
  // players regardless of the active tab). Clears when the param is removed.
  useEffect(() => {
    if (!playerParam) { setActivePlayer(null); return; }
    const found = [...pitchers, ...hitters].find(p => p.name === playerParam);
    if (found) setActivePlayer(found);
  }, [playerParam, pitchers, hitters]);

  // Total game count (rough) — exclude synthetic arsenal rows
  const gameCount = useMemo(() => {
    const ids = new Set([
      ...pitches.filter(p => !p._fromArsenal).map(p => p.game_id),
      ...batterPitches.map(p => p.game_id)
    ].filter(Boolean));
    return ids.size;
  }, [pitches, batterPitches]);

  const initials = team.name ? team.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  const saveJerseyNumber = async (playerName, value) => {
    try {
      const existing = await base44.entities.Player.filter({ name: playerName, team: teamName }, undefined, 1);
      if (existing?.length) {
        await base44.entities.Player.update(existing[0].id, { jersey_number: value });
      } else {
        await base44.entities.Player.create({ name: playerName, team: teamName, jersey_number: value });
      }
      setPlayerRoster(prev => {
        const idx = prev.findIndex(pl => canonicalNameKey(pl.name) === canonicalNameKey(playerName));
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], jersey_number: value };
          return copy;
        }
        return [...prev, { name: playerName, team: teamName, jersey_number: value }];
      });
    } catch {
      // Swallow — the input reverts to its prior value on next render if the write failed.
    }
  };

  const reportLabel = sidebarTab === 'hitters' ? 'Baserunner Report' : 'Pitcher & Catcher Report';
  const openReport = () => sidebarTab === 'hitters' ? setShowRunnerReport(true) : setShowPitcherCatcherReport(true);

  const toggleSelected = key => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleAllVisible = (keys, checked) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => { if (checked) next.add(k); else next.delete(k); });
      return next;
    });
  };
  // Resolve selected canonical keys back to full player rows across BOTH
  // lists (not just the currently visible tab) so a selection made on the
  // other tab survives the switch.
  const selectedPlayers = useMemo(() => {
    const all = [...pitchers, ...hitters];
    return all.filter(p => selectedKeys.has(canonicalNameKey(p.name)));
  }, [pitchers, hitters, selectedKeys]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.base, fontFamily: FONT, overflow: 'hidden' }}>

      {/* ── Main panel ── */}
      {activePlayer ? (
        /* Profile view is edge-to-edge — the rail collapses; PlayerProfile owns its own back control */
        <PlayerProfile
          player={activePlayer}
          team={team}
          onBack={() => navigate(location.pathname)}
          roster={sidebarTab === 'pitchers' ? pitchers : hitters}
          onNavigate={p => navigate(`${location.pathname}?player=${encodeURIComponent(p.name)}`, { replace: true })}
        />
      ) : (
        <>
          {/* ── Icon rail (list view only) ── */}
          <div style={{ width: 48, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.edge}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '14px 0', overflow: 'hidden' }}>
            <button
              onClick={onBack}
              title={`Back to ${team.name}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: FONT, fontSize: 18, lineHeight: 1, padding: 4 }}
            >
              ←
            </button>
            {team.logo_url
              ? <img src={cldImg(team.logo_url, 64)} alt={team.name} title={team.name} style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 5, border: `1px solid ${C.rim}`, background: C.raised }} />
              : (
                <div title={team.name} style={{ width: 32, height: 32, borderRadius: 5, background: C.raised, border: `1px solid ${C.rim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: C.gold, fontFamily: FONT }}>
                  {initials}
                </div>
              )
            }
            <button
              onClick={openReport}
              title={reportLabel}
              style={{ background: 'rgba(200,146,12,.1)', border: `1px solid rgba(200,146,12,.3)`, borderRadius: 5, cursor: 'pointer', color: C.gold, fontFamily: FONT, fontSize: 15, lineHeight: 1, padding: '6px 7px' }}
            >
              🖨
            </button>
          </div>

          {/* ── Roster panel ── */}
          <div style={{ flex: 1, background: C.base, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header strip — team identity (once) + the report relevant to this screen */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.edge}`, background: C.surface }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: C.white, letterSpacing: -0.3, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 1, fontFamily: FONT }}>
                  {[team.division && team.division + ' Division', gameCount > 0 && gameCount + ' games'].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="print-selected-btn" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {selectedPlayers.length > 0 && (
                  <button
                    onClick={() => setShowBatchConfirm(true)}
                    style={{
                      background: C.gold, border: `1px solid ${C.gold}`,
                      borderRadius: 5, padding: '7px 12px', fontSize: 11, fontWeight: 700, color: '#1a1a1a',
                      fontFamily: FONT, cursor: 'pointer', letterSpacing: 0.2, whiteSpace: 'nowrap',
                    }}
                  >
                    🖨 Print Selected ({selectedPlayers.length})
                  </button>
                )}
                <button
                  onClick={openReport}
                  style={{
                    flexShrink: 0, background: 'rgba(200,146,12,.1)', border: `1px solid rgba(200,146,12,.3)`,
                    borderRadius: 5, padding: '7px 12px', fontSize: 11, fontWeight: 700, color: C.gold,
                    fontFamily: FONT, cursor: 'pointer', letterSpacing: 0.2, whiteSpace: 'nowrap',
                  }}
                >
                  🖨 {reportLabel}
                </button>
              </div>
            </div>

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
                    onSelect={p => { navigate(`${location.pathname}?player=${encodeURIComponent(p.name)}`); if (typeof onSelectPlayer === 'function') onSelectPlayer(p); }}
                    team={team}
                    onSaveJersey={saveJerseyNumber}
                    selected={selectedKeys}
                    onToggle={toggleSelected}
                    onToggleAllVisible={toggleAllVisible}
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
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 767px) {
          .wide-roster-table { display: none !important; }
          .narrow-roster-empty { display: flex !important; }
          .print-selected-btn { display: none !important; }
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

      {showBatchConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowBatchConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#2b2e32', borderRadius: 8, padding: '18px 20px', maxWidth: 480, width: '90%', fontFamily: FONT }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 10 }}>
              Print reports for {selectedPlayers.length} player{selectedPlayers.length === 1 ? '' : 's'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 260, overflowY: 'auto' }}>
              {[...selectedPlayers].sort((a, b) => (a.role === 'Pitcher' ? 0 : 1) - (b.role === 'Pitcher' ? 0 : 1)).map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.04)', borderRadius: 5, padding: '7px 10px', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.cream }}>{p.jerseyNumber ? `#${p.jerseyNumber} ` : ''}{p.name}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.muted }}>{p.role}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowBatchConfirm(false)}
                style={{ background: 'rgba(200,146,12,.1)', border: `1px solid rgba(200,146,12,.3)`, color: C.gold, borderRadius: 5, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowBatchConfirm(false); setShowBatchPrint(true); }}
                style={{ background: C.gold, border: `1px solid ${C.gold}`, color: '#1a1a1a', borderRadius: 5, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >
                Open Print Preview →
              </button>
            </div>
          </div>
        </div>
      )}

      <BatchPrintReport
        open={showBatchPrint}
        onClose={() => setShowBatchPrint(false)}
        players={selectedPlayers}
        team={team}
        pitches={pitches}
        batterPitches={batterPitches}
      />

      <TeamReportBuilder
        open={showTeamReport}
        onClose={() => setShowTeamReport(false)}
        team={team}
        pitchers={pitchers}
        hitters={hitters}
        pitches={pitches}
        batterPitches={batterPitches}
      />
    </div>
  );
}