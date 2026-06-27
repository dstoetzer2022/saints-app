import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD, BORDER, TINT, inputStyle, labelStyle } from '@/lib/ds';
import SectionTitle from '@/components/shared/SectionTitle';
import PitcherScoutPanel from '@/components/scouting/PitcherScoutPanel';
import CatcherScoutPanel from '@/components/scouting/CatcherScoutPanel';
import RunnerScoutPanel from '@/components/scouting/RunnerScoutPanel';
import SubstitutionForm from '@/components/scouting/SubstitutionForm';
import LineupCard from '@/components/scouting/LineupCard';

const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'];
const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const btnBase = { fontFamily: "'Archivo', sans-serif", fontWeight: 700, borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const primaryBtn = { ...btnBase, background: NAVY, color: GOLD, border: 'none', padding: '9px 22px' };
const ghostBtn = { ...btnBase, background: 'none', border: `1.5px solid ${BORDER}`, color: NAVY, padding: '9px 16px' };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Step 1: Date + Opponent ────────────────────────────────
function Step1({ onNext, onBack }) {
  const [teams, setTeams] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [opponentId, setOpponentId] = useState('');

  useEffect(() => {
    base44.entities.Team.list('name', 100).then(ts => {
      // Exclude Saints from opponent list
      setTeams(ts.filter(t => t.code !== 'ARR'));
    });
  }, []);

  const opponent = teams.find(t => t.id === opponentId);

  return (
    <div style={{ maxWidth: 480 }}>
      <SectionTitle sub="Step 1 of 3">Game Setup</SectionTitle>
      <Field label="Game Date">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Opponent Team">
        <select value={opponentId} onChange={e => setOpponentId(e.target.value)} style={inputStyle}>
          <option value="">— select opponent —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {opponent?.logo_url && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <img src={opponent.logo_url} alt={opponent.name} style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, color: NAVY }}>{opponent.name}</span>
          </div>
        )}
      </Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button style={ghostBtn} onClick={onBack}>← Back</button>
        <button style={{ ...primaryBtn, opacity: (!date || !opponentId) ? 0.4 : 1 }}
          disabled={!date || !opponentId}
          onClick={() => onNext({ date, opponent })}>
          Next: Lineup Card →
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Lineup Card ───────────────────────────────────
function Step2({ gameSetup, onNext, onBack }) {
  const emptySlot = () => ({ name: '', position: '', jersey: '', hand: '' });
  const [lineup, setLineup] = useState(ORDER.map(emptySlot));
  const [startingPitcher, setStartingPitcher] = useState('');
  const [spJersey, setSpJersey] = useState('');
  const [spHand, setSpHand] = useState('');
  const [pitcherInLineup, setPitcherInLineup] = useState(null);

  function setSlot(i, field, val) {
    setLineup(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
    if (field === 'position' && val === 'P') {
      setPitcherInLineup(i);
      setStartingPitcher(''); setSpJersey('');
    }
    if (field === 'name' && pitcherInLineup === i) setStartingPitcher('');
  }

  const resolvedPitcherName = pitcherInLineup !== null ? lineup[pitcherInLineup].name : startingPitcher;
  const resolvedPitcherJersey = pitcherInLineup !== null ? lineup[pitcherInLineup].jersey : spJersey;
  const valid = lineup.every(s => s.name.trim()) && resolvedPitcherName.trim();

  const thS = { padding: '6px 8px', fontWeight: 700, fontSize: 11, color: NAVY, textTransform: 'uppercase', borderBottom: `2px solid ${NAVY}` };

  return (
    <div style={{ maxWidth: 740 }}>
      <SectionTitle sub={`Step 2 of 3 — ${gameSetup.opponent?.name} · ${gameSetup.date}`}>
        Lineup Card
      </SectionTitle>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr>
              <th style={{ ...thS, width: 36, textAlign: 'center' }}>#</th>
              <th style={thS}>Player Name</th>
              <th style={{ ...thS, width: 56, textAlign: 'center' }}>Jersey</th>
              <th style={{ ...thS, width: 78 }}>Pos</th>
              <th style={{ ...thS, width: 64 }}>Bats</th>
              <th style={{ ...thS, width: 50, textAlign: 'center' }}>SP?</th>
            </tr>
          </thead>
          <tbody>
            {lineup.map((slot, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : TINT }}>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: '#aaa', fontSize: 13 }}>{i + 1}</td>
                <td style={{ padding: '5px 8px' }}>
                  <input value={slot.name} onChange={e => setSlot(i, 'name', e.target.value)} placeholder={`Player ${i + 1}`} style={{ ...inputStyle, fontSize: 13 }} />
                </td>
                <td style={{ padding: '5px 8px' }}>
                  <input value={slot.jersey} onChange={e => setSlot(i, 'jersey', e.target.value)} placeholder="#" style={{ ...inputStyle, fontSize: 13, textAlign: 'center' }} />
                </td>
                <td style={{ padding: '5px 8px' }}>
                  <select value={slot.position} onChange={e => setSlot(i, 'position', e.target.value)} style={{ ...inputStyle, fontSize: 13 }}>
                    <option value="">—</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td style={{ padding: '5px 8px' }}>
                  <select value={slot.hand} onChange={e => setSlot(i, 'hand', e.target.value)} style={{ ...inputStyle, fontSize: 13 }}>
                    <option value="">—</option>
                    <option value="L">L</option>
                    <option value="R">R</option>
                    <option value="S">S</option>
                  </select>
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                  <input type="radio" name="startingPitcher" checked={pitcherInLineup === i}
                    onChange={() => { setPitcherInLineup(i); setStartingPitcher(''); setSpJersey(''); }}
                    style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
        <label style={labelStyle}>Starting Pitcher (if not in lineup above)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <input type="radio" name="startingPitcher" checked={pitcherInLineup === null}
            onChange={() => setPitcherInLineup(null)} style={{ flexShrink: 0 }} />
          <input value={startingPitcher}
            onChange={e => { setStartingPitcher(e.target.value); setPitcherInLineup(null); }}
            placeholder="Pitcher name" style={{ ...inputStyle, flex: 1 }} disabled={pitcherInLineup !== null} />
          <input value={spJersey}
            onChange={e => { setSpJersey(e.target.value); setPitcherInLineup(null); }}
            placeholder="#" style={{ ...inputStyle, width: 52, textAlign: 'center' }} disabled={pitcherInLineup !== null} />
        </div>
        <div>
          <label style={labelStyle}>Throws</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['L', 'R'].map(h => (
              <button key={h} type="button" onClick={() => setSpHand(spHand === h ? '' : h)}
                style={{ padding: '4px 14px', borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${NAVY}`, background: spHand === h ? NAVY : '#fff', color: spHand === h ? GOLD : NAVY }}>
                {h}HP
              </button>
            ))}
          </div>
        </div>
        {resolvedPitcherName && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: '#2c5530', fontWeight: 600 }}>
            ✓ Starting Pitcher: {resolvedPitcherName}{resolvedPitcherJersey ? ` #${resolvedPitcherJersey}` : ''}{spHand ? ` (${spHand}HP)` : ''}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={ghostBtn} onClick={onBack}>← Back</button>
        <button style={{ ...primaryBtn, opacity: !valid ? 0.4 : 1 }} disabled={!valid}
          onClick={() => onNext({ lineup, startingPitcherName: resolvedPitcherName, startingPitcherJersey: resolvedPitcherJersey, startingPitcherHand: spHand })}>
          Submit Lineup →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Live Scouting ─────────────────────────────────
function Step3({ gameSetup, lineupData, gameRecord, onBack }) {
  const [obsTab, setObsTab] = useState('PITCHER');
  const [pitcherObsList, setPitcherObsList] = useState([]);
  const [activePitcherId, setActivePitcherId] = useState(null);
  const [catcherObs, setCatcherObs] = useState(null);
  const [runnerObs, setRunnerObs] = useState([]);
  const [subLog, setSubLog] = useState([]);
  const [showSubForm, setShowSubForm] = useState(false);
  const [currentLineup, setCurrentLineup] = useState(lineupData?.lineup || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.PitcherObservation.filter({ game_id: gameRecord.id }),
      base44.entities.CatcherObservation.filter({ game_id: gameRecord.id }),
      base44.entities.BaserunnerObservation.filter({ game_id: gameRecord.id }),
    ]).then(([pObs, cObs, rObs]) => {
      setPitcherObsList(pObs);
      setActivePitcherId(pObs[pObs.length - 1]?.id || null);
      if (cObs.length) setCatcherObs(cObs[0]);
      setRunnerObs(rObs);
      setLoading(false);
    });
  }, [gameRecord.id]);

  const activePitcher = pitcherObsList.find(p => p.id === activePitcherId);

  async function handlePitcherSub({ name, jersey, hand }) {
    const newObs = await base44.entities.PitcherObservation.create({
      game_id: gameRecord.id, pitcher_name: name,
      pitcher_team: gameSetup.opponent.name, pitcher_hand: hand || null,
    });
    setSubLog(prev => [...prev, {
      type: 'pitcher', incoming: { name, jersey, hand },
      replaced: activePitcher?.pitcher_name || '—',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setPitcherObsList(prev => [...prev, newObs]);
    setActivePitcherId(newObs.id);
    setShowSubForm(false);
    setObsTab('PITCHER');
  }

  async function handleHitterSub({ name, jersey, hand, slotIndex }) {
    const replaced = currentLineup[slotIndex]?.name || '—';
    const newObs = await base44.entities.BaserunnerObservation.create({
      game_id: gameRecord.id, runner_name: name, runner_team: gameSetup.opponent.name,
    });
    setRunnerObs(prev => [...prev, newObs]);
    setCurrentLineup(prev => prev.map((s, i) => i === slotIndex ? { ...s, name, jersey, hand } : s));
    setSubLog(prev => [...prev, {
      type: 'hitter', incoming: { name, jersey, hand },
      replaced, slotIndex: slotIndex + 1,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setShowSubForm(false);
    setObsTab('BASERUNNERS');
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ width: 24, height: 24, border: '3px solid #cdc8bd', borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
    </div>;
  }

  const tabStyle = (active) => ({
    fontSize: 13, fontWeight: 700, padding: '9px 16px', border: 'none',
    borderBottom: active ? `3px solid ${GOLD}` : '3px solid transparent',
    background: 'transparent', color: active ? NAVY : '#888', cursor: 'pointer',
    fontFamily: "'Archivo', sans-serif",
  });

  return (
    <div>
      <div style={{ background: NAVY, borderRadius: 8, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {gameSetup.opponent?.logo_url && (
          <img src={gameSetup.opponent.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 15 }}>vs {gameSetup.opponent?.name}</div>
          <div style={{ color: '#ccc', fontSize: 12 }}>{gameSetup.date}</div>
        </div>
        <span style={{ background: '#22c55e', color: '#fff', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>LIVE</span>
        <button onClick={() => setShowSubForm(!showSubForm)}
          style={{ background: showSubForm ? '#ef4444' : GOLD, color: showSubForm ? '#fff' : NAVY, border: 'none', borderRadius: 5, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          {showSubForm ? '✕ Cancel' : '🔄 Substitution'}
        </button>
      </div>

      {showSubForm && (
        <SubstitutionForm
          lineup={currentLineup}
          currentPitcher={activePitcher?.pitcher_name}
          onPitcherSub={handlePitcherSub}
          onHitterSub={handleHitterSub}
          onCancel={() => setShowSubForm(false)}
        />
      )}

      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 20, overflowX: 'auto' }}>
        <button onClick={() => setObsTab('LINEUP')} style={tabStyle(obsTab === 'LINEUP')}>📋 Lineup</button>
        <button onClick={() => setObsTab('PITCHER')} style={tabStyle(obsTab === 'PITCHER')}>
          ⚾ Pitcher{pitcherObsList.length > 1 ? ` (${pitcherObsList.length})` : ''}
        </button>
        <button onClick={() => setObsTab('CATCHER')} style={tabStyle(obsTab === 'CATCHER')}>🥊 Catcher</button>
        <button onClick={() => setObsTab('BASERUNNERS')} style={tabStyle(obsTab === 'BASERUNNERS')}>
          🏃 Runners ({runnerObs.length})
        </button>
      </div>

      {obsTab === 'LINEUP' && (
        <LineupCard
          lineup={currentLineup}
          runnerObs={runnerObs}
          catcherObs={catcherObs}
          pitcherObsList={pitcherObsList}
        />
      )}

      {obsTab === 'PITCHER' && (
        <div>
          {pitcherObsList.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {pitcherObsList.map((p, i) => (
                <button key={p.id} onClick={() => setActivePitcherId(p.id)}
                  style={{ padding: '5px 12px', borderRadius: 5, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    border: `1.5px solid ${NAVY}`,
                    background: p.id === activePitcherId ? NAVY : '#fff',
                    color: p.id === activePitcherId ? GOLD : NAVY }}>
                  {i === 0 ? 'SP' : `RP${i}`}: {p.pitcher_name}
                </button>
              ))}
            </div>
          )}
          {activePitcher && <PitcherScoutPanel key={activePitcher.id} obs={activePitcher} />}
        </div>
      )}

      {obsTab === 'CATCHER' && catcherObs && (
        <CatcherScoutPanel key={catcherObs.id} obs={catcherObs} />
      )}

      {obsTab === 'BASERUNNERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {runnerObs.map(obs => <RunnerScoutPanel key={obs.id} obs={obs} />)}
        </div>
      )}

      {subLog.length > 0 && (
        <div style={{ marginTop: 24, background: TINT, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Substitution Log
          </div>
          {subLog.map((s, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: i < subLog.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
              <span style={{ fontWeight: 700 }}>{s.time}</span>{' '}
              {s.type === 'pitcher' ? '⚾' : '🔄'}{' '}
              <span style={{ color: '#2c5530', fontWeight: 600 }}>{s.incoming.name}</span>
              {s.incoming.jersey ? ` #${s.incoming.jersey}` : ''}
              {' '}for{' '}
              <span style={{ color: '#991b1b' }}>{s.replaced}</span>
              {s.slotIndex ? ` (slot ${s.slotIndex})` : ' (pitcher)'}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
        <button style={ghostBtn} onClick={onBack}>← Back to Menu</button>
      </div>
    </div>
  );
}

// ── Main orchestrator ─────────────────────────────────────
export default function GamedayScoutingFlow({ onBack }) {
  const [step, setStep] = useState(1);
  const [gameSetup, setGameSetup] = useState(null);   // { date, opponent }
  const [lineupData, setLineupData] = useState(null); // { lineup, startingPitcherName }
  const [gameRecord, setGameRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  async function handleStep2Submit(lineupResult) {
    setSubmitting(true); setSubmitErr('');
    try {
      const { date, opponent } = gameSetup;
      // Create / find Game record
      const existing = await base44.entities.Game.filter({ date, away_team: opponent.name });
      let game;
      if (existing.length) {
        game = existing[0];
      } else {
        game = await base44.entities.Game.create({
          date,
          home_team: 'Arroyo Seco Saints',
          home_team_code: 'ARR',
          away_team: opponent.name,
          away_team_code: opponent.code || '',
          status: 'imported',
        });
      }
      setGameRecord(game);

      // Find catcher in lineup
      const catcherSlot = lineupResult.lineup.find(s => s.position === 'C');

      // Create PitcherObservation stub
      const _pitcher = await base44.entities.PitcherObservation.create({
        game_id: game.id,
        pitcher_name: lineupResult.startingPitcherName,
        pitcher_team: opponent.name,
        pitcher_hand: lineupResult.startingPitcherHand || null,
      });

      // Create CatcherObservation stub (if C in lineup)
      let _catcher = null;
      if (catcherSlot) {
        _catcher = await base44.entities.CatcherObservation.create({
          game_id: game.id,
          catcher_name: catcherSlot.name,
          catcher_team: opponent.name,
        });
      }

      // Create BaserunnerObservation stubs for all 9
      const _runners = await Promise.all(
        lineupResult.lineup.map(s =>
          base44.entities.BaserunnerObservation.create({
            game_id: game.id,
            runner_name: s.name,
            runner_team: opponent.name,
          })
        )
      );

      // Save lineup to game record for reporting
      await base44.entities.Game.update(game.id, { lineup_data: lineupResult.lineup });
      setLineupData(lineupResult);
      setStep(3);
    } catch (e) {
      setSubmitErr(e.message || 'Failed to create records.');
    }
    setSubmitting(false);
  }

  if (submitting) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ width: 28, height: 28, border: `3px solid #cdc8bd`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: NAVY, fontWeight: 600 }}>Setting up game…</div>
      </div>
    );
  }

  return (
    <div>
      {step === 1 && (
        <Step1
          onNext={setup => { setGameSetup(setup); setStep(2); }}
          onBack={onBack}
        />
      )}
      {step === 2 && (
        <div>
          <Step2
            gameSetup={gameSetup}
            onNext={handleStep2Submit}
            onBack={() => setStep(1)}
          />
          {submitErr && <div style={{ color: '#991b1b', fontWeight: 600, marginTop: 12 }}>{submitErr}</div>}
        </div>
      )}
      {step === 3 && gameRecord && (
        <Step3
          gameSetup={gameSetup}
          lineupData={lineupData}
          gameRecord={gameRecord}
          onBack={onBack}
        />
      )}
    </div>
  );
}