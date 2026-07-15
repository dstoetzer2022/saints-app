import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { GOLD, CREAM, LINE_SOFT, PANEL_HI, GREEN, RED, AMBER, FONT, darkInputStyle, darkLabelStyle } from '@/lib/liveScoutTheme';
import useOfflineAutosave from '@/hooks/useOfflineAutosave';
import AutosaveTag from '@/components/scouting/AutosaveTag';

const RUNNER_OBS_ENTITY_MAP = { BaserunnerObservation: base44.entities.BaserunnerObservation };

const speedOpts = [{ val: 'fast', color: GREEN }, { val: 'average', color: AMBER }, { val: 'slow', color: RED }];
const aggrOpts = [{ val: 'aggressive', color: GREEN }, { val: 'average', color: AMBER }, { val: 'passive', color: 'rgba(255,255,255,0.4)' }];

function Counter({ label, value, onChange }) {
  return (
    <div>
      <label style={darkLabelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} style={{ width: 38, height: 38, border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: CREAM, fontWeight: 800, fontSize: 17, cursor: 'pointer', fontFamily: FONT }}>−</button>
        <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800, fontSize: 15, color: CREAM }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} style={{ width: 38, height: 38, border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: CREAM, fontWeight: 800, fontSize: 17, cursor: 'pointer', fontFamily: FONT }}>+</button>
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
        <label style={{ ...darkLabelStyle, marginBottom: 8 }}>{label}</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {opts.map(o => (
            <button key={o.val} type="button" title={o.val}
              onClick={() => onChange(value === o.val ? '' : o.val)}
              style={{
                width: 40, height: 40, borderRadius: '50%', background: o.color, cursor: 'pointer',
                border: value === o.val ? '3px solid #fff' : '3px solid rgba(255,255,255,0.15)',
                boxShadow: value === o.val ? '0 0 0 3px rgba(255,255,255,0.15)' : 'none',
              }} />
          ))}
        </div>
        {value && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 5, fontWeight: 700 }}>{value}</div>}
      </div>
    );
  }

  return (
    <div style={{ background: PANEL_HI, border: `1px solid ${LINE_SOFT}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: CREAM, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: FONT }}>
          {obs.jersey_number && <span style={{ fontWeight: 700, fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>#{obs.jersey_number}</span>}
          {obs.runner_name}
          {obs.position && <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(198,181,131,0.15)', borderRadius: 5, padding: '2px 8px', color: GOLD }}>{obs.position}</span>}
        </div>
        <AutosaveTag status={status} pendingCount={pendingCount} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 28px', alignItems: 'flex-start', marginBottom: 14 }}>
        <RatingRow label="Speed" opts={speedOpts} value={speed} onChange={setSpeed} />
        <RatingRow label="Aggression" opts={aggrOpts} value={aggr} onChange={setAggr} />

        {/* Steal Attempt block */}
        <div style={{ flexBasis: '100%' }}>
          <label style={darkLabelStyle}>Stolen Base</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {!showStealPrompt ? (
              <button
                type="button"
                onClick={() => setShowStealPrompt(true)}
                style={{ padding: '11px 22px', minHeight: 44, background: GOLD, color: '#07111c', border: 'none', borderRadius: 8, fontWeight: 900, fontSize: 13.5, cursor: 'pointer', letterSpacing: 0.3, fontFamily: FONT }}
              >
                + Steal Attempt
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>Result:</span>
                <button type="button" onClick={() => handleStealResult('safe')} style={{ padding: '10px 16px', minHeight: 42, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT }}>Safe</button>
                <button type="button" onClick={() => handleStealResult('out')}  style={{ padding: '10px 16px', minHeight: 42, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT }}>Out</button>
                <button type="button" onClick={() => handleStealResult('dead')} style={{ padding: '10px 16px', minHeight: 42, background: '#92400e', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT }}>Dead Ball</button>
                <button type="button" onClick={() => setShowStealPrompt(false)} style={{ padding: '10px 12px', minHeight: 42, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontFamily: FONT }}>✕</button>
              </div>
            )}
            {stealAtt > 0 && !editingSteal && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: GREEN, background: 'rgba(34,197,94,0.15)', borderRadius: 5, padding: '3px 9px' }}>Safe {stealSuc}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: RED, background: 'rgba(239,68,68,0.15)', borderRadius: 5, padding: '3px 9px' }}>Out {stealOut}</span>
                {stealDead > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24', background: 'rgba(146,64,14,0.25)', borderRadius: 5, padding: '3px 9px' }}>DB {stealDead}</span>}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>({stealAtt} att)</span>
                <button type="button" onClick={() => setEditingSteal(true)} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 5, padding: '4px 9px', cursor: 'pointer', fontFamily: FONT, minHeight: 28 }}>Edit</button>
              </div>
            )}
            {editingSteal && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'flex-end', marginLeft: 4, background: 'rgba(0,0,0,0.2)', border: `1px solid ${LINE_SOFT}`, borderRadius: 8, padding: '10px 14px' }}>
                {[
                  { label: 'Safe', val: stealSuc, set: v => { const diff = v - stealSuc; setStealSuc(Math.max(0, v)); setStealAtt(a => Math.max(0, a + diff)); }, color: GREEN },
                  { label: 'Out',  val: stealOut, set: v => { const diff = v - stealOut;  setStealOut(Math.max(0, v));  setStealAtt(a => Math.max(0, a + diff)); }, color: RED },
                  { label: 'Dead Ball', val: stealDead, set: v => { const diff = v - stealDead; setStealDead(Math.max(0, v)); setStealAtt(a => Math.max(0, a + diff)); }, color: '#fbbf24' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: item.color, marginBottom: 5 }}>{item.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" onClick={() => item.set(item.val - 1)} style={{ width: 32, height: 32, border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: CREAM, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>−</button>
                      <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 800, fontSize: 14, color: CREAM }}>{item.val}</span>
                      <button type="button" onClick={() => item.set(item.val + 1)} style={{ width: 32, height: 32, border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: CREAM, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingSteal(false)} style={{ padding: '8px 16px', minHeight: 36, background: GOLD, color: '#07111c', border: 'none', borderRadius: 6, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT }}>Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Counter label="Pickoff Att" value={pickoff} onChange={setPickoff} />
        <Counter label="Dirt Ball Adv" value={dirt} onChange={setDirt} />
        <div style={{ flexBasis: '100%' }}>
          <label style={darkLabelStyle}>Lead Size (1B)</label>
          <input value={leadSize} onChange={e => setLeadSize(e.target.value)} style={darkInputStyle} placeholder="e.g. 12 ft, short, average, long" />
        </div>
        <div style={{ flexBasis: '100%' }}>
          <label style={darkLabelStyle}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} style={darkInputStyle} />
        </div>
      </div>
    </div>
  );
}
