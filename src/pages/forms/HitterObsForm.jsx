import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ObsForm, FormField, GameSelect, TeamSelect, SubmitButton, useGameOptions, useTeamOptions, inputStyle } from "@/components/forms/ObsFormBase";

export default function HitterObsForm() {
  const games = useGameOptions();
  const teams = useTeamOptions();
  const [form, setForm] = useState({
    game_id: "", hitter_name: "", hitter_team: "", hitter_hand: "",
    ab_count: "", xbh_count: "", pull_pct: "", hard_hit_pct: "", slug_pct: "",
    approach: "", bat_speed_grade: "", contact_grade: "", power_grade: "", notes: "",
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    await base44.entities.HitterObservation.create({
      ...form,
      ab_count: form.ab_count ? parseInt(form.ab_count) : null,
      xbh_count: form.xbh_count ? parseInt(form.xbh_count) : null,
      pull_pct: form.pull_pct ? parseFloat(form.pull_pct) / 100 : null,
      hard_hit_pct: form.hard_hit_pct ? parseFloat(form.hard_hit_pct) / 100 : null,
      slug_pct: form.slug_pct ? parseFloat(form.slug_pct) : null,
      game_id: form.game_id || null,
    });
    setForm({ game_id: "", hitter_name: "", hitter_team: "", hitter_hand: "", ab_count: "", xbh_count: "", pull_pct: "", hard_hit_pct: "", slug_pct: "", approach: "", bat_speed_grade: "", contact_grade: "", power_grade: "", notes: "" });
  }

  const gradeOpts = ["plus_plus","plus","average","below","well_below"];

  return (
    <ObsForm title="Hitter Observation" onSubmit={handleSubmit}>
      {({ saving }) => (
        <>
          <FormField label="Game (optional)">
            <GameSelect value={form.game_id} onChange={v => set("game_id", v)} games={games} />
          </FormField>
          <FormField label="Hitter Name *">
            <input required value={form.hitter_name} onChange={e => set("hitter_name", e.target.value)} style={inputStyle} placeholder="Last, First" />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="Team *">
              <TeamSelect value={form.hitter_team} onChange={v => set("hitter_team", v)} teams={teams} />
            </FormField>
            <FormField label="Hand">
              <select value={form.hitter_hand} onChange={e => set("hitter_hand", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="R">R</option>
                <option value="L">L</option>
                <option value="S">S</option>
              </select>
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <FormField label="AB Count">
              <input type="number" value={form.ab_count} onChange={e => set("ab_count", e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="XBH Count">
              <input type="number" value={form.xbh_count} onChange={e => set("xbh_count", e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Slug%">
              <input type="number" step="0.001" value={form.slug_pct} onChange={e => set("slug_pct", e.target.value)} style={inputStyle} placeholder="0.000" />
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FormField label="Pull% (0–100)">
              <input type="number" step="0.1" value={form.pull_pct} onChange={e => set("pull_pct", e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label="Hard Hit% (0–100)">
              <input type="number" step="0.1" value={form.hard_hit_pct} onChange={e => set("hard_hit_pct", e.target.value)} style={inputStyle} />
            </FormField>
          </div>
          <FormField label="Approach">
            <select value={form.approach} onChange={e => set("approach", e.target.value)} style={inputStyle}>
              <option value="">—</option>
              <option value="disciplined">Disciplined</option>
              <option value="average">Average</option>
              <option value="chase">Chase</option>
            </select>
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <FormField label="Bat Speed">
              <select value={form.bat_speed_grade} onChange={e => set("bat_speed_grade", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {gradeOpts.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </FormField>
            <FormField label="Contact">
              <select value={form.contact_grade} onChange={e => set("contact_grade", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {gradeOpts.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </FormField>
            <FormField label="Power">
              <select value={form.power_grade} onChange={e => set("power_grade", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {gradeOpts.map(g => <option key={g} value={g}>{g}</option>)}
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