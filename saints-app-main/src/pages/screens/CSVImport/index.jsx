import React, { useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import DarkScreenLayout from '@/components/shared/DarkScreenLayout';
import { parseTrackmanCSV, n, countCategory, buildArsenals, extractCatcherData } from './parseTrackman';
import { rebuildAllPitcherSeasons } from '@/lib/seasonAggregation';

const GOLD = '#c6b583';
const TRACKMAN_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781850858/Big_Grey_o4nxgb.webp';

// Import a single parsed file's rows into the DB
async function importGame(rows, gameID, fileName, onProgress) {
  const allTeams = await base44.entities.Team.list('name', 200);
  const byTmCode = {};
  allTeams.forEach(t => { if (t.trackman_code) byTmCode[t.trackman_code] = t; });

  function resolveTeamName(tmCode) {
    if (!tmCode) return tmCode;
    return byTmCode[tmCode]?.name || tmCode;
  }

  const first = rows[0];
  const date = first.Date || '';
  const stadium = first.Stadium || '';
  const homeTmCode = first.HomeTeam || '';
  const awayTmCode = first.AwayTeam || '';
  const homeTeam = byTmCode[homeTmCode] || { name: homeTmCode, code: homeTmCode };
  const awayTeam = byTmCode[awayTmCode] || { name: awayTmCode, code: awayTmCode };

  onProgress('Creating game record…', 5);

  // Helper: normalize team code to first 3 uppercase alphanumeric chars
  const normCode = code => (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const importHome = normCode(homeTmCode);
  const importAway = normCode(awayTmCode);

  // 1. Check for exact trackman_file_name match (re-import)
  const byFileName = await base44.entities.Game.filter({ trackman_file_name: gameID });

  // 2. Check for fuzzy same-date matchup match (live-scouted game)
  const byDate = byFileName.length ? [] : await base44.entities.Game.filter({ date });

  let gameRecord;
  const fuzzyMatch = !byFileName.length && byDate.find(g => {
    const gh = normCode(g.home_team_code);
    const ga = normCode(g.away_team_code);
    return (gh === importHome && ga === importAway) || (gh === importAway && ga === importHome);
  });

  if (byFileName.length) {
    // Re-import: overwrite existing
    gameRecord = byFileName[0];
    await base44.entities.Game.update(gameRecord.id, {
      date, home_team: homeTeam.name, away_team: awayTeam.name,
      home_team_code: homeTeam.code || homeTeam.name,
      away_team_code: awayTeam.code || awayTeam.name,
      trackman_file_name: gameID, status: 'complete', total_pitches: rows.length,
    });
    onProgress('Clearing old pitch data…', 10);
    const oldPitches = await base44.entities.TrackmanPitch.filter({ game_id: gameRecord.id });
    for (let i = 0; i < oldPitches.length; i += 50)
      await Promise.all(oldPitches.slice(i, i + 50).map(p => base44.entities.TrackmanPitch.delete(p.id)));
    const oldArsenals = await base44.entities.PitcherArsenal.filter({ game_id: gameRecord.id });
    for (let i = 0; i < oldArsenals.length; i += 50)
      await Promise.all(oldArsenals.slice(i, i + 50).map(a => base44.entities.PitcherArsenal.delete(a.id)));
  } else if (fuzzyMatch) {
    // Attach to existing live-scouted game
    gameRecord = fuzzyMatch;
    await base44.entities.Game.update(gameRecord.id, {
      trackman_file_name: gameID, status: 'complete', total_pitches: rows.length,
    });
    onProgress('Clearing old pitch data…', 10);
    const oldPitches = await base44.entities.TrackmanPitch.filter({ game_id: gameRecord.id });
    for (let i = 0; i < oldPitches.length; i += 50)
      await Promise.all(oldPitches.slice(i, i + 50).map(p => base44.entities.TrackmanPitch.delete(p.id)));
    const oldArsenals = await base44.entities.PitcherArsenal.filter({ game_id: gameRecord.id });
    for (let i = 0; i < oldArsenals.length; i += 50)
      await Promise.all(oldArsenals.slice(i, i + 50).map(a => base44.entities.PitcherArsenal.delete(a.id)));
  } else {
    // No match — create new game
    gameRecord = await base44.entities.Game.create({
      date, home_team: homeTeam.name, away_team: awayTeam.name,
      home_team_code: homeTeam.code || homeTeam.name,
      away_team_code: awayTeam.code || awayTeam.name,
      trackman_file_name: gameID, status: 'complete', total_pitches: rows.length,
    });
  }

  const pitches = rows.map(r => ({
    game_id: gameRecord.id,
    pitch_no: n(r.PitchNo), date: r.Date || null, time: r.Time || null,
    pitcher_name: r.Pitcher || null, pitcher_id_trackman: r.PitcherId || null,
    pitcher_hand: r.PitcherThrows || null, pitcher_team: resolveTeamName(r.PitcherTeam),
    batter_name: r.Batter || null, batter_id_trackman: r.BatterId || null,
    batter_hand: r.BatterSide || null, batter_team: resolveTeamName(r.BatterTeam),
    inning: n(r.Inning), top_bottom: r['Top/Bottom'] || null,
    outs: n(r.Outs), balls: n(r.Balls), strikes: n(r.Strikes),
    pitch_type: r.TaggedPitchType || r.AutoPitchType || null,
    tagged_pitch_type: r.TaggedPitchType || null, pitch_call: r.PitchCall || null,
    rel_speed: n(r.RelSpeed), spin_rate: n(r.SpinRate), spin_axis: n(r.SpinAxis),
    horz_break: n(r.HorzBreak), induced_vert_break: n(r.InducedVertBreak),
    plate_loc_height: n(r.PlateLocHeight), plate_loc_side: n(r.PlateLocSide),
    zone_speed: n(r.ZoneSpeed), vert_rel_angle: n(r.VertRelAngle), horz_rel_angle: n(r.HorzRelAngle),
    rel_height: n(r.RelHeight), rel_side: n(r.RelSide), extension: n(r.Extension),
    exit_speed: n(r.ExitSpeed), launch_angle: n(r.Angle), hit_distance: n(r.Distance),
    bearing: n(r.Bearing), hang_time: n(r.HangTime),
    play_result: r.PlayResult || null, kor_bb: r.KorBB || null,
    count_category: countCategory(r.Balls, r.Strikes), notes: r.Notes || null,
  }));

  const BATCH = 50;
  const DELAY = 700;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < pitches.length; i += BATCH) {
    await base44.entities.TrackmanPitch.bulkCreate(pitches.slice(i, i + BATCH));
    const done = Math.min(i + BATCH, pitches.length);
    onProgress(`Importing pitches… ${done}/${pitches.length}`, 20 + Math.round((done / pitches.length) * 45));
    if (i + BATCH < pitches.length) await sleep(DELAY);
  }

  onProgress('Aggregating pitcher arsenals…', 68);
  const arsenals = buildArsenals(rows, gameRecord.id);
  for (let i = 0; i < arsenals.length; i += BATCH) {
    await base44.entities.PitcherArsenal.bulkCreate(arsenals.slice(i, i + BATCH));
    if (i + BATCH < arsenals.length) await sleep(DELAY);
  }

  onProgress('Processing catcher data…', 85);
  const catcherGroups = extractCatcherData(rows);
  for (const cg of catcherGroups) {
    const teamName = resolveTeamName(cg.team);
    const existingObs = await base44.entities.CatcherObservation.filter({ game_id: gameRecord.id, catcher_name: cg.name });
    const popData = { trackman_pop_times: cg.pops };
    if (existingObs.length) {
      await base44.entities.CatcherObservation.update(existingObs[0].id, popData);
    } else {
      await base44.entities.CatcherObservation.create({ game_id: gameRecord.id, catcher_name: cg.name, catcher_team: teamName || cg.team, ...popData });
    }
  }

  const pitcherSet = {};
  rows.forEach(r => { if (r.Pitcher) pitcherSet[r.Pitcher] = resolveTeamName(r.PitcherTeam) || r.PitcherTeam; });

  return {
    gameID, date,
    homeTeam, awayTeam,
    pitchCount: rows.length,
    pitchers: Object.entries(pitcherSet).map(([name, team]) => ({ name, team })),
    batters: [...new Set(rows.map(r => r.Batter).filter(Boolean))],
    catcherPops: catcherGroups.map(c => ({ name: c.name, count: c.pops.length })),
  };
}

export default function CSVImport({ onBack, onViewRepo }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState('DROP'); // DROP | CONFIRM_DUPES | IMPORTING | DONE | REBUILDING
  const [fileStatuses, setFileStatuses] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dupeWarnings, setDupeWarnings] = useState([]); // [{ fileName, gameID, date, homeTeam, awayTeam }]
  const parsedCache = useRef({}); // fileName -> rows, avoids double-parsing
  const [importedGames, setImportedGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [rebuildStatus, setRebuildStatus] = useState(null);
  const [wipePhase, setWipePhase] = useState('idle'); // idle | confirm | wiping | done
  const [wipeStatus, setWipeStatus] = useState(null);
  const [wipeCurated, setWipeCurated] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState('');

  useEffect(() => {
    base44.entities.Game.list('-date', 200)
      .then(games => { setImportedGames(games); setLoadingGames(false); })
      .catch(() => setLoadingGames(false));
  }, [phase]);

  function updateFileStatus(index, patch) {
    setFileStatuses(prev => prev.map((f, i) => i === index ? { ...f, ...patch } : f));
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.name.endsWith('.csv'));
    if (!files.length) { setError('No CSV files found.'); return; }
    setError(null);

    // Pre-flight duplicate check — cache parsed rows to avoid re-parsing on import
    parsedCache.current = {};
    const dupes = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const rows = parseTrackmanCSV(text);
        if (!rows.length) continue;
        parsedCache.current[file.name] = rows;
        const gameID = rows[0].GameID || file.name;
        const existing = await base44.entities.Game.filter({ trackman_file_name: gameID });
        if (existing.length) {
          const g = existing[0];
          dupes.push({ file, fileName: file.name, gameID, date: g.date, homeTeam: g.home_team, awayTeam: g.away_team });
        }
      } catch (_) {}
    }

    if (dupes.length > 0) {
      setPendingFiles(files);
      setDupeWarnings(dupes);
      setPhase('CONFIRM_DUPES');
      return;
    }

    runImport(files);
  }

  async function runImport(files) {
    const initialStatuses = files.map(f => ({ name: f.name, status: 'pending', label: 'Waiting…', pct: 0 }));
    setFileStatuses(initialStatuses);
    setResults([]);
    setPhase('IMPORTING');

    const importResults = [];
    for (let i = 0; i < files.length; i++) {
      updateFileStatus(i, { status: 'importing', label: 'Parsing…', pct: 2 });
      try {
        let rows = parsedCache.current[files[i].name];
        if (!rows) {
          const text = await files[i].text();
          rows = parseTrackmanCSV(text);
        }
        if (!rows.length) throw new Error('No pitcher rows found.');
        const gameID = rows[0].GameID || files[i].name;

        const result = await importGame(rows, gameID, files[i].name, (label, pct) => {
          updateFileStatus(i, { label, pct });
        });
        updateFileStatus(i, { status: 'done', label: 'Done!', pct: 100 });
        importResults.push({ ...result, fileName: files[i].name });
      } catch (e) {
        updateFileStatus(i, { status: 'error', label: e.message || 'Failed', pct: 0, error: e.message });
      }
    }

    setResults(importResults);
    setPhase('DONE');

    // Auto-rebuild season stats after successful import — show progress
    if (importResults.length > 0) {
      setPhase('REBUILDING');
      setRebuildStatus('Rebuilding season stats…');
      try {
        const allTeams = await base44.entities.Team.list('name', 200).catch(() => []);
        await rebuildAllPitcherSeasons(allTeams, msg => setRebuildStatus(msg));
        setRebuildStatus('Season stats updated!');
      } catch (e) {
        setRebuildStatus('Rebuild error: ' + e.message);
      }
      setTimeout(() => { setPhase('DROP'); setRebuildStatus(null); }, 3000);
    }
  }

  async function handleRebuild() {
    setPhase('REBUILDING');
    setRebuildStatus('Starting rebuild…');
    try {
      const allTeams = await base44.entities.Team.list('name', 200).catch(() => []);
      await rebuildAllPitcherSeasons(allTeams, msg => setRebuildStatus(msg));
      setRebuildStatus('Done!');
    } catch (e) {
      setRebuildStatus('Error: ' + e.message);
    }
    setTimeout(() => { setPhase('DROP'); setRebuildStatus(null); }, 2000);
  }

  async function handleDeleteGame(gameId) {
    setDeletingGameId(gameId);
    setDeleteConfirmId(null);
    setDeleteProgress('Deleting pitch data…');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    try {
      let batch, total = 0;
      do {
        batch = await base44.entities.TrackmanPitch.filter({ game_id: gameId }, '-created_date', 50).catch(() => []);
        if (batch.length) {
          await Promise.all(batch.map(r => base44.entities.TrackmanPitch.delete(r.id).catch(() => {})));
          total += batch.length;
          setDeleteProgress(`Deleting pitch data… ${total} rows`);
          await sleep(400);
        }
      } while (batch.length > 0);
      setDeleteProgress('Removing game record…');
      await base44.entities.Game.delete(gameId).catch(() => {});
      setImportedGames(prev => prev.filter(g => g.id !== gameId));
    } finally {
      setDeletingGameId(null);
      setDeleteProgress('');
    }
  }

  async function handleWipe() {
    setWipePhase('wiping');
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const wipeFully = async (entity, filterFn, label) => {
      let total = 0;
      let emptyRounds = 0;
      while (emptyRounds < 3) {
        // Always fetch first page — as records are deleted the list shrinks
        const batch = await base44.entities[entity].list('created_date', 50).catch(() => []);
        const toDelete = filterFn ? batch.filter(filterFn) : batch;
        if (toDelete.length === 0) {
          emptyRounds++;
          await sleep(500);
          continue;
        }
        emptyRounds = 0;
        for (const r of toDelete) {
          await base44.entities[entity].delete(r.id).catch(() => {});
          total++;
        }
        setWipeStatus(`Deleting ${label}… (${total} removed)`);
        await sleep(200);
      }
      return total;
    };

    try {
      setWipeStatus('Deleting pitch data… (this will take several minutes)');
      const pitchCount = await wipeFully('TrackmanPitch', null, 'pitches');

      setWipeStatus('Deleting season stats…');
      const arsenalCount = await wipeFully('PitcherArsenal', null, 'arsenal rows');
      const ratesCount = await wipeFully('PitcherSeasonRates', null, 'rate rows');

      setWipeStatus('Deleting imported game records…');
      const gameCount = await wipeFully('Game', g => !!g.trackman_file_name, 'games');

      if (wipeCurated) {
        setWipeStatus('Deleting curated trails…');
        await wipeFully('CuratedDugoutTrail', null, 'trails');
      }

      setWipeStatus(`✓ Done — removed ${pitchCount} pitches, ${arsenalCount + ratesCount} stat rows, ${gameCount} games.`);
      setWipePhase('done');
      setTimeout(() => { setWipePhase('idle'); setWipeStatus(null); setWipeCurated(false); }, 6000);
    } catch (e) {
      setWipeStatus('Error: ' + e.message);
      setWipePhase('idle');
    }
  }

  function reset() {
    setPhase('DROP');
    setFileStatuses([]);
    setResults([]);
    setError(null);
    setPendingFiles([]);
    setDupeWarnings([]);
    parsedCache.current = {};
  }

  return (
    <DarkScreenLayout>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>

          <button onClick={onBack} className="dark-back-btn" style={{ marginBottom: 28 }}>← Home</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <img src={TRACKMAN_LOGO} alt="Trackman" style={{ width: 72, height: 72, objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(198,181,131,0.2))' }} />
            <div>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 24, color: '#f0ece0', letterSpacing: '-0.4px', textTransform: 'uppercase', lineHeight: 1 }}>Trackman Import</div>
              <div style={{ fontSize: 11, color: 'rgba(198,181,131,0.55)', fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 5 }}>CSV · V3 · Multi-file bulk upload</div>
            </div>
          </div>

          {phase === 'DROP' && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                style={{
                  border: `2px dashed ${dragging ? GOLD : 'rgba(198,181,131,0.25)'}`,
                  borderRadius: 12, padding: '40px 32px', textAlign: 'center',
                  cursor: 'pointer', background: dragging ? 'rgba(198,181,131,0.08)' : 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.5 }}>📂</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0', fontFamily: "'Archivo', sans-serif" }}>Drop Trackman V3 game CSVs here</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Click to browse · Multiple files supported</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

              {/* Rebuild season stats */}
              <div style={{ marginTop: 20, marginBottom: 4 }}>
                <button
                  onClick={handleRebuild}
                  style={{ width: '100%', padding: '12px', background: 'rgba(198,181,131,0.1)', border: '1px solid rgba(198,181,131,0.3)', borderRadius: 8, color: GOLD, fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.5, fontFamily: "'Archivo', sans-serif" }}
                >
                  🔄 Rebuild All Season Stats
                </button>
              </div>

              {/* Data wipe */}
              <div style={{ marginTop: 12, border: '1px solid rgba(192,57,43,0.3)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#e74c3c', letterSpacing: 1, textTransform: 'uppercase', fontFamily: "'Archivo', sans-serif" }}>⚠ Wipe CSV Data</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: "'Archivo', sans-serif" }}>Clears all pitches, season stats, and imported game records</div>
                  </div>
                  {wipePhase === 'idle' && (
                    <button onClick={() => setWipePhase('confirm')}
                      style={{ background: 'rgba(192,57,43,0.2)', border: '1px solid rgba(192,57,43,0.5)', borderRadius: 6, padding: '6px 14px', color: '#e74c3c', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'Archivo', sans-serif", whiteSpace: 'nowrap' }}>
                      Wipe data
                    </button>
                  )}
                </div>

                {wipePhase === 'confirm' && (
                  <div style={{ padding: '14px', background: 'rgba(192,57,43,0.06)', borderTop: '1px solid rgba(192,57,43,0.2)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f0ece0', marginBottom: 12, fontFamily: "'Archivo', sans-serif" }}>
                      This will permanently delete all Trackman pitch data, season stats, and CSV-imported game records. Live-scouted games will be preserved.
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
                      <input type="checkbox" checked={wipeCurated} onChange={e => setWipeCurated(e.target.checked)}
                        style={{ width: 14, height: 14, accentColor: '#e74c3c' }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: "'Archivo', sans-serif" }}>Also delete curated dugout trails</span>
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleWipe}
                        style={{ flex: 1, padding: '10px', background: '#c0392b', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: "'Archivo', sans-serif" }}>
                        Yes, wipe everything
                      </button>
                      <button onClick={() => { setWipePhase('idle'); setWipeCurated(false); }}
                        style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: '#f0ece0', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Archivo', sans-serif" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {(wipePhase === 'wiping' || wipePhase === 'done') && (
                  <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(192,57,43,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {wipePhase === 'wiping' && (
                      <div style={{ width: 14, height: 14, border: '2px solid #e74c3c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    )}
                    {wipePhase === 'done' && <span style={{ fontSize: 16 }}>✓</span>}
                    <span style={{ fontSize: 12, color: wipePhase === 'done' ? '#2ecc71' : 'rgba(255,255,255,0.6)', fontFamily: "'Archivo', sans-serif" }}>{wipeStatus}</span>
                  </div>
                )}
              </div>

              {/* Already-imported games */}
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(198,181,131,0.5)', marginBottom: 10 }}>
                  Imported Games ({loadingGames ? '…' : importedGames.length})
                </div>
                {loadingGames ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ width: 20, height: 20, border: '2px solid rgba(198,181,131,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                  </div>
                ) : importedGames.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>No games imported yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {importedGames.map(g => (
                      <div key={g.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${deleteConfirmId === g.id ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.07)'}`, borderRadius: deleteConfirmId === g.id ? '8px 8px 0 0' : 8, padding: '9px 14px' }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', minWidth: 80, fontVariantNumeric: 'tabular-nums' }}>{g.date}</span>
                          <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: '#f0ece0', fontFamily: "'Archivo', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g.home_team || g.home_team_code} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>vs</span> {g.away_team || g.away_team_code}
                          </span>
                          {g.total_pitches != null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap' }}>{g.total_pitches} pitches</span>
                          )}
                          {deletingGameId === g.id ? (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{deleteProgress}</span>
                          ) : deleteConfirmId === g.id ? (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => handleDeleteGame(g.id)} style={{ background: '#c0392b', border: 'none', borderRadius: 4, padding: '4px 10px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                              <button onClick={() => setDeleteConfirmId(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, padding: '4px 10px', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(g.id)} style={{ background: 'none', border: '1px solid rgba(192,57,43,0.4)', borderRadius: 4, padding: '4px 8px', color: 'rgba(220,80,70,0.8)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                          )}
                        </div>
                        {deleteConfirmId === g.id && (
                          <div style={{ padding: '8px 14px', background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.5)', borderTop: 'none', borderRadius: '0 0 8px 8px', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                            This will permanently delete all pitch data for this game. Click Delete to confirm.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {phase === 'REBUILDING' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
              <div style={{ width: 28, height: 28, border: '3px solid rgba(198,181,131,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, textAlign: 'center', fontFamily: "'Archivo', sans-serif" }}>{rebuildStatus || 'Rebuilding…'}</div>
            </div>
          )}

          {phase === 'CONFIRM_DUPES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#fbbf24', marginBottom: 6 }}>⚠ Duplicate Game{dupeWarnings.length > 1 ? 's' : ''} Detected</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
                  The following file{dupeWarnings.length > 1 ? 's have' : ' has'} already been imported. Re-importing will overwrite existing pitch data for that game.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dupeWarnings.map((d, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: '#f0ece0', fontFamily: 'monospace' }}>{d.fileName}</div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                        {d.homeTeam} vs {d.awayTeam} · {d.date}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={reset} className="dark-back-btn" style={{ flex: 1 }}>Cancel</button>
                <button
                  onClick={() => runImport(pendingFiles)}
                  style={{ flex: 1, padding: '10px', background: '#b45309', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.3 }}
                >
                  Overwrite &amp; Import Anyway
                </button>
              </div>
            </div>
          )}

          {phase === 'IMPORTING' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Importing {fileStatuses.length} file{fileStatuses.length !== 1 ? 's' : ''}…
              </div>
              {fileStatuses.map((fs, i) => (
                <FileProgressRow key={i} fs={fs} />
              ))}
            </div>
          )}

          {phase === 'DONE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Import Complete — {results.length}/{fileStatuses.length} succeeded
              </div>
              {fileStatuses.map((fs, i) => (
                <FileProgressRow key={i} fs={fs} />
              ))}
              {results.length > 0 && (
                <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px' }}>
                  {results.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#d4c9a8', padding: '5px 0', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <span style={{ fontWeight: 700, color: '#f0ece0' }}>{r.homeTeam?.name} vs {r.awayTeam?.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{r.date} · {r.pitchCount} pitches · {r.pitchers.length} pitchers</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={reset} className="dark-back-btn" style={{ flex: 1 }}>Import More</button>
                {onViewRepo && results.length > 0 && (
                  <button onClick={() => onViewRepo(results[0]?.homeTeam)} className="dark-primary-btn" style={{ flex: 1, padding: '10px' }}>
                    View Repository →
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '12px 16px', fontSize: 12.5, color: '#f87171', fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </DarkScreenLayout>
  );
}

function FileProgressRow({ fs }) {
  const statusColor = fs.status === 'done' ? '#4ade80' : fs.status === 'error' ? '#f87171' : GOLD;
  const icon = fs.status === 'done' ? '✓' : fs.status === 'error' ? '✗' : '…';
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: fs.status === 'importing' ? 8 : 0 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: statusColor, minWidth: 16 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 12, color: '#d4c9a8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fs.name}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fs.label}</span>
      </div>
      {fs.status === 'importing' && (
        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${fs.pct}%`, background: GOLD, borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>
      )}
      {fs.status === 'error' && fs.error && (
        <div style={{ fontSize: 11, color: '#f87171', marginTop: 4, paddingLeft: 26 }}>{fs.error}</div>
      )}
    </div>
  );
}