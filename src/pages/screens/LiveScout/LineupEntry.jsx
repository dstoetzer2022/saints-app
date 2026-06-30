import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeName } from '@/lib/statsUtils';
import DarkScreenLayout from '@/components/shared/DarkScreenLayout';

const GOLD = '#c6b583';
const CCL_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';
const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'];

const HAND_COLORS = { L: '#f97316', R: '#3b82f6', S: '#a855f7' };

// ── Autocomplete name input ───────────────────────────────────
function NameAutocomplete({ value, onChange, onSelect, knownPlayers, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const matches = value.trim().length >= 1
    ? knownPlayers.filter(p => p.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="dark-input"
        style={{ fontSize: 13, width: '100%' }}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#0e1f30', border: '1px solid rgba(198,181,131,0.3)',
          borderRadius: 6, marginTop: 3, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {matches.map((p, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(p); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: i < matches.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: "'Archivo', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(198,181,131,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f0ece0' }}>{p.name}</span>
              {p.jersey && <span style={{ fontSize: 11, fontWeight: 600, color: GOLD }}>#{p.jersey}</span>}
              {p.hand && (
                <span style={{ fontSize: 10, fontWeight: 800, color: HAND_COLORS[p.hand] || '#aaa', background: `${HAND_COLORS[p.hand] || '#aaa'}18`, border: `1px solid ${HAND_COLORS[p.hand] || '#aaa'}44`, borderRadius: 3, padding: '1px 5px' }}>
                  {p.hand}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LineupEntry({ gameSetup, onSubmit, onBack }) {
  const emptySlot = () => ({ name: '', jersey: '', position: '', hand: '' });
  const [lineup, setLineup] = useState(Array(9).fill(null).map(emptySlot));
  const [spName, setSpName] = useState('');
  const [spJersey, setSpJersey] = useState('');
  const [spHand, setSpHand] = useState('');
  const [pitcherSlot, setPitcherSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [knownPlayers, setKnownPlayers] = useState([]);
  const [knownPitchers, setKnownPitchers] = useState([]);

  const opponentName = gameSetup?.opponent?.name;

  useEffect(() => {
    if (!opponentName) return;
    Promise.all([
      base44.entities.BaserunnerObservation.filter({ runner_team: opponentName }, 'runner_name', 200),
      base44.entities.PitcherObservation.filter({ pitcher_team: opponentName }, 'pitcher_name', 100),
      base44.entities.TrackmanPitch.filter({ batter_team: opponentName }, 'batter_name', 500),
      base44.entities.TrackmanPitch.filter({ pitcher_team: opponentName }, 'pitcher_name', 500),
    ]).then(([runners, pitchers, tmBatters, tmPitchers]) => {
      // Batters: merge scout obs + trackman
      const map = {};
      const normalizeHand = h => {
        if (!h) return '';
        const v = h.trim();
        if (v === 'L' || v === 'R' || v === 'S') return v;
        if (v.toLowerCase().startsWith('l')) return 'L';
        if (v.toLowerCase().startsWith('r')) return 'R';
        if (v.toLowerCase().startsWith('s') || v.toLowerCase() === 'both') return 'S';
        return '';
      };
      const normalizeThrow = h => {
        if (!h) return '';
        const v = h.trim();
        if (v === 'L' || v === 'R') return v;
        if (v.toLowerCase().startsWith('l')) return 'L';
        if (v.toLowerCase().startsWith('r')) return 'R';
        return '';
      };

      const mergeHitter = (rawName, jersey, hand) => {
        if (!rawName) return;
        const name = normalizeName(rawName);
        const key = name.toLowerCase();
        const normHand = normalizeHand(hand);
        if (!map[key]) map[key] = { name, jersey: jersey || '', hand: normHand };
        else {
          if (!map[key].jersey && jersey) map[key].jersey = jersey;
          if (!map[key].hand && normHand) map[key].hand = normHand;
        }
      };
      runners.forEach(r => mergeHitter(r.runner_name, r.jersey_number, r.bats));
      tmBatters.forEach(r => mergeHitter(r.batter_name, null, r.batter_hand));
      setKnownPlayers(Object.values(map).sort((a, b) => a.name.localeCompare(b.name)));

      // Pitchers: merge scout obs + trackman
      const pmap = {};
      const mergePitcher = (rawName, jersey, hand) => {
        if (!rawName) return;
        const name = normalizeName(rawName);
        const key = name.toLowerCase();
        const normHand = normalizeThrow(hand);
        if (!pmap[key]) pmap[key] = { name, jersey: jersey || '', hand: normHand };
        else {
          if (!pmap[key].jersey && jersey) pmap[key].jersey = jersey;
          if (!pmap[key].hand && normHand) pmap[key].hand = normHand;
        }
      };
      pitchers.forEach(p => mergePitcher(p.pitcher_name, p.jersey_number, p.pitcher_hand));
      tmPitchers.forEach(p => mergePitcher(p.pitcher_name, null, p.pitcher_hand));
      setKnownPitchers(Object.values(pmap).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [opponentName]);

  function setSlot(i, field, val) {
    setLineup(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  }

  function selectSlotPlayer(i, p) {
    setLineup(prev => prev.map((s, j) => j === i ? { ...s, name: p.name, jersey: p.jersey || s.jersey, hand: p.hand || s.hand } : s));
  }

  const resolvedSP = pitcherSlot !== null ? lineup[pitcherSlot] : { name: spName, jersey: spJersey, hand: spHand };
  const filledSlots = lineup.filter(s => s.name.trim());
  const valid = filledSlots.length >= 1 && resolvedSP.name.trim();

  async function handleSubmit() {
    setSubmitting(true); setError('');
    try {
      const { date, opponent } = gameSetup;
      const existing = await base44.entities.Game.filter({ date, away_team: opponent.name });
      let game = existing.length ? existing[0] : await base44.entities.Game.create({
        date,
        home_team: 'Arroyo Seco Saints', home_team_code: 'ARR',
        away_team: opponent.name, away_team_code: opponent.code || '',
        status: 'in-progress', lineup_data: lineup,
      });

      const catcherSlot = lineup.find(s => s.position === 'C');

      const [pitcher] = await Promise.all([
        base44.entities.PitcherObservation.create({
          game_id: game.id,
          pitcher_name: resolvedSP.name,
          pitcher_team: opponent.name,
          pitcher_hand: resolvedSP.hand || null,
          jersey_number: resolvedSP.jersey || null,
          is_current_pitcher: true,
        }),
      ]);

      let catcher = null;
      if (catcherSlot) {
        catcher = await base44.entities.CatcherObservation.create({
          game_id: game.id,
          catcher_name: catcherSlot.name,
          catcher_team: opponent.name,
          jersey_number: catcherSlot.jersey || null,
          bats: catcherSlot.hand || null,
        });
      }

      const runners = await Promise.all(lineup.filter(s => s.name.trim()).map(s =>
        base44.entities.BaserunnerObservation.create({
          game_id: game.id,
          runner_name: s.name,
          runner_team: opponent.name,
          jersey_number: s.jersey || null,
          bats: s.hand || null,
          position: s.position || null,
        })
      ));

      onSubmit({ game, lineup, pitcher, catcher, runners });
    } catch (e) {
      setError(e.message || 'Failed to create game records.');
    }
    setSubmitting(false);
  }

  const opponent = gameSetup?.opponent;

  return (
    <DarkScreenLayout>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '32px 16px 60px' }}>
        <div style={{ width: '100%', maxWidth: 680 }}>

          {/* Back */}
          <button onClick={onBack} className="dark-back-btn" style={{ marginBottom: 22 }}>← Back</button>

          {/* Opponent banner */}
          {opponent && (
            <div className="dark-glass-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', marginBottom: 22, borderColor: 'rgba(198,181,131,0.3)' }}>
              <img src={opponent.logo_url || CCL_LOGO} alt={opponent.name} style={{ width: 46, height: 46, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(198,181,131,0.6)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Lineup Card · {gameSetup.date}</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#f0ece0', fontFamily: "'Archivo', sans-serif" }}>vs {opponent.name}</div>
              </div>
            </div>
          )}

          {/* Lineup table */}
          <div className="dark-glass-card" style={{ padding: '4px 0', marginBottom: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(198,181,131,0.15)' }}>
                  <th style={{ padding: '10px 10px', fontWeight: 800, fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', width: 32 }}>#</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: 1, width: 58, textAlign: 'center' }}>Jersey</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: 1, width: 72 }}>Pos</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: 1, width: 68 }}>Bats</th>
                  <th style={{ padding: '10px 10px', fontWeight: 800, fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: 1, width: 44, textAlign: 'center' }}>SP?</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map((slot, i) => (
                  <tr key={i} style={{ borderBottom: i < 8 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: pitcherSlot === i ? 'rgba(198,181,131,0.07)' : 'transparent' }}>
                    <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 800, color: 'rgba(198,181,131,0.4)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '4px 6px' }}>
                      <NameAutocomplete
                        value={slot.name}
                        onChange={v => setSlot(i, 'name', v)}
                        onSelect={p => selectSlotPlayer(i, p)}
                        knownPlayers={knownPlayers}
                        placeholder={`Player ${i + 1}`}
                      />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input value={slot.jersey} onChange={e => setSlot(i, 'jersey', e.target.value)} placeholder="#" className="dark-input" style={{ fontSize: 13, textAlign: 'center' }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <select value={slot.position} onChange={e => setSlot(i, 'position', e.target.value)} className="dark-input" style={{ fontSize: 13 }}>
                        <option value="">—</option>
                        {POSITIONS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <select value={slot.hand} onChange={e => setSlot(i, 'hand', e.target.value)} className="dark-input" style={{ fontSize: 13 }}>
                        <option value="">—</option>
                        <option>L</option><option>R</option><option>S</option>
                      </select>
                    </td>
                    <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                      <input type="radio" name="spSlot" checked={pitcherSlot === i}
                        onChange={() => { setPitcherSlot(i); setSpName(''); setSpJersey(''); setSpHand(''); }}
                        style={{ accentColor: GOLD, width: 15, height: 15, cursor: 'pointer' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Separate SP */}
          <div className="dark-glass-card" style={{ padding: '16px 18px', marginBottom: 22 }}>
            <label className="dark-label">Starting Pitcher (if not in lineup above)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="radio" name="spSlot" checked={pitcherSlot === null}
                onChange={() => setPitcherSlot(null)}
                style={{ accentColor: GOLD, width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
              <NameAutocomplete
                value={spName}
                onChange={v => setSpName(v)}
                onSelect={p => { setSpName(p.name); if (p.jersey) setSpJersey(p.jersey); if (p.hand) setSpHand(p.hand); }}
                knownPlayers={knownPitchers}
                placeholder="Pitcher name"
                disabled={pitcherSlot !== null}
              />
              <input value={spJersey} onChange={e => setSpJersey(e.target.value)} placeholder="#"
                disabled={pitcherSlot !== null} className="dark-input" style={{ width: 52, textAlign: 'center', opacity: pitcherSlot !== null ? 0.4 : 1 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {['L', 'R'].map(h => (
                  <button key={h} type="button" disabled={pitcherSlot !== null}
                    onClick={() => setSpHand(spHand === h ? '' : h)}
                    style={{ padding: '6px 13px', borderRadius: 5, fontWeight: 800, fontSize: 12, cursor: 'pointer', border: `1.5px solid ${spHand === h ? HAND_COLORS[h] : 'rgba(255,255,255,0.15)'}`, background: spHand === h ? `${HAND_COLORS[h]}22` : 'rgba(255,255,255,0.05)', color: spHand === h ? HAND_COLORS[h] : 'rgba(240,236,224,0.5)', opacity: pitcherSlot !== null ? 0.35 : 1, transition: 'all 0.12s', fontFamily: "'Archivo', sans-serif" }}>
                    {h}HP
                  </button>
                ))}
              </div>
            </div>
            {resolvedSP.name && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#4ade80', fontWeight: 700, letterSpacing: 0.2 }}>
                ✓ SP: {resolvedSP.name}{resolvedSP.jersey ? ` #${resolvedSP.jersey}` : ''}{resolvedSP.hand ? ` · ${resolvedSP.hand}HP` : ''}
              </div>
            )}
          </div>

          {error && <div style={{ color: '#f87171', fontWeight: 600, marginBottom: 12, fontSize: 13 }}>{error}</div>}

          <button disabled={!valid || submitting} onClick={handleSubmit}
            className="dark-primary-btn" style={{ width: '100%', padding: '16px', fontSize: 16 }}>
            {submitting ? 'Setting up…' : 'Start Scouting →'}
          </button>
        </div>
      </div>
    </DarkScreenLayout>
  );
}