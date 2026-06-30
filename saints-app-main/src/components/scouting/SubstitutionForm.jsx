import React, { useState, useEffect, useRef } from 'react';
import { NAVY, GOLD, BORDER, TINT, inputStyle, labelStyle } from '@/lib/ds';
import { base44 } from '@/api/base44Client';
import { normalizeName } from '@/lib/statsUtils';

const btnBase = { fontFamily: "'Archivo', sans-serif", fontWeight: 700, borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const primaryBtn = { ...btnBase, background: NAVY, color: GOLD, border: 'none', padding: '9px 22px' };

const HAND_COLORS = { L: '#f97316', R: '#3b82f6', S: '#a855f7' };

function normalizeHand(h) {
  if (!h) return '';
  const v = h.trim();
  if (v === 'L' || v === 'R' || v === 'S') return v;
  if (v.toLowerCase().startsWith('l')) return 'L';
  if (v.toLowerCase().startsWith('r')) return 'R';
  if (v.toLowerCase().startsWith('s') || v.toLowerCase() === 'both') return 'S';
  return '';
}

function normalizeThrow(h) {
  if (!h) return '';
  const v = h.trim();
  if (v === 'L' || v === 'R') return v;
  if (v.toLowerCase().startsWith('l')) return 'L';
  if (v.toLowerCase().startsWith('r')) return 'R';
  return '';
}

function NameAutocomplete({ value, onChange, onSelect, knownPlayers, placeholder }) {
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
    <div ref={ref} style={{ position: 'relative' }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder={placeholder} style={inputStyle} autoComplete="off" />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: '#0e1f30', border: '1px solid rgba(198,181,131,0.3)', borderRadius: 6, marginTop: 3, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {matches.map((p, i) => (
            <button key={i} type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(p); setOpen(false); }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: i < matches.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Archivo', sans-serif" }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(198,181,131,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f0ece0' }}>{p.name}</span>
              {p.jersey && <span style={{ fontSize: 11, fontWeight: 600, color: GOLD }}>#{p.jersey}</span>}
              {p.hand && <span style={{ fontSize: 10, fontWeight: 800, color: HAND_COLORS[p.hand] || '#aaa', background: `${HAND_COLORS[p.hand] || '#aaa'}18`, border: `1px solid ${HAND_COLORS[p.hand] || '#aaa'}44`, borderRadius: 3, padding: '1px 5px' }}>{p.hand}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubstitutionForm({ lineup, currentPitcher, opponentName, onPitcherSub, onHitterSub, onCancel }) {
  const [type, setType] = useState('hitter');
  const [name, setName] = useState('');
  const [jersey, setJersey] = useState('');
  const [hand, setHand] = useState('');
  const [slotIndex, setSlotIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [knownPlayers, setKnownPlayers] = useState([]);
  const [knownPitchers, setKnownPitchers] = useState([]);

  useEffect(() => {
    if (!opponentName) return;
    Promise.all([
      base44.entities.BaserunnerObservation.filter({ runner_team: opponentName }, 'runner_name', 200),
      base44.entities.PitcherObservation.filter({ pitcher_team: opponentName }, 'pitcher_name', 100),
      base44.entities.TrackmanPitch.filter({ batter_team: opponentName }, 'batter_name', 500),
      base44.entities.TrackmanPitch.filter({ pitcher_team: opponentName }, 'pitcher_name', 500),
    ]).then(([runners, pitchers, tmBatters, tmPitchers]) => {
      const map = {};
      const mergeHitter = (rawName, jersey, hand) => {
        if (!rawName) return;
        const name = normalizeName(rawName);
        const key = name.toLowerCase();
        const normHand = normalizeHand(hand);
        if (!map[key]) map[key] = { name, jersey: jersey || '', hand: normHand };
        else { if (!map[key].jersey && jersey) map[key].jersey = jersey; if (!map[key].hand && normHand) map[key].hand = normHand; }
      };
      runners.forEach(r => mergeHitter(r.runner_name, r.jersey_number, r.bats));
      tmBatters.forEach(r => mergeHitter(r.batter_name, null, r.batter_hand));
      setKnownPlayers(Object.values(map).sort((a, b) => a.name.localeCompare(b.name)));

      const pmap = {};
      const mergePitcher = (rawName, jersey, hand) => {
        if (!rawName) return;
        const name = normalizeName(rawName);
        const key = name.toLowerCase();
        const normHand = normalizeThrow(hand);
        if (!pmap[key]) pmap[key] = { name, jersey: jersey || '', hand: normHand };
        else { if (!pmap[key].jersey && jersey) pmap[key].jersey = jersey; if (!pmap[key].hand && normHand) pmap[key].hand = normHand; }
      };
      pitchers.forEach(p => mergePitcher(p.pitcher_name, p.jersey_number, p.pitcher_hand));
      tmPitchers.forEach(p => mergePitcher(p.pitcher_name, null, p.pitcher_hand));
      setKnownPitchers(Object.values(pmap).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [opponentName]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    if (type === 'pitcher') {
      await onPitcherSub({ name: name.trim(), jersey, hand });
    } else {
      await onHitterSub({ name: name.trim(), jersey, hand, slotIndex });
    }
    setSubmitting(false);
  }

  const typeBtn = (val, label) => (
    <button type="button" onClick={() => { setType(val); setHand(''); }}
      style={{ flex: 1, padding: '8px 0', borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        border: `1.5px solid ${NAVY}`, background: type === val ? NAVY : '#fff', color: type === val ? GOLD : NAVY }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: TINT, border: `2px solid ${GOLD}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: NAVY, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Make Substitution
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {typeBtn('hitter', '🔄 Pinch Hitter')}
        {typeBtn('pitcher', '⚾ Relief Pitcher')}
      </div>

      {type === 'hitter' && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Replacing (lineup slot)</label>
          <select value={slotIndex} onChange={e => setSlotIndex(Number(e.target.value))} style={inputStyle}>
            {lineup.map((s, i) => (
              <option key={i} value={i}>#{i + 1} — {s.name || `Slot ${i + 1}`} ({s.position || '—'})</option>
            ))}
          </select>
        </div>
      )}

      {type === 'pitcher' && currentPitcher && (
        <div style={{ fontSize: 12.5, color: '#555', marginBottom: 10 }}>
          Replacing: <span style={{ fontWeight: 700, color: NAVY }}>{currentPitcher}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: 8, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <NameAutocomplete
            value={name}
            onChange={setName}
            onSelect={p => { setName(p.name); if (p.jersey) setJersey(p.jersey); if (p.hand) setHand(p.hand); }}
            knownPlayers={type === 'pitcher' ? knownPitchers : knownPlayers}
            placeholder="Player name"
          />
        </div>
        <div>
          <label style={labelStyle}>Jersey</label>
          <input value={jersey} onChange={e => setJersey(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="#" />
        </div>
        <div>
          <label style={labelStyle}>{type === 'pitcher' ? 'Throws' : 'Bats'}</label>
          <select value={hand} onChange={e => setHand(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            <option value="L">L</option>
            <option value="R">R</option>
            {type === 'hitter' && <option value="S">S</option>}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} disabled={!name.trim() || submitting}
          style={{ ...primaryBtn, opacity: !name.trim() || submitting ? 0.4 : 1 }}>
          {submitting ? 'Creating…' : 'Confirm Sub'}
        </button>
        <button onClick={onCancel} style={{ ...btnBase, background: 'none', border: `1.5px solid ${BORDER}`, color: NAVY, padding: '9px 16px' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}