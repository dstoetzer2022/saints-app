import React, { useState } from 'react';
import GameSelectScreen from './GameSelectScreen';
import NewGameSetup from './NewGameSetup';
import LineupEntry from './LineupEntry';
import LiveScoutingHub from './LiveScoutingHub';

const CCL_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';

// step: 'SELECT' | 'NEW_GAME' | 'LINEUP' | 'HUB'
export default function LiveScout({ onBack }) {
  const [step, setStep] = useState('SELECT');
  const [gameSetup, setGameSetup] = useState(null);   // { date, opponent }
  const [hubData, setHubData] = useState(null);        // { game, opponent, lineup }

  function handleResume(game, opponentTeam) {
    const oppName = game.home_team_code === 'ARR' ? game.away_team : game.home_team;
    const opponent = opponentTeam || { name: oppName, logo_url: CCL_LOGO };
    setHubData({ game, opponent, lineup: game.lineup_data || [] });
    setStep('HUB');
  }

  function handleLineupSubmit({ game, lineup, _pitcher, _catcher, _runners }) {
    setHubData({ game, opponent: gameSetup.opponent, lineup });
    setStep('HUB');
  }

  if (step === 'SELECT') {
    return <GameSelectScreen onResume={handleResume} onNewGame={() => setStep('NEW_GAME')} onBack={onBack} />;
  }

  if (step === 'NEW_GAME') {
    return <NewGameSetup onNext={setup => { setGameSetup(setup); setStep('LINEUP'); }} onBack={() => setStep('SELECT')} />;
  }

  if (step === 'LINEUP') {
    return <LineupEntry gameSetup={gameSetup} onSubmit={handleLineupSubmit} onBack={() => setStep('NEW_GAME')} />;
  }

  if (step === 'HUB' && hubData) {
    return (
      <LiveScoutingHub
        game={hubData.game}
        opponent={hubData.opponent}
        initialLineup={hubData.lineup}
        onBack={() => setStep('SELECT')}
        onHome={onBack}
      />
    );
  }

  return null;
}
