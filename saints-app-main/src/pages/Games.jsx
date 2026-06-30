import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import TeamBadge from "@/components/shared/TeamBadge";
import { CalendarDays, ChevronDown, ChevronRight, Activity, Search, Trash2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

const EXPECTED_PITCHERS = 6;

function StatusBadge({ game }) {
  if (!game.total_pitches || game.total_pitches === 0) {
    return (
      <span style={{
        height: "20px", borderRadius: "2px", padding: "0 8px",
        display: "inline-flex", alignItems: "center",
        fontSize: "11px", fontFamily: "var(--font-body)", fontWeight: 500,
        letterSpacing: "0.05em", textTransform: "uppercase",
        border: "1px solid var(--accent-red-dim)", color: "var(--accent-red)", backgroundColor: "#C8102E15",
      }}>Pending</span>
    );
  }
  const styles = {
    imported: { border: "1px solid #2A4A6A", color: "#4A8AB0", backgroundColor: "#2A4A6A15", label: "Imported" },
    complete: { border: "1px solid #1A5A7A", color: "#2A9ABF", backgroundColor: "#1A5A7A15", label: "Complete" },
    scouting_complete: { border: "1px solid #1A5A2A", color: "#2AB04A", backgroundColor: "#1A5A2A15", label: "Scouting Complete" },
  };
  const s = styles[game.status] || styles.imported;
  return (
    <span style={{
      height: "20px", borderRadius: "2px", padding: "0 8px",
      display: "inline-flex", alignItems: "center",
      fontSize: "11px", fontFamily: "var(--font-body)", fontWeight: 500,
      letterSpacing: "0.05em", textTransform: "uppercase",
      border: s.border, color: s.color, backgroundColor: s.backgroundColor,
    }}>{s.label}</span>
  );
}

function GameRow({ game, pitcherObs, hitterObs, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleteState, setDeleteState] = useState('idle'); // idle | confirm | deleting | done
  const [deleteProgress, setDeleteProgress] = useState('');

  async function handleDelete() {
    setDeleteState('deleting');
    try {
      // Delete all TrackmanPitch rows for this game in batches of 50
      let batch;
      let totalDeleted = 0;
      do {
        batch = await base44.entities.TrackmanPitch.filter({ game_id: game.id }, '-created_date', 50).catch(() => []);
        if (batch.length) {
          await Promise.all(batch.map(r => base44.entities.TrackmanPitch.delete(r.id).catch(() => {})));
          totalDeleted += batch.length;
          setDeleteProgress(`Deleting pitch data… ${totalDeleted} rows`);
          // Small delay between batches to avoid rate limiting
          await new Promise(res => setTimeout(res, 400));
        }
      } while (batch.length > 0);

      // Delete the Game record itself
      setDeleteProgress('Removing game record…');
      await base44.entities.Game.delete(game.id).catch(() => {});

      setDeleteState('done');
      setTimeout(() => onDelete(game.id), 800);
    } catch (err) {
      setDeleteState('idle');
      setDeleteProgress('');
      console.error('Delete failed:', err);
    }
  }

  const scoutCount = pitcherObs.length;
  const scoutPct = Math.min(100, (scoutCount / EXPECTED_PITCHERS) * 100);

  let dateLabel = game.date;
  let dayLabel = "";
  try {
    const d = parseISO(game.date);
    dateLabel = format(d, "MMM d");
    dayLabel = format(d, "EEE").toUpperCase();
  } catch {}

  return (
    <div style={{ borderBottom: "1px solid var(--border-color)" }}>
      <button
        className="w-full text-left transition-all duration-150"
        style={{
          height: "56px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "0 16px",
          backgroundColor: "var(--bg-surface)",
          borderLeft: expanded ? "2px solid var(--accent-gold)" : "2px solid transparent",
          cursor: "pointer",
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-raised)"; e.currentTarget.style.borderLeft = "2px solid var(--accent-gold)"; }}
        onMouseLeave={e => { if (!expanded) { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; e.currentTarget.style.borderLeft = "2px solid transparent"; } }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Date */}
        <div style={{ width: "48px", flexShrink: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "16px", color: "var(--text-primary)", lineHeight: 1 }}>
            {dateLabel}
          </div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.2, marginTop: "2px" }}>
            {dayLabel}
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-center flex-1 min-w-0" style={{ gap: "8px" }}>
          <TeamBadge teamCode={game.away_team_code} />
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 500 }}>vs</span>
          <TeamBadge teamCode={game.home_team_code} />
        </div>

        {/* Pitch count */}
        <div className="hidden sm:flex items-center" style={{ gap: "4px", flexShrink: 0 }}>
          <Activity className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)" }}>
            {game.total_pitches || 0}
          </span>
        </div>

        {/* Scouting progress */}
        <div className="hidden md:flex flex-col justify-center" style={{ width: "80px", flexShrink: 0, gap: "4px" }}>
          <div className="flex justify-between">
            <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", color: "var(--text-muted)" }}>SCOUTED</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)" }}>
              {scoutCount}/{EXPECTED_PITCHERS}
            </span>
          </div>
          <div style={{ height: "3px", borderRadius: "2px", backgroundColor: "var(--bg-raised)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${scoutPct}%`, backgroundColor: "var(--accent-gold)", borderRadius: "2px" }} />
          </div>
        </div>

        {/* Status */}
        <div className="hidden sm:block" style={{ flexShrink: 0 }}>
          <StatusBadge game={game} />
        </div>

        {/* Expand */}
        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ backgroundColor: "var(--bg-raised)", borderTop: "1px solid var(--border-color)", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {game.venue && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CalendarDays className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)" }}>
                {game.venue} · {game.date}
              </span>
            </div>
          )}

          {/* Pitcher obs */}
          <div>
            <div style={{
              fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px",
              color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px"
            }}>
              Pitcher Observations ({pitcherObs.length})
            </div>
            {pitcherObs.length === 0 ? (
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>None recorded</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {pitcherObs.map(o => (
                  <div key={o.id} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "6px 8px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "2px",
                  }}>
                    <TeamBadge teamCode={o.pitcher_team} size="xs" />
                    <span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "12px", color: "var(--text-primary)" }}>{o.pitcher_name}</span>
                    {o.time_to_plate_1b && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>R1:{o.time_to_plate_1b}s</span>}
                    {o.time_to_plate_2b && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>R2:{o.time_to_plate_2b}s</span>}
                    {o.ucla_hold_start && <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-secondary)" }}>UCLA: {o.ucla_hold_start === o.ucla_hold_end ? o.ucla_hold_start : `${o.ucla_hold_start}→${o.ucla_hold_end}`}</span>}
                    {o.notes && <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{o.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hitter obs */}
          <div>
            <div style={{
              fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px",
              color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px"
            }}>
              Hitter Observations ({hitterObs.length})
            </div>
            {hitterObs.length === 0 ? (
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>None recorded</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {hitterObs.map(o => (
                  <div key={o.id} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "6px 8px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "2px",
                  }}>
                    <TeamBadge teamCode={o.hitter_team} size="xs" />
                    <span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "12px", color: "var(--text-primary)" }}>{o.hitter_name}</span>
                    {o.bat_speed_grade && <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-secondary)" }}>Bat: {o.bat_speed_grade}</span>}
                    {o.contact_grade && <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-secondary)" }}>Cnt: {o.contact_grade}</span>}
                    {o.power_grade && <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-secondary)" }}>Pwr: {o.power_grade}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Games() {
  const [games, setGames] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [hitterObs, setHitterObs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function handleGameDeleted(gameId) {
    setGames(prev => prev.filter(g => g.id !== gameId));
  }

  useEffect(() => {
    async function load() {
      const [gameData, pitcherData, hitterData, teamData] = await Promise.all([
        base44.entities.Game.list("-date", 200),
        base44.entities.PitcherObservation.list("-created_date", 500),
        base44.entities.HitterObservation.list("-created_date", 500),
        base44.entities.Team.list("-name", 100),
      ]);
      setGames(gameData);
      setPitcherObs(pitcherData);
      setHitterObs(hitterData);
      setTeams(teamData);
      setLoading(false);
    }
    load();
  }, []);

  function getTeamName(code) {
    const t = teams.find(t => t.code === code);
    return t?.name || code || "";
  }

  const filtered = games.filter(g => {
    if (fromDate && g.date < fromDate) return false;
    if (toDate && g.date > toDate) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const homeName = getTeamName(g.home_team_code).toLowerCase();
      const awayName = getTeamName(g.away_team_code).toLowerCase();
      if (!homeName.includes(q) && !awayName.includes(q) && !g.home_team_code?.toLowerCase().includes(q) && !g.away_team_code?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid var(--border-color)", borderTopColor: "var(--accent-gold)" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Page header */}
      <div>
        <h1 style={{
          fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "28px",
          textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-primary)",
          lineHeight: 1,
        }}>
          Games
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
          {games.length} game{games.length !== 1 ? "s" : ""} imported
        </p>
        <div style={{ width: "40px", height: "1px", backgroundColor: "var(--accent-gold)", marginTop: "8px" }} />
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "10px",
        padding: "12px 16px",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        borderRadius: "4px",
      }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: "160px" }}>
          <Search className="w-3.5 h-3.5" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            placeholder="Search by team name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", paddingLeft: "32px", paddingRight: "10px", height: "32px",
              backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-color)",
              borderRadius: "2px", color: "var(--text-primary)",
              fontFamily: "var(--font-body)", fontSize: "13px", outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{
              width: "136px", height: "32px", padding: "0 8px",
              backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-color)",
              borderRadius: "2px", color: "var(--text-primary)",
              fontFamily: "var(--font-body)", fontSize: "13px", outline: "none",
            }}
          />
          <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>–</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{
              width: "136px", height: "32px", padding: "0 8px",
              backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-color)",
              borderRadius: "2px", color: "var(--text-primary)",
              fontFamily: "var(--font-body)", fontSize: "13px", outline: "none",
            }}
          />
        </div>
      </div>

      {/* Game list */}
      {filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: "8px" }}>
          <CalendarDays style={{ width: "40px", height: "40px", color: "var(--text-muted)" }} />
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "18px", color: "var(--text-secondary)" }}>
            {games.length === 0 ? "No games imported yet" : "No games match your filters"}
          </h3>
          {games.length === 0 && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-muted)" }}>
              Import a Trackman CSV to get started
            </p>
          )}
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border-color)", borderRadius: "4px", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "flex", alignItems: "center", gap: "16px",
            padding: "0 16px", height: "32px",
            backgroundColor: "var(--bg-raised)",
            borderBottom: "1px solid rgba(200, 168, 75, 0.3)",
          }}>
            <div style={{ width: "48px", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Date</div>
            <div style={{ flex: 1, fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Matchup</div>
            <div className="hidden sm:block" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Pitches</div>
            <div className="hidden md:block" style={{ width: "80px", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Scouted</div>
            <div className="hidden sm:block" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Status</div>
            <div style={{ width: "16px", flexShrink: 0 }} />
          </div>

          {filtered.map(game => (
            <GameRow
              key={game.id}
              game={game}
              pitcherObs={pitcherObs.filter(o => o.game_id === game.id)}
              hitterObs={hitterObs.filter(o => o.game_id === game.id)}
              onDelete={handleGameDeleted}
            />
          ))}
          {/* Delete game */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            {deleteState === 'idle' && (
              <button
                onClick={() => setDeleteState('confirm')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid var(--accent-red-dim)', borderRadius: '3px', padding: '6px 12px', color: 'var(--accent-red)', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em' }}
              >
                <Trash2 style={{ width: 12, height: 12 }} /> Delete Game &amp; Pitch Data
              </button>
            )}
            {deleteState === 'confirm' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#C8102E10', border: '1px solid var(--accent-red-dim)', borderRadius: '3px' }}>
                <AlertTriangle style={{ width: 14, height: 14, color: 'var(--accent-red)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>
                  Delete all pitch data for this game? This cannot be undone.
                </span>
                <button
                  onClick={handleDelete}
                  style={{ background: '#C8102E', color: '#fff', border: 'none', borderRadius: '3px', padding: '5px 14px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setDeleteState('idle')}
                  style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '5px 12px', fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            )}
            {deleteState === 'deleting' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                <div style={{ width: 14, height: 14, border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-red)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)' }}>{deleteProgress || 'Deleting…'}</span>
              </div>
            )}
            {deleteState === 'done' && (
              <div style={{ padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: '12px', color: '#2AB04A' }}>✓ Game deleted</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}