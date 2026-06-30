import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ObsForm, FormField, GameSelect, TeamSelect, SubmitButton, useGameOptions, useTeamOptions, inputStyle } from "@/components/forms/ObsFormBase";

export default function PitcherObsForm() {
  const games = useGameOptions();
  const teams = useTeamOptions();
  const [form, setForm] = useState({
    game_id: "", pitcher_name: "", pitcher_team: "",
    time_to_plate_1b: "", time_to_plate_2b: "", has_slide_step: false,
    ucla_hold_start: "", ucla_hold_end: "", notes: "",
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    await base44.entities.PitcherObservation.create({
      ...form,
      time_to_plate_1b: form.time_to_plate_1b ? parseFloat(form.time_to_plate_1b) : null,
      time_to_plate_2b: form.time_to_plate_2b ? parseFloat(form.time_to_plate_2b) : null,
      game_id: form.game_id || null,
    });
    setForm({ game_id: "", pitcher_name: "", pitcher_team: "", time_to_plate_1b: "", time_to_plate_2b: "", has_slide_step: false, ucla_hold_start: "", ucla_hold_end: "", notes: "" });
  }

  return (
    <ObsForm title="Pitcher Observation" onSubmit={handleSubmit}>
      {({ saving }) => (
        <>
          <FormField label="Game (optional)">
            <GameSelect value={form.game_id} onChange={v => set("game_id", v)} games={games} />
          </FormField>
          <FormField label="Pitcher Name *">
            <input required value={form.pitcher_name} onChange={e => set("pitcher_name", e.target.value)} style={inputStyle} placeholder="Last, First" />
          </FormField>
          <FormField label="Team *">
            <TeamSelect value={form.pitcher_team} onChange={v => set("pitcher_team", v)} teams={teams} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="Time to Plate — R1 (sec)">
              <input type="number" step="0.01" value={form.time_to_plate_1b} onChange={e => set("time_to_plate_1b", e.target.value)} style={inputStyle} placeholder="e.g. 1.32" />
            </FormField>
            <FormField label="Time to Plate — R2 (sec)">
              <input type="number" step="0.01" value={form.time_to_plate_2b} onChange={e => set("time_to_plate_2b", e.target.value)} style={inputStyle} placeholder="e.g. 1.28" />
            </FormField>
          </div>
          <FormField label="Slide Step">
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={form.has_slide_step} onChange={e => set("has_slide_step", e.target.checked)} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-primary)" }}>Has slide step</span>
            </label>
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="UCLA Hold Start">
              <select value={form.ucla_hold_start} onChange={e => set("ucla_hold_start", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {["U","C","L","A"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="UCLA Hold End">
              <select value={form.ucla_hold_end} onChange={e => set("ucla_hold_end", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {["U","C","L","A"].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
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