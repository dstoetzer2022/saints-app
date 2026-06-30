import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getTeamName } from "@/lib/teams";
import { formatNum, formatPct, mean, getSpeedColor, getAggressionColor } from "@/lib/statsUtils";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function ReportView() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const gameScope = params.get("game") || "season";
  const teamFilter = params.get("team");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const results = {};
        
        if (type === "staff" || type === "pitcher") {
          let arsenals = await base44.entities.PitcherArsenal.list("-created_date", 2000);
          if (teamFilter && teamFilter !== "all") arsenals = arsenals.filter(a => a.pitcher_team === teamFilter);
          if (gameScope !== "season") arsenals = arsenals.filter(a => a.game_id === gameScope);
          results.arsenals = arsenals;
        }

        if (type === "hitter") {
          let pitches = await base44.entities.TrackmanPitch.list("-created_date", 2000);
          if (teamFilter && teamFilter !== "all") pitches = pitches.filter(p => p.batter_team === teamFilter);
          if (gameScope !== "season") pitches = pitches.filter(p => p.game_id === gameScope);
          results.pitches = pitches;
        }

        if (type === "baserunning") {
          let obs = await base44.entities.BaserunnerObservation.list("-created_date", 500);
          if (teamFilter && teamFilter !== "all") obs = obs.filter(o => o.runner_team === teamFilter);
          if (gameScope !== "season") obs = obs.filter(o => o.game_id === gameScope);
          results.baserunners = obs;
        }

        if (type === "catcher") {
          let obs = await base44.entities.CatcherObservation.list("-created_date", 500);
          if (teamFilter && teamFilter !== "all") obs = obs.filter(o => o.catcher_team === teamFilter);
          if (gameScope !== "season") obs = obs.filter(o => o.game_id === gameScope);
          results.catchers = obs;
        }

        setData(results);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [type, gameScope, teamFilter]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  const scopeLabel = gameScope === "season" ? "Full Season" : "Game: " + gameScope;
  const teamLabel = teamFilter && teamFilter !== "all" ? getTeamName(teamFilter) : "All Teams";

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      {/* Header bar */}
      <div className="no-print sticky top-0 bg-gray-900 text-white px-6 py-3 flex items-center justify-between z-50">
        <span className="font-bold text-sm tracking-wide">SAINTS DATA MATRIX — REPORT</span>
        <Button onClick={handlePrint} variant="secondary" size="sm" className="gap-2">
          <Printer className="w-3 h-3" /> Save as PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-4">
        {/* Report header */}
        <div className="border-b-2 border-gray-900 pb-4 mb-6">
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Archivo, sans-serif" }}>
            {type === "staff" && "Pitcher Staff Overview"}
            {type === "pitcher" && "Pitcher Deep Dive"}
            {type === "hitter" && "Hitter Contact Quality"}
            {type === "baserunning" && "Baserunning Report"}
            {type === "catcher" && "Catcher Report"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{teamLabel} · {scopeLabel}</p>
        </div>

        {/* Staff report */}
        {type === "staff" && data?.arsenals && <StaffReport arsenals={data.arsenals} />}
        {type === "pitcher" && data?.arsenals && <PitcherDeepReport arsenals={data.arsenals} />}
        {type === "hitter" && data?.pitches && <HitterReport pitches={data.pitches} />}
        {type === "baserunning" && data?.baserunners && <BaserunningReport obs={data.baserunners} />}
        {type === "catcher" && data?.catchers && <CatcherReport obs={data.catchers} />}
      </div>
    </div>
  );
}

