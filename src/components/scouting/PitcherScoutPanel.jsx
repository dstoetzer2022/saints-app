import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { GOLD, CREAM, LINE_SOFT, PANEL_HI, FONT, darkInputStyle, darkLabelStyle, darkSectionBoxStyle, darkSectionHeadStyle } from '@/lib/liveScoutTheme';
import useOfflineAutosave from '@/hooks/useOfflineAutosave';
import AutosaveTag from '@/components/scouting/AutosaveTag';

const PITCHER_OBS_ENTITY_MAP = { PitcherObservation: base44.entities.PitcherObservation };

const initArr = (v) => Array.isArray(v) ? v : v != null ? [v] : [];

// UCLA segments: U, U-C, C, C-L, L, L-A, A (7 selectable bins)
// Dashes are their own selectable bins (the zone between two letters)
const UCLA_BINS = ['U', 'U-C', 'C', 'C-L', 'L', 'L-A', 'A'];

// Exported so LiveScoutingHub's Battery hero can reuse the same widget for
// both hold rows without duplicating the tap-target styling.
export function UCLASelector({ value, onChange, label }) {
  return (
    <div>
      {label && <label style={darkLabelStyle}>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {UCLA_BINS.map(bin => {
          const isDash = bin.includes('-');
          const active = value === bin;
          return (
            <button
              key={bin}
              type="button"
              onClick={() => onChange(active ? '' : bin)}
              style={{
                height: isDash ? 32 : 44,
                width: isDash ? 28 : 44,
                borderRadius: isDash ? 6 : 8,
                fontWeight: 800,
                fontSize: isDash ? 12 : 15,
                cursor: 'pointer',
                border: `2px solid ${active ? GOLD : 'rgba(198,181,131,0.3)'}`,
                background: active ? GOLD : 'rgba(255,255,255,0.04)',
                color: active ? '#07111c' : isDash ? 'rgba(255,255,255,0.3)' : CREAM,
                boxShadow: active ? '0 0 14px rgba(198,181,131,0.4)' : 'none',
                transition: 'all 0.12s',
                fontFamily: FONT,
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {isDash ? '—' : bin}
            </button>
          );
        })}
      </div>
      {value && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6, fontWeight: 700 }}>{value}</div>
      )}
    </div>
  );
}

function ReadingInput({ label, readings, onAdd, onRemove }) {
  const [val, setVal] = useState('');
  function add() { const v = parseFloat(val); if (!isNaN(v)) { onAdd(v); setVal(''); } }
  return (
    <div>
      <label style={darkLabelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
          placeholder="0.00" style={{ ...darkInputStyle, flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add}
          style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, border: `1.5px solid ${GOLD}`, background: 'transparent', fontWeight: 800, fontSize: 19, color: GOLD, cursor: 'pointer', fontFamily: FONT }}>+</button>
      </div>
      {readings.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {readings.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 10px', fontSize: 13, fontWeight: 700, color: CREAM }}>
              {r.toFixed(2)}s
              <button type="button" onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', color: '#f87171', fontWeight: 800, cursor: 'pointer', padding: 0, fontSize: 15, lineHeight: 1 }}>×</button>
            </span>
          ))}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', alignSelf: 'center', marginLeft: 4 }}>
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
  const { schedule, status, pendingCount } = useOfflineAutosave(
    `PitcherObservation:${obs.id}`, 'PitcherObservation', obs.id, PITCHER_OBS_ENTITY_MAP
  );

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const payload = {
      time_to_plate_1b: r1b,
      time_to_plate_2b: r2b,
      time_to_plate_slide: slideReadings,
      slide_step_notes: slideNotes || null,
      pickoff_moves: pickoff ? pickoff.split(',').map(s => s.trim()).filter(Boolean) : [],
      ucla_hold_start: uclaHold1b || null,
      ucla_hold_2b: uclaHold2b || null,
      ucla_hold_end: null,
      notes: notes || null,
    };
    schedule(payload, () => base44.entities.PitcherObservation.update(obs.id, payload));
  }, [r1b, r2b, slideReadings, slideNotes, pickoff, uclaHold1b, uclaHold2b, notes]);

  return (
    <div style={{ background: PANEL_HI, border: `1px solid ${LINE_SOFT}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: CREAM, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: FONT }}>
          {obs.jersey_number && <span style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>#{obs.jersey_number}</span>}
          {obs.pitcher_name}
          {obs.pitcher_hand && <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(198,181,131,0.15)', borderRadius: 5, padding: '2px 8px', color: GOLD }}>{obs.pitcher_hand}HP</span>}
        </div>
        <AutosaveTag status={status} pendingCount={pendingCount} />
      </div>

      {/* Time to plate row — 3 columns including slide step */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ReadingInput label="Time to Plate — 1B (sec)" readings={r1b}
          onAdd={v => setR1b(p => [...p, v])} onRemove={i => setR1b(p => p.filter((_, j) => j !== i))} />
        <ReadingInput label="Time to Plate — 2B (sec)" readings={r2b}
          onAdd={v => setR2b(p => [...p, v])} onRemove={i => setR2b(p => p.filter((_, j) => j !== i))} />
        <ReadingInput label="Slide Step (sec)" readings={slideReadings}
          onAdd={v => setSlideReadings(p => [...p, v])} onRemove={i => setSlideReadings(p => p.filter((_, j) => j !== i))} />
      </div>

      {/* UCLA Hold */}
      <div style={darkSectionBoxStyle}>
        <div style={darkSectionHeadStyle}>UCLA Hold Position</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <UCLASelector label="Runner on 1st" value={uclaHold1b} onChange={setUclaHold1b} />
          <UCLASelector label="Runner on 2nd" value={uclaHold2b} onChange={setUclaHold2b} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={darkLabelStyle}>Pickoff Moves</label>
        <input value={pickoff} onChange={e => setPickoff(e.target.value)} style={darkInputStyle} placeholder="balk move, quick pick…" />
      </div>

      <div>
        <label style={darkLabelStyle}>Notes</label>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ ...darkInputStyle, resize: 'vertical' }} />
      </div>
    </div>
  );
}
