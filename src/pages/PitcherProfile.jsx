import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { formatNum, percentile, mean } from "@/lib/statsUtils";
import GlassCard from "@/components/shared/GlassCard";
import PercentileBar from "@/components/shared/PercentileBar";
import StatBox from "@/components/shared/StatBox";
import TeamBadge from "@/components/shared/TeamBadge";
import GameScopeSelector from "@/components/shared/GameScopeSelector";
import MovementChart from "@/components/charts/MovementChart";
import ReleasePointChart from "@/components/charts/ReleasePointChart";
import MetricCell from "@/components/shared/MetricCell";
import PitchVideoCell from "@/components/shared/PitchVideoCell";
import { useTeam } from "@/hooks/useTeam";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PITCH_COLORS = {
  "Fastball": "#ef4444", "Four-Seam": "#ef4444", "FourSeamFastBall": "#ef4444",
  "Sinker": "#f97316", "TwoSeamFastBall": "#f97316",
  "Cutter": "#eab308", "Slider": "#22c55e", 
  "Curveball": "#3b82f6", "Changeup": "#8b5cf6",
  "Splitter": "#ec4899", "Knuckle Curve": "#06b6d4",
  "Sweeper": "#14b8a6", "Slurve": "#10b981",
  "Unknown": "#6b7280"
};

