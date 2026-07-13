import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { getPitchColor, normalizePitch } from '@/lib/ds';
import { applyArsenalCorrection, correctMistaggedPitches, buildTypeStats, zDistToType } from '@/lib/arsenalCorrection';
import PitchPreview3D from './PitchPreview3D';

const FONT = "'Archivo', system-ui, sans-serif";
const NAVY = '#0e253a';
const GOLD = '#b8860b';

function trailColorFor(type) { return getPitchColor(type); }

// Flags a curated trail whose frozen physical values (captured at curation
// time) no longer fit its own label well against the pitcher's CURRENT
// corrected arsenal — e.g. a trail curated before correction existed, or
// from a source pitch that's since been reclassified by the mistag pass.
// Same outlierZ/nearZ thresholds as correctMistaggedPitches, so "stale" here
// means the same thing "mistagged" means everywhere else in the app.
function checkTrailStaleness(trail, typeStats) {
  const ownType = normalizePitch(trail.pitch_type);
  const ownStats = typeStats[ownType];
  if (!ownStats) return null; // not enough season data to judge either way
  const zOwn = zDistToType(trail, ownStats);
  if (zOwn == null || zOwn < 3.0) return null;
  let best = null, zBest = Infinity;
  for (const [t, s] of Object.entries(typeStats)) {
    if (t === ownType) continue;
    const z = zDistToType(trail, s);
    if (z != null && z < zBest) { zBest = z; best = t; }
  }
  if (best == null || zBest > 1.5) return null;
  return { betterFit: best, zOwn, zBest };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function toLastFirst(name) {
  if (!name) return '';
  if (name.includes(',')) return name.trim();
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
}

function fmt1(v) { return v != null ? Number(v).toFixed(1) : '—'; }
function fmtInt(v) { return v != null ? Math.round(v) : '—'; }

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0F6E56', color: '#E1F5EE', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: FONT, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
      {msg}
    </div>
  );
}

