import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, BORDER, TINT, fmt, avg, normalizePitch } from '@/lib/ds';

const TH = { padding: '6px 10px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: NAVY, borderBottom: `2px solid ${NAVY}`, textAlign: 'left' };
const TD = { padding: '5px 10px', fontSize: 13, borderBottom: '1px solid #eee' };
const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28, pageBreakInside: 'avoid' }}>
    <div style={{ fontWeight: 800, fontSize: 14, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `2px solid ${GOLD}`, paddingBottom: 6, marginBottom: 12 }}>
      {title}
    </div>
    {children}
  </div>
);

function ArsenalMini({ pitches }) {
  if (!pitches.length) return null;
  const types = {};
  pitches.forEach(p => {
    const pt = normalizePitch(p.pitch_type || p.tagged_pitch_type);
    if (!types[pt]) types[pt] = [];
    types[pt].push(p);
  });
  const rows = Object.entries(types).map(([pt, ps]) => ({
    pt, count: ps.length, usage: ((ps.length / pitches.length) * 100).toFixed(0),
    velo: fmt(avg(ps.map(p => p.rel_speed))), maxV: fmt(Math.max(...ps.map(p => p.rel_speed || 0))),
  })).sort((a, b) => b.count - a.count);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Arsenal</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rows.map(r => (
          <span key={r.pt} style={{ fontSize: 12, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '3px 8px' }}>
            <b>{r.pt}</b> {r.usage}% · {r.velo} (max {r.maxV})
          </span>
        ))}
      </div>
    </div>
  );
}

function PitcherCard({ obs, pitches }) {
  const initArr = v => Array.isArray(v) ? v : v != null ? [v] : [];
  const r1b = initArr(obs.time_to_plate_1b);
  const r2b = initArr(obs.time_to_plate_2b);

  return (
    <div style={{ background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px', marginBottom: 12, pageBreakInside: 'avoid' }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: NAVY, marginBottom: 8 }}>
        {obs.pitcher_name}{obs.pitcher_hand ? ` (${obs.pitcher_hand}HP)` : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 13 }}>
        {r1b.length > 0 && <span><b>TTP 1B:</b> {r1b.map(r => r.toFixed(2) + 's').join(', ')} (avg {(r1b.reduce((a, b) => a + b, 0) / r1b.length).toFixed(2)}s)</span>}
        {r2b.length > 0 && <span><b>TTP 2B:</b> {r2b.map(r => r.toFixed(2) + 's').join(', ')} (avg {(r2b.reduce((a, b) => a + b, 0) / r2b.length).toFixed(2)}s)</span>}
        {obs.slide_step_type && <span><b>Slide Step:</b> {obs.slide_step_type}{obs.slide_step_notes ? ` — ${obs.slide_step_notes}` : ''}</span>}
        {obs.pickoff_moves?.length > 0 && <span><b>Pickoff:</b> {obs.pickoff_moves.join(', ')}</span>}
        {obs.ucla_hold_start && <span><b>UCLA:</b> {obs.ucla_hold_start}{obs.ucla_hold_end ? `→${obs.ucla_hold_end}` : ''}</span>}
      </div>
      {obs.notes && <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic', marginTop: 6 }}>{obs.notes}</div>}
      <ArsenalMini pitches={pitches} />
    </div>
  );
}

export default function GameReport({ gameId, onBack }) {
  const [game, setGame] = useState(null);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Game.filter({ id: gameId }),
      base44.entities.PitcherObservation.filter({ game_id: gameId }),
      base44.entities.CatcherObservation.filter({ game_id: gameId }),
      base44.entities.BaserunnerObservation.filter({ game_id: gameId }),
      base44.entities.TrackmanPitch.filter({ game_id: gameId }, 'pitcher_name', 500),
    ]).then(([g, po, co, ro, tp]) => {
      if (g.length) setGame(g[0]);
      setPitcherObs(po); setCatcherObs(co); setRunnerObs(ro); setPitches(tp);
      setLoading(false);
    });
  }, [gameId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading report…</div>;
  if (!game) return <div style={{ padding: 40 }}>Game not found.</div>;

  const lineup = game.lineup_data || [];
  const pitchesByPitcher = {};
  pitches.forEach(p => { const n = p.pitcher_name; if (n) { if (!pitchesByPitcher[n]) pitchesByPitcher[n] = []; pitchesByPitcher[n].push(p); } });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 24px' }}>
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 5, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: NAVY, cursor: 'pointer' }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: NAVY, color: GOLD, border: 'none', borderRadius: 6, fontWeight: 700, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>🖨 Print / Save PDF</button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontWeight: 800, fontSize: 12, color: NAVY, letterSpacing: 2, textTransform: 'uppercase' }}>Saints Scouting Report</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: NAVY, marginTop: 4 }}>vs {game.away_team === 'Arroyo Seco Saints' ? game.home_team : game.away_team}</div>
        <div style={{ fontSize: 13, color: '#888' }}>{game.date}{game.venue ? ` · ${game.venue}` : ''}</div>
      </div>

      {lineup.length > 0 && (
        <Section title="Opponent Lineup">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={{ ...TH, width: 36, textAlign: 'center' }}>#</th>
              <th style={TH}>Name</th><th style={{ ...TH, width: 56 }}>Jersey</th>
              <th style={{ ...TH, width: 60 }}>Pos</th><th style={{ ...TH, width: 50 }}>Bats</th>
            </tr></thead>
            <tbody>
              {lineup.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : TINT }}>
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: '#aaa' }}>{i + 1}</td>
                  <td style={{ ...TD, fontWeight: 600 }}>{s.name}</td>
                  <td style={TD}>{s.jersey ? `#${s.jersey}` : '—'}</td>
                  <td style={TD}>{s.position || '—'}</td>
                  <td style={TD}>{s.hand || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {pitcherObs.length > 0 && (
        <Section title={`Pitching (${pitcherObs.length})`}>
          {pitcherObs.map((obs, i) => (
            <PitcherCard key={obs.id} obs={obs} pitches={pitchesByPitcher[obs.pitcher_name] || []} />
          ))}
        </Section>
      )}

      {catcherObs.length > 0 && (
        <Section title="Catching">
          {catcherObs.map(c => {
            const att = c.steal_attempts || [];
            const caught = att.filter(a => a.result === 'out').length;
            return (
              <div key={c.id} style={{ fontSize: 13, marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{c.catcher_name}</span>
                {c.warmup_pop_time && <span> · Warmup Pop: {c.warmup_pop_time}s</span>}
                {att.length > 0 && <span> · Steals: {caught}/{att.length} caught</span>}
                {c.notes && <span style={{ fontStyle: 'italic', color: '#555' }}> — {c.notes}</span>}
              </div>
            );
          })}
        </Section>
      )}

      {runnerObs.length > 0 && (
        <Section title="Baserunner Tendencies">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Name', 'Speed', 'Aggression', 'Pickoff', 'Dirt Ball', 'Notes'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {runnerObs.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 ? TINT : '#fff' }}>
                  <td style={{ ...TD, fontWeight: 600 }}>{r.runner_name}</td>
                  <td style={TD}>{r.speed_rating || '—'}</td>
                  <td style={TD}>{r.aggression_rating || '—'}</td>
                  <td style={TD}>{r.pickoff_attempts ?? '—'}</td>
                  <td style={TD}>{r.dirt_ball_advances ?? '—'}</td>
                  <td style={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}