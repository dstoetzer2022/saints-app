import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeName } from '@/lib/statsUtils';
import { C, FONT } from '@/lib/darkTheme';

const SPEED_COLOR = { fast: C.green, average: C.amber, slow: C.red };
const AGGR_COLOR  = { aggressive: C.green, average: C.amber, passive: C.red };

function StatBadge({ label, value, color }) {
  if (!value && value !== 0) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, fontFamily: FONT,
      color: color || C.cream,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>{label}</span> {value}
    </span>
  );
}

function RunnerCard({ obs }) {
  const stealPct = obs.steal_attempts > 0
    ? Math.round(obs.steals_successful / obs.steal_attempts * 100)
    : null;

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.edge}`,
      borderRadius: 8,
      padding: '14px 18px',
      pageBreakInside: 'avoid',
      breakInside: 'avoid',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        {obs.jersey_number && (
          <span style={{ fontSize: 13, fontWeight: 900, color: C.muted, fontFamily: FONT, minWidth: 28 }}>
            #{obs.jersey_number}
          </span>
        )}
        <span style={{ fontSize: 17, fontWeight: 900, color: C.white, letterSpacing: -0.4, fontFamily: FONT }}>
          {obs.runner_name}
        </span>
        {obs.position && (
          <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {obs.position}
          </span>
        )}
        {obs.bats && (
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: FONT }}>
            {obs.bats}HB
          </span>
        )}
      </div>

      {/* Ratings row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 10 }}>
        {obs.speed_rating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: FONT }}>Speed</span>
            <span style={{
              fontSize: 12, fontWeight: 800, fontFamily: FONT,
              color: SPEED_COLOR[obs.speed_rating] || C.cream,
              textTransform: 'capitalize',
            }}>
              {obs.speed_rating}
            </span>
          </div>
        )}
        {obs.aggression_rating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: FONT }}>Aggression</span>
            <span style={{
              fontSize: 12, fontWeight: 800, fontFamily: FONT,
              color: AGGR_COLOR[obs.aggression_rating] || C.cream,
              textTransform: 'capitalize',
            }}>
              {obs.aggression_rating}
            </span>
          </div>
        )}
        {obs.lead_size_1b && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: FONT }}>Lead (1B)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.cream, fontFamily: FONT }}>{obs.lead_size_1b}</span>
          </div>
        )}
      </div>

      {/* Counting stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', marginBottom: obs.notes ? 10 : 0 }}>
        {obs.steal_attempts > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: FONT }}>SB</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.white, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>
              {obs.steals_successful ?? 0}/{obs.steal_attempts}
            </span>
            {stealPct != null && (
              <span style={{ fontSize: 11, fontWeight: 700, color: stealPct >= 70 ? C.green : stealPct >= 50 ? C.amber : C.red, fontFamily: FONT }}>
                ({stealPct}%)
              </span>
            )}
          </div>
        )}
        {obs.pickoff_attempts > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: FONT }}>PO Att</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.cream, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>{obs.pickoff_attempts}</span>
          </div>
        )}
        {obs.dirt_ball_advances > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: FONT }}>Dirt Adv</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: C.cream, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>{obs.dirt_ball_advances}</span>
          </div>
        )}
      </div>

      {obs.notes && (
        <div style={{
          marginTop: 8, fontSize: 11, fontWeight: 500, color: C.muted, fontStyle: 'italic',
          fontFamily: FONT, borderLeft: `2px solid ${C.gold}`, paddingLeft: 10, lineHeight: 1.5,
        }}>
          "{obs.notes}"
        </div>
      )}
    </div>
  );
}

export default function BaserunnerReport({ team, onClose }) {
  const [obs, setObs] = useState([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    base44.entities.BaserunnerObservation
      .filter({ runner_team: team.name }, 'runner_name', 500)
      .then(data => {
        // Deduplicate by normalized runner name — keep the most complete record
        const map = {};
        data.forEach(o => {
          const key = normalizeName(o.runner_name).toLowerCase();
          if (!map[key]) {
            map[key] = { ...o };
          } else {
            // Merge: prefer non-null values; sum counting stats
            const existing = map[key];
            if (!existing.speed_rating && o.speed_rating) existing.speed_rating = o.speed_rating;
            if (!existing.aggression_rating && o.aggression_rating) existing.aggression_rating = o.aggression_rating;
            if (!existing.lead_size_1b && o.lead_size_1b) existing.lead_size_1b = o.lead_size_1b;
            if (!existing.position && o.position) existing.position = o.position;
            if (!existing.jersey_number && o.jersey_number) existing.jersey_number = o.jersey_number;
            existing.steal_attempts  = (existing.steal_attempts  || 0) + (o.steal_attempts  || 0);
            existing.steals_successful = (existing.steals_successful || 0) + (o.steals_successful || 0);
            existing.pickoff_attempts = (existing.pickoff_attempts || 0) + (o.pickoff_attempts || 0);
            existing.dirt_ball_advances = (existing.dirt_ball_advances || 0) + (o.dirt_ball_advances || 0);
            if (o.notes && !existing.notes) existing.notes = o.notes;
          }
        });
        const sorted = Object.values(map).sort((a, b) => {
          const na = parseInt(a.jersey_number) || 999;
          const nb = parseInt(b.jersey_number) || 999;
          return na - nb || (a.runner_name || '').localeCompare(b.runner_name || '');
        });
        setObs(sorted);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [team.name]);

  const handlePrint = () => {
    const SPEED_LABELS = { fast: 'Fast', average: 'Average', slow: 'Slow' };
    const AGGR_LABELS  = { aggressive: 'Aggressive', average: 'Average', passive: 'Passive' };
    const SPEED_DOT = { fast: '#1a7a3a', average: '#a8780a', slow: '#b53030' };
    const AGGR_DOT  = { aggressive: '#1a7a3a', average: '#a8780a', passive: '#b53030' };

    const summaryItems = [
      { label: 'Runners',     value: obs.length },
      { label: 'SB Att',      value: obs.reduce((a, o) => a + (o.steal_attempts || 0), 0) },
      { label: 'SB Suc',      value: obs.reduce((a, o) => a + (o.steals_successful || 0), 0) },
      { label: 'Fast',        value: obs.filter(o => o.speed_rating === 'fast').length },
      { label: 'Aggressive',  value: obs.filter(o => o.aggression_rating === 'aggressive').length },
    ];

    // One dense row per runner instead of a stacked card — fits far more
    // players per printed page while keeping every field readable.
    const rowsHtml = obs.map(o => {
      const stealPct = o.steal_attempts > 0
        ? Math.round((o.steals_successful || 0) / o.steal_attempts * 100)
        : null;
      const sbCell = o.steal_attempts > 0
        ? `${o.steals_successful ?? 0}/${o.steal_attempts}${stealPct != null ? ` (${stealPct}%)` : ''}`
        : '—';
      const speedDot = o.speed_rating ? `<span class="dot" style="background:${SPEED_DOT[o.speed_rating]||'#999'}"></span>${SPEED_LABELS[o.speed_rating]||o.speed_rating}` : '—';
      const aggrDot  = o.aggression_rating ? `<span class="dot" style="background:${AGGR_DOT[o.aggression_rating]||'#999'}"></span>${AGGR_LABELS[o.aggression_rating]||o.aggression_rating}` : '—';

      return `<tr>
        <td class="num">${o.jersey_number || '—'}</td>
        <td class="name">${o.runner_name || '—'}</td>
        <td>${o.position || '—'}</td>
        <td>${o.bats ? o.bats + 'HB' : '—'}</td>
        <td class="rate">${speedDot}</td>
        <td class="rate">${aggrDot}</td>
        <td>${o.lead_size_1b || '—'}</td>
        <td class="num">${sbCell}</td>
        <td class="num">${o.pickoff_attempts || '—'}</td>
        <td class="num">${o.dirt_ball_advances || '—'}</td>
        <td class="notes">${o.notes || ''}</td>
      </tr>`;
    }).join('');

    const summaryHtml = summaryItems.map(s =>
      `<div class="sum-box"><div class="sum-label">${s.label}</div><div class="sum-val">${s.value}</div></div>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Baserunner Report — ${team.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Archivo', sans-serif; background: #fff; color: #111; padding: 24px 28px; font-size: 11px; }
    .report-title { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .team-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #000; margin-bottom: 2px; }
    .meta { font-size: 11px; color: #888; margin-bottom: 12px; }
    hr { border: none; border-top: 2px solid #000; margin-bottom: 16px; }
    .summary { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .sum-box { border: 1px solid #ddd; border-radius: 6px; padding: 6px 12px; text-align: center; min-width: 64px; }
    .sum-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.1px; color: #888; }
    .sum-val { font-size: 18px; font-weight: 900; color: #000; }
    table.roster { width: 100%; border-collapse: collapse; }
    table.roster thead { display: table-header-group; } /* repeats on every printed page */
    table.roster th {
      font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;
      color: #fff; background: #0e253a; text-align: left; padding: 5px 7px; white-space: nowrap;
    }
    table.roster th.num, table.roster td.num { text-align: center; }
    table.roster td { padding: 5px 7px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 11px; }
    table.roster tr:nth-child(even) td { background: #fafafa; }
    table.roster tr { page-break-inside: avoid; break-inside: avoid; }
    td.name { font-weight: 800; color: #000; white-space: nowrap; }
    td.rate { white-space: nowrap; }
    td.notes { font-style: italic; color: #555; }
    .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    @page { margin: 14mm 16mm; }
    @media print { body { padding: 14px 18px; } }
  </style>
</head>
<body>
  <div class="report-title">Baserunner Scouting Report</div>
  <div class="team-name">${team.name}</div>
  <div class="meta">${obs.length} runner${obs.length !== 1 ? 's' : ''} · Printed ${new Date().toLocaleDateString()}</div>
  <hr/>
  <div class="summary">${summaryHtml}</div>
  <table class="roster">
    <thead>
      <tr>
        <th class="num">#</th><th>Name</th><th>Pos</th><th>Bats</th>
        <th>Speed</th><th>Aggression</th><th>Lead (1B)</th>
        <th class="num">SB</th><th class="num">PO Att</th><th class="num">Dirt Adv</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 820, background: C.base, borderRadius: 12, border: `1px solid ${C.edge}`, overflow: 'hidden' }}>

        {/* Modal header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderBottom: `1px solid ${C.edge}`, background: C.surface }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, fontFamily: FONT, marginBottom: 2 }}>
              Baserunner Report
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: FONT, letterSpacing: -0.3 }}>{team.name}</div>
          </div>
          <button
            onClick={handlePrint}
            disabled={loading || obs.length === 0}
            style={{
              background: C.gold, color: '#000', border: 'none', borderRadius: 6,
              padding: '8px 18px', fontSize: 12, fontWeight: 800, cursor: loading || obs.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: FONT, letterSpacing: 0.3, opacity: loading || obs.length === 0 ? 0.5 : 1,
            }}
          >
            🖨 Print
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: `1px solid ${C.edge}`, borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.muted, cursor: 'pointer', fontFamily: FONT }}
          >
            Close
          </button>
        </div>

        {/* Printable content */}
        <div ref={printRef} id="baserunner-report-print" style={{ padding: '24px 24px 40px' }}>

          {/* Print-only header */}
          <div className="print-only" style={{ display: 'none', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Baserunner Scouting Report</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#000', marginBottom: 2 }}>{team.name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{obs.length} runner{obs.length !== 1 ? 's' : ''} · Printed {new Date().toLocaleDateString()}</div>
            <hr style={{ marginTop: 16, border: 'none', borderTop: '2px solid #000' }} />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 24, height: 24, border: `3px solid ${C.faint}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : obs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontFamily: FONT, fontSize: 14 }}>
              No baserunner observations found for {team.name}.
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Runners', value: obs.length },
                  { label: 'SB Att',  value: obs.reduce((a, o) => a + (o.steal_attempts || 0), 0) },
                  { label: 'SB Suc',  value: obs.reduce((a, o) => a + (o.steals_successful || 0), 0) },
                  { label: 'Fast',    value: obs.filter(o => o.speed_rating === 'fast').length },
                  { label: 'Aggressive', value: obs.filter(o => o.aggression_rating === 'aggressive').length },
                ].map(s => (
                  <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 7, padding: '8px 14px', textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted, fontFamily: FONT }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: C.white, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Runner cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
                {obs.map((o, i) => <RunnerCard key={i} obs={o} />)}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}