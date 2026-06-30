import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, BORDER, TINT, inputStyle, labelStyle } from '@/lib/ds';
import useAutosave from '@/hooks/useAutosave';
import AutosaveTag from '@/components/scouting/AutosaveTag';

const initArr = (v) => Array.isArray(v) ? v : v != null ? [v] : [];

// UCLA segments: U, U-C, C, C-L, L, L-A, A (7 selectable bins)
// Dashes are their own selectable bins (the zone between two letters)
const UCLA_BINS = ['U', 'U-C', 'C', 'C-L', 'L', 'L-A', 'A'];

function UCLASelector({ value, onChange, label }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {UCLA_BINS.map(bin => {
          const isDash = bin.includes('-');
          const active = value === bin;
          return (
            <button
              key={bin}
              type="button"
              onClick={() => onChange(active ? '' : bin)}
              style={{
                height: isDash ? 30 : 38,
                width: isDash ? 28 : 38,
                borderRadius: isDash ? 4 : 6,
                fontWeight: 800,
                fontSize: isDash ? 13 : 16,
                cursor: 'pointer',
                border: `2px solid ${active ? GOLD : BORDER}`,
                background: active ? NAVY : '#fff',
                color: active ? GOLD : isDash ? '#aaa' : NAVY,
                transition: 'all 0.12s',
                fontFamily: "'Archivo', sans-serif",
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {isDash ? '—' : bin}
            </button>
          );
        })}
      </div>
      {value && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 4, fontWeight: 600 }}>{value}</div>
      )}
    </div>
  );
}

function ReadingInput({ label, readings, onAdd, onRemove }) {
  const [val, setVal] = useState('');
  function add() { const v = parseFloat(val); if (!isNaN(v)) { onAdd(v); setVal(''); } }
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
          placeholder="0.00" style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add}
          style={{ padding: '0 10px', borderRadius: 4, border: `1.5px solid ${NAVY}`, background: '#fff', fontWeight: 700, fontSize: 15, color: NAVY, cursor: 'pointer' }}>+</button>
      </div>
      {readings.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {readings.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
              {r.toFixed(2)}s
              <button type="button" onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          ))}
          <span style={{ fontSize: 11, color: '#888', alignSelf: 'center', marginLeft: 4 }}>
            avg {(readings.reduce((a, b) => a + b, 0) / readings.length).toFixed(2)}s
          </span>
        </div>
      )}
    </div>
  );
}

export default function PitcherScoutPanel({ obs }) {
  const [r1b, setR1b] = useState(initArr(obs.time_to_plate_1b));
  const [r2b, setR2b] = useState(initArr(obs.time_to_plate_2b));
  const [slideReadings, setSlideReadings] = useState(initArr(obs.time_to_plate_slide));
  const [slideNotes, setSlideNotes] = useState(obs.slide_step_notes || '');
  const [pickoff, setPickoff] = useState((obs.pickoff_moves || []).join(', '));
  const [uclaHold1b, setUclaHold1b] = useState(obs.ucla_hold_start || '');
  const [uclaHold2b, setUclaHold2b] = useState(obs.ucla_hold_2b || '');
  const [notes, setNotes] = useState(obs.notes || '');

  const mounted = useRef(false);
  const { schedule, status } = useAutosave();

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    schedule(() => base44.entities.PitcherObservation.update(obs.id, {
      time_to_plate_1b: r1b,
      time_to_plate_2b: r2b,
      time_to_plate_slide: slideReadings,
      slide_step_notes: slideNotes || null,
      pickoff_moves: pickoff ? pickoff.split(',').map(s => s.trim()).filter(Boolean) : [],
      ucla_hold_start: uclaHold1b || null,
      ucla_hold_2b: uclaHold2b || null,
      ucla_hold_end: null,
      notes: notes || null,
    }));
  }, [r1b, r2b, slideReadings, slideNotes, pickoff, uclaHold1b, uclaHold2b, notes]);

  return (
    <div style={{ maxWidth: 600, background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: NAVY, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {obs.jersey_number && <span style={{ fontWeight: 700, fontSize: 13, color: '#888' }}>#{obs.jersey_number}</span>}
          {obs.pitcher_name}
          {obs.pitcher_hand && <span style={{ fontSize: 12, fontWeight: 700, background: '#e8e4d9', borderRadius: 4, padding: '2px 7px', color: '#555' }}>{obs.pitcher_hand}HP</span>}
        </div>
        <AutosaveTag status={status} />
      </div>

      {/* Time to plate row — 3 columns including slide step */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
        <ReadingInput label="Time to Plate — 1B (sec)" readings={r1b}
          onAdd={v => setR1b(p => [...p, v])} onRemove={i => setR1b(p => p.filter((_, j) => j !== i))} />
        <ReadingInput label="Time to Plate — 2B (sec)" readings={r2b}
          onAdd={v => setR2b(p => [...p, v])} onRemove={i => setR2b(p => p.filter((_, j) => j !== i))} />
        <ReadingInput label="Slide Step (sec)" readings={slideReadings}
          onAdd={v => setSlideReadings(p => [...p, v])} onRemove={i => setSlideReadings(p => p.filter((_, j) => j !== i))} />
      </div>

      {/* UCLA Hold */}
      <div style={{ background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 11, color: NAVY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>UCLA Hold Position</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <UCLASelector label="Runner on 1st" value={uclaHold1b} onChange={setUclaHold1b} />
          <UCLASelector label="Runner on 2nd" value={uclaHold2b} onChange={setUclaHold2b} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Pickoff Moves</label>
        <input value={pickoff} onChange={e => setPickoff(e.target.value)} style={inputStyle} placeholder="balk move, quick pick…" />
      </div>

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </div>
  );
}