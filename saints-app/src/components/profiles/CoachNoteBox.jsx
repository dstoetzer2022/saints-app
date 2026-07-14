import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { C, FONT } from '@/lib/darkTheme';

const FONT_STYLE = { fontFamily: FONT };

function Card({ children, style }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 10, padding: 15, ...style }}>
      {children}
    </div>
  );
}

// ── Coach annotations (mockup v3, item 9) ──────────────────────
// Free-text, timestamped notes on a player. Backed by a CoachNote entity;
// degrades to an informational line until the entity exists (schema is a
// separate sign-off — no schema is created from here).
export default function CoachNoteBox({ playerNameKey }) {
  const [notes, setNotes] = useState(null); // null = loading, false = entity unavailable
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    base44.entities.CoachNote.filter({ player_name_key: playerNameKey })
      .then(rows => { if (live) setNotes((rows || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))); })
      .catch(() => { if (live) setNotes(false); });
    return () => { live = false; };
  }, [playerNameKey]);

  const save = async () => {
    const note = draft.trim();
    if (!note || saving) return;
    setSaving(true);
    try {
      const created = await base44.entities.CoachNote.create({ player_name_key: playerNameKey, note });
      setNotes(n => [created, ...(n || [])]);
      setDraft('');
    } catch {
      setNotes(false);
    }
    setSaving(false);
  };

  if (notes === false) {
    return (
      <div style={{ fontSize: 11, color: C.muted, padding: '10px 2px', ...FONT_STYLE }}>
        Coach annotations pending setup (CoachNote entity not yet created).
      </div>
    );
  }

  return (
    <Card style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Coach annotation</div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Add a note on this player… (timestamped, visible to all staff)"
        style={{ width: '100%', minHeight: 56, resize: 'vertical', background: C.raised, border: `1px solid ${C.edge}`, color: C.cream, borderRadius: 8, padding: '10px 12px', fontSize: 12.5, ...FONT_STYLE }}
      />
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <button onClick={save} disabled={saving || !draft.trim()} style={{ background: C.raised, border: `1px solid ${C.goldDim || C.gold}`, color: C.gold, borderRadius: 6, padding: '6px 13px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', opacity: saving || !draft.trim() ? 0.5 : 1, ...FONT_STYLE }}>
          {saving ? 'Saving…' : 'Save Note'}
        </button>
      </div>
      {(notes || []).map(n => (
        <div key={n.id} style={{ background: C.raised, border: `1px solid ${C.edge}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 8, padding: '9px 12px', marginTop: 9 }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 3 }}>
            {n.created_date ? new Date(n.created_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{n.note}</div>
        </div>
      ))}
    </Card>
  );
}

