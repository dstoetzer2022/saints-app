import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, TINT, inputStyle, labelStyle } from '@/lib/ds';
import ToggleBtn from '@/components/shared/ToggleBtn';

const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
const Field = ({ label, children, full }) => (
  <div style={full ? { gridColumn: '1 / -1' } : {}}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

export default function CatcherObsForm({ games }) {
  const [f, setF] = useState({ game_id: '', catcher_name: '', hand: '', warmup_pop: '', notes: '' });
  const [attempts, setAttempts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  function set(k, v) { setF(p => ({ ...p, [k]: v })); }
  function addAttempt() { setAttempts(a => [...a, { base: '2B', pop_time: '', result: 'Out' }]); }
  function setAtt(i, k, v) { setAttempts(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function removeAtt(i) { setAttempts(a => a.filter((_, j) => j !== i)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await base44.entities.CatcherObservation.create({
        game_id: f.game_id || null,
        catcher_name: f.catcher_name,
        catcher_team: '',
        warmup_pop_time: f.warmup_pop ? parseFloat(f.warmup_pop) : null,
        steal_attempts: attempts.map(a => ({ base: a.base, pop_time: a.pop_time ? parseFloat(a.pop_time) : null, result: a.result.toLowerCase().replace(' ', '_') })),
        notes: f.notes || null,
      });
      setSaved(true);
      setF({ game_id: '', catcher_name: '', hand: '', warmup_pop: '', notes: '' });
      setAttempts([]);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message || 'Save failed'); }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: TINT, border: `1.5px solid #e0dbd0`, borderRadius: 8, padding: '20px 20px', marginTop: 8 }}>
      <div style={grid2}>
        <Field label="Game" full>
          <select value={f.game_id} onChange={e => set('game_id', e.target.value)} style={inputStyle}>
            <option value="">— select game —</option>
            {games.map(g => <option key={g.id} value={g.id}>{g.date} — {g.away_team_code} vs {g.home_team_code}</option>)}
          </select>
        </Field>
        <Field label="Catcher Name">
          <input required value={f.catcher_name} onChange={e => set('catcher_name', e.target.value)} style={inputStyle} placeholder="Last, First" />
        </Field>
        <Field label="Hand">
          <ToggleBtn options={['R', 'L']} value={f.hand} onChange={v => set('hand', v)} />
        </Field>
        <Field label="Warmup Pop Time">
          <input type="number" step="0.01" value={f.warmup_pop} onChange={e => set('warmup_pop', e.target.value)} style={inputStyle} placeholder="1.89" />
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={labelStyle}>Steal Attempts</label>
          <button type="button" onClick={addAttempt} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: `1.5px solid ${NAVY}`, background: '#fff', color: NAVY, cursor: 'pointer' }}>+ Add</button>
        </div>
        {attempts.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={a.base} onChange={e => setAtt(i, 'base', e.target.value)} style={inputStyle}>
              <option>2B</option><option>3B</option>
            </select>
            <input type="number" step="0.01" value={a.pop_time} onChange={e => setAtt(i, 'pop_time', e.target.value)} placeholder="Pop time" style={inputStyle} />
            <select value={a.result} onChange={e => setAtt(i, 'result', e.target.value)} style={inputStyle}>
              <option>Out</option><option>Safe</option><option>No Throw</option>
            </select>
            <button type="button" onClick={() => removeAtt(i)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>Notes</label>
        <textarea rows={3} value={f.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button type="submit" disabled={saving} style={{ background: NAVY, color: GOLD, border: `1.5px solid ${NAVY}`, borderRadius: 6, fontWeight: 700, padding: '9px 20px', cursor: 'pointer', fontSize: 13 }}>
          {saving ? 'Saving…' : 'Save Catcher Observation'}
        </button>
        {saved && <span style={{ color: '#2c5530', fontWeight: 600, fontSize: 13 }}>Saved ✓</span>}
        {err && <span style={{ color: '#991b1b', fontWeight: 600, fontSize: 13 }}>{err}</span>}
      </div>
    </form>
  );
}