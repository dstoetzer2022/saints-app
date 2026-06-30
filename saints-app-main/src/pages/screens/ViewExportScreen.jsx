import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, BORDER, TINT, normalizePitch, pitchColor, fmt, avg } from '@/lib/ds';
import SectionTitle from '@/components/shared/SectionTitle';
import GameReport from '@/pages/screens/GameReport';
import SeasonTendencies from '@/pages/screens/SeasonTendencies';

const PAGE_SIZE = 50;
const MAIN_TABS = ['PROFILES', 'REPORTS', 'TENDENCIES', 'DATA'];
const DATA_TABS = ['Trackman', 'Observations', 'Save/Load'];

// ── Shared styles ──────────────────────────────────────────
const TH = { padding: '6px 10px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, color: NAVY, textAlign: 'left', borderBottom: `2px solid ${NAVY}`, whiteSpace: 'nowrap' };
const THR = { ...TH, textAlign: 'right' };
const TD = { padding: '5px 10px', fontSize: 13, borderBottom: '1px solid #eee', whiteSpace: 'nowrap' };
const TDR = { ...TD, textAlign: 'right', fontFamily: 'monospace' };
const rowBg = i => i % 2 === 0 ? '#fff' : TINT;
const tabStyle = (active) => ({
  fontSize: 13.5, fontWeight: 700, padding: '10px 16px', border: 'none',
  borderBottom: active ? `3px solid ${GOLD}` : '3px solid transparent',
  background: 'transparent', color: active ? NAVY : '#888', cursor: 'pointer', marginBottom: -1,
  transition: 'all 0.12s', fontFamily: "'Archivo', sans-serif",
});
const Empty = () => <p style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: 32 }}>No data.</p>;

// ── Arsenal builder ────────────────────────────────────────
function buildArsenal(pitches) {
  const total = pitches.length;
  const map = {};
  pitches.forEach(p => {
    const pt = normalizePitch(p.pitch_type || p.tagged_pitch_type);
    if (!map[pt]) map[pt] = [];
    map[pt].push(p);
  });
  return Object.entries(map)
    .map(([pt, rows]) => ({
      pt, count: rows.length, usage: rows.length / total * 100,
      avg_velo: avg(rows.map(r => r.rel_speed)),
      max_velo: rows.reduce((m, r) => Math.max(m, r.rel_speed || 0), 0) || null,
      avg_spin: avg(rows.map(r => r.spin_rate)),
      avg_ivb: avg(rows.map(r => r.induced_vert_break)),
      avg_hb: avg(rows.map(r => r.horz_break)),
      avg_rel_ht: avg(rows.map(r => r.rel_height)),
      avg_ext: avg(rows.map(r => r.extension)),
    }))
    .filter(a => total <= 10 || a.usage >= 5)
    .sort((a, b) => b.count - a.count);
}

