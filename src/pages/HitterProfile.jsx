import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { formatNum, formatPct, mean, percentile } from "@/lib/statsUtils";
import GlassCard from "@/components/shared/GlassCard";
import PercentileBar from "@/components/shared/PercentileBar";
import StatBox from "@/components/shared/StatBox";
import TeamBadge from "@/components/shared/TeamBadge";
import GameScopeSelector from "@/components/shared/GameScopeSelector";
import SprayChart from "@/components/charts/SprayChart";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HitterProfile() {
  const { name, teamCode } = useParams();
  const decodedName = decodeURIComponent(name);
  const [pitches, setPitches] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState("season");
  const [leaguePitches, setLeaguePitches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pitchData, gameData, allBatterPitches] = await Promise.all([
          base44.entities.TrackmanPitch.filter({ batter_name: decodedName, batter_team: teamCode }, "-created_date", 2000),
          base44.entities.Game.list("-date", 100),
          base44.entities.TrackmanPitch.list("-created_date", 2000)
        ]);
        setPitches(pitchData);
        setLeaguePitches(allBatterPitches);
        const playerGameIds = new Set(pitchData.map(p => p.game_id));
        setGames(gameData.filter(g => playerGameIds.has(g.id)));
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [decodedName, teamCode]);

  const filtered = useMemo(() => {
    return selectedGame === "season" ? pitches : pitches.filter(p => p.game_id === selectedGame);
  }, [pitches, selectedGame]);

  const stats = useMemo(() => {
    const bip = filtered.filter(p => p.exit_speed != null && p.exit_speed > 0);
    const exitVelos = bip.map(p => p.exit_speed);
    const avgEV = mean(exitVelos);
    const maxEV = exitVelos.length > 0 ? Math.max(...exitVelos) : 0;
    const hardHit = bip.filter(p => p.exit_speed >= 95).length;
    const hardHitPct = bip.length > 0 ? (hardHit / bip.length) * 100 : 0;
    
    const launchAngles = bip.filter(p => p.launch_angle != null).map(p => p.launch_angle);
    const avgLA = mean(launchAngles);
    
    const gb = bip.filter(p => p.launch_angle != null && p.launch_angle < 10).length;
    const ld = bip.filter(p => p.launch_angle != null && p.launch_angle >= 10 && p.launch_angle <= 25).length;
    const fb = bip.filter(p => p.launch_angle != null && p.launch_angle > 25).length;
    const bipCount = gb + ld + fb || 1;

    const swings = filtered.filter(p => ["StrikeSwinging", "FoulBall", "InPlay", "FoulBallNotFieldable", "FoulBallFieldable"].includes(p.pitch_call));
    const whiffs = filtered.filter(p => p.pitch_call === "StrikeSwinging");
    const whiffPct = swings.length > 0 ? (whiffs.length / swings.length) * 100 : 0;

    const outOfZone = filtered.filter(p => {
      const h = Math.abs(p.plate_loc_side);
      const v = p.plate_loc_height;
      return h != null && v != null && (h > 0.83 || v < 1.5 || v > 3.5);
    });
    const chasePitches = outOfZone.filter(p => ["StrikeSwinging", "FoulBall", "InPlay", "FoulBallNotFieldable", "FoulBallFieldable"].includes(p.pitch_call));
    const chasePct = outOfZone.length > 0 ? (chasePitches.length / outOfZone.length) * 100 : 0;

    return { avgEV, maxEV, hardHitPct, avgLA, gb, ld, fb, bipCount, whiffPct, chasePct, bipTotal: bip.length, totalPitches: filtered.length };
  }, [filtered]);

  // League pools for hitter percentiles
  const leaguePools = useMemo(() => {
    const bip = leaguePitches.filter(p => p.exit_speed != null && p.exit_speed > 0);
    // Group by batter to get per-batter averages
    const byBatter = {};
    bip.forEach(p => {
      const key = `${p.batter_name}__${p.batter_team}`;
      if (!byBatter[key]) byBatter[key] = [];
      byBatter[key].push(p.exit_speed);
    });
    const avgEVs = Object.values(byBatter).filter(arr => arr.length >= 5).map(arr => mean(arr));
    const maxEVs = Object.values(byBatter).filter(arr => arr.length >= 5).map(arr => Math.max(...arr));
    const hardHitPcts = Object.values(byBatter).filter(arr => arr.length >= 5).map(arr => {
      const hard = arr.filter(v => v >= 95).length;
      return (hard / arr.length) * 100;
    });
    return { avgEVs, maxEVs, hardHitPcts };
  }, [leaguePitches]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const hand = pitches[0]?.batter_hand;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link to={`/teams/${teamCode}`}>
          <Button variant="ghost" size="icon" className="mt-1"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-2xl font-bold">{decodedName}</h1>
            <TeamBadge teamCode={teamCode} />
            {hand && <span className="text-sm font-mono text-muted-foreground">{hand === "Right" ? "RHH" : "LHH"}</span>}
          </div>
        </div>
      </div>

      <GameScopeSelector games={games} selectedGameId={selectedGame} onSelect={setSelectedGame} />

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <GlassCard><StatBox label="Pitches Seen" value={stats.totalPitches} /></GlassCard>
        <GlassCard><StatBox label="Avg EV" value={formatNum(stats.avgEV)} accent /></GlassCard>
        <GlassCard><StatBox label="Max EV" value={formatNum(stats.maxEV)} destructive /></GlassCard>
        <GlassCard><StatBox label="Hard Hit%" value={formatPct(stats.hardHitPct)} /></GlassCard>
        <GlassCard><StatBox label="Avg LA" value={formatNum(stats.avgLA) + "°"} /></GlassCard>
      </div>

      {/* Percentiles */}
      <GlassCard>
        <h3 className="font-heading font-bold mb-4">Percentile Rankings (League-Wide)</h3>
        <div className="space-y-3">
          <PercentileBar label="Avg Exit Velocity" value={formatNum(stats.avgEV)} percentile={percentile(stats.avgEV, leaguePools.avgEVs)} unit=" mph" />
          <PercentileBar label="Max Exit Velocity" value={formatNum(stats.maxEV)} percentile={percentile(stats.maxEV, leaguePools.maxEVs)} unit=" mph" />
          <PercentileBar label="Hard Hit %" value={formatPct(stats.hardHitPct)} percentile={percentile(stats.hardHitPct, leaguePools.hardHitPcts)} />
        </div>
      </GlassCard>

      {/* Batted ball + discipline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-heading font-bold mb-4">Batted Ball Profile</h3>
          <div className="space-y-3">
            {[
              { label: "Ground Ball", value: stats.gb, pct: (stats.gb / stats.bipCount) * 100, color: "#f97316" },
              { label: "Line Drive", value: stats.ld, pct: (stats.ld / stats.bipCount) * 100, color: "#22c55e" },
              { label: "Fly Ball", value: stats.fb, pct: (stats.fb / stats.bipCount) * 100, color: "#3b82f6" }
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="font-mono">{formatPct(item.pct)} ({item.value})</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-heading font-bold mb-4">Plate Discipline</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <p className="text-3xl font-display font-bold">{formatPct(stats.whiffPct)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Whiff Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-display font-bold">{formatPct(stats.chasePct)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Chase Rate</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Spray chart */}
      <GlassCard>
        <h3 className="font-heading font-bold mb-3">Spray Chart</h3>
        <SprayChart pitches={filtered} />
      </GlassCard>
    </div>
  );
}