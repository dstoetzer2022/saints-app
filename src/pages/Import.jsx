import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { parseTrackmanCSV, extractGameInfo } from "@/lib/csvParser";
import { aggregateArsenal } from "@/lib/statsUtils";
import GlassCard from "@/components/shared/GlassCard";
import TeamBadge from "@/components/shared/TeamBadge";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function Import() {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, parsing, importing, aggregating, done, error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const processFile = useCallback(async (file) => {
    setStatus("parsing");
    setProgress(5);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const { pitches, errors } = parseTrackmanCSV(text);
      
      if (pitches.length === 0) {
        throw new Error("No valid pitch data found in CSV. " + (errors.length > 0 ? errors.join(", ") : ""));
      }

      setProgress(15);
      setStatus("importing");

      // Create game record
      const gameInfo = extractGameInfo(pitches, file.name);
      const game = await base44.entities.Game.create(gameInfo);
      const gameId = game.id;

      // Stamp all pitches with game_id and batch create
      const BATCH_SIZE = 50;
      const stampedPitches = pitches.map(p => ({ ...p, game_id: gameId }));
      
      for (let i = 0; i < stampedPitches.length; i += BATCH_SIZE) {
        const batch = stampedPitches.slice(i, i + BATCH_SIZE);
        await base44.entities.TrackmanPitch.bulkCreate(batch);
        setProgress(15 + Math.round((i / stampedPitches.length) * 60));
      }

      setProgress(80);
      setStatus("aggregating");

      // Aggregate arsenals per pitcher for this game
      const pitcherGroups = {};
      for (const p of pitches) {
        if (!p.pitcher_name) continue;
        const key = `${p.pitcher_name}__${p.pitcher_team}`;
        if (!pitcherGroups[key]) pitcherGroups[key] = { pitches: [], name: p.pitcher_name, team: p.pitcher_team, hand: p.pitcher_hand };
        pitcherGroups[key].pitches.push(p);
      }

      const arsenalRecords = [];
      for (const group of Object.values(pitcherGroups)) {
        const agg = aggregateArsenal(group.pitches, group.name, group.team, group.hand, gameId);
        arsenalRecords.push(...agg);
      }

      // Batch create arsenals
      for (let i = 0; i < arsenalRecords.length; i += BATCH_SIZE) {
        const batch = arsenalRecords.slice(i, i + BATCH_SIZE);
        await base44.entities.PitcherArsenal.bulkCreate(batch);
      }

      setProgress(100);
      setStatus("done");

      // Compute team summary
      const teamPitchers = {};
      const teamHitters = {};
      for (const p of pitches) {
        if (p.pitcher_name && p.pitcher_team) {
          if (!teamPitchers[p.pitcher_team]) teamPitchers[p.pitcher_team] = new Set();
          teamPitchers[p.pitcher_team].add(p.pitcher_name);
        }
        if (p.batter_name && p.batter_team) {
          if (!teamHitters[p.batter_team]) teamHitters[p.batter_team] = new Set();
          teamHitters[p.batter_team].add(p.batter_name);
        }
      }

      setResult({
        gameId,
        totalPitches: pitches.length,
        pitchers: Object.values(pitcherGroups).length,
        arsenalTypes: arsenalRecords.length,
        teams: Object.entries(teamPitchers).map(([code, set]) => ({
          code,
          pitchers: set.size,
          hitters: teamHitters[code]?.size || 0
        })),
        homeTeam: gameInfo.home_team_code,
        awayTeam: gameInfo.away_team_code,
        date: gameInfo.date
      });

    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processFile(file);
    } else {
      setError("Please drop a CSV file");
    }
  }, [processFile]);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Import Trackman</h1>
        <p className="text-muted-foreground mt-1">Drop a Trackman V3 CSV to process pitch data</p>
      </div>

      {/* Drop zone */}
      <GlassCard noPadding>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            p-12 text-center border-2 border-dashed rounded-xl transition-all cursor-pointer
            ${dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}
          `}
          onClick={() => document.getElementById("csv-input").click()}
        >
          <input
            id="csv-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
          />
          
          {status === "idle" && (
            <>
              <Upload className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="font-heading font-semibold text-lg">Drop Trackman CSV here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </>
          )}

          {(status === "parsing" || status === "importing" || status === "aggregating") && (
            <>
              <Loader2 className="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
              <p className="font-heading font-semibold text-lg">
                {status === "parsing" && "Parsing CSV..."}
                {status === "importing" && "Importing pitches..."}
                {status === "aggregating" && "Aggregating arsenals..."}
              </p>
              <Progress value={progress} className="mt-4 max-w-xs mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">{progress}%</p>
            </>
          )}

          {status === "done" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="font-heading font-semibold text-lg text-green-600">Import Complete</p>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="font-heading font-semibold text-lg text-destructive">Import Failed</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </>
          )}
        </div>
      </GlassCard>

      {/* Result summary */}
      {result && (
        <GlassCard>
          <h3 className="font-heading font-bold mb-4">Import Summary</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-display font-bold text-accent">{result.totalPitches.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Pitches</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-bold">{result.pitchers}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Pitchers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-bold">{result.arsenalTypes}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Arsenal Types</p>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Teams in File</p>
            <div className="space-y-2">
              {result.teams.map(t => (
                <div key={t.code} className="flex items-center justify-between">
                  <TeamBadge code={t.code} />
                  <span className="text-sm text-muted-foreground">
                    {t.pitchers} pitchers · {t.hitters} hitters
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button 
              onClick={() => { setStatus("idle"); setResult(null); }}
              variant="outline"
              className="gap-2"
            >
              <Upload className="w-4 h-4" /> Import Another
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}