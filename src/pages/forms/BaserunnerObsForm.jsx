import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ObsForm, FormField, GameSelect, TeamSelect, SubmitButton, useGameOptions, useTeamOptions, inputStyle } from "@/components/forms/ObsFormBase";

export default function BaserunnerObsForm() {
  const games = useGameOptions();
  const teams = useTeamOptions();
  const [form, setForm] = useState({
    game_id: "", runner_name: "", runner_team: "",
    speed_rating: "", aggression_rating: "",
    pickoff_attempts: "", dirt_ball_advances: "", notes: "",
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    await base44.entities.BaserunnerObservation.create({
      ...form,
      pickoff_attempts: form.pickoff_attempts ? parseInt(form.pickoff_attempts) : 0,
      dirt_ball_advances: form.dirt_ball_advances ? parseInt(form.dirt_ball_advances) : 0,
      game_id: form.game_id || null,
    });
    setForm({ game_id: "", runner_name: "", runner_team: "", speed_rating: "", aggression_rating: "", pickoff_attempts: "", dirt_ball_advances: "", notes: "" });
  }

  return (
    <ObsForm title="Baserunner Observation" onSubmit={handleSubmit}>
      {({ saving }) => (
        <>
          <FormField label="Game (optional)">
            <GameSelect value={form.game_id} onChange={v => set("game_id", v)} games={games} />
          </FormField>
          <FormField label="Runner Name *">
            <input required value={form.runner_name} onChange={e => set("runner_name", e.target.value)} style={inputStyle} placeholder="Last, First" />
          </FormField>
          <FormField label="Team *">
            <TeamSelect value={form.runner_team} onChange={v => set("runner_team", v)} teams={teams} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="Speed Rating">
              <select value={form.speed_rating} onChange={e => set("speed_rating", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="fast">Fast</option>
                <option value="average">Average</option>
                <option value="slow">Slow</option>
              </select>
            </FormField>
            <FormField label="Aggression Rating">
              <select value={form.aggression_rating} onChange={e => set("aggression_rating", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="aggressive">Aggressive</option>
                <option value="average">Average</option>
                <option value="passive">Passive</option>
              </select>
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="Pickoff Attempts">
              <input type="number" min="0" value={form.pickoff_attempts} onChange={e => set("pickoff_attempts", e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Dirt Ball Advances">
              <input type="number" min="0" value={form.dirt_ball_advances} onChange={e => set("dirt_ball_advances", e.target.value)} style={inputStyle} />
            </FormField>
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