// ── Arsenal table ─────────────────────────────────────────
function ArsenalTable({ arsenal }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={TH}>Pitch</th>
            <th style={THR}>Count</th><th style={THR}>Usage</th>
            <th style={THR}>Avg Velo</th><th style={THR}>Max Velo</th>
            <th style={THR}>Spin</th><th style={THR}>iVB</th><th style={THR}>HB</th>
            <th style={THR}>RelHt</th><th style={THR}>Ext</th>
          </tr>
        </thead>
        <tbody>
          {arsenal.map((row, i) => (
            <tr key={row.pt} style={{ background: rowBg(i) }}>
              <td style={TD}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: pitchColor(row.pt), display: 'inline-block', flexShrink: 0 }} />
                  {row.pt}
                </span>
              </td>
              <td style={TDR}>{row.count}</td>
              <td style={TDR}>{row.usage.toFixed(1)}%</td>
              <td style={TDR}>{fmt(row.avg_velo)}</td>
              <td style={TDR}>{fmt(row.max_velo)}</td>
              <td style={TDR}>{fmt(row.avg_spin, 0)}</td>
              <td style={TDR}>{fmt(row.avg_ivb)}</td>
              <td style={TDR}>{fmt(row.avg_hb)}</td>
              <td style={TDR}>{fmt(row.avg_rel_ht)}</td>
              <td style={TDR}>{fmt(row.avg_ext)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Scout notes box ───────────────────────────────────────
function ScoutNotes({ obs }) {
  if (!obs) return null;
  return (
    <div style={{ background: '#faf9f5', border: '1.5px solid #e0dbd0', borderRadius: 8, padding: '12px 16px', marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 11, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Scout Notes</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 18px', fontSize: 12.5 }}>
        {obs.time_to_plate_1b != null && <span><b>TTP 1B:</b> {obs.time_to_plate_1b}s</span>}
        {obs.time_to_plate_2b != null && <span><b>TTP 2B:</b> {obs.time_to_plate_2b}s</span>}
        {obs.ucla_hold_start && <span><b>UCLA Hold:</b> {obs.ucla_hold_start}{obs.ucla_hold_end && obs.ucla_hold_end !== obs.ucla_hold_start ? `→${obs.ucla_hold_end}` : ''}</span>}
        {obs.has_slide_step != null && (
          <span style={{ background: obs.has_slide_step ? '#dcfce7' : '#fee2e2', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
            {obs.has_slide_step ? 'Slide Step ✓' : 'No Slide Step'}
          </span>
        )}
        {obs.pickoff_moves?.length > 0 && <span><b>Pickoff:</b> {obs.pickoff_moves.join(', ')}</span>}
        {obs.notes && <span style={{ color: '#555', fontStyle: 'italic', flexBasis: '100%' }}>{obs.notes}</span>}
      </div>
    </div>
  );
}

// ── Pitcher card ──────────────────────────────────────────
function PitcherCard({ name, pitches, obs, collapsible = true }) {
  const [open, setOpen] = useState(!collapsible);
  const arsenal = useMemo(() => buildArsenal(pitches), [pitches]);
  const hand = pitches[0]?.pitcher_hand || '';
  const maxVelo = pitches.reduce((m, p) => Math.max(m, p.rel_speed || 0), 0);

  return (
    <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: collapsible ? 'pointer' : 'default', background: open ? TINT : '#fff', transition: 'background 0.12s' }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, color: NAVY, flex: 1 }}>{name}</span>
        {hand && <span style={{ background: NAVY, color: GOLD, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{hand}</span>}
        <span style={{ fontSize: 12, color: '#888' }}>{pitches.length} pitches</span>
        {maxVelo > 0 && <span style={{ fontSize: 12, color: '#888' }}>Top: {maxVelo.toFixed(1)}</span>}
        {collapsible && <span style={{ color: '#aaa', fontSize: 12 }}>{open ? '▲' : '▼'}</span>}
      </div>
      {open && (
        <div style={{ padding: '0 16px 16px', background: TINT }}>
          <ArsenalTable arsenal={arsenal} />
          <ScoutNotes obs={obs} />
        </div>
      )}
    </div>
  );
}

// ── PROFILES TAB ─────────────────────────────────────────
function ProfilesTab({ pitches, pitcherObs }) {
  const grouped = useMemo(() => {
    const m = {};
    pitches.forEach(p => { if (!p.pitcher_name) return; if (!m[p.pitcher_name]) m[p.pitcher_name] = []; m[p.pitcher_name].push(p); });
    return m;
  }, [pitches]);
  const names = Object.keys(grouped).sort();
  if (!names.length) return <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: 32 }}>No Trackman data for this team yet.</p>;
  return (
    <div>
      {names.map(name => (
        <PitcherCard key={name} name={name} pitches={grouped[name]}
          obs={pitcherObs.find(o => o.pitcher_name === name)} collapsible />
      ))}
    </div>
  );
}

// ── REPORTS TAB ──────────────────────────────────────────
function ReportsTab({ _activeTeam, pitches, pitcherObs, catcherObs, runnerObs }) {
  const grouped = useMemo(() => {
    const m = {};
    pitches.forEach(p => { if (!p.pitcher_name) return; if (!m[p.pitcher_name]) m[p.pitcher_name] = []; m[p.pitcher_name].push(p); });
    return m;
  }, [pitches]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }} className="no-print">
        <button onClick={() => window.print()} style={{ background: NAVY, color: GOLD, border: 'none', borderRadius: 6, fontWeight: 700, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>
          Print / PDF
        </button>
      </div>

      <SectionTitle>Pitcher Scouting</SectionTitle>
      {Object.keys(grouped).length === 0 ? <Empty /> : Object.keys(grouped).sort().map(name => (
        <PitcherCard key={name} name={name} pitches={grouped[name]}
          obs={pitcherObs.find(o => o.pitcher_name === name)} collapsible={false} />
      ))}

      <div style={{ marginTop: 28 }}>
        <SectionTitle>Catcher Observations</SectionTitle>
        {catcherObs.length === 0 ? <Empty /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Catcher','Team','Warmup Pop','Steal Attempts','Notes'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{catcherObs.map((r,i) => {
                const att = r.steal_attempts||[]; const caught = att.filter(a=>a.result==='out').length;
                return <tr key={r.id} style={{ background: rowBg(i) }}>
                  <td style={TD}>{r.catcher_name}</td><td style={TD}>{r.catcher_team||'—'}</td>
                  <td style={TDR}>{r.warmup_pop_time!=null?r.warmup_pop_time+'s':'—'}</td>
                  <td style={TD}>{att.length?`${caught}/${att.length} caught`:'—'}</td>
                  <td style={TD}>{r.notes||'—'}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionTitle>Baserunner Observations</SectionTitle>
        {runnerObs.length === 0 ? <Empty /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Runner','Team','Speed','Aggression','Pickoff Att','Dirt Ball Adv','Notes'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{runnerObs.map((r,i)=>(
                <tr key={r.id} style={{ background: rowBg(i) }}>
                  <td style={TD}>{r.runner_name}</td><td style={TD}>{r.runner_team||'—'}</td>
                  <td style={TD}>{r.speed_rating||'—'}</td><td style={TD}>{r.aggression_rating||'—'}</td>
                  <td style={TDR}>{r.pickoff_attempts??'—'}</td><td style={TDR}>{r.dirt_ball_advances??'—'}</td>
                  <td style={TD}>{r.notes||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DATA TAB ─────────────────────────────────────────────
function TrackmanSubTab({ pitches }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(pitches.length / PAGE_SIZE);
  const slice = pitches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (!pitches.length) return <Empty />;
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr>{['Pitcher','Batter','Type','Velo','Spin','HB','iVB','PlateH','PlateSide','Call','Result'].map((h,i)=><th key={h} style={i>1?THR:TH}>{h}</th>)}</tr></thead>
          <tbody>{slice.map((r,i)=>(
            <tr key={r.id||i} style={{ background: rowBg(i) }}>
              <td style={TD}>{r.pitcher_name}</td><td style={TD}>{r.batter_name}</td>
              <td style={TD}>{normalizePitch(r.pitch_type||r.tagged_pitch_type)}</td>
              <td style={TDR}>{fmt(r.rel_speed)}</td><td style={TDR}>{fmt(r.spin_rate,0)}</td>
              <td style={TDR}>{fmt(r.horz_break)}</td><td style={TDR}>{fmt(r.induced_vert_break)}</td>
              <td style={TDR}>{fmt(r.plate_loc_height)}</td><td style={TDR}>{fmt(r.plate_loc_side)}</td>
              <td style={TD}>{r.pitch_call||'—'}</td><td style={TD}>{r.play_result||'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 13 }}>
          <button disabled={page===0} onClick={()=>setPage(p=>p-1)} style={{ background: NAVY, color: GOLD, border: 'none', borderRadius: 5, padding: '5px 14px', fontWeight: 700, cursor: page===0?'not-allowed':'pointer', opacity: page===0?0.4:1 }}>← Prev</button>
          <span style={{ color: NAVY }}>Page {page+1} of {pages} ({pitches.length} rows)</span>
          <button disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)} style={{ background: NAVY, color: GOLD, border: 'none', borderRadius: 5, padding: '5px 14px', fontWeight: 700, cursor: page>=pages-1?'not-allowed':'pointer', opacity: page>=pages-1?0.4:1 }}>Next →</button>
        </div>
      )}
    </div>
  );
}

function ObsSubTab({ pitcherObs, catcherObs, runnerObs, onRefresh }) {
  async function del(entity, id) { await base44.entities[entity].delete(id); onRefresh(); }

  const DelBtn = ({ entity, id }) => (
    <button onClick={() => del(entity, id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 16, cursor: 'pointer', padding: '0 2px' }}>×</button>
  );

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: NAVY, textTransform: 'uppercase', marginBottom: 8 }}>Pitcher Observations</div>
        {!pitcherObs.length ? <Empty /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['Name','TTP 1B','UCLA','Slide','Pickoff Att','Notes',''].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{pitcherObs.map((r,i)=>(
              <tr key={r.id} style={{ background: rowBg(i) }}>
                <td style={TD}>{r.pitcher_name}</td>
                <td style={TDR}>{r.time_to_plate_1b!=null?r.time_to_plate_1b+'s':'—'}</td>
                <td style={TD}>{r.ucla_hold_start||'—'}</td>
                <td style={TD}>{r.has_slide_step==null?'—':r.has_slide_step?'Yes':'No'}</td>
                <td style={TDR}>{r.pickoff_attempts??'—'}</td>
                <td style={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(r.notes||'').slice(0,40)}{r.notes?.length>40?'…':''}</td>
                <td style={TD}><DelBtn entity="PitcherObservation" id={r.id} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: NAVY, textTransform: 'uppercase', marginBottom: 8 }}>Catcher Observations</div>
        {!catcherObs.length ? <Empty /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['Name','Warmup Pop','# Steals','Notes',''].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{catcherObs.map((r,i)=>(
              <tr key={r.id} style={{ background: rowBg(i) }}>
                <td style={TD}>{r.catcher_name}</td>
                <td style={TDR}>{r.warmup_pop_time!=null?r.warmup_pop_time+'s':'—'}</td>
                <td style={TDR}>{(r.steal_attempts||[]).length}</td>
                <td style={{ ...TD, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(r.notes||'').slice(0,40)}</td>
                <td style={TD}><DelBtn entity="CatcherObservation" id={r.id} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: NAVY, textTransform: 'uppercase', marginBottom: 8 }}>Baserunner Observations</div>
        {!runnerObs.length ? <Empty /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['Name','Team','Speed','Aggr','Pickoff','Notes',''].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{runnerObs.map((r,i)=>(
              <tr key={r.id} style={{ background: rowBg(i) }}>
                <td style={TD}>{r.runner_name}</td><td style={TD}>{r.runner_team||'—'}</td>
                <td style={TD}>{r.speed_rating||'—'}</td><td style={TD}>{r.aggression_rating||'—'}</td>
                <td style={TDR}>{r.pickoff_attempts??'—'}</td>
                <td style={{ ...TD, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(r.notes||'').slice(0,40)}</td>
                <td style={TD}><DelBtn entity="BaserunnerObservation" id={r.id} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SaveLoadSubTab({ activeTeam, pitches, pitcherObs, catcherObs, runnerObs, onRefresh }) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  function exportJSON() {
    const data = { team: activeTeam?.name, exportedAt: new Date().toISOString(), pitches, pitcherObs, catcherObs, runnerObs };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(activeTeam?.name||'team').toLowerCase().replace(/\s+/g,'-')}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }

  async function clearData() {
    setClearing(true);
    await Promise.all([
      ...pitches.map(r => base44.entities.TrackmanPitch.delete(r.id)),
      ...pitcherObs.map(r => base44.entities.PitcherObservation.delete(r.id)),
      ...catcherObs.map(r => base44.entities.CatcherObservation.delete(r.id)),
      ...runnerObs.map(r => base44.entities.BaserunnerObservation.delete(r.id)),
    ]);
    setClearing(false); setConfirming(false); onRefresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
      <button onClick={exportJSON} style={{ background: NAVY, color: GOLD, border: 'none', borderRadius: 6, fontWeight: 700, padding: '9px 20px', cursor: 'pointer', fontSize: 13 }}>
        Export JSON
      </button>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, padding: '9px 20px', cursor: 'pointer', fontSize: 13 }}>
          Clear This Team's Data
        </button>
      ) : (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16 }}>
          <p style={{ fontWeight: 700, color: '#991b1b', marginBottom: 12 }}>
            Delete all data for {activeTeam?.name}? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={clearData} disabled={clearing} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 700, padding: '7px 16px', cursor: 'pointer' }}>
              {clearing ? 'Deleting…' : 'Yes, Delete All'}
            </button>
            <button onClick={() => setConfirming(false)} style={{ background: NAVY, color: GOLD, border: 'none', borderRadius: 5, fontWeight: 700, padding: '7px 16px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN VIEW/EXPORT SCREEN ───────────────────────────────
export default function ViewExportScreen({ setScreen }) {
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [mainTab, setMainTab] = useState('PROFILES');
  const [dataTab, setDataTab] = useState('Trackman');
  const [showReport, setShowReport] = useState(false);
  const [pitches, setPitches] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.Team.list('name', 100).then(ts => {
      setTeams(ts);
      const def = ts.find(t => t.name === 'Arroyo Seco Saints') || ts[0] || null;
      setActiveTeam(def);
    });
    base44.entities.Game.list('-date', 200).then(setGames);
  }, []);

  const loadData = useCallback(async () => {
    if (!activeTeam) return;
    setLoading(true);
    const gameFilter = selectedGame ? { game_id: selectedGame } : { pitcher_team: activeTeam.name };
    const [p, po, co, ro] = await Promise.all([
      base44.entities.TrackmanPitch.filter(gameFilter, 'pitcher_name', 1000),
      base44.entities.PitcherObservation.list('pitcher_name', 500),
      base44.entities.CatcherObservation.list('catcher_name', 200),
      base44.entities.BaserunnerObservation.list('runner_name', 200),
    ]);
    setPitches(p); setPitcherObs(po); setCatcherObs(co); setRunnerObs(ro);
    setLoading(false);
  }, [activeTeam, selectedGame]);

  useEffect(() => { loadData(); }, [loadData]);

  const teamGames = games.filter(g => activeTeam && (g.home_team === activeTeam.name || g.away_team === activeTeam.name || g.home_team_code === activeTeam.code || g.away_team_code === activeTeam.code));

  if (showReport && selectedGame) {
    return <GameReport gameId={selectedGame} onBack={() => setShowReport(false)} />;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
      <button onClick={() => setScreen('HOME')} style={{ background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 5, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: NAVY, cursor: 'pointer', marginBottom: 24 }}>
        ← Home
      </button>

      {/* Team chip strip */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, overflowX: 'auto' }}>
        {teams.map(t => {
          const active = t.id === activeTeam?.id;
          return (
            <button key={t.id} onClick={() => { setActiveTeam(t); setSelectedGame(''); }}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${active ? NAVY : BORDER}`, background: active ? NAVY : '#fff', color: active ? GOLD : '#444', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Game scope */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)}
          style={{ border: `1.5px solid ${BORDER}`, borderRadius: 5, background: '#fff', color: NAVY, fontWeight: 600, fontSize: 13, padding: '6px 10px', fontFamily: "'Archivo', sans-serif", outline: 'none' }}>
          <option value="">All Games (Season)</option>
          {teamGames.map(g => <option key={g.id} value={g.id}>{g.date} — {g.away_team_code||g.away_team} vs {g.home_team_code||g.home_team}</option>)}
        </select>
        {selectedGame && (
          <button onClick={() => setShowReport(true)}
            style={{ background: NAVY, color: GOLD, border: 'none', borderRadius: 5, fontWeight: 700, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            📋 Scouting Report
          </button>
        )}
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 24 }}>
        {MAIN_TABS.map(tab => <button key={tab} onClick={() => setMainTab(tab)} style={tabStyle(mainTab === tab)}>{tab}</button>)}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#888', fontStyle: 'italic' }}>Loading…</p>
      ) : (
        <>
          {mainTab === 'PROFILES' && <ProfilesTab pitches={pitches} pitcherObs={pitcherObs} />}
          {mainTab === 'REPORTS' && <ReportsTab activeTeam={activeTeam} pitches={pitches} pitcherObs={pitcherObs} catcherObs={catcherObs} runnerObs={runnerObs} />}
          {mainTab === 'TENDENCIES' && <SeasonTendencies teamName={activeTeam?.name} />}
          {mainTab === 'DATA' && (
            <div>
              <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }}>
                {DATA_TABS.map(tab => <button key={tab} onClick={() => setDataTab(tab)} style={{ ...tabStyle(dataTab === tab), fontSize: 13 }}>{tab}</button>)}
              </div>
              {dataTab === 'Trackman' && <TrackmanSubTab pitches={pitches} />}
              {dataTab === 'Observations' && <ObsSubTab pitcherObs={pitcherObs} catcherObs={catcherObs} runnerObs={runnerObs} onRefresh={loadData} />}
              {dataTab === 'Save/Load' && <SaveLoadSubTab activeTeam={activeTeam} pitches={pitches} pitcherObs={pitcherObs} catcherObs={catcherObs} runnerObs={runnerObs} onRefresh={loadData} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}