import React, { useState } from 'react';
import { NAVY, GOLD } from '@/lib/ds';

// Single shared password for both Live Scout and CSV Import.
// Unlock state persists for the browser tab session (sessionStorage), so
// switching between Live Scout and Import within the same session doesn't
// re-prompt — but a new tab/browser session asks again.
const CORRECT_PASSWORD = 'Brookside9!';
const SESSION_KEY = 'saints_dm_data_unlocked';

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
  });
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return children;

  function handleSubmit(e) {
    e.preventDefault();
    if (value === CORRECT_PASSWORD) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      setUnlocked(true);
    } else {
      setError(true);
      setValue('');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: NAVY, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Archivo', sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(198,181,131,0.2)',
        borderRadius: 12, padding: '32px 28px', width: 320,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ color: GOLD, fontWeight: 800, fontSize: 18, textAlign: 'center', letterSpacing: 0.3 }}>
          Restricted Access
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>
          Enter password to continue
        </div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          placeholder="Password"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${error ? '#f87171' : 'rgba(198,181,131,0.25)'}`,
            borderRadius: 6, padding: '10px 12px', color: '#f0ece0',
            fontSize: 14, fontFamily: "'Archivo', sans-serif", outline: 'none',
          }}
        />
        {error && (
          <div style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>
            Incorrect password
          </div>
        )}
        <button type="submit" style={{
          background: GOLD, color: '#0e253a', border: 'none', borderRadius: 6,
          padding: '10px 0', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          fontFamily: "'Archivo', sans-serif",
        }}>
          Unlock
        </button>
      </form>
    </div>
  );
}
