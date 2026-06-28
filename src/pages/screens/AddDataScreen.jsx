import React from 'react';
import LiveScout from '@/pages/screens/LiveScout';
import CSVImport from '@/pages/screens/CSVImport';

export default function AddDataScreen({ setScreen, initialMode }) {
  if (initialMode === 'LIVE_SCOUT') {
    return <LiveScout onBack={() => setScreen('HOME')} />;
  }
  if (initialMode === 'CSV') {
    return (
      <CSVImport
        onBack={() => setScreen('HOME')}
        onViewRepo={() => setScreen('VIEW_EXPORT')}
      />
    );
  }
  return null;
}