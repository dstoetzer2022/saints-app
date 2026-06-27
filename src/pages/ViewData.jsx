import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/lib/AppContext';
import { NAVY, GOLD, BORDER, TINT, btn, btnSm, normalizePitchType, pitchColor } from '@/lib/ds';
import SectionTitle from '@/components/shared/SectionTitle';

const MAIN_TABS = ['PROFILES', 'REPORTS', 'DATA'];
const DATA_TABS = ['Trackman', 'Observations', 'Save/Load'];

// ── Shared table styles ──────────────────────────────────────
const TH = { borderBottom: `2px solid ${NAVY}`, fontWeight: 700, color: NAVY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, padding: '6px 9px', textAlign: 'left', whiteSpace: 'nowrap' };
const THR = { ...TH, textAlign: 'right' };
const TD = { borderBottom: '1px solid #eee', padding: '5px 9px', fontSize: 13, color: '#1a1a1a', whiteSpace: 'nowrap' };
const TDR = { ...TD, textAlign: 'right', fontFamily: 'monospace' };
function Empty() { return <p style={{ color: NAVY, fontStyle: 'italic', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>No data yet.</p>; }
function fmt(v, d = 1) { return v != null && !isNaN(v) ? Number(v).toFixed(d) : '—'; }
function rowBg(i) { return i % 2 === 0 ? '#fff' : '#faf9f5'; }

// ── Metric coloring ──────────────────────────────────────────
function metricStyle(metric, value) {
  if (value == null || isNaN(Number(value))) return {};
  const v = Number(value);
  if (metric === 'k_bb_pct') {
    const p = v * 100;
    if (p < 0) return { background: '#fee2e2', color: '#991b1b' };
    if (p < 5) return { background: '#fef9c3', color: '#854d0e' };
    if (p < 10) return { background: '#dcfce7', color: '#166534' };
    return { background: '#fef3c7', color: '#92400e' };
  }
  if (metric === 'whiff_pct') {
    if (v < 20) return { background: '#fee2e2', color: '#991b1b' };
    if (v < 27) return { background: '#fef9c3', color: '#854d0e' };
    if (v < 35) return { background: '#dcfce7', color: '#166534' };
    return { background: '#fef3c7', color: '#92400e' };
  }
  if (metric === 'zone_pct') {
    if (v < 42) return { background: '#fee2e2', color: '#991b1b' };
    if (v < 48) return { background: '#fef9c3', color: '#854d0e' };
    return { background: '#dcfce7', color: '#166534' };
  }
  return {};
}

// ── Pitcher card ─────────────────────────────────────────────
function PitcherCard({ pitcherName, pitches, obs }) {
  const [open, setOpen] = useState(false);

  const total = pitches.length;
  const topVelo = pitches.reduce((m, p) => Math.max(m, p.rel_speed || 0), 0);
  const hand = pitches[0]?.pitcher_hand || '';

  const arsenal = useMemo(() => {
    const map = {};
    pitches.forEach(p => {
      const pt = normalizePitchType(p.pitch_type || p.tagged_pitch_type);
      if (!map[pt]) map[pt] = [];
      map[pt].push(p);
    });
    return Object.entries(map).map(([pt, rows]) => {
      const velos = rows.map(r => r.rel_speed).filter(Boolean);
      const spins = rows.map(r => r.spin_rate).filter(Boolean);
      const ivbs = rows.map(r => r.induced_vert_break).filter(Boolean);
      const hbs = rows.map(r => r.horz_break).filter(Boolean);
      const relHts = rows.map(r => r.rel_height).filter(Boolean);
      const exts = rows.map(r => r.extension).filter(Boolean);
      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      return {
        pt, count: rows.length, usage: (rows.length / total * 100).toFixed(1),
        avgVelo: avg(velos), maxVelo: velos.length ? Math.max(...velos) : null,
        spin: avg(spins), ivb: avg(ivbs), hb: avg(hbs),
        relHt: avg(relHts), ext: avg(exts),
      };
    }).sort((a, b) => b.count - a.count);
  }, [pitches, total]);

  const pitcherObs = obs.find(o => o.pitcher_name === pitcherName);

  return (
    <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', cursor: 'pointer', background: open ? TINT : '#fff', transition: 'background 0.15s' }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, color: NAVY, flex: 1 }}>{pitcherName}</span>
        {hand && <span style={{ background: NAVY, color: GOLD, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{hand}</span>}
        <span style={{ fontSize: 12, color: '#888' }}>{total} pitches</span>
        <span style={{ fontSize: 12, color: '#888' }}>Top: {topVelo ? topVelo.toFixed(1) : '—'}</span>
        <span style={{ color: '#888', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px', background: TINT }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
              <thead>
                <tr>
                  {['Pitch Type', 'Count', 'Usage%', 'Avg Velo', 'Max Velo', 'Spin', 'iVB', 'HB', 'RelHt', 'Ext'].map((h, i) => (
                    <th key={h} style={i > 0 ? THR : TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {arsenal.map((row, i) => (
                  <tr key={row.pt} style={{ background: rowBg(i) }}>
                    <td style={TD}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: pitchColor(row.pt), display: 'inline-block' }} />
                        {row.pt}
                      </span>
                    </td>
                    <td style={TDR}>{row.count}</td>
                    <td style={TDR}>{row.usage}%</td>
                    <td style={TDR}>{fmt(row.avgVelo)}</td>
                    <td style={TDR}>{fmt(row.maxVelo)}</td>
                    <td style={TDR}>{fmt(row.spin, 0)}</td>
                    <td style={TDR}>{fmt(row.ivb)}</td>
                    <td style={TDR}>{fmt(row.hb)}</td>
                    <td style={TDR}>{fmt(row.relHt)}</td>
                    <td style={TDR}>{fmt(row.ext)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pitcherObs && (
            <div style={{ background: '#faf9f5', border: '1.5px solid #e0dbd0', borderRadius: 8, padding: '12px 16px', marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: NAVY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>Scout Notes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 12 }}>
                {pitcherObs.time_to_plate_1b != null && <span><b>Time/Plate R1:</b> {pitcherObs.time_to_plate_1b}s</span>}
                {pitcherObs.time_to_plate_2b != null && <span><b>Time/Plate R2:</b> {pitcherObs.time_to_plate_2b}s</span>}
                {pitcherObs.ucla_hold_start && <span><b>UCLA Hold:</b> {pitcherObs.ucla_hold_start}{pitcherObs.ucla_hold_end && pitcherObs.ucla_hold_end !== pitcherObs.ucla_hold_start ? `→${pitcherObs.ucla_hold_end}` : ''}</span>}
                {pitcherObs.has_slide_step != null && <span style={{ background: pitcherObs.has_slide_step ? '#dcfce7' : '#fee2e2', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>{pitcherObs.has_slide_step ? 'Slide Step' : 'No Slide Step'}</span>}
                {pitcherObs.pickoff_moves?.length > 0 && <span><b>Pickoff:</b> {pitcherObs.pickoff_moves.join(', ')}</span>}
                {pitcherObs.notes && <span style={{ color: '#444', fontStyle: 'italic' }}>{pitcherObs.notes}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PROFILES TAB ─────────────────────────────────────────────
function ProfilesTab({ pitches, pitcherObs }) {
  const pitcherMap = useMemo(() => {
    const m = {};
    pitches.forEach(p => {
      if (!p.pitcher_name) return;
      if (!m[p.pitcher_name]) m[p.pitcher_name] = [];
      m[p.pitcher_name].push(p);
    });
    return m;
  }, [pitches]);

  const names = Object.keys(pitcherMap).sort();
  if (!names.length) return <Empty />;
  return (
    <div>
      {names.map(name => (
        <PitcherCard key={name} pitcherName={name} pitches={pitcherMap[name]} obs={pitcherObs} />
      ))}
    </div>
  );
}

// ── REPORTS TAB ──────────────────────────────────────────────
function ReportsTab({ _activeTeam, pitches, pitcherObs, hitterObs, catcherObs, runnerObs }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }} className="no-print">
        <button onClick={() => window.print()} style={{ ...btn('navy') }}>Print / PDF</button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionTitle>Opponent Pitchers</SectionTitle>
        {pitches.length === 0 ? <Empty /> : (
          <ProfilesTab pitches={pitches} pitcherObs={pitcherObs} />
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionTitle>Hitter Observations</SectionTitle>
        {hitterObs.length === 0 ? <Empty /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Hitter','Team','Hand','AB','XBH','Approach','Bat Spd','Contact','Power','Notes'].map((h, i) => (
                  <th key={h} style={i > 1 ? THR : TH}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{hitterObs.map((r, i) => (
                <tr key={r.id} style={{ background: rowBg(i) }}>
                  <td style={TD}>{r.hitter_name}</td>
                  <td style={TD}>{r.hitter_team}</td>
                  <td style={TDR}>{r.hitter_hand || '—'}</td>
                  <td style={TDR}>{r.ab_count ?? '—'}</td>
                  <td style={TDR}>{r.xbh_count ?? '—'}</td>
                  <td style={TD}>{r.approach || '—'}</td>
                  <td style={TD}>{r.bat_speed_grade || '—'}</td>
                  <td style={TD}>{r.contact_grade || '—'}</td>
                  <td style={TD}>{r.power_grade || '—'}</td>
                  <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionTitle>Catcher Observations</SectionTitle>
        {catcherObs.length === 0 ? <Empty /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Catcher','Team','Warmup Pop','Steal Attempts','Notes'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{catcherObs.map((r, i) => {
                const att = r.steal_attempts || [];
                const caught = att.filter(a => a.result === 'out').length;
                return <tr key={r.id} style={{ background: rowBg(i) }}>
                  <td style={TD}>{r.catcher_name}</td><td style={TD}>{r.catcher_team}</td>
                  <td style={TDR}>{r.warmup_pop_time != null ? r.warmup_pop_time + 's' : '—'}</td>
                  <td style={TD}>{att.length ? `${caught}/${att.length} caught` : '—'}</td>
                  <td style={TD}>{r.notes || '—'}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Baserunner Observations</SectionTitle>
        {runnerObs.length === 0 ? <Empty /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Runner','Team','Speed','Aggression','Pickoffs','Dirt Adv','Notes'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{runnerObs.map((r, i) => (
                <tr key={r.id} style={{ background: rowBg(i) }}>
                  <td style={TD}>{r.runner_name}</td><td style={TD}>{r.runner_team}</td>
                  <td style={TD}>{r.speed_rating || '—'}</td><td style={TD}>{r.aggression_rating || '—'}</td>
                  <td style={TDR}>{r.pickoff_attempts ?? '—'}</td><td style={TDR}>{r.dirt_ball_advances ?? '—'}</td>
                  <td style={TD}>{r.notes || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DATA TAB ─────────────────────────────────────────────────
const PAGE_SIZE = 50;

function TrackmanSubTab({ pitches }) {
  const [page, setPage] = useState(0);
  const total = pitches.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const slice = pitches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (!total) return <Empty />;
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>
            {['Pitcher','Batter','Type','Velo','Spin','HB','iVB','Plate H','Plate Side','Call','Result'].map((h, i) => (
              <th key={h} style={i > 1 ? THR : TH}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{slice.map((r, i) => (
            <tr key={r.id || i} style={{ background: rowBg(i) }}>
              <td style={TD}>{r.pitcher_name}</td>
              <td style={TD}>{r.batter_name}</td>
              <td style={TD}>{normalizePitchType(r.pitch_type || r.tagged_pitch_type)}</td>
              <td style={TDR}>{fmt(r.rel_speed)}</td>
              <td style={TDR}>{fmt(r.spin_rate, 0)}</td>
              <td style={TDR}>{fmt(r.horz_break)}</td>
              <td style={TDR}>{fmt(r.induced_vert_break)}</td>
              <td style={TDR}>{fmt(r.plate_loc_height)}</td>
              <td style={TDR}>{fmt(r.plate_loc_side)}</td>
              <td style={TD}>{r.pitch_call || '—'}</td>
              <td style={TD}>{r.play_result || '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13 }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ ...btnSm('navy'), opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
          <span style={{ color: NAVY }}>Page {page + 1} of {pages} ({total} rows)</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} style={{ ...btnSm('navy'), opacity: page >= pages - 1 ? 0.4 : 1 }}>Next →</button>
        </div>
      )}
    </div>
  );
}

function ObsSubTab({ pitcherObs, catcherObs, runnerObs, onRefresh }) {
  async function deleteObs(entity, id) {
    await base44.entities[entity].delete(id);
    onRefresh();
  }
  const delBtn = (entity, id) => (
    <button onClick={() => deleteObs(entity, id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0, fontWeight: 700 }}>×</button>
  );

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Pitchers */}
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: NAVY, marginBottom: 6, textTransform: 'uppercase' }}>Pitcher Obs</div>
        {!pitcherObs.length ? <Empty /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['Name','R1','UCLA','Notes',''].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{pitcherObs.map((r, i) => (
              <tr key={r.id} style={{ background: rowBg(i) }}>
                <td style={TD}>{r.pitcher_name}</td>
                <td style={TDR}>{r.time_to_plate_1b != null ? r.time_to_plate_1b + 's' : '—'}</td>
                <td style={TD}>{r.ucla_hold_start || '—'}</td>
                <td style={{ ...TD, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes || '—'}</td>
                <td style={TD}>{delBtn('PitcherObservation', r.id)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {/* Catchers */}
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: NAVY, marginBottom: 6, textTransform: 'uppercase' }}>Catcher Obs</div>
        {!catcherObs.length ? <Empty /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['Name','Pop','Attempts',''].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{catcherObs.map((r, i) => (
              <tr key={r.id} style={{ background: rowBg(i) }}>
                <td style={TD}>{r.catcher_name}</td>
                <td style={TDR}>{r.warmup_pop_time != null ? r.warmup_pop_time + 's' : '—'}</td>
                <td style={TDR}>{(r.steal_attempts || []).length}</td>
                <td style={TD}>{delBtn('CatcherObservation', r.id)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {/* Runners */}
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: NAVY, marginBottom: 6, textTransform: 'uppercase' }}>Baserunner Obs</div>
        {!runnerObs.length ? <Empty /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['Name','Speed','Aggr','Pickoffs',''].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{runnerObs.map((r, i) => (
              <tr key={r.id} style={{ background: rowBg(i) }}>
                <td style={TD}>{r.runner_name}</td>
                <td style={TD}>{r.speed_rating || '—'}</td>
                <td style={TD}>{r.aggression_rating || '—'}</td>
                <td style={TDR}>{r.pickoff_attempts ?? '—'}</td>
                <td style={TD}>{delBtn('BaserunnerObservation', r.id)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SaveLoadSubTab({ activeTeam, pitches, pitcherObs, catcherObs, runnerObs, onClear }) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  function exportJSON() {
    const data = { pitches, pitcherObs, catcherObs, runnerObs, exportedAt: new Date().toISOString(), team: activeTeam?.code };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(activeTeam?.code || 'team').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function clearData() {
    setClearing(true);
    await Promise.all([
      ...pitches.map(r => base44.entities.TrackmanPitch.delete(r.id)),
      ...pitcherObs.map(r => base44.entities.PitcherObservation.delete(r.id)),
      ...catcherObs.map(r => base44.entities.CatcherObservation.delete(r.id)),
      ...runnerObs.map(r => base44.entities.BaserunnerObservation.delete(r.id)),
    ]);
    setClearing(false);
    setConfirming(false);
    onClear();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
      <button onClick={exportJSON} style={{ ...btn('navy') }}>Export JSON</button>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} style={{ ...btn('navy'), background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}>
          Clear This Team's Data
        </button>
      ) : (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: 14 }}>
          <p style={{ fontWeight: 700, color: '#991b1b', marginBottom: 10 }}>Are you sure? This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={clearData} disabled={clearing} style={{ ...btnSm('navy'), background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}>
              {clearing ? 'Clearing…' : 'Yes, Delete All'}
            </button>
            <button onClick={() => setConfirming(false)} style={{ ...btnSm('navy') }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────
export default function ViewData() {
  const navigate = useNavigate();
  const { teams, activeTeam, setActiveTeam } = useApp();
  const [mainTab, setMainTab] = useState('PROFILES');
  const [dataTab, setDataTab] = useState('Trackman');
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [pitches, setPitches] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [hitterObs, setHitterObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    if (!activeTeam) return;
    setLoading(true);
    const teamName = activeTeam.name;
    const [g, p, po, ho, co, ro] = await Promise.all([
      base44.entities.Game.list('-date', 100),
      selectedGame
        ? base44.entities.TrackmanPitch.filter({ game_id: selectedGame }, 'pitcher_name', 500)
        : base44.entities.TrackmanPitch.filter({ pitcher_team: teamName }, 'pitcher_name', 500),
      base44.entities.PitcherObservation.filter({ pitcher_team: activeTeam.code }, 'pitcher_name', 200),
      base44.entities.HitterObservation.list('hitter_name', 200),
      base44.entities.CatcherObservation.list('catcher_name', 100),
      base44.entities.BaserunnerObservation.list('runner_name', 100),
    ]);
    setGames(g);
    setPitches(p);
    setPitcherObs(po);
    setHitterObs(ho);
    setCatcherObs(co);
    setRunnerObs(ro);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [activeTeam?.id, selectedGame]);

  const teamGames = games.filter(g =>
    g.home_team_code === activeTeam?.code || g.away_team_code === activeTeam?.code
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <button onClick={() => navigate('/')} style={{ ...btnSm('navy'), marginBottom: 24 }}>← Home</button>
      <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: NAVY, margin: 0 }}>View / Export</h2>
      </div>

      {/* Team chip strip */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0', overflowX: 'auto' }}>
        {teams.map(t => {
          const active = t.id === activeTeam?.id;
          return (
            <button key={t.id} onClick={() => { setActiveTeam(t); setSelectedGame(''); }}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: `1.5px solid ${active ? NAVY : BORDER}`,
                background: active ? NAVY : '#fff',
                color: active ? GOLD : '#444',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Game scope */}
      <div style={{ marginBottom: 20 }}>
        <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)}
          style={{ border: `1.5px solid ${BORDER}`, borderRadius: 5, background: '#fff', color: NAVY, fontWeight: 600, fontSize: 13, padding: '6px 10px', fontFamily: "'Archivo', sans-serif" }}>
          <option value="">All Games (Season)</option>
          {teamGames.map(g => (
            <option key={g.id} value={g.id}>{g.date} — {g.away_team_code} vs {g.home_team_code}</option>
          ))}
        </select>
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 24, gap: 4 }}>
        {MAIN_TABS.map(tab => {
          const active = mainTab === tab;
          return (
            <button key={tab} onClick={() => setMainTab(tab)} style={{
              padding: '8px 18px', background: 'none', border: 'none',
              borderBottom: active ? `3px solid ${GOLD}` : '3px solid transparent',
              color: active ? NAVY : '#888',
              fontWeight: active ? 700 : 500,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: "'Archivo', sans-serif",
              marginBottom: -1,
            }}>{tab}</button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${BORDER}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {mainTab === 'PROFILES' && <ProfilesTab pitches={pitches} pitcherObs={pitcherObs} />}
          {mainTab === 'REPORTS' && <ReportsTab activeTeam={activeTeam} pitches={pitches} pitcherObs={pitcherObs} hitterObs={hitterObs} catcherObs={catcherObs} runnerObs={runnerObs} />}
          {mainTab === 'DATA' && (
            <div>
              <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
                {DATA_TABS.map(tab => {
                  const active = dataTab === tab;
                  return (
                    <button key={tab} onClick={() => setDataTab(tab)} style={{
                      padding: '6px 14px', background: 'none', border: 'none',
                      borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
                      color: active ? NAVY : '#888',
                      fontWeight: active ? 700 : 500,
                      fontSize: 12, cursor: 'pointer', fontFamily: "'Archivo', sans-serif",
                      marginBottom: -1,
                    }}>{tab}</button>
                  );
                })}
              </div>
              {dataTab === 'Trackman' && <TrackmanSubTab pitches={pitches} />}
              {dataTab === 'Observations' && <ObsSubTab pitcherObs={pitcherObs} catcherObs={catcherObs} runnerObs={runnerObs} onRefresh={loadData} />}
              {dataTab === 'Save/Load' && <SaveLoadSubTab activeTeam={activeTeam} pitches={pitches} pitcherObs={pitcherObs} catcherObs={catcherObs} runnerObs={runnerObs} onClear={loadData} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}