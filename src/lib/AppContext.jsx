import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null); // team object or null
  const [teamsLoading, setTeamsLoading] = useState(true);

  async function loadTeams() {
    const t = await base44.entities.Team.list('name', 100);
    setTeams(t);
    setTeamsLoading(false);
    // default to ARR if present
    if (!activeTeam) {
      const arr = t.find(x => x.code === 'ARR') || t[0] || null;
      setActiveTeam(arr);
    }
  }

  async function addTeam(name) {
    const code = name.toUpperCase().replace(/\s+/g, '_').slice(0, 10);
    const t = await base44.entities.Team.create({ name, code });
    setTeams(prev => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
    return t;
  }

  useEffect(() => { loadTeams(); }, []);

  return (
    <AppContext.Provider value={{ teams, activeTeam, setActiveTeam, teamsLoading, loadTeams, addTeam }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}