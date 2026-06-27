import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, input } from '@/lib/ds';

export { input as inputStyle };

export const label = {
  display: 'block', fontWeight: 600, fontSize: 12,
  color: NAVY, marginBottom: 4, letterSpacing: '0.02em',
};

export function Field({ label: lbl, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <label style={label}>{lbl}</label>
      {children}
    </div>
  );
}

export function useGames() {
  const [games, setGames] = useState([]);
  useEffect(() => { base44.entities.Game.list('-date', 50).then(setGames); }, []);
  return games;
}

export function useTeams() {
  const [teams, setTeams] = useState([]);
  useEffect(() => { base44.entities.Team.list('name', 100).then(setTeams); }, []);
  return teams;
}

export function GameSelect({ value, onChange, games }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={input} required>
      <option value="">— select game —</option>
      {games.map(g => (
        <option key={g.id} value={g.id}>
          {g.date} — {g.away_team_code} vs {g.home_team_code}
        </option>
      ))}
    </select>
  );
}

export function TeamSelect({ value, onChange, teams }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={input}>
      <option value="">— select team —</option>
      {teams.map(t => <option key={t.code} value={t.code}>{t.name} ({t.code})</option>)}
    </select>
  );
}

export function HandToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {['R', 'L'].map(h => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(h)}
          style={{
            padding: '5px 14px', borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            border: `1.5px solid ${NAVY}`,
            background: value === h ? NAVY : '#fff',
            color: value === h ? GOLD : NAVY,
            transition: 'all 0.15s',
          }}
        >
          {h}
        </button>
      ))}
    </div>
  );
}

export function ToggleBtn({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            padding: '5px 12px', borderRadius: 5, fontWeight: 600, fontSize: 12, cursor: 'pointer',
            border: `1.5px solid ${NAVY}`,
            background: value === o.value ? NAVY : '#fff',
            color: value === o.value ? GOLD : NAVY,
            transition: 'all 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TallyCounter({ value, onChange, label: lbl }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lbl && <span style={label}>{lbl}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          style={{ width: 28, height: 28, borderRadius: 5, border: `1.5px solid ${NAVY}`, background: '#fff', color: NAVY, fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
          −
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: NAVY, minWidth: 20, textAlign: 'center' }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          style={{ width: 28, height: 28, borderRadius: 5, border: `1.5px solid ${NAVY}`, background: '#fff', color: NAVY, fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
          +
        </button>
      </div>
    </div>
  );
}

export function ColorPicker({ value, onChange }) {
  const opts = [
    { val: 'fast', color: '#22c55e', label: 'Fast' },
    { val: 'average', color: '#eab308', label: 'Avg' },
    { val: 'slow', color: '#ef4444', label: 'Slow' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {opts.map(o => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(value === o.val ? '' : o.val)}
          title={o.label}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: o.color,
            border: value === o.val ? `3px solid ${NAVY}` : '2px solid #ccc',
            transform: value === o.val ? 'scale(1.15)' : 'scale(1)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            padding: 0,
          }}
        />
      ))}
      {value && (
        <button type="button" onClick={() => onChange('')}
          style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ×
        </button>
      )}
    </div>
  );
}

export function AggressionColorPicker({ value, onChange }) {
  const opts = [
    { val: 'aggressive', color: '#22c55e', label: 'Aggressive' },
    { val: 'average', color: '#eab308', label: 'Average' },
    { val: 'passive', color: '#ef4444', label: 'Passive' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {opts.map(o => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(value === o.val ? '' : o.val)}
          title={o.label}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: o.color,
            border: value === o.val ? `3px solid ${NAVY}` : '2px solid #ccc',
            transform: value === o.val ? 'scale(1.15)' : 'scale(1)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            padding: 0,
          }}
        />
      ))}
      {value && (
        <button type="button" onClick={() => onChange('')}
          style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ×
        </button>
      )}
    </div>
  );
}

export function SubmitBtn({ loading, label: lbl = 'Save' }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        background: loading ? '#999' : NAVY,
        color: GOLD,
        border: `1.5px solid ${loading ? '#999' : NAVY}`,
        borderRadius: 6,
        fontWeight: 700,
        padding: '9px 24px',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: "'Archivo', sans-serif",
        fontSize: 14,
        transition: 'all 0.15s',
      }}
    >
      {loading ? 'Saving…' : lbl}
    </button>
  );
}

export function FormBox({ children, onSubmit }) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: '#faf9f5',
        border: `1.5px solid #e0dbd0`,
        borderRadius: 8,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginTop: 4,
      }}
    >
      {children}
    </form>
  );
}