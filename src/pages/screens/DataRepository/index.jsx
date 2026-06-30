import React, { useState } from 'react';
import TeamGrid from './TeamGrid';
import RosterView from './RosterView';

export default function DataRepository({ setScreen }) {
  const [team, setTeam] = useState(null);

  if (team) {
    return (
      <RosterView
        team={team}
        onBack={() => setTeam(null)}
      />
    );
  }

  return (
    <TeamGrid
      onSelectTeam={setTeam}
      onHome={() => setScreen('HOME')}
    />
  );
}