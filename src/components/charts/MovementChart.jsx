import React, { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function MovementChart({ pitches, getPitchColor }) {
  const data = useMemo(() => {
    const byType = {};
    pitches.forEach(p => {
      if (p.horz_break == null || p.induced_vert_break == null) return;
      const type = p.tagged_pitch_type || p.pitch_type || "Unknown";
      if (!byType[type]) byType[type] = [];
      byType[type].push({ x: p.horz_break, y: p.induced_vert_break, name: type });
    });
    return byType;
  }, [pitches]);

  const types = Object.keys(data);

  if (types.length === 0) {
    return <p className="text-center text-muted-foreground py-8 text-sm">No movement data available</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 82% / 0.3)" />
        <XAxis 
          type="number" 
          dataKey="x" 
          name="Horizontal Break" 
          unit="in"
          label={{ value: "Horizontal Break (in)", position: "insideBottom", offset: -10, style: { fontSize: 11, fill: "hsl(214 20% 40%)" } }}
          tick={{ fontSize: 10 }}
        />
        <YAxis 
          type="number" 
          dataKey="y" 
          name="Induced Vert Break" 
          unit="in"
          label={{ value: "IVB (in)", angle: -90, position: "insideLeft", offset: 5, style: { fontSize: 11, fill: "hsl(214 20% 40%)" } }}
          tick={{ fontSize: 10 }}
        />
        <Tooltip 
          content={({ payload }) => {
            if (!payload || !payload.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                <p className="font-semibold">{d.name}</p>
                <p>H Break: {d.x?.toFixed(1)}"</p>
                <p>IVB: {d.y?.toFixed(1)}"</p>
              </div>
            );
          }}
        />
        {types.map(type => (
          <Scatter 
            key={type}
            name={type}
            data={data[type]}
            fill={getPitchColor(type)}
            fillOpacity={0.7}
            r={4}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}