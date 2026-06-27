import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { TEAMS } from "@/lib/teams";
import GlassCard from "@/components/shared/GlassCard";
import { ArrowRight } from "lucide-react";

export default function Teams() {
  const [arsenals, setArsenals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await base44.entities.PitcherArsenal.list("-created_date", 500);
        setArsenals(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  // Count unique pitchers per team
  const teamStats = {};
  TEAMS.forEach(t => { teamStats[t.code] = { pitchers: new Set(), totalPitches: 0 }; });
  arsenals.forEach(a => {
    if (teamStats[a.pitcher_team]) {
      teamStats[a.pitcher_team].pitchers.add(a.pitcher_name);
      teamStats[a.pitcher_team].totalPitches += (a.count || 0);
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Teams</h1>
        <p className="text-muted-foreground mt-1">California Collegiate League — 12 Teams</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEAMS.map(team => {
          const stats = teamStats[team.code];
          const pitcherCount = stats?.pitchers.size || 0;
          const pitchTotal = stats?.totalPitches || 0;

          return (
            <Link key={team.code} to={`/teams/${team.code}`}>
              <GlassCard className="hover:border-accent/50 transition-all group cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.short.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-heading font-bold text-base group-hover:text-accent transition-colors">
                        {team.name}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground">{team.code}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors mt-1" />
                </div>
                <div className="mt-4 flex gap-6">
                  <div>
                    <p className="text-xl font-display font-bold">{pitcherCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pitchers</p>
                  </div>
                  <div>
                    <p className="text-xl font-display font-bold">{pitchTotal.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pitches</p>
                  </div>
                </div>
              </GlassCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}