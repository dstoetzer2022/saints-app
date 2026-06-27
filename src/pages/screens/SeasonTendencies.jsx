import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, BORDER, TINT } from '@/lib/ds';
import SectionTitle from '@/components/shared/SectionTitle';

const TH = { padding: '6px 10px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: NAVY, textAlign: 'left', borderBottom: `2px solid ${NAVY}` };
const TD = { padding: '5px 10px', fontSize: 13, borderBottom: '1px solid #eee' };

function mode(arr) {
  if (!arr.length) return '—';
  const counts = {};
  arr.forEach(v => { if (v) counts[v] = (counts[v] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0] ? `${sorted[0][0]} (${sorted[0][1]}/${arr.length})` : '—';
}

export default function SeasonTendencies({ teamName }) {
  const [games, setGames] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [_catcherObs, setCatcherObs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamName) return;
    async function load() {
      const allGames = await base44.entities.Game.list('-date', 200);
      const teamGames = allGames.filter(g => g.away_team === teamName || g.home_team === teamName);
      setGames(teamGames);
      const gameIds = new Set(teamGames.map(g => g.id));
      const [po, ro, co] = await Promise.all([
        base44.entities.PitcherObservation.list('pitcher_name', 500),
        base44.entities.BaserunnerObservation.list('runner_name', 500),
        base44.entities.CatcherObservation.list('catcher_name', 200),
      ]);
      setPitcherObs(po.filter(o => gameIds.has(o.game_id)));
      setRunnerObs(ro.filter(o => gameIds.has(o.game_id)));
      setCatcherObs(co.filter(o => gameIds.has(o.game_id)));
      setLoading(false);
    }
    load();
  }, [teamName]);

  const pitcherAgg = useMemo(() => {
    const map = {};
    pitcherObs.forEach(o => {
      if (!map[o.pitcher_name]) map[o.pitcher_name] = { obs: [], gameIds: new Set() };
      map[o.pitcher_name].obs.push(o);
      if (o.game_id) map[o.pitcher_name].gameIds.add(o.game_id);
    });
    return Object.entries(map).map(([name, { obs, gameIds }]) => {
      const initArr = v => Array.isArray(v) ? v : v != null ? [v] : [];
      const allR1b = obs.flatMap(o => initArr(o.time_to_plate_1b));
      const allR2b = obs.flatMap(o => initArr(o.time_to_plate_2b));
      return {
        name, appearances: gameIds.size, obs,
        avgTtp1b: allR1b.length ? (allR1b.reduce((a, b) => a + b, 0) / allR1b.length).toFixed(2) : null,
        avgTtp2b: allR2b.length ? (allR2b.reduce((a, b) => a + b, 0) / allR2b.length).toFixed(2) : null,
        slideSteps: mode(obs.map(o => o.slide_step_type).filter(Boolean)),
        hands: obs[0]?.pitcher_hand || '—',
        notes: obs.map(o => o.notes).filter(Boolean),
      };
    }).sort((a, b) => b.appearances - a.appearances);
  }, [pitcherObs]);

  const runnerAgg = useMemo(() => {
    const map = {};
    runnerObs.forEach(o => {
      if (!map[o.runner_name]) map[o.runner_name] = { obs: [], gameIds: new Set() };
      map[o.runner_name].obs.push(o);
      if (o.game_id) map[o.runner_name].gameIds.add(o.game_id);
    });
    return Object.entries(map).map(([name, { obs, gameIds }]) => ({
      name, appearances: gameIds.size,
      speed: mode(obs.map(o => o.speed_rating).filter(Boolean)),
      aggression: mode(obs.map(o => o.aggression_rating).filter(Boolean)),
      totalPickoff: obs.reduce((s, o) => s + (o.pickoff_attempts || 0), 0),
      totalDirt: obs.reduce((s, o) => s + (o.dirt_ball_advances || 0), 0),
    })).sort((a, b) => b.appearances - a.appearances);
  }, [runnerObs]);

  if (!teamName) return <p style={{ textAlign: 'center', color: '#888', padding: 32 }}>Select a team above to view season tendencies.</p>;
  if (loading) return <p style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading tendencies…</p>;
  if (!games.length) return <p style={{ textAlign: 'center', color: '#888', padding: 32 }}>No games scouted against {teamName} yet.</p>;

  return (
    <div>
      <div style={{ background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
        <span style={{ fontWeight: 700, color: NAVY }}>{games.length} game{games.length !== 1 ? 's' : ''}</span> scouted vs {teamName}
        <span style={{ color: '#888', marginLeft: 10 }}>
          ({games.map(g => g.date).join(', ')})
        </span>
      </div>

      <SectionTitle>Pitcher Usage Patterns</SectionTitle>
      {pitcherAgg.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>No pitcher observations.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {pitcherAgg.map(p => (
            <div key={p.name} style={{ background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>{p.name} ({p.hands}HP)</span>
                <span style={{ fontSize: 12, color: '#888' }}>{p.appearances} game{p.appearances !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 13 }}>
                {p.avgTtp1b && <span><b>Avg TTP 1B:</b> {p.avgTtp1b}s</span>}
                {p.avgTtp2b && <span><b>Avg TTP 2B:</b> {p.avgTtp2b}s</span>}
                <span><b>Slide Step:</b> {p.slideSteps}</span>
              </div>
              {p.notes.length > 0 && (
                <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic', marginTop: 6 }}>
                  {p.notes.map((n, i) => <div key={i}>• {n}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Baserunner Profiles</SectionTitle>
      {runnerAgg.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>No baserunner observations.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Runner', 'Games', 'Speed', 'Aggression', 'Pickoff Att', 'Dirt Ball Adv'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {runnerAgg.map((r, i) => (
              <tr key={r.name} style={{ background: i % 2 ? TINT : '#fff' }}>
                <td style={{ ...TD, fontWeight: 600 }}>{r.name}</td>
                <td style={TD}>{r.appearances}</td>
                <td style={TD}>{r.speed}</td>
                <td style={TD}>{r.aggression}</td>
                <td style={TD}>{r.totalPickoff}</td>
                <td style={TD}>{r.totalDirt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}