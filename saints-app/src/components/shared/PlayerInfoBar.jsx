import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { canonicalNameKey, normalizeHandLabel } from '@/lib/statsUtils';

const FONT = "'Archivo', system-ui, sans-serif";

const FIELDS = [
  { key: 'school', label: 'School' },
];

const BATS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'R', label: 'Right' },
  { value: 'L', label: 'Left' },
  { value: 'S', label: 'Switch' },
];

function InlineField({ label, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== (value || '')) onChange(draft);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT, fontWeight: 700 }}>
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
          style={{
            fontSize: 13, fontWeight: 500, fontFamily: FONT, color: '#ffffff',
            background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(198,181,131,0.5)',
            borderRadius: 5, padding: '4px 8px', outline: 'none', width: 140,
          }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{
            fontSize: 13, fontWeight: 600, fontFamily: FONT,
            color: draft ? '#c6b583' : 'rgba(198,181,131,0.55)',
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationColor: draft ? 'rgba(198,181,131,0.4)' : 'rgba(198,181,131,0.25)',
            textUnderlineOffset: 3,
          }}
        >
          {draft || '+ Add school'}
        </span>
      )}
    </div>
  );
}

// Manual handedness override. Trackman occasionally mislabels a pitch's
// batter_hand (bad camera read, wrong session config, etc.), which can make
// a normal hitter look like a switch hitter when both sides show up in the
// data. This field lets that be corrected directly and takes precedence
// over the auto-detected value everywhere (roster table + profile pill).
function BatsField({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'rgba(198,181,131,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT, fontWeight: 700 }}>
        Bats
      </span>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          fontSize: 13, fontWeight: 600, fontFamily: FONT,
          color: value ? '#c6b583' : 'rgba(198,181,131,0.55)',
          background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(198,181,131,0.35)',
          borderRadius: 5, padding: '4px 8px', outline: 'none', cursor: 'pointer', width: 90,
        }}
      >
        {BATS_OPTIONS.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#1a1a1a', color: '#fff' }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function PlayerInfoBar({ playerName, team, isPitcher, onSchoolChange, onBatsChange }) {
  const [record, setRecord] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState({ school: '', bats: '' });

  useEffect(() => {
    if (!playerName) return;
    setLoaded(false); setRecord(null); setRecordId(null);
    setData({ school: '', bats: '' });
    const wantKey = canonicalNameKey(playerName);
    // Scope to team + match by canonical key (not exact string) so this finds the
    // SAME Player row RosterView reads, regardless of "Last, First" vs "First Last"
    // formatting. Falls back to an unscoped exact-name lookup if no team is known.
    (team
      ? fetchAllFiltered(base44.entities.Player, { team }, 'name')
      : base44.entities.Player.filter({ name: playerName }, undefined, 1)
    )
      .then(rows => {
        const match = team
          ? (rows || []).find(r => canonicalNameKey(r.name) === wantKey)
          : (rows || [])[0];
        if (match) {
          setRecordId(match.id);
          setData({ school: match.school || '', bats: match.bats || '' });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [playerName, team]);

  const handleChange = async (field, value) => {
    const newData = { ...data, [field]: value };
    setData(newData);
    if (field === 'school' && onSchoolChange) onSchoolChange(value);
    if (field === 'bats' && onBatsChange) onBatsChange(normalizeHandLabel(value));
    try {
      if (recordId) {
        await base44.entities.Player.update(recordId, { [field]: value });
      } else {
        const created = await base44.entities.Player.create({ name: playerName, team: team || undefined, ...newData });
        setRecordId(created.id);
      }
    } catch (e) { /* silent */ }
  };

  if (!loaded) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 14px',
      marginTop: 10, fontFamily: FONT,
    }}>
      {FIELDS.map(({ key, label }) => (
        <InlineField
          key={key}
          label={label}
          value={data[key]}
          onChange={val => handleChange(key, val)}
        />
      ))}
      {!isPitcher && (
        <BatsField value={data.bats} onChange={val => handleChange('bats', val)} />
      )}
    </div>
  );
}