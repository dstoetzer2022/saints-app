import React from "react";

const POSITIONS = ["U", "C", "L", "A"];
const POSITION_INDICES = { U: 0, C: 1, L: 2, A: 3 };

export default function UCLAHoldSelector({ startPos, endPos, onChange }) {
  const handleClick = (pos) => {
    if (!startPos) {
      onChange(pos, pos);
    } else if (startPos === pos && endPos === pos) {
      onChange(null, null);
    } else {
      // Must be contiguous range
      const clickIdx = POSITION_INDICES[pos];
      const startIdx = POSITION_INDICES[startPos];
      
      if (Math.abs(clickIdx - startIdx) <= 2) {
        const minIdx = Math.min(clickIdx, startIdx);
        const maxIdx = Math.max(clickIdx, startIdx);
        // Ensure contiguous
        onChange(POSITIONS[minIdx], POSITIONS[maxIdx]);
      } else {
        onChange(pos, pos);
      }
    }
  };

  const isInRange = (pos) => {
    if (!startPos || !endPos) return false;
    const idx = POSITION_INDICES[pos];
    const sIdx = POSITION_INDICES[startPos];
    const eIdx = POSITION_INDICES[endPos];
    return idx >= Math.min(sIdx, eIdx) && idx <= Math.max(sIdx, eIdx);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">UCLA Hold Timing</label>
      <div className="flex items-center gap-1">
        {POSITIONS.map((pos, i) => (
          <React.Fragment key={pos}>
            <button
              type="button"
              onClick={() => handleClick(pos)}
              className={`
                w-10 h-10 rounded-lg font-heading font-bold text-sm transition-all
                ${isInRange(pos) 
                  ? "bg-accent text-accent-foreground shadow-md scale-105" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                }
              `}
            >
              {pos}
            </button>
            {i < POSITIONS.length - 1 && (
              <span className="text-muted-foreground/40 text-lg">·</span>
            )}
          </React.Fragment>
        ))}
      </div>
      {startPos && (
        <p className="text-xs text-muted-foreground">
          Selected: {startPos === endPos ? startPos : `${startPos} → ${endPos}`}
        </p>
      )}
    </div>
  );
}