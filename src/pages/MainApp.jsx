import React, { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GlobalHeader from '@/components/shared/GlobalHeader';
import PasswordGate from '@/components/shared/PasswordGate';
import HomeScreen from '@/pages/screens/HomeScreen';
import { PAPER, NAVY } from '@/lib/ds';

// AUDIT: route-level code splitting — Three.js, recharts, and every heavy
// screen previously loaded before the Home screen painted (stadium Wi-Fi,
// phones). Only HomeScreen is eager now.
const AddDataScreen  = lazy(() => import('@/pages/screens/AddDataScreen'));
const DataRepository = lazy(() => import('@/pages/screens/DataRepository'));
const DugoutView     = lazy(() => import('@/pages/screens/DugoutView'));

const FULL_SCREEN = new Set(['HOME', 'ADD_DATA', 'IMPORT_CSV', 'VIEW_EXPORT', 'DUGOUT']);

// ── URL-synced screens (Phase 2.1) ─────────────────────────────────────
// The screen switch is now driven by the URL instead of local state, so
// every screen is deep-linkable/bookmarkable, browser back works, and a
// refresh keeps your place. setScreen keeps its old signature — children
// (HomeScreen, GlobalHeader, DataRepository) are unchanged.
const SCREEN_PATHS = {
  HOME: '/',
  ADD_DATA: '/scout',
  IMPORT_CSV: '/import',
  VIEW_EXPORT: '/repo',
  DUGOUT: '/dugout',
};

function screenFromPath(pathname) {
  if (pathname.startsWith('/scout')) return 'ADD_DATA';
  if (pathname.startsWith('/import')) return 'IMPORT_CSV';
  if (pathname.startsWith('/repo')) return 'VIEW_EXPORT';
  if (pathname.startsWith('/dugout')) return 'DUGOUT';
  return 'HOME';
}

function ScreenLoader() {
  return (
    <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 26, height: 26, border: '3px solid rgba(198,181,131,0.2)', borderTopColor: '#c6b583', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

export default function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const screen = screenFromPath(location.pathname);
  const setScreen = s => navigate(SCREEN_PATHS[s] || '/');

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
      {!FULL_SCREEN.has(screen) && <GlobalHeader onHome={() => setScreen('HOME')} />}
      {screen === 'HOME' && <HomeScreen setScreen={setScreen} />}
      <Suspense fallback={<ScreenLoader />}>
        {screen === 'ADD_DATA' && (
          <PasswordGate>
            <AddDataScreen setScreen={setScreen} initialMode="LIVE_SCOUT" />
          </PasswordGate>
        )}
        {screen === 'IMPORT_CSV' && (
          <PasswordGate>
            <AddDataScreen setScreen={setScreen} initialMode="CSV" />
          </PasswordGate>
        )}
        {screen === 'VIEW_EXPORT' && <DataRepository setScreen={setScreen} />}
        {screen === 'DUGOUT' && <DugoutView setScreen={setScreen} />}
      </Suspense>
    </div>
  );
}
