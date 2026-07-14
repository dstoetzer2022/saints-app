Drop `pitcher-rest.json` (and `league-appearances.json` if you want it) here —
this is the same output the `ccl-pitcher-tracker` scraper writes to its own
`data/` folder. Point its GitHub Action's commit path at
`saints-app-main/public/data/` instead (or add a copy step) so it lands here
directly and Cloudflare Pages serves it at `/data/pitcher-rest.json`,
which is what `PitcherRestTracker.jsx` fetches.
