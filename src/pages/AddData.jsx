import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/lib/AppContext';
import { NAVY, GOLD, BORDER, TINT, btn, btnSm, resolveTeamName } from '@/lib/ds';
import SectionTitle from '@/components/shared/SectionTitle';
import PitcherObsForm from '@/components/obs/PitcherObsForm';
import CatcherObsForm from '@/components/obs/CatcherObsForm';
import BaserunnerObsForm from '@/components/obs/BaserunnerObsForm';

function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    vals.push(cur.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  }).filter(r => r.Pitcher || r.Batter);
}

function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

export default function AddData() {
  const navigate = useNavigate();
  const { activeTeam } = useApp();
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [activeObsForm, setActiveObsForm] = useState(null);

  async function handleFiles(files) {
    if (!files || !files.length) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const summaries = [];
      for (const file of files) {
        const text = await file.text();
        const rows = parseCSVText(text);
        if (!rows.length) continue;

        // Group by date + pitcher team to create game records
        const gameMap = {};
        for (const r of rows) {
          const date = r.Date || '';
          const pitcherTeam = resolveTeamName(r.PitcherTeam);
          const batterTeam = resolveTeamName(r.BatterTeam);
          const topBottom = r['Top/Bottom'] || '';

          // Determine home/away: "Top" = away pitching (home batting), "Bottom" = home pitching
          let homeCode = r.BatterTeam || 'UNK';
          let awayCode = r.PitcherTeam || 'UNK';
          if (topBottom === 'Bottom') {
            homeCode = r.PitcherTeam || 'UNK';
            awayCode = r.BatterTeam || 'UNK';
          }

          const gameKey = `${date}__${homeCode}__${awayCode}`;
          if (!gameMap[gameKey]) {
            // Check for existing game
            const existing = await base44.entities.Game.filter({ date, home_team_code: homeCode, away_team_code: awayCode });
            if (existing.length) {
              gameMap[gameKey] = existing[0];
            } else {
              gameMap[gameKey] = await base44.entities.Game.create({
                date,
                home_team_code: homeCode,
                away_team_code: awayCode,
                home_team: resolveTeamName(homeCode),
                away_team: resolveTeamName(awayCode),
                trackman_file_name: file.name,
                status: 'imported',
              });
            }
          }
        }

        // Bulk create pitches
        const CHUNK = 100;
        const pitches = rows.map(r => {
          const topBottom = r['Top/Bottom'] || '';
          let homeCode = r.BatterTeam || 'UNK';
          let awayCode = r.PitcherTeam || 'UNK';
          if (topBottom === 'Bottom') { homeCode = r.PitcherTeam || 'UNK'; awayCode = r.BatterTeam || 'UNK'; }
          const gameKey = `${r.Date}__${homeCode}__${awayCode}`;
          return {
            game_id: gameMap[gameKey]?.id || null,
            date: r.Date || null,
            pitcher_name: r.Pitcher || null,
            pitcher_id_trackman: r.PitcherId || null,
            pitcher_team: resolveTeamName(r.PitcherTeam),
            pitcher_hand: r.PitcherThrows || null,
            batter_name: r.Batter || null,
            batter_id_trackman: r.BatterId || null,
            batter_team: resolveTeamName(r.BatterTeam),
            batter_hand: r.BatterSide || null,
            inning: num(r.Inning),
            top_bottom: r['Top/Bottom'] || null,
            outs: num(r.Outs),
            balls: num(r.Balls),
            strikes: num(r.Strikes),
            pitch_type: r.AutoPitchType || null,
            tagged_pitch_type: r.TaggedPitchType || null,
            pitch_call: r.PitchCall || null,
            rel_speed: num(r.RelSpeed),
            spin_rate: num(r.SpinRate),
            spin_axis: num(r.SpinAxis),
            horz_break: num(r.HorzBreak),
            induced_vert_break: num(r.InducedVertBreak),
            plate_loc_height: num(r.PlateLocHeight),
            plate_loc_side: num(r.PlateLocSide),
            zone_speed: num(r.ZoneSpeed),
            rel_height: num(r.RelHeight),
            rel_side: num(r.RelSide),
            extension: num(r.Extension),
            exit_speed: num(r.ExitSpeed),
            launch_angle: num(r.Angle),
            hit_distance: num(r.Distance),
            bearing: num(r.Bearing),
            play_result: r.PlayResult || null,
            kor_bb: r.KorBB || null,
          };
        });

        // Update game pitch counts
        for (const game of Object.values(gameMap)) {
          const count = pitches.filter(p => p.game_id === game.id).length;
          await base44.entities.Game.update(game.id, { total_pitches: count });
        }

        for (let i = 0; i < pitches.length; i += CHUNK) {
          await base44.entities.TrackmanPitch.bulkCreate(pitches.slice(i, i + CHUNK));
        }

        // Summarize by pitcher team
        const teamPitchers = {};
        for (const r of rows) {
          const team = resolveTeamName(r.PitcherTeam);
          if (!teamPitchers[team]) teamPitchers[team] = new Set();
          if (r.Pitcher) teamPitchers[team].add(r.Pitcher);
        }
        summaries.push({ file: file.name, teamPitchers, total: rows.length });
      }

      const routedParts = [];
      for (const s of summaries) {
        for (const [team, pitchers] of Object.entries(s.teamPitchers)) {
          routedParts.push(`${team} (${pitchers.size} pitcher${pitchers.size !== 1 ? 's' : ''})`);
        }
      }
      setImportStatus({ ok: true, msg: `Loaded ${files.length} file(s). Routed: ${routedParts.join(' · ')}` });
    } catch (err) {
      setImportStatus({ ok: false, msg: err.message || 'Import failed.' });
    }
    setImporting(false);
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={() => navigate('/')} style={{ ...btnSm('navy'), marginBottom: 24 }}>
        ← Home
      </button>

      {/* SECTION 1: Trackman Intake */}
      <div style={{ marginBottom: 40 }}>
        <SectionTitle>Trackman Intake</SectionTitle>

        <div
          onClick={() => !importing && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          style={{
            border: `2.5px dashed ${dragging ? GOLD : '#bdb8ad'}`,
            borderRadius: 10,
            padding: '26px 20px',
            textAlign: 'center',
            cursor: importing ? 'not-allowed' : 'pointer',
            background: dragging ? '#fffdf6' : TINT,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: NAVY, marginBottom: 6 }}>
            {importing ? 'Importing…' : 'Drop Trackman game CSV(s)'}
          </div>
          <div style={{ fontSize: 12.5, color: '#888' }}>
            auto-routed by team · folds into season totals · multiple files OK
          </div>
          {importing && (
            <div style={{ marginTop: 12 }}>
              <div style={{ width: 22, height: 22, border: `3px solid ${BORDER}`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".csv" multiple style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />

        {importStatus && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 6,
            background: importStatus.ok ? '#d1fae5' : '#fee2e2',
            color: importStatus.ok ? '#166534' : '#991b1b',
            fontWeight: 600, fontSize: 13,
            border: `1px solid ${importStatus.ok ? '#6ee7b7' : '#fca5a5'}`,
          }}>
            {importStatus.msg}
          </div>
        )}
      </div>

      {/* SECTION 2: Log Observations */}
      <div>
        <SectionTitle>Log Observations</SectionTitle>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {['Pitchers', 'Catchers', 'Baserunners'].map(label => (
            <button
              key={label}
              onClick={() => setActiveObsForm(activeObsForm === label ? null : label)}
              style={{
                ...btn(activeObsForm === label ? 'gold' : 'navy'),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeObsForm === 'Pitchers' && <PitcherObsForm activeTeam={activeTeam} />}
        {activeObsForm === 'Catchers' && <CatcherObsForm activeTeam={activeTeam} />}
        {activeObsForm === 'Baserunners' && <BaserunnerObsForm activeTeam={activeTeam} />}
      </div>
    </div>
  );
}