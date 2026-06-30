import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, TINT, inputStyle, labelStyle } from '@/lib/ds';
import TallyCounter from '@/components/shared/TallyCounter';
import { SpeedPicker, AggressionPicker } from '@/components/shared/ColorPicker';

const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
const Field = ({ label, children, full }) => (
  <div style={full ? { gridColumn: '1 / -1' } : {}}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

export default function BaserunnerObsForm({ games }) {
  const [f, setF] = useState({ game_id: '', runner_name: '', runner_team: '', speed: '', aggression: '', pickoff_attempts: 0, dirt_ball_advances: 0, notes: '' });
  const [teams, setTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { base44.entities.Team.list('name', 100).then(setTeams); }, []);
  function set(k, v) { setF(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await base44.entities.BaserunnerObservation.create({
        game_id: f.game_id || null,
        runner_name: f.runner_name,
        runner_team: f.runner_team || null,
        speed_rating: f.speed || null,
        aggression_rating: f.aggression || null,
        pickoff_attempts: f.pickoff_attempts,
        dirt_ball_advances: f.dirt_ball_advances,
        notes: f.notes || null,
      });
      setSaved(true);
      setF({ game_id: '', runner_name: '', runner_team: '', speed: '', aggression: '', pickoff_attempts: 0, dirt_ball_advances: 0, notes: '' });
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
        <Field label="Runner Name">
          <input required value={f.runner_name} onChange={e => set('runner_name', e.target.value)} style={inputStyle} placeholder="Last, First" />
        </Field>
        <Field label="Team">
          <select value={f.runner_team} onChange={e => set('runner_team', e.target.value)} style={inputStyle}>
            <option value="">— select team —</option>
            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Speed Rating">
          <SpeedPicker value={f.speed} onChange={v => set('speed', v)} />
        </Field>
        <Field label="Aggression Rating">
          <AggressionPicker value={f.aggression} onChange={v => set('aggression', v)} />
        </Field>
        <Field label="Pickoff Attempts">
          <TallyCounter value={f.pickoff_attempts} onChange={v => set('pickoff_attempts', v)} />
        </Field>
        <Field label="Dirt Ball Advances">
          <TallyCounter value={f.dirt_ball_advances} onChange={v => set('dirt_ball_advances', v)} />
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={f.notes} onChange={e => set('notes', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button type="submit" disabled={saving} style={{ background: NAVY, color: GOLD, border: `1.5px solid ${NAVY}`, borderRadius: 6, fontWeight: 700, padding: '9px 20px', cursor: 'pointer', fontSize: 13 }}>
          {saving ? 'Saving…' : 'Save Baserunner Observation'}
        </button>
        {saved && <span style={{ color: '#2c5530', fontWeight: 600, fontSize: 13 }}>Saved ✓</span>}
        {err && <span style={{ color: '#991b1b', fontWeight: 600, fontSize: 13 }}>{err}</span>}
      </div>
    </form>
  );
}