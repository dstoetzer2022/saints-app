import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, TINT, inputStyle, labelStyle } from '@/lib/ds';
import UCLASelector from '@/components/obs/UCLASelector';
import TallyCounter from '@/components/shared/TallyCounter';
import ToggleBtn from '@/components/shared/ToggleBtn';

const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
const Field = ({ label, children, full }) => (
  <div style={full ? { gridColumn: '1 / -1' } : {}}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

export default function PitcherObsForm({ games }) {
  const [f, setF] = useState({ game_id: '', pitcher_name: '', hand: '', ttp1b: '', ttp2b: '', slide_step: '', ucla: '', pickoff_moves: '', pickoff_attempts: 0, notes: '' });
  const [existingMoves, setExistingMoves] = useState([]);
  const [existingNames, setExistingNames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    base44.entities.PitcherObservation.list('pitcher_name', 500).then(obs => {
      setExistingNames([...new Set(obs.map(o => o.pitcher_name).filter(Boolean))]);
      const moves = new Set();
      obs.forEach(o => (o.pickoff_moves || []).forEach(m => moves.add(m)));
      setExistingMoves([...moves]);
    });
  }, []);

  function set(k, v) { setF(p => ({ ...p, [k]: v })); }

  function uclaStart(v) { return v ? v.split('·')[0] : null; }
  function uclaEnd(v) { return v ? v.split('·').slice(-1)[0] : null; }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await base44.entities.PitcherObservation.create({
        game_id: f.game_id || null,
        pitcher_name: f.pitcher_name,
        pitcher_team: '',
        pitcher_hand: f.hand || null,
        time_to_plate_1b: f.ttp1b ? parseFloat(f.ttp1b) : null,
        time_to_plate_2b: f.ttp2b ? parseFloat(f.ttp2b) : null,
        has_slide_step: f.slide_step === 'YES' ? true : f.slide_step === 'NO' ? false : null,
        ucla_hold_start: uclaStart(f.ucla),
        ucla_hold_end: uclaEnd(f.ucla),
        pickoff_moves: f.pickoff_moves ? f.pickoff_moves.split(',').map(s => s.trim()).filter(Boolean) : [],
        notes: f.notes || null,
      });
      setSaved(true);
      setF({ game_id: '', pitcher_name: '', hand: '', ttp1b: '', ttp2b: '', slide_step: '', ucla: '', pickoff_moves: '', pickoff_attempts: 0, notes: '' });
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
        <Field label="Pitcher Name">
          <input list="pitcher-names" value={f.pitcher_name} onChange={e => set('pitcher_name', e.target.value)} required style={inputStyle} placeholder="Last, First" />
          <datalist id="pitcher-names">{existingNames.map(n => <option key={n} value={n} />)}</datalist>
        </Field>
        <Field label="Hand">
          <ToggleBtn options={['R', 'L']} value={f.hand} onChange={v => set('hand', v)} />
        </Field>
        <Field label="Time to Plate — 1B">
          <input type="number" step="0.01" value={f.ttp1b} onChange={e => set('ttp1b', e.target.value)} style={inputStyle} placeholder="2.1s" />
        </Field>
        <Field label="Time to Plate — 2B">
          <input type="number" step="0.01" value={f.ttp2b} onChange={e => set('ttp2b', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Slide Step">
          <ToggleBtn options={['YES', 'NO']} value={f.slide_step} onChange={v => set('slide_step', v)} />
        </Field>
        <Field label="UCLA Hold" full>
          <UCLASelector value={f.ucla} onChange={v => set('ucla', v)} />
        </Field>
        <Field label="Pickoff Moves" full>
          <input value={f.pickoff_moves} onChange={e => set('pickoff_moves', e.target.value)} style={inputStyle} placeholder="balk move, quick pick…" />
          {existingMoves.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {existingMoves.map(m => (
                <button key={m} type="button"
                  onClick={() => set('pickoff_moves', f.pickoff_moves ? f.pickoff_moves + ', ' + m : m)}
                  style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, background: GOLD, color: NAVY, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Pickoff Attempts">
          <TallyCounter value={f.pickoff_attempts} onChange={v => set('pickoff_attempts', v)} />
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={f.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button type="submit" disabled={saving} style={{ background: NAVY, color: GOLD, border: `1.5px solid ${NAVY}`, borderRadius: 6, fontWeight: 700, padding: '9px 20px', cursor: 'pointer', fontSize: 13 }}>
          {saving ? 'Saving…' : 'Save Pitcher Observation'}
        </button>
        {saved && <span style={{ color: '#2c5530', fontWeight: 600, fontSize: 13 }}>Saved ✓</span>}
        {err && <span style={{ color: '#991b1b', fontWeight: 600, fontSize: 13 }}>{err}</span>}
      </div>
    </form>
  );
}