# Saints Data Matrix

React/Vite web app for the Arroyo Seco Saints (California Collegiate League): live game scouting, Trackman data pipelines, player profiling, and dugout displays. Backend: Base44 (app ID `6a33bb3aaecad5de2f0e0911`). Deployed via Cloudflare Workers at `saints-app.dstoetzer2022.workers.dev`.

## Screen map
- **Home** (`HomeScreen`) — nav hub, warms the league pitch cache on mount
- **Live Scout** (`LiveScout/*`, password-gated) — in-game observation entry
- **CSV Import** (`CSVImport/*`, password-gated) — Trackman V3 CSV ingestion
- **Data Repository** (`DataRepository/*`) — TeamGrid → TeamHub → RosterView → PlayerProfile / Leaderboard / PitcherRestTracker
- **Dugout View** (`DugoutView/`) — live display, polls `Game` every 10s, controlled remotely via `dugout_display_mode`

## Core libraries (`src/lib/`)
- `statsUtils.js` — name canonicalization (`canonicalNameKey`), pitch-call predicates, percentiles
- `profileStats.js` — pitcher/hitter profile computation, wOBA/xStats, percentile pools
- `arsenalCorrection.js` — two-pass UCLA arsenal correction (type merge + median/MAD mistag pass)
- `seasonAggregation.js` — PitcherArsenal season rebuild (create-then-delete ordering)
- `fetchAll.js` — paginated pulls with retry/dedupe · `leagueCache.js` — 10-min league pitch cache
- `pitch3dEngine.js` — Three.js scene builder for 3D pitch flight

## Data conventions
- Names: Trackman/Base44 store "Last, First"; live scouting uses "First Last" — always match via `canonicalNameKey()`
- `pitcher_team` on TrackmanPitch = full team name; PitcherArsenal = Trackman code (e.g. `ARR_SEC`) — never join on team
- Season aggregate rows use `game_id: 'season'`
- `FoulBallNotFieldable` is the V3 foul call; cutters are excluded from FB velo averages

## Develop
```
npm install
# .env.local: VITE_GATE_PASSWORD=<gate password>
npm run dev
```

## Deploy
`npm run build` → `wrangler deploy` (Cloudflare Workers, SPA fallback per `wrangler.jsonc`).
