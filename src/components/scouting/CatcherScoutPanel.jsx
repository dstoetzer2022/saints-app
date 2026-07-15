import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { GOLD, CREAM, LINE_SOFT, PANEL_HI, FONT, darkInputStyle, darkLabelStyle, darkSectionBoxStyle, darkSectionHeadStyle } from '@/lib/liveScoutTheme';
import useOfflineAutosave from '@/hooks/useOfflineAutosave';
import AutosaveTag from '@/components/scouting/AutosaveTag';

const CATCHER_OBS_ENTITY_MAP = { CatcherObservation: base44.entities.CatcherObservation };

const darkSelectStyle = { ...darkInputStyle };

export default function CatcherScoutPanel({ obs }) {
  const [warmup, setWarmup] = useState(obs.warmup_pop_time ?? '');
  const [biThrows, setBiThrows] = useState(obs.between_innings_throws || []);
  const [blockingNotes, setBlockingNotes] = useState(obs.blocking_notes || '');
  const [notes, setNotes] = useState(obs.notes || '');

  const mounted = useRef(false);
  const { schedule, status, pendingCount } = useOfflineAutosave(
    `CatcherObservation:${obs.id}`, 'CatcherObservation', obs.id, CATCHER_OBS_ENTITY_MAP
  );

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const payload = {
      warmup_pop_time: warmup !== '' ? parseFloat(warmup) : null,
      between_innings_throws: biThrows.map(t => ({ base: t.base, time: t.time ? parseFloat(t.time) : null, notes: t.notes || '' })),
      blocking_notes: blockingNotes || null,
      notes: notes || null,
    };
    schedule(payload, () => base44.entities.CatcherObservation.update(obs.id, payload));
  }, [warmup, biThrows, blockingNotes, notes]);

  function addBiThrow() { setBiThrows(t => [...t, { base: '2B', time: '', notes: '' }]); }
  function setBi(i, k, v) { setBiThrows(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function removeBi(i) { setBiThrows(t => t.filter((_, j) => j !== i)); }

  return (
    <div style={{ background: PANEL_HI, border: `1px solid ${LINE_SOFT}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: CREAM, display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT }}>
          {obs.jersey_number && <span style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>#{obs.jersey_number}</span>}
          {obs.catcher_name}
          <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(198,181,131,0.15)', borderRadius: 5, padding: '2px 8px', color: GOLD }}>C</span>
        </div>
        <AutosaveTag status={status} pendingCount={pendingCount} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={darkLabelStyle}>Warmup Pop Time</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 180 }}>
          <input type="number" step="0.01" value={warmup} onChange={e => setWarmup(e.target.value)} placeholder="0.00" style={darkInputStyle} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>sec</span>
        </div>
      </div>

      {/* Between innings throws */}
      <div style={darkSectionBoxStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={darkSectionHeadStyle}>Between-Innings Throws</div>
          <button type="button" onClick={addBiThrow} style={{ fontSize: 12, fontWeight: 800, padding: '8px 14px', minHeight: 36, borderRadius: 7, border: `1.5px solid ${GOLD}`, background: 'transparent', color: GOLD, cursor: 'pointer', fontFamily: FONT }}>+ Add</button>
        </div>
        {biThrows.length === 0 && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No throws logged.</div>}
        {biThrows.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '84px 120px 1fr 36px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <select value={t.base} onChange={e => setBi(i, 'base', e.target.value)} style={darkSelectStyle}><option>2B</option><option>3B</option></select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" step="0.01" value={t.time} onChange={e => setBi(i, 'time', e.target.value)} placeholder="1.89" style={darkInputStyle} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>sec</span>
            </div>
            <input value={t.notes || ''} onChange={e => setBi(i, 'notes', e.target.value)} placeholder="Notes…" style={darkInputStyle} />
            <button type="button" onClick={() => removeBi(i)} style={{ background: 'none', border: 'none', color: '#f87171', fontWeight: 800, fontSize: 20, cursor: 'pointer', padding: 0, width: 36, height: 36 }}>×</button>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={darkLabelStyle}>Blocking Notes</label>
        <textarea rows={2} value={blockingNotes} onChange={e => setBlockingNotes(e.target.value)} style={{ ...darkInputStyle, resize: 'vertical' }} placeholder="Blocking technique, weaknesses, dirt ball handling…" />
      </div>

      <div>
        <label style={darkLabelStyle}>Notes</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ ...darkInputStyle, resize: 'vertical' }} />
      </div>
    </div>
  );
}
