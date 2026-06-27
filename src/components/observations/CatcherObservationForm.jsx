import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useTeams } from "@/hooks/useTeam";
import GlassCard from "@/components/shared/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import TeamBadge from "@/components/shared/TeamBadge";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";

export default function CatcherObservationForm() {
  const { teams } = useTeams();
  const [games, setGames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [observations, setObservations] = useState([]);

  const [form, setForm] = useState({
    game_id: "",
    catcher_name: "",
    catcher_team: "",
    warmup_pop_time: "",
    steal_attempts: [],
    notes: ""
  });

  useEffect(() => {
    async function load() {
      const [gameData, obsData] = await Promise.all([
        base44.entities.Game.list("-date", 100),
        base44.entities.CatcherObservation.list("-created_date", 200)
      ]);
      setGames(gameData);
      setObservations(obsData);
    }
    load();
  }, []);

  const addStealAttempt = () => {
    setForm(f => ({
      ...f,
      steal_attempts: [...f.steal_attempts, { pop_time: "", base: "2B", result: "out" }]
    }));
  };

  const updateStealAttempt = (idx, field, value) => {
    setForm(f => ({
      ...f,
      steal_attempts: f.steal_attempts.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    }));
  };

  const removeStealAttempt = (idx) => {
    setForm(f => ({
      ...f,
      steal_attempts: f.steal_attempts.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      warmup_pop_time: form.warmup_pop_time ? parseFloat(form.warmup_pop_time) : null,
      steal_attempts: form.steal_attempts.map(s => ({
        ...s,
        pop_time: s.pop_time ? parseFloat(s.pop_time) : null
      }))
    };
    await base44.entities.CatcherObservation.create(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm({ game_id: "", catcher_name: "", catcher_team: "", warmup_pop_time: "", steal_attempts: [], notes: "" });
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="font-heading font-bold mb-4">Catcher Observation</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Catcher Name</Label>
              <Input value={form.catcher_name} onChange={e => setForm(f => ({...f, catcher_name: e.target.value}))} required placeholder="Last, First" />
            </div>
            <div>
              <Label>Team</Label>
              <Select value={form.catcher_team} onValueChange={v => setForm(f => ({...f, catcher_team: v}))}>
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

          <div>
            <Label>Warmup Pop Time</Label>
            <Input type="number" step="0.01" value={form.warmup_pop_time} onChange={e => setForm(f => ({...f, warmup_pop_time: e.target.value}))} placeholder="e.g. 2.05" className="max-w-xs" />
          </div>

          {/* Steal attempts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Steal Attempts (Game)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStealAttempt} className="gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {form.steal_attempts.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
                  <Input 
                    type="number" step="0.01" 
                    value={s.pop_time} 
                    onChange={e => updateStealAttempt(i, "pop_time", e.target.value)} 
                    placeholder="Pop time" 
                    className="w-28" 
                  />
                  <Select value={s.base} onValueChange={v => updateStealAttempt(i, "base", v)}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2B">2B</SelectItem>
                      <SelectItem value="3B">3B</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={s.result} onValueChange={v => updateStealAttempt(i, "result", v)}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="out">Out</SelectItem>
                      <SelectItem value="safe">Safe</SelectItem>
                      <SelectItem value="no_throw">No Throw</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeStealAttempt(i)} className="shrink-0">
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Additional observations..." rows={3} />
          </div>

          <Button type="submit" disabled={saving || !form.catcher_name} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
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
                  <span className="font-semibold">{o.catcher_name}</span>
                  <TeamBadge teamCode={o.catcher_team} size="xs" />
                </div>
                {o.warmup_pop_time && <p className="text-xs mt-1">Warmup: {o.warmup_pop_time}s</p>}
                {o.steal_attempts?.length > 0 && (
                  <p className="text-xs">{o.steal_attempts.length} steal attempt(s)</p>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}