function getPitchColor(type) {
  for (const [key, color] of Object.entries(PITCH_COLORS)) {
    if (type?.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#6b7280";
}

function ArsenalRow({ a, getPitchColor, videoInfo, onVideoUploaded }) {
  const { team } = useTeam(a.pitcher_team);
  const borderColor = team?.primary_color || "transparent";
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <td className="p-3 pl-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getPitchColor(a.pitch_type) }} />
          <span className="font-semibold">{a.pitch_type}</span>
        </div>
      </td>
      <td className="text-center p-3 font-mono">{a.count}</td>
      <td className="text-center p-3 font-mono">{a.usage_pct?.toFixed(1)}%</td>
      <td className="text-center p-3 font-mono">
        {a.velo_mean?.toFixed(1)} <span className="text-muted-foreground text-xs">±{a.velo_std?.toFixed(1)}</span>
      </td>
      <td className="text-center p-3 font-mono">
        {a.spin_mean?.toFixed(0)} <span className="text-muted-foreground text-xs">±{a.spin_std?.toFixed(0)}</span>
      </td>
      <td className="text-center p-3 font-mono">{a.horz_break_mean?.toFixed(1)}"</td>
      <td className="text-center p-3 font-mono">{a.vert_break_mean?.toFixed(1)}"</td>
      <MetricCell value={a.whiff_pct} metric="whiff_pct" />
      <MetricCell value={a.zone_pct} metric="zone_pct" />
      <td className="text-center p-3 pr-5">
        <PitchVideoCell
          pitchType={a.pitch_type}
          videoUrl={videoInfo?.video_url}
          thumbnailUrl={videoInfo?.video_thumbnail_url}
          arsenalId={videoInfo?.id}
          onUploaded={(fields) => onVideoUploaded(a.pitch_type, fields)}
        />
      </td>
    </tr>
  );
}

export default function PitcherProfile() {
  const { name, teamCode } = useParams();
  const decodedName = decodeURIComponent(name);
  const [pitches, setPitches] = useState([]);
  const [allArsenals, setAllArsenals] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState("season");
  const [leaguePool, setLeaguePool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videoOverrides, setVideoOverrides] = useState({}); // pitch_type -> {video_url, video_thumbnail_url}

  useEffect(() => {
    async function load() {
      try {
        const [pitchData, arsenalData, gameData, leagueArsenals] = await Promise.all([
          base44.entities.TrackmanPitch.filter({ pitcher_name: decodedName, pitcher_team: teamCode }, "-created_date", 2000),
          base44.entities.PitcherArsenal.filter({ pitcher_name: decodedName, pitcher_team: teamCode }, "-created_date", 500),
          base44.entities.Game.list("-date", 100),
          base44.entities.PitcherArsenal.list("-created_date", 2000)
        ]);
        setPitches(pitchData);
        setAllArsenals(arsenalData);
        setLeaguePool(leagueArsenals);
        const playerGameIds = new Set(pitchData.map(p => p.game_id));
        setGames(gameData.filter(g => playerGameIds.has(g.id)));
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [decodedName, teamCode]);

  const filteredPitches = useMemo(() => {
    return selectedGame === "season" ? pitches : pitches.filter(p => p.game_id === selectedGame);
  }, [pitches, selectedGame]);

  const filteredArsenals = useMemo(() => {
    if (selectedGame === "season") {
      // Aggregate across all games
      const byType = {};
      allArsenals.forEach(a => {
        if (!byType[a.pitch_type]) byType[a.pitch_type] = [];
        byType[a.pitch_type].push(a);
      });
      return Object.entries(byType).map(([type, records]) => {
        const totalCount = records.reduce((s, r) => s + (r.count || 0), 0);
        const totalPitches = records.reduce((s, r) => s + (r.total_pitches || 0), 0);
        return {
          pitch_type: type,
          count: totalCount,
          usage_pct: totalPitches > 0 ? (totalCount / totalPitches) * 100 : 0,
          velo_mean: mean(records.map(r => r.velo_mean).filter(Boolean)),
          velo_std: mean(records.map(r => r.velo_std).filter(Boolean)),
          velo_max: Math.max(...records.map(r => r.velo_max || 0)),
          spin_mean: mean(records.map(r => r.spin_mean).filter(Boolean)),
          spin_std: mean(records.map(r => r.spin_std).filter(Boolean)),
          horz_break_mean: mean(records.map(r => r.horz_break_mean).filter(v => v != null)),
          vert_break_mean: mean(records.map(r => r.vert_break_mean).filter(v => v != null)),
          whiff_pct: mean(records.map(r => r.whiff_pct).filter(Boolean)),
          zone_pct: mean(records.map(r => r.zone_pct).filter(Boolean)),
          ahead_count: records.reduce((s, r) => s + (r.ahead_count || 0), 0),
          even_count: records.reduce((s, r) => s + (r.even_count || 0), 0),
          behind_count: records.reduce((s, r) => s + (r.behind_count || 0), 0),
        };
      });
    }
    return allArsenals.filter(a => a.game_id === selectedGame);
  }, [allArsenals, selectedGame]);

  // Video lives on the season-scope PitcherArsenal row per pitch type,
  // regardless of which game scope is currently selected in the table.
  const videoByPitchType = useMemo(() => {
    const map = {};
    allArsenals.filter(a => a.game_id === "season").forEach(a => {
      map[a.pitch_type] = { id: a.id, video_url: a.video_url, video_thumbnail_url: a.video_thumbnail_url };
    });
    Object.entries(videoOverrides).forEach(([type, fields]) => {
      map[type] = { ...(map[type] || {}), ...fields };
    });
    return map;
  }, [allArsenals, videoOverrides]);

  function handleVideoUploaded(pitchType, fields) {
    setVideoOverrides(prev => ({ ...prev, [pitchType]: fields }));
  }

  // League percentile pools
  const leaguePools = useMemo(() => {
    const fbVelos = leaguePool.filter(a => a.pitch_type?.match(/fast|sinker|four/i) && a.count >= 10).map(a => a.velo_mean);
    const allSpins = leaguePool.filter(a => a.count >= 10).map(a => a.spin_mean);
    const allWhiff = leaguePool.filter(a => a.count >= 20).map(a => a.whiff_pct);
    const allExt = pitches.map(p => p.extension).filter(v => v != null);
    return { fbVelos, allSpins, allWhiff, allExt };
  }, [leaguePool, pitches]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const hand = pitches[0]?.pitcher_hand;
  const totalPitches = filteredPitches.length;
  const avgVelo = mean(filteredPitches.map(p => p.rel_speed).filter(Boolean));
  const maxVelo = Math.max(0, ...filteredPitches.map(p => p.rel_speed).filter(Boolean));
  const avgSpin = mean(filteredPitches.map(p => p.spin_rate).filter(Boolean));
  const avgExt = mean(filteredPitches.map(p => p.extension).filter(Boolean));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={`/teams/${teamCode}`}>
          <Button variant="ghost" size="icon" className="mt-1"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-2xl font-bold">{decodedName}</h1>
            <TeamBadge teamCode={teamCode} />
            {hand && <span className="text-sm font-mono text-muted-foreground">{hand === "Right" ? "RHP" : "LHP"}</span>}
          </div>
        </div>
      </div>

      <GameScopeSelector games={games} selectedGameId={selectedGame} onSelect={setSelectedGame} />

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <GlassCard><StatBox label="Pitches" value={totalPitches} /></GlassCard>
        <GlassCard><StatBox label="Avg Velo" value={formatNum(avgVelo)} accent /></GlassCard>
        <GlassCard><StatBox label="Max Velo" value={formatNum(maxVelo)} destructive /></GlassCard>
        <GlassCard><StatBox label="Avg Spin" value={formatNum(avgSpin, 0)} /></GlassCard>
        <GlassCard><StatBox label="Extension" value={formatNum(avgExt)} sub="ft" /></GlassCard>
      </div>

      {/* Percentile rankings */}
      <GlassCard>
        <h3 className="font-heading font-bold mb-4">Percentile Rankings (League-Wide)</h3>
        <div className="space-y-3">
          <PercentileBar label="Fastball Velocity" value={formatNum(avgVelo)} percentile={percentile(avgVelo, leaguePools.fbVelos)} unit=" mph" />
          <PercentileBar label="Spin Rate" value={formatNum(avgSpin, 0)} percentile={percentile(avgSpin, leaguePools.allSpins)} unit=" rpm" />
          <PercentileBar label="Extension" value={formatNum(avgExt)} percentile={percentile(avgExt, leaguePools.allExt)} unit=" ft" />
        </div>
      </GlassCard>

      {/* Arsenal table */}
      <GlassCard noPadding>
        <div className="p-5 pb-0">
          <h3 className="font-heading font-bold">Arsenal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 pl-5 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Pitch</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Count</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Usage</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Velo</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Spin</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">H Break</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">V Break</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Whiff%</th>
                <th className="text-center p-3 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Zone%</th>
                <th className="text-center p-3 pr-5 font-heading font-semibold text-xs uppercase tracking-wider text-muted-foreground">Video</th>
              </tr>
            </thead>
            <tbody>
              {filteredArsenals.sort((a, b) => (b.count || 0) - (a.count || 0)).map((a, i) => (
                <ArsenalRow
                  key={i}
                  a={a}
                  getPitchColor={getPitchColor}
                  videoInfo={videoByPitchType[a.pitch_type]}
                  onVideoUploaded={handleVideoUploaded}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Count splits */}
        {filteredArsenals.length > 0 && (
          <div className="p-5 pt-2 border-t border-border/50">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Count Splits</p>
            <div className="flex gap-6 text-sm">
              {filteredArsenals.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getPitchColor(a.pitch_type) }} />
                  <span className="font-mono text-xs">
                    A:{a.ahead_count || 0} E:{a.even_count || 0} B:{a.behind_count || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-heading font-bold mb-3">Pitch Movement</h3>
          <MovementChart pitches={filteredPitches} getPitchColor={getPitchColor} />
        </GlassCard>
        <GlassCard>
          <h3 className="font-heading font-bold mb-3">Release Point</h3>
          <ReleasePointChart pitches={filteredPitches} getPitchColor={getPitchColor} />
        </GlassCard>
      </div>
    </div>
  );
}