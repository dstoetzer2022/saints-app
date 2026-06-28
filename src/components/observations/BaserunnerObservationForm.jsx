import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useTeams } from "@/hooks/useTeam";
import { getSpeedColor, getAggressionColor } from "@/lib/statsUtils";
import GlassCard from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import TeamBadge from "@/components/shared/TeamBadge";
import { CheckCircle2 } from "lucide-react";

const SPEED_OPTIONS = [
  { value: "fast", label: "Fast", color: "#22c55e" },
  { value: "average", label: "Average", color: "#eab308" },
  { value: "slow", label: "Slow", color: "#ef4444" }
];

const AGGRESSION_OPTIONS = [
  { value: "aggressive", label: "Aggressive", color: "#22c55e" },
  { value: "average", label: "Average", color: "#eab308" },
  { value: "passive", label: "Passive", color: "#ef4444" }
];

export default function BaserunnerObservationForm() {
  const { teams } = useTeams();
  const [games, setGames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [observations, setObservations] = useState([]);

  const [form, setForm] = useState({
    game_id: "",
    runner_name: "",
    runner_team: "",
    speed_rating: "",
    aggression_rating: "",
    pickoff_attempts: 0,
    dirt_ball_advances: 0,
    notes: ""
  });

  useEffect(() => {
    async function load() {
      const [gameData, obsData] = await Promise.all([
        base44.entities.Game.list("-date", 100),
        base44.entities.BaserunnerObservation.list("-created_date", 200)
      ]);
      setGames(gameData);
      setObservations(obsData);
    }
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.BaserunnerObservation.create({
      ...form,
      pickoff_attempts: parseInt(form.pickoff_attempts) || 0,
      dirt_ball_advances: parseInt(form.dirt_ball_advances) || 0
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm({ game_id: "", runner_name: "", runner_team: "", speed_rating: "", aggression_rating: "", pickoff_attempts: 0, dirt_ball_advances: 0, notes: "" });
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="font-heading font-bold mb-4">Baserunner Observation</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Runner Name</Label>
              <Input value={form.runner_name} onChange={e => setForm(f => ({...f, runner_name: e.target.value}))} required placeholder="Last, First" />
            </div>
            <div>
              <Label>Team</Label>
              <Select value={form.runner_team} onValueChange={v => setForm(f => ({...f, runner_team: v}))}>
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

          {/* Speed rating */}
          <div>
            <Label className="mb-2 block">Speed</Label>
            <div className="flex gap-2">
              {SPEED_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({...f, speed_rating: opt.value}))}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2
                    ${form.speed_rating === opt.value 
                      ? "text-white shadow-md scale-105" 
                      : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                    }
                  `}
                  style={form.speed_rating === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aggression rating */}
          <div>
            <Label className="mb-2 block">Aggression</Label>
            <div className="flex gap-2">
              {AGGRESSION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({...f, aggression_rating: opt.value}))}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2
                    ${form.aggression_rating === opt.value 
                      ? "text-white shadow-md scale-105" 
                      : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                    }
                  `}
                  style={form.aggression_rating === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Pickoff Attempts</Label>
              <Input type="number" min="0" value={form.pickoff_attempts} onChange={e => setForm(f => ({...f, pickoff_attempts: e.target.value}))} />
            </div>
            <div>
              <Label>Dirt Ball Advances</Label>
              <Input type="number" min="0" value={form.dirt_ball_advances} onChange={e => setForm(f => ({...f, dirt_ball_advances: e.target.value}))} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Additional observations..." rows={3} />
          </div>

          <Button type="submit" disabled={saving || !form.runner_name} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? "Saving..." : "Save Observation"}
          </Button>
        </form>
      </GlassCard>

      {observations.length > 0 && (
        <GlassCard>
          <h3 className="font-heading font-bold mb-3">Recent Observations</h3>
          <div className="space-y-2">
            {observations.slice(0, 10).map(o => (
              <div key={o.id} className="p-3 bg-muted/40 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{o.runner_name}</span>
                  <TeamBadge teamCode={o.runner_team} size="xs" />
                </div>
                <div className="flex gap-2 mt-1.5">
                  {o.speed_rating && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: getSpeedColor(o.speed_rating) }}>
                      {o.speed_rating}
                    </span>
                  )}
                  {o.aggression_rating && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: getAggressionColor(o.aggression_rating) }}>
                      {o.aggression_rating}
                    </span>
                  )}
                  {o.pickoff_attempts > 0 && <span className="text-xs text-muted-foreground">{o.pickoff_attempts} pickoffs</span>}
                  {o.dirt_ball_advances > 0 && <span className="text-xs text-muted-foreground">{o.dirt_ball_advances} dirt advances</span>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}