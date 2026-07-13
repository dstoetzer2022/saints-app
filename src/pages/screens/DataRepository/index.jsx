import React, { useState } from 'react';
import TeamGrid from './TeamGrid';
import TeamHub from './TeamHub';
import RosterView from './RosterView';
import PitcherRestTracker from './PitcherRestTracker';
import Leaderboard from './Leaderboard';

export default function DataRepository({ setScreen }) {
  const [team, setTeam] = useState(null);
  const [tab, setTab] = useState(null); // 'pitchers' | 'hitters' | 'rest'
  const [view, setView] = useState(null); // 'leaderboard' | null

  if (view === 'leaderboard') {
    return <Leaderboard onBack={() => setView(null)} />;
  }

  if (team && tab === 'rest') {
    return <PitcherRestTracker team={team} onBack={() => setTab(null)} />;
  }

  if (team && (tab === 'pitchers' || tab === 'hitters')) {
    return (
      <RosterView
        team={team}
        initialTab={tab}
        onBack={() => setTab(null)}
      />
    );
  }

  if (team) {
    return (
      <TeamHub
        team={team}
        onSelectTab={setTab}
        onBack={() => setTeam(null)}
      />
    );
  }

  return (
    <TeamGrid
      onSelectTeam={setTeam}
      onHome={() => setScreen('HOME')}
      onLeaderboard={() => setView('leaderboard')}
    />
  );
}