// ── Pitcher selector (dropdown) ──────────────────────────────────────────────
function PitcherSelector({ pitchers, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = pitchers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.team || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 280 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: '#fff', border: `1.5px solid ${GOLD}`, borderRadius: 7, padding: '9px 14px', fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: FONT, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{selected ? selected.name : 'Select pitcher…'}</span>
        {selected && <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{selected.team}</span>}
        <span style={{ color: '#888', fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: `1px solid ${GOLD}55`, borderRadius: 8, zIndex: 200, width: '100%', maxHeight: 380, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${pitchers.length} pitchers…`}
            style={{ border: 'none', borderBottom: `1px solid ${GOLD}33`, padding: '9px 12px', fontSize: 12, fontFamily: FONT, outline: 'none', flexShrink: 0 }} />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(p => (
              <button key={p.key} onClick={() => { onSelect(p); setOpen(false); setSearch(''); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 14px', background: selected?.key === p.key ? '#f4f2ec' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, color: NAVY, borderBottom: `0.5px solid ${GOLD}22` }}>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: '#888' }}>{p.team}</span>
              </button>
            ))}
            {!filtered.length && <div style={{ padding: 10, fontSize: 11, color: '#888', fontFamily: FONT }}>No results</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Curated trail row ────────────────────────────────────────────────────────
function CuratedRow({ trail, isFirst, isLast, onRemove, onMoveUp, onMoveDown, checked, onToggleChecked, staleness }) {
  const [confirming, setConfirming] = useState(false);
  const color = trail.trail_color || getPitchColor(trail.pitch_type);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0, background: '#fff', border: `1px solid ${staleness ? '#c0392b99' : color + '66'}`, borderRadius: 8, marginBottom: 6 }}>
      {/* Color bar on left edge */}
      <div style={{ width: 5, alignSelf: 'stretch', background: color, borderRadius: '8px 0 0 8px', flexShrink: 0 }} />
      <div style={{ padding: '10px 0 10px 10px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <input type="checkbox" checked={checked} onChange={onToggleChecked} style={{ width: 16, height: 16, cursor: 'pointer' }} />
      </div>
      <div style={{ flex: '1 1 220px', minWidth: 0, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, fontFamily: FONT }}>{trail.display_label || trail.pitch_type}</div>
          <div style={{ fontSize: 11, color: '#555', fontFamily: FONT, marginTop: 2 }}>
            <span style={{ fontWeight: 700, color: NAVY }}>{fmt1(trail.rel_speed)}</span> mph
            {' · '}
            <span style={{ fontWeight: 700, color: NAVY }}>{fmtInt(trail.spin_rate)}</span> rpm
            {' · '}{fmtInt(trail.spin_axis)}°
            {trail.induced_vert_break != null && <> · <span style={{ color: '#1D9E75', fontWeight: 700 }}>{fmt1(trail.induced_vert_break)}&quot; IVB</span></>}
            {trail.horz_break != null && <> · <span style={{ color: '#378ADD', fontWeight: 700 }}>{fmt1(trail.horz_break)}&quot; HB</span></>}
          </div>
          {staleness && (
            <div style={{ fontSize: 10.5, color: '#c0392b', fontWeight: 700, marginTop: 4, background: '#fdecea', border: '1px solid #f5c6c0', borderRadius: 5, padding: '3px 7px', display: 'inline-block' }}>
              ⚠ Looks more like {staleness.betterFit} than {trail.pitch_type} — worth a re-check
            </div>
          )}
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: color, background: color + '18', border: `1px solid ${color}55`, borderRadius: 4, padding: '2px 6px', flexShrink: 0, letterSpacing: 0.5 }}>LOCKED</span>
      </div>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', marginLeft: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={onMoveUp} disabled={isFirst} style={{ border: 'none', background: 'none', cursor: isFirst ? 'not-allowed' : 'pointer', color: isFirst ? '#ccc' : NAVY, padding: '2px 4px' }}><ChevronUp size={14} /></button>
          <button onClick={onMoveDown} disabled={isLast} style={{ border: 'none', background: 'none', cursor: isLast ? 'not-allowed' : 'pointer', color: isLast ? '#ccc' : NAVY, padding: '2px 4px' }}><ChevronDown size={14} /></button>
        </div>
        {confirming ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#c0392b', fontFamily: FONT }}>Remove?</span>
            <button onClick={() => { setConfirming(false); onRemove(); }} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Yes</button>
            <button onClick={() => setConfirming(false)} style={{ background: '#eee', color: NAVY, border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>No</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} style={{ background: 'none', border: `1px solid #ddd`, borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#c0392b' }}><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}

// ── Bulk delete bar — appears above the list once anything is checked ────────
function BulkDeleteBar({ count, onDelete, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fdecea', border: '1px solid #f5c6c0', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#c0392b', fontFamily: FONT }}>{count} trail{count !== 1 ? 's' : ''} selected</span>
      {confirming ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#c0392b', fontFamily: FONT }}>Delete {count}?</span>
          <button onClick={() => { setConfirming(false); onDelete(); }} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Yes, delete</button>
          <button onClick={() => setConfirming(false)} style={{ background: '#eee', color: NAVY, border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Clear selection</button>
          <button onClick={() => setConfirming(true)} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={13} /> Delete Selected
          </button>
        </div>
      )}
    </div>
  );
}

// ── Available pitch group ────────────────────────────────────────────────────
function PitchGroup({ pitchType, pitches, curatedPitchTypes, onAdd, onRemoveType, adding }) {
  const [open, setOpen] = useState(false);
  const [previewPitch, setPreviewPitch] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const hasCurated = curatedPitchTypes.has(pitchType);
  const color = trailColorFor(pitchType);

  const handleRowClick = (p) => {
    setPreviewPitch(prev => prev?.id === p.id ? null : p);
  };

  return (
    <div style={{ marginBottom: 8, border: `1px solid ${GOLD}33`, borderRadius: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: hasCurated ? '#f0f9f5' : '#faf9f5', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: NAVY, flex: 1 }}>{pitchType}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{pitches.length} pitches</span>
        {hasCurated && <span style={{ fontSize: 10, fontWeight: 800, color: '#0F6E56', background: '#E1F5EE', borderRadius: 4, padding: '2px 6px' }}>✓ curated</span>}
        <span style={{ fontSize: 10, color: '#aaa' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ borderTop: `0.5px solid ${GOLD}22` }}>
          {/* 3D preview panel — shown when a pitch row is selected */}
          {previewPitch && (
            <div style={{ padding: '10px 14px', background: '#0a1520', borderBottom: `1px solid ${GOLD}22` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#c6b583', fontFamily: FONT }}>
                  #{previewPitch.pitch_no} — {fmt1(previewPitch.rel_speed)} mph · {fmtInt(previewPitch.spin_rate)} rpm · {fmt1(previewPitch.induced_vert_break)} IVB · {fmt1(previewPitch.horz_break)} HB
                </span>
                <button onClick={() => setPreviewPitch(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
              </div>
              <PitchPreview3D pitch={previewPitch} pitchType={pitchType} trailColor={color} />
            </div>
          )}
          {pitches.slice(0, 100).map(p => (
            <div key={p.id}
              onClick={() => handleRowClick(p)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 28px', background: previewPitch?.id === p.id ? '#e8f4ff' : '#fff', borderBottom: `0.5px solid ${GOLD}11`, cursor: 'pointer', borderLeft: previewPitch?.id === p.id ? `3px solid ${color}` : '3px solid transparent', transition: 'background 0.15s' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, fontFamily: FONT }}>
                  #{p.pitch_no} <span style={{ fontWeight: 400, color: '#888', fontSize: 10 }}>{p.source_game_id_short}</span>
                  {previewPitch?.id === p.id && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: color, background: color + '22', borderRadius: 3, padding: '1px 5px' }}>PREVIEWING</span>}
                </div>
                <div style={{ fontSize: 11, color: '#555', fontFamily: FONT }}>
                  {fmt1(p.rel_speed)} mph · {fmtInt(p.spin_rate)} rpm · {fmtInt(p.spin_axis)}° · {fmt1(p.induced_vert_break)} IVB · {fmt1(p.horz_break)} HB
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); onAdd(p); }} disabled={adding === p.id}
                  style={{ background: hasCurated ? '#BA7517' : NAVY, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: adding === p.id ? 'wait' : 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', opacity: adding === p.id ? 0.6 : 1 }}>
                  {hasCurated ? 'Replace' : 'Add trail'}
                </button>
                {/* Delete only enabled when THIS pitch type already has a curated trail */}
                {hasCurated && (
                  confirmingRemove ? (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button onClick={() => { setConfirmingRemove(false); onRemoveType(); }} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Yes</button>
                      <button onClick={() => setConfirmingRemove(false)} style={{ background: '#eee', color: NAVY, border: 'none', borderRadius: 5, padding: '5px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>No</button>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmingRemove(true); }}
                      style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#c0392b', flexShrink: 0 }}
                      title={`Remove curated ${pitchType} trail`}>
                      <Trash2 size={13} />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TrailCuration({ setScreen }) {
  const [pitchers, setPitchers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [curated, setCurated] = useState([]);
  const [pitchGroups, setPitchGroups] = useState({});
  const [typeStats, setTypeStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Load all distinct pitcher+team combos from TrackmanPitch
  useEffect(() => {
    base44.entities.TrackmanPitch.list('-created_date', 2000)
      .then(rows => {
        const seen = new Set();
        const list = [];
        for (const r of (rows || [])) {
          if (!r.pitcher_name || r.pitcher_name.trim() === 'Last, First') continue;
          const lf = toLastFirst(r.pitcher_name);
          const k = `${lf}|${r.pitcher_team || ''}`;
          if (seen.has(k)) continue;
          seen.add(k);
          list.push({ key: k, name: lf, team: r.pitcher_team || '', hand: r.pitcher_hand || '' });
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setPitchers(list);
      })
      .catch(() => {});
  }, []);

  const loadPitcherData = useCallback(async (p) => {
    if (!p) return;
    setLoading(true);
    setCurated([]);
    setPitchGroups({});
    setTypeStats({});
    setSelectedIds(new Set());
    try {
      const [curatedRows, pitchRowsRaw] = await Promise.all([
        base44.entities.CuratedDugoutTrail.filter(
          { pitcher_name: p.name, pitcher_team: p.team }, 'display_order', 50
        ).catch(() => []),
        base44.entities.TrackmanPitch.filter(
          { pitcher_name: p.name, pitcher_team: p.team }, '-created_date', 500
        ).catch(() => []),
      ]);
      setCurated(curatedRows || []);

      // Same two-pass correction (type-merge, then per-pitch mistag) used
      // everywhere else in the app — without this, the candidate list below
      // would show pitches grouped by their RAW tagged_pitch_type, meaning a
      // coach curating "the best ChangeUp" could be picking from a candidate
      // pool contaminated with mistagged pitches, or missing good candidates
      // that were mislabeled into the wrong bucket.
      const merged = applyArsenalCorrection(pitchRowsRaw || []);
      const { data: pitchRows } = correctMistaggedPitches(merged.data);

      const groups = {};
      for (const r of pitchRows) {
        const pt = normalizePitch(r.tagged_pitch_type || r.pitch_type || 'Unknown');
        if (!groups[pt]) groups[pt] = [];
        groups[pt].push({ ...r, source_game_id_short: (r.game_id || '').slice(-6) });
      }
      setPitchGroups(groups);

      // Stats built from the CORRECTED candidate pool — used only to flag
      // curated trails (below) whose frozen physical values no longer fit
      // their label, e.g. a trail curated before correction existed, or from
      // a pitch that's since been reclassified. Purely informational: never
      // auto-changes a trail, just surfaces "you may want to review this."
      setTypeStats(buildTypeStats(pitchRows));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = useCallback((p) => {
    setSelected(p);
    loadPitcherData(p);
  }, [loadPitcherData]);

  const handleRemove = async (trail) => {
    await base44.entities.CuratedDugoutTrail.delete(trail.id).catch(() => {});
    setCurated(prev => prev.filter(t => t.id !== trail.id));
    setSelectedIds(prev => { const next = new Set(prev); next.delete(trail.id); return next; });
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === curated.length ? new Set() : new Set(curated.map(t => t.id)));
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    await Promise.all(ids.map(id => base44.entities.CuratedDugoutTrail.delete(id).catch(() => {})));
    setCurated(prev => prev.filter(t => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
    setToast(`Removed ${ids.length} trail${ids.length !== 1 ? 's' : ''}`);
  };

  const handleRemoveType = async (pitchType) => {
    const existing = curated.find(t => t.pitch_type === pitchType);
    if (!existing) return;
    await handleRemove(existing);
  };

  const handleMoveUp = async (idx) => {
    if (idx === 0) return;
    const updated = [...curated];
    const a = updated[idx - 1], b = updated[idx];
    const aOrd = a.display_order, bOrd = b.display_order;
    await Promise.all([
      base44.entities.CuratedDugoutTrail.update(a.id, { display_order: bOrd }),
      base44.entities.CuratedDugoutTrail.update(b.id, { display_order: aOrd }),
    ]).catch(() => {});
    updated[idx - 1] = { ...a, display_order: bOrd };
    updated[idx] = { ...b, display_order: aOrd };
    updated.sort((x, y) => (x.display_order || 0) - (y.display_order || 0));
    setCurated(updated);
  };

  const handleMoveDown = async (idx) => {
    if (idx >= curated.length - 1) return;
    await handleMoveUp(idx + 1);
  };

  const handleAdd = async (pitch, pitchType) => {
    if (!selected) return;
    setAdding(pitch.id);
    try {
      // Enforce one trail per pitch type — replace if exists
      const existing = curated.find(t => t.pitch_type === pitchType);
      if (existing) {
        await base44.entities.CuratedDugoutTrail.delete(existing.id).catch(() => {});
      }
      const newTrail = await base44.entities.CuratedDugoutTrail.create({
        pitcher_name: selected.name,
        pitcher_team: selected.team,
        pitcher_hand: pitch.pitcher_hand || selected.hand || '',
        pitch_type: pitchType,
        display_label: pitchType,
        display_order: existing ? (existing.display_order ?? curated.length) : curated.length,
        active: true,
        trail_color: trailColorFor(pitchType),
        source_game_id: pitch.game_id || '',
        source_pitch_no: pitch.pitch_no || null,
        rel_speed: pitch.rel_speed != null ? parseFloat(pitch.rel_speed) : null,
        spin_rate: pitch.spin_rate != null ? parseFloat(pitch.spin_rate) : null,
        spin_axis: pitch.spin_axis != null ? parseFloat(pitch.spin_axis) : null,
        horz_break: pitch.horz_break != null ? parseFloat(pitch.horz_break) : null,
        induced_vert_break: pitch.induced_vert_break != null ? parseFloat(pitch.induced_vert_break) : null,
        plate_loc_height: pitch.plate_loc_height != null ? parseFloat(pitch.plate_loc_height) : null,
        plate_loc_side: pitch.plate_loc_side != null ? parseFloat(pitch.plate_loc_side) : null,
        rel_height: pitch.rel_height != null ? parseFloat(pitch.rel_height) : null,
        rel_side: pitch.rel_side != null ? parseFloat(pitch.rel_side) : null,
        extension: pitch.extension != null ? parseFloat(pitch.extension) : null,
        vert_rel_angle: pitch.vert_rel_angle != null ? parseFloat(pitch.vert_rel_angle) : null,
        horz_rel_angle: pitch.horz_rel_angle != null ? parseFloat(pitch.horz_rel_angle) : null,
      });
      setCurated(prev => {
        const next = existing
          ? prev.filter(t => t.id !== existing.id).concat(newTrail)
          : prev.concat(newTrail);
        return [...next].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      });
      setToast(existing ? `Replaced existing ${pitchType} trail` : `Added ${pitchType} trail`);
    } finally {
      setAdding(null);
    }
  };

  const curatedPitchTypes = new Set(curated.map(t => t.pitch_type));

  return (
    <div style={{ minHeight: '100vh', background: '#f4f2ec', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: NAVY, borderBottom: `2px solid ${GOLD}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => setScreen('home')} style={{ background: 'rgba(255,255,255,.08)', border: '0.5px solid rgba(255,255,255,.2)', borderRadius: 6, color: '#c6b583', fontSize: 16, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f4f2ec', letterSpacing: -0.3 }}>Trail Curation</div>
          <div style={{ fontSize: 11, color: 'rgba(198,181,131,.55)', fontWeight: 600, letterSpacing: 1 }}>PRE-GAME PITCH SELECTION</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <PitcherSelector pitchers={pitchers} selected={selected} onSelect={handleSelect} />
        </div>
      </div>

      {!selected ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', color: '#888', fontSize: 16, fontStyle: 'italic' }}>
          Select a pitcher to begin curating trails
        </div>
      ) : (
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 20px 60px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>

            {/* Left: Curated trails */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: GOLD }}>
                  Curated Trails ({curated.length})
                </div>
                {curated.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedIds.size === curated.length} onChange={toggleSelectAll} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                    Select all
                  </label>
                )}
              </div>
              {selectedIds.size > 0 && (
                <BulkDeleteBar count={selectedIds.size} onDelete={handleDeleteSelected} onCancel={() => setSelectedIds(new Set())} />
              )}
              {curated.length === 0 && (
                <div style={{ background: '#fff', border: `1px dashed ${GOLD}55`, borderRadius: 8, padding: '24px 16px', textAlign: 'center', color: '#aaa', fontSize: 13, fontStyle: 'italic' }}>
                  No curated trails yet — add from available pitches →
                </div>
              )}
              {curated.map((trail, idx) => (
                <CuratedRow
                  key={trail.id}
                  trail={trail}
                  isFirst={idx === 0}
                  isLast={idx === curated.length - 1}
                  onRemove={() => handleRemove(trail)}
                  onMoveUp={() => handleMoveUp(idx)}
                  onMoveDown={() => handleMoveDown(idx)}
                  checked={selectedIds.has(trail.id)}
                  onToggleChecked={() => toggleSelected(trail.id)}
                  staleness={checkTrailStaleness(trail, typeStats)}
                />
              ))}
              {curated.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(15,110,86,.08)', border: '1px solid rgba(15,110,86,.2)', borderRadius: 7, fontSize: 11, color: '#0F6E56', fontWeight: 600 }}>
                  ✓ Dugout View will use these {curated.length} curated trail{curated.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Right: Available pitches */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: GOLD, marginBottom: 10 }}>
                Available Pitches
              </div>
              {loading && <div style={{ textAlign: 'center', padding: 24, color: '#888', fontSize: 13 }}>Loading…</div>}
              {!loading && Object.keys(pitchGroups).length === 0 && (
                <div style={{ color: '#aaa', fontSize: 13, fontStyle: 'italic', padding: 16 }}>No Trackman data found for this pitcher.</div>
              )}
              {!loading && Object.entries(pitchGroups)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([pt, pitches]) => (
                  <PitchGroup
                    key={pt}
                    pitchType={pt}
                    pitches={pitches}
                    curatedPitchTypes={curatedPitchTypes}
                    onAdd={(pitch) => handleAdd(pitch, pt)}
                    onRemoveType={() => handleRemoveType(pt)}
                    adding={adding}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}