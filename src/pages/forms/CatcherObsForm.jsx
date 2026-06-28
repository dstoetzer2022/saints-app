import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ObsForm, FormField, GameSelect, TeamSelect, SubmitButton, useGameOptions, useTeamOptions, inputStyle } from "@/components/forms/ObsFormBase";

export default function CatcherObsForm() {
  const games = useGameOptions();
  const teams = useTeamOptions();
  const [form, setForm] = useState({
    game_id: "", catcher_name: "", catcher_team: "",
    warmup_pop_time: "", notes: "",
  });
  const [attempts, setAttempts] = useState([]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function addAttempt() { setAttempts(a => [...a, { base: "2B", pop_time: "", result: "out" }]); }
  function setAttempt(i, k, v) { setAttempts(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function removeAttempt(i) { setAttempts(a => a.filter((_, j) => j !== i)); }

  async function handleSubmit() {
    await base44.entities.CatcherObservation.create({
      ...form,
      warmup_pop_time: form.warmup_pop_time ? parseFloat(form.warmup_pop_time) : null,
      game_id: form.game_id || null,
      steal_attempts: attempts.map(a => ({ ...a, pop_time: a.pop_time ? parseFloat(a.pop_time) : null })),
    });
    setForm({ game_id: "", catcher_name: "", catcher_team: "", warmup_pop_time: "", notes: "" });
    setAttempts([]);
  }

  return (
    <ObsForm title="Catcher Observation" onSubmit={handleSubmit}>
      {({ saving }) => (
        <>
          <FormField label="Game (optional)">
            <GameSelect value={form.game_id} onChange={v => set("game_id", v)} games={games} />
          </FormField>
          <FormField label="Catcher Name *">
            <input required value={form.catcher_name} onChange={e => set("catcher_name", e.target.value)} style={inputStyle} placeholder="Last, First" />
          </FormField>
          <FormField label="Team *">
            <TeamSelect value={form.catcher_team} onChange={v => set("catcher_team", v)} teams={teams} />
          </FormField>
          <FormField label="Warmup Pop Time (sec)">
            <input type="number" step="0.01" value={form.warmup_pop_time} onChange={e => set("warmup_pop_time", e.target.value)} style={inputStyle} placeholder="e.g. 1.95" />
          </FormField>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>Steal Attempts</span>
              <button type="button" onClick={addAttempt} style={{ padding: "4px 10px", borderRadius: "4px", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer" }}>
                + Add
              </button>
            </div>
            {attempts.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "8px", marginBottom: "8px" }}>
                <select value={a.base} onChange={e => setAttempt(i, "base", e.target.value)} style={inputStyle}>
                  <option value="2B">2B</option>
                  <option value="3B">3B</option>
                </select>
                <input type="number" step="0.01" value={a.pop_time} onChange={e => setAttempt(i, "pop_time", e.target.value)} style={inputStyle} placeholder="Pop time" />
                <select value={a.result} onChange={e => setAttempt(i, "result", e.target.value)} style={inputStyle}>
                  <option value="out">Out</option>
                  <option value="safe">Safe</option>
                  <option value="no_throw">No Throw</option>
                </select>
                <button type="button" onClick={() => removeAttempt(i)} style={{ padding: "0 8px", borderRadius: "4px", backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-color)", color: "var(--accent-red)", cursor: "pointer", fontSize: "14px" }}>×</button>
              </div>
            ))}
          </div>

          <FormField label="Notes">
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
          </FormField>
          <SubmitButton loading={saving} />
        </>
      )}
    </ObsForm>
  );
}