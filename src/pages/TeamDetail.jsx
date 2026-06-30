import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { getTeamByCode, getTeamColor } from "@/lib/teams";
import GlassCard from "@/components/shared/GlassCard";
import GameScopeSelector from "@/components/shared/GameScopeSelector";
import { ArrowLeft, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function TeamDetail() {
  const { teamCode } = useParams();
  const team = getTeamByCode(teamCode);
  const [pitches, setPitches] = useState([]);
  const [_arsenals, setArsenals] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState("season");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pitchData, arsenalData, gameData] = await Promise.all([
          base44.entities.TrackmanPitch.filter({ pitcher_team: teamCode }, "-created_date", 500),
          base44.entities.PitcherArsenal.filter({ pitcher_team: teamCode }, "-created_date", 500),
          base44.entities.Game.list("-date", 100)
        ]);
        setPitches(pitchData);
        setArsenals(arsenalData);
        // Filter games that involve this team
        const teamGames = gameData.filter(g => g.home_team_code === teamCode || g.away_team_code === teamCode);
        setGames(teamGames);
        
        // Also fetch batters from this team
        const batterPitches = await base44.entities.TrackmanPitch.filter({ batter_team: teamCode }, "-created_date", 500);
        setPitches(prev => {
          const ids = new Set(prev.map(p => p.id));
          return [...prev, ...batterPitches.filter(p => !ids.has(p.id))];
        });
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [teamCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // Get unique pitchers and hitters
  const filteredPitches = selectedGame === "season" 
    ? pitches 
    : pitches.filter(p => p.game_id === selectedGame);

  const pitcherMap = {};
  const hitterMap = {};
  
  filteredPitches.forEach(p => {
    if (p.pitcher_team === teamCode && p.pitcher_name) {
      if (!pitcherMap[p.pitcher_name]) pitcherMap[p.pitcher_name] = { count: 0, hand: p.pitcher_hand };
      pitcherMap[p.pitcher_name].count++;
    }
    if (p.batter_team === teamCode && p.batter_name) {
      if (!hitterMap[p.batter_name]) hitterMap[p.batter_name] = { count: 0, hand: p.batter_hand };
      hitterMap[p.batter_name].count++;
    }
  });

  const pitchers = Object.entries(pitcherMap).sort((a, b) => b[1].count - a[1].count);
  const hitters = Object.entries(hitterMap).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/teams">
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: getTeamColor(teamCode) }}
            >
              {team?.short?.slice(0, 2).toUpperCase() || "??"}
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">{team?.name || teamCode}</h1>
              <p className="text-xs font-mono text-muted-foreground">{teamCode}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scope selector */}
      <GameScopeSelector games={games} selectedGameId={selectedGame} onSelect={setSelectedGame} />

      {/* Tabs */}
      <Tabs defaultValue="pitchers">
        <TabsList>
          <TabsTrigger value="pitchers">Pitchers ({pitchers.length})</TabsTrigger>
          <TabsTrigger value="hitters">Hitters ({hitters.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pitchers" className="mt-4">
          {pitchers.length === 0 ? (
            <GlassCard>
              <p className="text-center text-muted-foreground py-8">No pitcher data for this scope</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pitchers.map(([name, data]) => (
                <Link key={name} to={`/player/pitcher/${encodeURIComponent(name)}/${teamCode}`}>
                  <GlassCard className="hover:border-accent/50 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-sm truncate group-hover:text-accent transition-colors">
                          {name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.hand === "Right" ? "RHP" : data.hand === "Left" ? "LHP" : "P"} · {data.count} pitches
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="hitters" className="mt-4">
          {hitters.length === 0 ? (
            <GlassCard>
              <p className="text-center text-muted-foreground py-8">No hitter data for this scope</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {hitters.map(([name, data]) => (
                <Link key={name} to={`/player/hitter/${encodeURIComponent(name)}/${teamCode}`}>
                  <GlassCard className="hover:border-accent/50 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-accent/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-sm truncate group-hover:text-accent transition-colors">
                          {name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.hand === "Right" ? "RHH" : data.hand === "Left" ? "LHH" : "H"} · {data.count} pitches seen
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}