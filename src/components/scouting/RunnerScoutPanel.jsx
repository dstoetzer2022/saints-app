import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, BORDER, TINT, inputStyle, labelStyle } from '@/lib/ds';
import useOfflineAutosave from '@/hooks/useOfflineAutosave';
import AutosaveTag from '@/components/scouting/AutosaveTag';

const RUNNER_OBS_ENTITY_MAP = { BaserunnerObservation: base44.entities.BaserunnerObservation };

const speedOpts = [{ val: 'fast', color: '#22c55e' }, { val: 'average', color: '#eab308' }, { val: 'slow', color: '#ef4444' }];
const aggrOpts = [{ val: 'aggressive', color: '#22c55e' }, { val: 'average', color: '#eab308' }, { val: 'passive', color: '#ef4444' }];

function Counter({ label, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} style={{ width: 24, height: 26, border: `1.5px solid ${BORDER}`, borderRadius: 4, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>−</button>
        <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} style={{ width: 24, height: 26, border: `1.5px solid ${BORDER}`, borderRadius: 4, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
}

export default function RunnerScoutPanel({ obs, onSaved }) {
  const [speed, setSpeed] = useState(obs.speed_rating || '');
  const [aggr, setAggr] = useState(obs.aggression_rating || '');
  const [leadSize, setLeadSize] = useState(obs.lead_size_1b || '');
  const [stealAtt, setStealAtt] = useState(obs.steal_attempts ?? 0);
  const [stealSuc, setStealSuc] = useState(obs.steals_successful ?? 0);
  const [stealDead, setStealDead] = useState(obs.steal_dead_ball ?? 0);
  const [stealOut, setStealOut] = useState(obs.steal_out ?? 0);
  const [pickoff, setPickoff] = useState(obs.pickoff_attempts ?? 0);
  const [dirt, setDirt] = useState(obs.dirt_ball_advances ?? 0);
  const [notes, setNotes] = useState(obs.notes || '');
  const [showStealPrompt, setShowStealPrompt] = useState(false);
  const [editingSteal, setEditingSteal] = useState(false);

  const mounted = useRef(false);
  const { schedule, status, pendingCount } = useOfflineAutosave(
    `BaserunnerObservation:${obs.id}`, 'BaserunnerObservation', obs.id, RUNNER_OBS_ENTITY_MAP
  );

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const payload = {
      speed_rating: speed || null, aggression_rating: aggr || null,
      lead_size_1b: leadSize || null,
      steal_attempts: stealAtt, steals_successful: stealSuc,
      steal_dead_ball: stealDead, steal_out: stealOut,
      pickoff_attempts: pickoff, dirt_ball_advances: dirt, notes: notes || null,
    };
    schedule(payload, async () => {
      const updated = await base44.entities.BaserunnerObservation.update(obs.id, payload);
      if (onSaved) onSaved(updated);
    });
  }, [speed, aggr, leadSize, stealAtt, stealSuc, stealDead, stealOut, pickoff, dirt, notes]);

  function handleStealResult(result) {
    setStealAtt(a => a + 1);
    if (result === 'safe') setStealSuc(s => s + 1);
    if (result === 'dead') setStealDead(d => d + 1);
    if (result === 'out') setStealOut(o => o + 1);
    setShowStealPrompt(false);
  }

  function RatingRow({ label, opts, value, onChange }) {
    return (
      <div>
        <label style={{ ...labelStyle, marginBottom: 6 }}>{label}</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {opts.map(o => (
            <button key={o.val} type="button" title={o.val}
              onClick={() => onChange(value === o.val ? '' : o.val)}
              style={{ width: 26, height: 26, borderRadius: '50%', background: o.color, cursor: 'pointer', border: value === o.val ? `3px solid ${NAVY}` : '2px solid #ccc' }} />
          ))}
        </div>
        {value && <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{value}</div>}
      </div>
    );
  }

  return (
    <div style={{ background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: NAVY, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {obs.jersey_number && <span style={{ fontWeight: 700, fontSize: 13, color: '#888' }}>#{obs.jersey_number}</span>}
          {obs.runner_name}
          {obs.position && <span style={{ fontSize: 12, fontWeight: 700, background: '#e8e4d9', borderRadius: 4, padding: '2px 7px', color: '#555' }}>{obs.position}</span>}
        </div>
        <AutosaveTag status={status} pendingCount={pendingCount} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', alignItems: 'flex-start', marginBottom: 12 }}>
        <RatingRow label="Speed" opts={speedOpts} value={speed} onChange={setSpeed} />
        <RatingRow label="Aggression" opts={aggrOpts} value={aggr} onChange={setAggr} />

        {/* Steal Attempt block */}
        <div style={{ flexBasis: '100%' }}>
          <label style={labelStyle}>Stolen Base</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Big steal button */}
            {!showStealPrompt ? (
              <button
                type="button"
                onClick={() => setShowStealPrompt(true)}
                style={{ padding: '7px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.3 }}
              >
                + Steal Attempt
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555', marginRight: 4 }}>Result:</span>
                <button type="button" onClick={() => handleStealResult('safe')} style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Safe</button>
                <button type="button" onClick={() => handleStealResult('out')}  style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Out</button>
                <button type="button" onClick={() => handleStealResult('dead')} style={{ padding: '6px 14px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Dead Ball</button>
                <button type="button" onClick={() => setShowStealPrompt(false)} style={{ padding: '6px 10px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 5, fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#888' }}>✕</button>
              </div>
            )}
            {/* Tally display */}
            {stealAtt > 0 && !editingSteal && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '2px 8px' }}>Safe {stealSuc}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', background: '#fee2e2', borderRadius: 4, padding: '2px 8px' }}>Out {stealOut}</span>
                {stealDead > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#92400e', background: '#fef3c7', borderRadius: 4, padding: '2px 8px' }}>DB {stealDead}</span>}
                <span style={{ fontSize: 11, color: '#888' }}>({stealAtt} att)</span>
                <button type="button" onClick={() => setEditingSteal(true)} style={{ fontSize: 11, color: '#888', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '1px 7px', cursor: 'pointer' }}>Edit</button>
              </div>
            )}
            {/* Edit mode */}
            {editingSteal && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'flex-end', marginLeft: 4, background: '#f0f0e8', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 12px' }}>
                {[
                  { label: 'Safe', val: stealSuc, set: v => { const diff = v - stealSuc; setStealSuc(Math.max(0, v)); setStealAtt(a => Math.max(0, a + diff)); }, color: '#16a34a' },
                  { label: 'Out',  val: stealOut, set: v => { const diff = v - stealOut;  setStealOut(Math.max(0, v));  setStealAtt(a => Math.max(0, a + diff)); }, color: '#dc2626' },
                  { label: 'Dead Ball', val: stealDead, set: v => { const diff = v - stealDead; setStealDead(Math.max(0, v)); setStealAtt(a => Math.max(0, a + diff)); }, color: '#92400e' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: item.color, marginBottom: 3 }}>{item.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button type="button" onClick={() => item.set(item.val - 1)} style={{ width: 22, height: 24, border: `1.5px solid ${BORDER}`, borderRadius: 4, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>−</button>
                      <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 800, fontSize: 13 }}>{item.val}</span>
                      <button type="button" onClick={() => item.set(item.val + 1)} style={{ width: 22, height: 24, border: `1.5px solid ${BORDER}`, borderRadius: 4, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingSteal(false)} style={{ padding: '4px 12px', background: NAVY, color: '#fff', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Counter label="Pickoff Att" value={pickoff} onChange={setPickoff} />
        <Counter label="Dirt Ball Adv" value={dirt} onChange={setDirt} />
        <div style={{ flexBasis: '100%' }}>
          <label style={labelStyle}>Lead Size (1B)</label>
          <input value={leadSize} onChange={e => setLeadSize(e.target.value)} style={inputStyle} placeholder="e.g. 12 ft, short, average, long" />
        </div>
        <div style={{ flexBasis: '100%' }}>
          <label style={labelStyle}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
        </div>
      </div>
    </div>
  );
}