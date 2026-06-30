import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamName } from "@/lib/teams";

export default function GameScopeSelector({ games, selectedGameId, onSelect }) {
  return (
    <Select value={selectedGameId || "season"} onValueChange={onSelect}>
      <SelectTrigger className="w-[280px] bg-card border-border">
        <SelectValue placeholder="Select scope" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="season">
          <span className="font-semibold">Full Season (Cumulative)</span>
        </SelectItem>
        {games.map(g => (
          <SelectItem key={g.id} value={g.id}>
            {g.date} — {getTeamName(g.home_team_code)} vs {getTeamName(g.away_team_code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}