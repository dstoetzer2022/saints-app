import React, { useState } from 'react';
import GlobalHeader from '@/components/shared/GlobalHeader';
import HomeScreen from '@/pages/screens/HomeScreen';
import AddDataScreen from '@/pages/screens/AddDataScreen';
import DataRepository from '@/pages/screens/DataRepository';
import DugoutView from '@/pages/screens/DugoutView';
import { PAPER } from '@/lib/ds';

const FULL_SCREEN = new Set(['HOME', 'ADD_DATA', 'IMPORT_CSV', 'VIEW_EXPORT', 'DUGOUT']);

export default function MainApp() {
  const [screen, setScreen] = useState('HOME');

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
      {!FULL_SCREEN.has(screen) && <GlobalHeader onHome={() => setScreen('HOME')} />}
      {screen === 'HOME' && <HomeScreen setScreen={setScreen} />}
      {screen === 'ADD_DATA' && <AddDataScreen setScreen={setScreen} initialMode="LIVE_SCOUT" />}
      {screen === 'IMPORT_CSV' && <AddDataScreen setScreen={setScreen} initialMode="CSV" />}
      {screen === 'VIEW_EXPORT' && <DataRepository setScreen={setScreen} />}
      {screen === 'DUGOUT' && <DugoutView setScreen={setScreen} />}
    </div>
  );
}