export const TEAMS = [
  { name: "Arroyo Seco Saints", code: "ARR_SEC", short: "Saints", color: "#1a2942" },
  { name: "San Luis Obispo Blues", code: "SAN_LUI", short: "Blues", color: "#1e3a5f" },
  { name: "Santa Barbara Foresters", code: "SAN_BAR", short: "Foresters", color: "#2d5016" },
  { name: "Sonoma Stompers", code: "SON_STO", short: "Stompers", color: "#6b2d8b" },
  { name: "Walnut Creek Crawdads", code: "WAL_CRE", short: "Crawdads", color: "#8b1a1a" },
  { name: "Orange County Riptide", code: "ORA_COU2", short: "Riptide", color: "#0077be" },
  { name: "Conejo Oaks", code: "CON_OAK", short: "Oaks", color: "#4a3728" },
  { name: "MLB Academy Barons", code: "MLB_ACA", short: "Barons", color: "#1a1a1a" },
  { name: "Philippines Baseball Group", code: "PHI_BAS", short: "Philippines", color: "#0038a8" },
  { name: "Menlo Park Legends", code: "MEN_PAR", short: "Legends", color: "#b8860b" },
  { name: "Alameda Merchants", code: "ALA_MER", short: "Merchants", color: "#2f4f4f" },
  { name: "San Diego Bombers", code: "SAN_DIE_24", short: "Bombers", color: "#c41e3a" }
];

export const TEAM_LOGOS = {
  ARR_SEC: "https://images.sportsengine.com/is/image/sportsengine/s-l300-5dae7c5e-5b02-48ea-b2e7-0b9f0e7d4e2c",
  SAN_LUI: null,
  SAN_BAR: null,
  SON_STO: null,
  WAL_CRE: null,
  ORA_COU2: null,
  CON_OAK: null,
  MLB_ACA: null,
  PHI_BAS: null,
  MEN_PAR: null,
  ALA_MER: null,
  SAN_DIE_24: null
};

export function getTeamByCode(code) {
  return TEAMS.find(t => t.code === code);
}

export function getTeamName(code) {
  const team = getTeamByCode(code);
  return team ? team.name : code;
}

export function getTeamShort(code) {
  const team = getTeamByCode(code);
  return team ? team.short : code;
}

export function getTeamColor(code) {
  const team = getTeamByCode(code);
  return team ? team.color : "#666";
}