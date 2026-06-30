import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Module-level cache shared across all hook instances
const teamCache = { data: null, loading: false, promise: null };

async function fetchTeams() {
  if (teamCache.data) return teamCache.data;
  if (teamCache.promise) return teamCache.promise;
  teamCache.promise = base44.entities.Team.list("-name", 100).then(teams => {
    teamCache.data = teams;
    return teams;
  });
  return teamCache.promise;
}

export function useTeams() {
  const [teams, setTeams] = useState(teamCache.data || []);
  const [loading, setLoading] = useState(!teamCache.data);

  useEffect(() => {
    if (teamCache.data) { setTeams(teamCache.data); setLoading(false); return; }
    fetchTeams().then(t => { setTeams(t); setLoading(false); });
  }, []);

  return { teams, loading };
}

export function useTeam(code) {
  const { teams, loading } = useTeams();
  const team = teams.find(t => t.code === code) || null;
  return { team, loading };
}

export function useTeamColor(code) {
  const { team } = useTeam(code);
  return team?.primary_color || "#666666";
}