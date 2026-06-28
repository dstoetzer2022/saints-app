import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useTeams } from "@/hooks/useTeam";
import GlassCard from "@/components/shared/GlassCard";
import UCLAHoldSelector from "./UCLAHoldSelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import TeamBadge from "@/components/shared/TeamBadge";
import { CheckCircle2, Plus, X } from "lucide-react";

export default function PitcherObservationForm() {
  const { teams } = useTeams();
  const [games, setGames] = useState([]);
  const [existingMoves, setExistingMoves] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [observations, setObservations] = useState([]);

  const [form, setForm] = useState({
    game_id: "",
    pitcher_name: "",
    pitcher_team: "",
    time_to_plate_1b: "",
    time_to_plate_2b: "",
    has_slide_step: false,
    pickoff_moves: [],
    ucla_hold_start: null,
    ucla_hold_end: null,
    notes: ""
  });
  const [newMove, setNewMove] = useState("");
  const [moveFilter, setMoveFilter] = useState([]);

  useEffect(() => {
    async function load() {
      const [gameData, obsData] = await Promise.all([
        base44.entities.Game.list("-date", 100),
        base44.entities.PitcherObservation.list("-created_date", 200)
      ]);
      setGames(gameData);
      setObservations(obsData);
      // Collect all known pickoff moves
      const moves = new Set();
      obsData.forEach(o => {
        if (o.pickoff_moves) o.pickoff_moves.forEach(m => moves.add(m));
      });
      setExistingMoves([...moves]);
    }
    load();
  }, []);

  const handleAddMove = () => {
    if (newMove.trim() && !form.pickoff_moves.includes(newMove.trim())) {
      setForm(f => ({ ...f, pickoff_moves: [...f.pickoff_moves, newMove.trim()] }));
      setNewMove("");
      setMoveFilter([]);
    }
  };

  const handleMoveInput = (val) => {
    setNewMove(val);
    if (val.length > 0) {
      setMoveFilter(existingMoves.filter(m => m.toLowerCase().includes(val.toLowerCase())));
    } else {
      setMoveFilter([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      time_to_plate_1b: form.time_to_plate_1b ? parseFloat(form.time_to_plate_1b) : null,
      time_to_plate_2b: form.time_to_plate_2b ? parseFloat(form.time_to_plate_2b) : null,
    };
    await base44.entities.PitcherObservation.create(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm({ game_id: "", pitcher_name: "", pitcher_team: "", time_to_plate_1b: "", time_to_plate_2b: "", has_slide_step: false, pickoff_moves: [], ucla_hold_start: null, ucla_hold_end: null, notes: "" });
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="font-heading font-bold mb-4">Pitcher Observation</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Pitcher Name</Label>
              <Input value={form.pitcher_name} onChange={e => setForm(f => ({...f, pitcher_name: e.target.value}))} required placeholder="Last, First" />
            </div>
            <div>
              <Label>Team</Label>
              <Select value={form.pitcher_team} onValueChange={v => setForm(f => ({...f, pitcher_team: v}))}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Game</Label>
              <Select value={form.game_id} onValueChange={v => setForm(f => ({...f, game_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Select game" /></SelectTrigger>
                <SelectContent>
                  {games.map(g => <SelectItem key={g.id} value={g.id}>{g.date} — {g.home_team_code} vs {g.away_team_code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Time to Plate (R1)</Label>
              <Input type="number" step="0.01" value={form.time_to_plate_1b} onChange={e => setForm(f => ({...f, time_to_plate_1b: e.target.value}))} placeholder="e.g. 1.35" />
            </div>
            <div>
              <Label>Time to Plate (R2)</Label>
              <Input type="number" step="0.01" value={form.time_to_plate_2b} onChange={e => setForm(f => ({...f, time_to_plate_2b: e.target.value}))} placeholder="e.g. 1.42" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.has_slide_step} onCheckedChange={v => setForm(f => ({...f, has_slide_step: v}))} />
            <Label>Slide Step</Label>
          </div>

          {/* Pickoff moves */}
          <div>
            <Label>Pickoff Moves</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Input 
                  value={newMove} 
                  onChange={e => handleMoveInput(e.target.value)} 
                  placeholder="Add move name..."
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddMove())}
                />
                {moveFilter.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                    {moveFilter.map(m => (
                      <button key={m} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onClick={() => { setNewMove(m); setMoveFilter([]); }}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" size="icon" onClick={handleAddMove}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.pickoff_moves.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.pickoff_moves.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs font-medium">
                    {m}
                    <button type="button" onClick={() => setForm(f => ({...f, pickoff_moves: f.pickoff_moves.filter((_, j) => j !== i)}))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <UCLAHoldSelector 
            startPos={form.ucla_hold_start} 
            endPos={form.ucla_hold_end} 
            onChange={(s, e) => setForm(f => ({...f, ucla_hold_start: s, ucla_hold_end: e}))} 
          />

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Additional observations..." rows={3} />
          </div>

          <Button type="submit" disabled={saving || !form.pitcher_name} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? "Saving..." : "Save Observation"}
          </Button>
        </form>
      </GlassCard>

      {/* Recent observations */}
      {observations.length > 0 && (
        <GlassCard>
          <h3 className="font-heading font-bold mb-3">Recent Observations</h3>
          <div className="space-y-2">
            {observations.slice(0, 10).map(o => (
              <div key={o.id} className="p-3 bg-muted/40 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{o.pitcher_name}</span>
                  <TeamBadge teamCode={o.pitcher_team} size="xs" />
                </div>
                {o.time_to_plate_1b && <p className="text-xs mt-1">R1: {o.time_to_plate_1b}s</p>}
                {o.time_to_plate_2b && <p className="text-xs">R2: {o.time_to_plate_2b}s</p>}
                {o.ucla_hold_start && <p className="text-xs">UCLA: {o.ucla_hold_start === o.ucla_hold_end ? o.ucla_hold_start : `${o.ucla_hold_start}→${o.ucla_hold_end}`}</p>}
                {o.notes && <p className="text-xs text-muted-foreground mt-1">{o.notes}</p>}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}