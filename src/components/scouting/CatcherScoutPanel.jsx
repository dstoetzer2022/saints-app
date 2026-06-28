import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, BORDER, TINT, inputStyle, labelStyle } from '@/lib/ds';
import useAutosave from '@/hooks/useAutosave';
import AutosaveTag from '@/components/scouting/AutosaveTag';

export default function CatcherScoutPanel({ obs }) {
  const [warmup, setWarmup] = useState(obs.warmup_pop_time ?? '');
  const [biThrows, setBiThrows] = useState(obs.between_innings_throws || []);
  const [blockingNotes, setBlockingNotes] = useState(obs.blocking_notes || '');
  const [notes, setNotes] = useState(obs.notes || '');

  const mounted = useRef(false);
  const { schedule, status } = useAutosave();

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    schedule(() => base44.entities.CatcherObservation.update(obs.id, {
      warmup_pop_time: warmup !== '' ? parseFloat(warmup) : null,
      between_innings_throws: biThrows.map(t => ({ base: t.base, time: t.time ? parseFloat(t.time) : null, notes: t.notes || '' })),
      blocking_notes: blockingNotes || null,
      notes: notes || null,
    }));
  }, [warmup, biThrows, blockingNotes, notes]);

  function addBiThrow() { setBiThrows(t => [...t, { base: '2B', time: '', notes: '' }]); }
  function setBi(i, k, v) { setBiThrows(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function removeBi(i) { setBiThrows(t => t.filter((_, j) => j !== i)); }

  const sectionHead = { fontWeight: 800, fontSize: 11, color: NAVY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 };

  return (
    <div style={{ maxWidth: 560, background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}>
          {obs.jersey_number && <span style={{ fontWeight: 700, fontSize: 13, color: '#888' }}>#{obs.jersey_number}</span>}
          {obs.catcher_name}
          <span style={{ fontSize: 12, fontWeight: 700, background: '#e8e4d9', borderRadius: 4, padding: '2px 7px', color: '#555' }}>C</span>
        </div>
        <AutosaveTag status={status} />
      </div>

      {/* Between innings throws */}
      <div style={{ marginBottom: 16, background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={sectionHead}>Between Innings Throws</div>
          <button type="button" onClick={addBiThrow} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: `1.5px solid ${NAVY}`, background: '#fff', color: NAVY, cursor: 'pointer' }}>+ Add</button>
        </div>
        {biThrows.length === 0 && <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No throws logged.</div>}
        {biThrows.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 28px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <select value={t.base} onChange={e => setBi(i, 'base', e.target.value)} style={inputStyle}><option>2B</option><option>3B</option></select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" step="0.01" value={t.time} onChange={e => setBi(i, 'time', e.target.value)} placeholder="1.89" style={inputStyle} />
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>sec</span>
            </div>
            <input value={t.notes || ''} onChange={e => setBi(i, 'notes', e.target.value)} placeholder="Notes…" style={inputStyle} />
            <button type="button" onClick={() => removeBi(i)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
      </div>

      {/* Blocking notes */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Blocking Notes</label>
        <textarea rows={2} value={blockingNotes} onChange={e => setBlockingNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Blocking technique, weaknesses, dirt ball handling…" />
      </div>

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
    </div>
  );
}