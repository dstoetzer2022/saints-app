import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TEAMS } from "@/lib/teams";
import GlassCard from "@/components/shared/GlassCard";
import GameScopeSelector from "@/components/shared/GameScopeSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Printer } from "lucide-react";

const REPORT_TYPES = [
  { id: "staff", label: "Pitcher Staff Overview", desc: "All pitchers on a team with arsenal summaries" },
  { id: "pitcher", label: "Per-Pitcher Deep Dive", desc: "Individual pitcher with full arsenal, movement, and splits" },
  { id: "hitter", label: "Hitter Contact Quality", desc: "Exit velocities, launch angles, and batted ball profiles" },
  { id: "baserunning", label: "Baserunning Report", desc: "Speed, aggression, pickoff attempts, dirt ball advances" },
  { id: "catcher", label: "Catcher Report", desc: "Pop times, steal attempts, and arm grades" }
];

export default function Reports() {
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState("season");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const gameData = await base44.entities.Game.list("-date", 100);
      setGames(gameData);
      setLoading(false);
    }
    load();
  }, []);

  const openReport = (type) => {
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("game", selectedGame);
    if (selectedTeam) params.set("team", selectedTeam);
    window.open(`/report-view?${params.toString()}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">Generate printable scouting reports</p>
      </div>

      {/* Filters */}
      <GlassCard>
        <h3 className="font-heading font-bold mb-3">Report Scope</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Team</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger><SelectValue placeholder="All teams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {TEAMS.map(t => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Game / Season</label>
            <GameScopeSelector games={games} selectedGameId={selectedGame} onSelect={setSelectedGame} />
          </div>
        </div>
      </GlassCard>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_TYPES.map(report => (
          <GlassCard key={report.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-accent" />
                <h3 className="font-heading font-bold text-sm">{report.label}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{report.desc}</p>
            </div>
            <Button 
              onClick={() => openReport(report.id)} 
              variant="outline" 
              className="mt-4 gap-2 w-full"
            >
              <Printer className="w-3 h-3" /> Generate Report
            </Button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}