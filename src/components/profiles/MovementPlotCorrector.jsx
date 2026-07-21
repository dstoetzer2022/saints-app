import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePitch, getPitchColor, PITCH_COLORS, fmt } from '@/lib/ds';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { correctRowsByPitcher, getLeaguePitches } from '@/lib/leagueCache';
import { savePools } from '@/lib/poolCache';
import { rebuildPitcherSeason } from '@/lib/seasonAggregation';
import { C, FONT } from '@/lib/darkTheme';

// Assignable pitch types for the reassignment dropdown — excludes the two
// fallback labels (Undefined/Other), which aren't real pitch calls a coach
// would deliberately tag a corrected point as.
const PITCH_TYPES = Object.keys(PITCH_COLORS).filter(t => t !== 'Undefined' && t !== 'Other');

const W = 520, H = 520, R = 230, cx0 = W / 2, cy0 = H / 2;

function fmtIt(v) { return v != null && Number.isFinite(v) ? Math.round(v) : '—'; }

export default function MovementPlotCorrector({ pitcherName, team, allTeams, onRebuilt }) {
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('point'); // 'point' | 'drag'
  const [pending, setPending] = useState({}); // pitchId -> newType
  const [activePointId, setActivePointId] = useState(null);
  const [draftType, setDraftType] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dragDraftType, setDragDraftType] = useState('');
  const [drag, setDrag] = useState(null); // {x0,y0,x1,y1} in svg coords, while actively dragging
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [toast, setToast] = useState(null);
  const [toastError, setToastError] = useState(false);

  const svgRef = useRef(null);
  const draggingRef = useRef(false);

  const loadPitches = useCallback(async () => {
    if (!pitcherName) return;
    setLoading(true);
    try {
      const rows = await fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_name: pitcherName }, '-created_date');
      // Display the CURRENT effective label (post auto-arsenal-correction) —
      // same as what the on-screen Arsenal tab movement plot shows — so a
      // coach is auditing the same thing they already see, looking for
      // outliers the auto-cleaner missed.
      setPitches(correctRowsByPitcher(rows || []));
    } catch {
      setPitches([]);
      setToast('Failed to load pitch data — reopen this tool to retry.');
      setToastError(true);
    } finally {
      setLoading(false);
    }
  }, [pitcherName]);

  useEffect(() => { loadPitches(); }, [loadPitches]);

  // Reset interaction state whenever the tool mode changes.
  useEffect(() => {
    setActivePointId(null);
    setSelectedIds(new Set());
    setDrag(null);
    setDragDraftType('');
  }, [mode]);

  const pointsGeom = useMemo(() => {
    return pitches
      .map(p => ({
        id: p.id,
        hb: parseFloat(p.horz_break),
        ivb: parseFloat(p.induced_vert_break),
        origType: normalizePitch(p.tagged_pitch_type || p.pitch_type),
        game_id: p.game_id, pitch_no: p.pitch_no, date: p.date,
        rel_speed: p.rel_speed, spin_rate: p.spin_rate,
      }))
      .filter(p => Number.isFinite(p.hb) && Number.isFinite(p.ivb));
  }, [pitches]);

  const pointsById = useMemo(() => new Map(pointsGeom.map(p => [p.id, p])), [pointsGeom]);

  // Reset the active point's draft dropdown only when the SELECTED point
  // changes — not on every `pending` edit elsewhere, which would otherwise
  // clobber an in-progress selection on this point.
  useEffect(() => {
    if (activePointId == null) { setDraftType(''); return; }
    const pt = pointsById.get(activePointId);
    if (pt) setDraftType(pending[activePointId] || pt.origType);
  }, [activePointId, pointsById]);

  const isLHP = pitches.some(p => p.pitcher_hand === 'Left');
  const rightLabel = isLHP ? 'GLOVE' : 'ARM';
  const leftLabel = isLHP ? 'ARM' : 'GLOVE';

  const maxDataR = useMemo(() => {
    let m = 0;
    for (const pt of pointsGeom) m = Math.max(m, Math.hypot(pt.hb, pt.ivb));
    return m;
  }, [pointsGeom]);
  const DOMAIN = Math.max(20, Math.ceil((maxDataR * 1.08) / 5) * 5);
  const SCALE = R / DOMAIN;
  const ringStep = DOMAIN / 4;
  const rings = [4, 3, 2, 1].map(i => Math.round(ringStep * i));

  const byTypeCounts = useMemo(() => {
    const map = {};
    pointsGeom.forEach(pt => {
      const t = pending[pt.id] || pt.origType;
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [pointsGeom, pending]);
  const totalPts = pointsGeom.length;

  const pendingGroups = useMemo(() => {
    const groups = {};
    for (const [id, newType] of Object.entries(pending)) {
      const pt = pointsById.get(id);
      const origType = pt ? pt.origType : '?';
      const key = `${origType}→${newType}`;
      (groups[key] = groups[key] || { origType, newType, ids: [] }).ids.push(id);
    }
    return Object.values(groups).sort((a, b) => b.ids.length - a.ids.length);
  }, [pending, pointsById]);
  const pendingCount = Object.keys(pending).length;

  // Converts a client (mouse) coordinate into svg-viewBox space. Can't assume
  // the rendered box is square even though the viewBox is (a flex-shrunk
  // container can compress the svg's height below its width) — replicate the
  // browser's own default preserveAspectRatio="xMidYMid meet" letterboxing
  // (uniform scale, centered) instead of scaling each axis independently.
  function svgPointFromEvent(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const offsetX = (rect.width - W * scale) / 2;
    const offsetY = (rect.height - H * scale) / 2;
    return {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale,
    };
  }

  function handleSvgMouseDown(e) {
    if (mode !== 'drag') return;
    e.preventDefault();
    const p = svgPointFromEvent(e);
    draggingRef.current = true;
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }

  useEffect(() => {
    if (mode !== 'drag') return;
    function onMove(e) {
      if (!draggingRef.current) return;
      const p = svgPointFromEvent(e);
      setDrag(d => d ? { ...d, x1: p.x, y1: p.y } : d);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDrag(d => {
        if (d) {
          const minX = Math.min(d.x0, d.x1), maxX = Math.max(d.x0, d.x1);
          const minY = Math.min(d.y0, d.y1), maxY = Math.max(d.y0, d.y1);
          const ids = pointsGeom.filter(pt => {
            const x = cx0 + pt.hb * SCALE, y = cy0 - pt.ivb * SCALE;
            return x >= minX && x <= maxX && y >= minY && y <= maxY;
          }).map(pt => pt.id);
          setSelectedIds(new Set(ids));
        }
        return null;
      });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [mode, pointsGeom, SCALE]);

  function applyPointChange(id, origType, newType) {
    setPending(prev => {
      const next = { ...prev };
      if (newType === origType) delete next[id]; else next[id] = newType;
      return next;
    });
    setActivePointId(null);
  }

  function applySelectionChange(ids, newType) {
    setPending(prev => {
      const next = { ...prev };
      for (const id of ids) {
        const pt = pointsById.get(id);
        if (!pt) continue;
        if (newType === pt.origType) delete next[id]; else next[id] = newType;
      }
      return next;
    });
    setSelectedIds(new Set());
    setDragDraftType('');
  }

  function undoGroup(ids) {
    setPending(prev => {
      const next = { ...prev };
      ids.forEach(id => delete next[id]);
      return next;
    });
  }

  // A manual correction here is just a tagged_pitch_type write — it is not
  // "locked" against a future auto-cleaner run. In practice this is stable:
  // correctMistaggedPitches only reassigns pitches that are outliers from
  // their own type's centroid, and a genuine fix moves a pitch to the type
  // its physical values already match, so it won't be re-flagged.
  async function handleSaveAndRebuild() {
    const entries = Object.entries(pending);
    if (!entries.length || saving) return;
    setSaving(true);
    setToast(null);
    try {
      setProgress(`Saving ${entries.length} correction${entries.length === 1 ? '' : 's'}…`);
      const CHUNK = 8;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const batch = entries.slice(i, i + CHUNK);
        await Promise.all(batch.map(([id, newType]) =>
          base44.entities.TrackmanPitch.update(id, { tagged_pitch_type: newType })
        ));
        setProgress(`Saving corrections… ${Math.min(i + CHUNK, entries.length)}/${entries.length}`);
      }

      setProgress(`Rebuilding arsenal for ${pitcherName}…`);
      const teamCode = team?.trackman_code || team?.name || '';
      const validTeamCodes = new Set((allTeams || []).filter(t => t.trackman_code).map(t => t.trackman_code));
      await rebuildPitcherSeason(pitcherName, teamCode, team?.name || '', setProgress, validTeamCodes);

      setProgress('Refreshing league data…');
      const freshLeaguePitches = await getLeaguePitches({ force: true });
      await savePools(freshLeaguePitches).catch(() => {});

      setPending({});
      setSelectedIds(new Set());
      setActivePointId(null);
      setProgress(null);
      setToast(`Saved ${entries.length} correction${entries.length === 1 ? '' : 's'} — arsenal rebuilt.`);
      setToastError(false);

      await loadPitches();
      if (onRebuilt) onRebuilt();
    } catch (e) {
      setProgress(null);
      setToast(`Save failed — ${e?.message || 'network error'}. Try again.`);
      setToastError(true);
    } finally {
      setSaving(false);
    }
  }

  const FONT_STYLE = { fontFamily: FONT };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: C.muted, ...FONT_STYLE }}>
      <div style={{ width: 22, height: 22, border: `2px solid ${C.edge}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 12 }} />
      Loading pitch data…
    </div>
  );

  const activePoint = activePointId != null ? pointsById.get(activePointId) : null;

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 0 }}>
      {/* Left: interactive plot */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#06121a', padding: '16px 20px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {[['point', 'Point Correction'], ['drag', 'Drag Select']].map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)} style={{
              cursor: 'pointer', border: `1px solid ${mode === key ? C.gold : C.edge}`,
              background: mode === key ? 'rgba(200,146,12,0.12)' : C.surface,
              color: mode === key ? C.gold : C.muted,
              borderRadius: 7, fontSize: 11.5, fontWeight: 800, padding: '7px 14px', ...FONT_STYLE,
            }}>
              {label}
            </button>
          ))}
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 6, ...FONT_STYLE }}>
            {mode === 'point' ? 'Click a pitch to correct its tag.' : 'Drag a box around pitches to reassign them together.'}
          </span>
        </div>

        {!totalPts ? (
          <div style={{ color: C.muted, fontSize: 12, ...FONT_STYLE }}>No movement data (horz_break / induced_vert_break) for this pitcher.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
              {byTypeCounts.map(([pt, n]) => (
                <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: getPitchColor(pt) }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, ...FONT_STYLE }}>{pt} {(n / totalPts * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              onMouseDown={handleSvgMouseDown}
              style={{ width: '100%', maxWidth: 560, aspectRatio: '1 / 1', display: 'block', margin: '0 auto', userSelect: drag ? 'none' : 'auto', cursor: mode === 'drag' ? 'crosshair' : 'default' }}
            >
              <defs>
                <clipPath id="mpcClip"><circle cx={cx0} cy={cy0} r={R} /></clipPath>
              </defs>

              {rings.map(v => {
                const rad = v * SCALE;
                return (
                  <g key={v}>
                    <circle cx={cx0} cy={cy0} r={rad} fill="none" stroke={v === rings[rings.length - 1] ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)'} strokeWidth={1} strokeDasharray={v === rings[0] ? '' : '3 3'} />
                    <text x={cx0 + 3} y={cy0 - rad - 3} fontSize={8} fill={C.muted}>{v}"</text>
                  </g>
                );
              })}
              <circle cx={cx0} cy={cy0} r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={1.3} />
              <line x1={cx0} y1={cy0 - R} x2={cx0} y2={cy0 + R} stroke="rgba(255,255,255,.14)" strokeWidth={1} />
              <line x1={cx0 - R} y1={cy0} x2={cx0 + R} y2={cy0} stroke="rgba(255,255,255,.14)" strokeWidth={1} />

              <text x={cx0} y={cy0 - R - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.muted}>RISE</text>
              <text x={cx0} y={cy0 + R + 16} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.muted}>DROP</text>
              <text x={cx0 - R - 10} y={cy0 + 4} textAnchor="end" fontSize={9} fill={C.muted}>{leftLabel}</text>
              <text x={cx0 + R + 10} y={cy0 + 4} fontSize={9} fill={C.muted}>{rightLabel}</text>

              <g clipPath="url(#mpcClip)">
                {pointsGeom.map(pt => {
                  const type = pending[pt.id] || pt.origType;
                  const color = getPitchColor(type);
                  const x = cx0 + pt.hb * SCALE, y = cy0 - pt.ivb * SCALE;
                  const isPending = !!pending[pt.id];
                  const isSelected = selectedIds.has(pt.id);
                  const isActive = activePointId === pt.id;
                  return (
                    <circle
                      key={pt.id}
                      cx={x} cy={y}
                      r={isActive ? 6 : isSelected ? 5 : 3.6}
                      fill={color} fillOpacity={0.8}
                      stroke={isActive || isSelected ? '#ffffff' : isPending ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.35)'}
                      strokeWidth={isActive || isSelected ? 2 : isPending ? 1.5 : 0.4}
                      strokeDasharray={isPending && !isSelected && !isActive ? '2 1' : undefined}
                      style={{ cursor: mode === 'point' ? 'pointer' : 'default' }}
                      onClick={mode === 'point' ? (e) => { e.stopPropagation(); setActivePointId(pt.id); } : undefined}
                    />
                  );
                })}
              </g>

              {drag && (
                <rect
                  x={Math.min(drag.x0, drag.x1)} y={Math.min(drag.y0, drag.y1)}
                  width={Math.abs(drag.x1 - drag.x0)} height={Math.abs(drag.y1 - drag.y0)}
                  fill="rgba(198,181,131,0.12)" stroke="#c6b583" strokeDasharray="4 3" strokeWidth={1}
                />
              )}
            </svg>
          </>
        )}
      </div>

      {/* Right: side panel — active tool state, pending changes, save */}
      <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', background: '#0a1a28', borderLeft: `1px solid ${C.edge}`, overflowY: 'auto' }}>
        {/* Point mode: active point detail */}
        {mode === 'point' && (
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.edge}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, marginBottom: 8, ...FONT_STYLE }}>
              Selected Pitch
            </div>
            {!activePoint ? (
              <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', ...FONT_STYLE }}>Click a point on the plot to correct it.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: C.cream, ...FONT_STYLE }}>
                  #{activePoint.pitch_no} <span style={{ color: C.muted }}>{(activePoint.game_id || '').slice(-6)}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>
                  {fmt(activePoint.rel_speed)} mph · {fmtIt(activePoint.spin_rate)} rpm · {fmt(activePoint.hb)}" HB · {fmt(activePoint.ivb)}" IVB
                </div>
                <div style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>
                  Current: <span style={{ color: getPitchColor(pending[activePoint.id] || activePoint.origType), fontWeight: 700 }}>{pending[activePoint.id] || activePoint.origType}</span>
                </div>
                <select value={draftType} onChange={e => setDraftType(e.target.value)} style={{
                  background: C.surface, border: `1px solid ${C.edge}`, color: C.cream, borderRadius: 6,
                  padding: '7px 9px', fontSize: 12, fontFamily: FONT,
                }}>
                  {PITCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => applyPointChange(activePoint.id, activePoint.origType, draftType)} style={{
                    flex: 1, background: C.gold, color: '#080f17', border: 'none', borderRadius: 6,
                    padding: '7px 0', fontSize: 11, fontWeight: 800, cursor: 'pointer', ...FONT_STYLE,
                  }}>
                    Apply
                  </button>
                  <button onClick={() => setActivePointId(null)} style={{
                    flex: 1, background: 'transparent', color: C.muted, border: `1px solid ${C.edge}`, borderRadius: 6,
                    padding: '7px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...FONT_STYLE,
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drag mode: selection detail */}
        {mode === 'drag' && (
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.edge}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, marginBottom: 8, ...FONT_STYLE }}>
              Selection
            </div>
            {selectedIds.size === 0 ? (
              <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', ...FONT_STYLE }}>Drag a box on the plot to select pitches.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: C.cream, ...FONT_STYLE }}>{selectedIds.size} pitch{selectedIds.size === 1 ? '' : 'es'} selected</div>
                <select value={dragDraftType} onChange={e => setDragDraftType(e.target.value)} style={{
                  background: C.surface, border: `1px solid ${C.edge}`, color: C.cream, borderRadius: 6,
                  padding: '7px 9px', fontSize: 12, fontFamily: FONT,
                }}>
                  <option value="">Select pitch type…</option>
                  {PITCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => applySelectionChange([...selectedIds], dragDraftType)}
                    disabled={!dragDraftType}
                    style={{
                      flex: 1, background: dragDraftType ? C.gold : C.faint, color: dragDraftType ? '#080f17' : C.muted,
                      border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 11, fontWeight: 800,
                      cursor: dragDraftType ? 'pointer' : 'default', ...FONT_STYLE,
                    }}
                  >
                    Reassign {selectedIds.size} pitch{selectedIds.size === 1 ? '' : 'es'}
                  </button>
                  <button onClick={() => { setSelectedIds(new Set()); setDragDraftType(''); }} style={{
                    flex: 1, background: 'transparent', color: C.muted, border: `1px solid ${C.edge}`, borderRadius: 6,
                    padding: '7px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...FONT_STYLE,
                  }}>
                    Clear selection
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending changes */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.edge}`, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, ...FONT_STYLE }}>
              Pending Changes ({pendingCount})
            </div>
            {pendingCount > 0 && (
              <button onClick={() => setPending({})} style={{
                marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, fontSize: 10,
                fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', ...FONT_STYLE,
              }}>
                Reset all
              </button>
            )}
          </div>
          {pendingGroups.length === 0 ? (
            <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', ...FONT_STYLE }}>No corrections staged yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendingGroups.map(g => (
                <div key={`${g.origType}-${g.newType}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: C.raised, border: `1px solid ${C.edge}`,
                  borderRadius: 6, padding: '6px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, fontSize: 11, ...FONT_STYLE }}>
                    <span style={{ color: getPitchColor(g.origType) }}>{g.origType}</span>
                    <span style={{ color: C.muted }}>→</span>
                    <span style={{ color: getPitchColor(g.newType), fontWeight: 700 }}>{g.newType}</span>
                    <span style={{ color: C.muted, marginLeft: 4 }}>({g.ids.length})</span>
                  </div>
                  <button onClick={() => undoGroup(g.ids)} style={{
                    background: 'none', border: 'none', color: C.muted, fontSize: 10, fontWeight: 700,
                    cursor: 'pointer', textDecoration: 'underline', ...FONT_STYLE,
                  }}>
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save and rebuild */}
        <div style={{ padding: '14px 16px' }}>
          <button
            onClick={handleSaveAndRebuild}
            disabled={pendingCount === 0 || saving}
            style={{
              width: '100%', background: pendingCount > 0 && !saving ? '#BA7517' : C.faint,
              color: pendingCount > 0 && !saving ? '#fff' : C.muted, border: 'none', borderRadius: 7,
              padding: '11px 0', fontSize: 12, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
              cursor: pendingCount > 0 && !saving ? 'pointer' : 'default', ...FONT_STYLE,
            }}
          >
            {saving ? 'Saving…' : 'Save and Rebuild Arsenal'}
          </button>
          {progress && (
            <div style={{ marginTop: 8, fontSize: 10.5, color: C.muted, textAlign: 'center', ...FONT_STYLE }}>{progress}</div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toastError ? '#7A1E1E' : '#0F6E56', color: toastError ? '#FBEAEA' : '#E1F5EE',
          padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,.5)', ...FONT_STYLE,
        }}>
          {toast}
          <button onClick={() => setToast(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}
    </div>
  );
}
