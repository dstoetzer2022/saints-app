import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import reportError from '@/lib/reportError';
import TeamGrid from './TeamGrid';
import TeamHub from './TeamHub';
import RosterView from './RosterView';
import PitcherRestTracker from './PitcherRestTracker';
import Leaderboard from './Leaderboard';

// ── URL-driven repository navigation (Phase 2.1) ───────────────────────
// /repo                     → team grid
// /repo/leaderboard         → league leaderboard
// /repo/:teamCode           → team hub
// /repo/:teamCode/:tab      → roster (pitchers | hitters | rest)
// Team objects are resolved from the Team entity by `code` (falling back to
// an encoded name), so a hard refresh or shared link lands on the right team.
const TABS = new Set(['pitchers', 'hitters', 'rest']);

const teamSlug = t => encodeURIComponent(t.code || t.name);

export default function DataRepository({ setScreen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null); // null = loading

  useEffect(() => {
    let live = true;
    base44.entities.Team.list('name', 100)
      .then(ts => { if (live) setTeams(ts || []); })
      .catch(err => { if (live) { setTeams([]); reportError(err, 'Could not load teams'); } });
    return () => { live = false; };
  }, []);

  const segs = location.pathname.split('/').filter(Boolean); // ['repo', a?, b?]
  const view = segs[1] === 'leaderboard' ? 'leaderboard' : null;
  const teamKey = view ? null : (segs[1] ? decodeURIComponent(segs[1]) : null);
  const tab = TABS.has(segs[2]) ? segs[2] : null;

  const team = useMemo(() => {
    if (!teamKey || !teams) return null;
    return teams.find(t => t.code === teamKey) || teams.find(t => t.name === teamKey) || null;
  }, [teams, teamKey]);

  if (view === 'leaderboard') {
    return <Leaderboard onBack={() => navigate('/repo')} />;
  }

  // Deep link names a team we can't resolve yet (teams still loading) or at
  // all (bad code) — hold a beat while loading, then fall back to the grid.
  if (teamKey && teams === null) {
    return null;
  }
  if (teamKey && !team) {
    return (
      <TeamGrid
        onSelectTeam={t => navigate(`/repo/${teamSlug(t)}`)}
        onHome={() => setScreen('HOME')}
        onLeaderboard={() => navigate('/repo/leaderboard')}
      />
    );
  }

  if (team && tab === 'rest') {
    return <PitcherRestTracker team={team} onBack={() => navigate(`/repo/${teamSlug(team)}`)} />;
  }

  if (team && (tab === 'pitchers' || tab === 'hitters')) {
    return (
      <RosterView
        key={`${teamSlug(team)}-${tab}`}
        team={team}
        initialTab={tab}
        onBack={() => navigate(`/repo/${teamSlug(team)}`)}
      />
    );
  }

  if (team) {
    return (
      <TeamHub
        team={team}
        onSelectTab={t => navigate(`/repo/${teamSlug(team)}/${t}`)}
        onOpenReport={() => navigate(`/repo/${teamSlug(team)}/pitchers?report=1`)}
        onBack={() => navigate('/repo')}
      />
    );
  }

  return (
    <TeamGrid
      onSelectTeam={t => navigate(`/repo/${teamSlug(t)}`)}
      onHome={() => setScreen('HOME')}
      onLeaderboard={() => navigate('/repo/leaderboard')}
    />
  );
}