function StaffReport({ arsenals }) {
  const byPitcher = {};
  arsenals.forEach(a => {
    const key = `${a.pitcher_name}__${a.pitcher_team}`;
    if (!byPitcher[key]) byPitcher[key] = { name: a.pitcher_name, team: a.pitcher_team, hand: a.pitcher_hand, pitches: [] };
    byPitcher[key].pitches.push(a);
  });

  const pitchers = Object.values(byPitcher).sort((a, b) => a.name.localeCompare(b.name));

  if (pitchers.length === 0) return <p className="text-gray-500">No pitcher data available.</p>;

  return (
    <div className="space-y-6">
      {pitchers.map((pitcher, idx) => (
        <div key={idx} className="break-inside-avoid">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-base">{pitcher.name}</h3>
            <span className="text-xs text-gray-500">{pitcher.hand === "Right" ? "RHP" : "LHP"} · {getTeamName(pitcher.team)}</span>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                {["Pitch", "N", "Usage", "Velo", "Spin", "HB", "IVB", "Whiff%"].map(h => (
                  <th key={h} className="text-left py-1 px-2 font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitcher.pitches.sort((a, b) => (b.count || 0) - (a.count || 0)).map((a, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 px-2 font-medium">{a.pitch_type}</td>
                  <td className="py-1 px-2">{a.count}</td>
                  <td className="py-1 px-2">{formatPct(a.usage_pct)}</td>
                  <td className="py-1 px-2">{formatNum(a.velo_mean)}±{formatNum(a.velo_std)}</td>
                  <td className="py-1 px-2">{formatNum(a.spin_mean, 0)}</td>
                  <td className="py-1 px-2">{formatNum(a.horz_break_mean)}"</td>
                  <td className="py-1 px-2">{formatNum(a.vert_break_mean)}"</td>
                  <td className="py-1 px-2">{formatPct(a.whiff_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function PitcherDeepReport({ arsenals }) {
  // Same structure as staff but with more detail per pitcher
  return <StaffReport arsenals={arsenals} />;
}

function HitterReport({ pitches }) {
  const byBatter = {};
  pitches.forEach(p => {
    if (!p.batter_name) return;
    const key = `${p.batter_name}__${p.batter_team}`;
    if (!byBatter[key]) byBatter[key] = { name: p.batter_name, team: p.batter_team, hand: p.batter_hand, rows: [] };
    byBatter[key].rows.push(p);
  });

  const batters = Object.values(byBatter).sort((a, b) => a.name.localeCompare(b.name));

  if (batters.length === 0) return <p className="text-gray-500">No hitter data available.</p>;

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-gray-300">
          {["Hitter", "Team", "PA", "Avg EV", "Max EV", "Hard%", "Avg LA", "GB%", "LD%", "FB%", "Whiff%", "Chase%"].map(h => (
            <th key={h} className="text-left py-1 px-1.5 font-semibold text-gray-600">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {batters.map((b, idx) => {
          const bip = b.rows.filter(p => p.exit_speed > 0);
          const evs = bip.map(p => p.exit_speed);
          const avgEV = mean(evs);
          const maxEV = evs.length > 0 ? Math.max(...evs) : 0;
          const hardHit = bip.filter(p => p.exit_speed >= 95).length;
          const las = bip.filter(p => p.launch_angle != null).map(p => p.launch_angle);
          const gb = las.filter(v => v < 10).length;
          const ld = las.filter(v => v >= 10 && v <= 25).length;
          const fb = las.filter(v => v > 25).length;
          const total = gb + ld + fb || 1;
          const swings = b.rows.filter(p => ["StrikeSwinging", "FoulBall", "FoulBallNotFieldable", "FoulBallFieldable", "InPlay"].includes(p.pitch_call));
          const whiffs = b.rows.filter(p => p.pitch_call === "StrikeSwinging");

          return (
            <tr key={idx} className="border-b border-gray-100">
              <td className="py-1 px-1.5 font-medium">{b.name}</td>
              <td className="py-1 px-1.5 text-gray-500">{b.team}</td>
              <td className="py-1 px-1.5">{b.rows.length}</td>
              <td className="py-1 px-1.5">{formatNum(avgEV)}</td>
              <td className="py-1 px-1.5 font-semibold">{formatNum(maxEV)}</td>
              <td className="py-1 px-1.5">{bip.length > 0 ? formatPct((hardHit / bip.length) * 100) : "—"}</td>
              <td className="py-1 px-1.5">{formatNum(mean(las))}°</td>
              <td className="py-1 px-1.5">{formatPct((gb / total) * 100)}</td>
              <td className="py-1 px-1.5">{formatPct((ld / total) * 100)}</td>
              <td className="py-1 px-1.5">{formatPct((fb / total) * 100)}</td>
              <td className="py-1 px-1.5">{swings.length > 0 ? formatPct((whiffs.length / swings.length) * 100) : "—"}</td>
              <td className="py-1 px-1.5">—</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BaserunningReport({ obs }) {
  if (obs.length === 0) return <p className="text-gray-500">No baserunner observations.</p>;

  // Aggregate by runner
  const byRunner = {};
  obs.forEach(o => {
    const key = `${o.runner_name}__${o.runner_team}`;
    if (!byRunner[key]) byRunner[key] = { name: o.runner_name, team: o.runner_team, entries: [] };
    byRunner[key].entries.push(o);
  });

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-gray-300">
          {["Runner", "Team", "Speed", "Aggression", "Pickoffs", "Dirt Advances", "Notes"].map(h => (
            <th key={h} className="text-left py-1 px-2 font-semibold text-gray-600">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Object.values(byRunner).map((r, idx) => {
          const totalPickoffs = r.entries.reduce((s, e) => s + (e.pickoff_attempts || 0), 0);
          const totalDirt = r.entries.reduce((s, e) => s + (e.dirt_ball_advances || 0), 0);
          const lastSpeed = r.entries[r.entries.length - 1]?.speed_rating;
          const lastAggression = r.entries[r.entries.length - 1]?.aggression_rating;
          return (
            <tr key={idx} className="border-b border-gray-100">
              <td className="py-1 px-2 font-medium">{r.name}</td>
              <td className="py-1 px-2 text-gray-500">{r.team}</td>
              <td className="py-1 px-2">
                {lastSpeed && (
                  <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: getSpeedColor(lastSpeed) }}>
                    {lastSpeed}
                  </span>
                )}
              </td>
              <td className="py-1 px-2">
                {lastAggression && (
                  <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: getAggressionColor(lastAggression) }}>
                    {lastAggression}
                  </span>
                )}
              </td>
              <td className="py-1 px-2">{totalPickoffs}</td>
              <td className="py-1 px-2">{totalDirt}</td>
              <td className="py-1 px-2 text-gray-500 max-w-[200px] truncate">
                {r.entries.map(e => e.notes).filter(Boolean).join("; ")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CatcherReport({ obs }) {
  if (obs.length === 0) return <p className="text-gray-500">No catcher observations.</p>;

  const byCatcher = {};
  obs.forEach(o => {
    const key = `${o.catcher_name}__${o.catcher_team}`;
    if (!byCatcher[key]) byCatcher[key] = { name: o.catcher_name, team: o.catcher_team, entries: [] };
    byCatcher[key].entries.push(o);
  });

  return (
    <div className="space-y-4">
      {Object.values(byCatcher).map((c, idx) => {
        const warmups = c.entries.map(e => e.warmup_pop_time).filter(Boolean);
        const allSteals = c.entries.flatMap(e => e.steal_attempts || []);
        return (
          <div key={idx} className="break-inside-avoid">
            <h3 className="font-bold text-sm mb-1">{c.name} — {getTeamName(c.team)}</h3>
            <div className="grid grid-cols-3 gap-4 text-xs mb-2">
              <div>
                <span className="text-gray-500">Warmup Pop:</span>{" "}
                <span className="font-mono font-semibold">{warmups.length > 0 ? formatNum(mean(warmups)) + "s" : "—"}</span>
              </div>
              <div>
                <span className="text-gray-500">Steal Attempts:</span>{" "}
                <span className="font-mono font-semibold">{allSteals.length}</span>
              </div>
              <div>
                <span className="text-gray-500">CS Rate:</span>{" "}
                <span className="font-mono font-semibold">
                  {allSteals.length > 0 ? formatPct((allSteals.filter(s => s.result === "out").length / allSteals.length) * 100) : "—"}
                </span>
              </div>
            </div>
            {allSteals.length > 0 && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-1 px-2 text-gray-500">Pop Time</th>
                    <th className="text-left py-1 px-2 text-gray-500">Base</th>
                    <th className="text-left py-1 px-2 text-gray-500">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {allSteals.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1 px-2 font-mono">{s.pop_time ? formatNum(s.pop_time) + "s" : "—"}</td>
                      <td className="py-1 px-2">{s.base}</td>
                      <td className="py-1 px-2">
                        <span className={`font-semibold ${s.result === "out" ? "text-green-600" : s.result === "safe" ? "text-red-600" : "text-gray-400"}`}>
                          {s.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}