// ── fetchAll: shared pagination helper ────────────────────────────────────────
// Every previous "fetch all" in the app was a single capped call (300/500/1000/
// 2000) that silently truncated as the season grew. This helper loops pages
// until a short page, deduping by id.
//
// DEFENSIVE DESIGN: the Base44 SDK's filter/list signature is
// (query, sort, limit[, skip]) / (sort, limit[, skip]). If a given SDK version
// ignores the skip argument, the second page returns the same rows as the
// first — the no-new-ids guard below detects that and stops, so worst case
// behaves exactly like the old single-page fetch (never an infinite loop,
// never a regression).

const PAGE = 500;

async function drain(fetchPage, { max = 20000, delayMs = 120 } = {}) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seen = new Set();
  const out = [];
  let skip = 0;
  for (;;) {
    let page = [];
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try { page = (await fetchPage(PAGE, skip)) || []; ok = true; }
      catch (err) {
        if (attempt === 2) {
          console.warn(`fetchAll: page at skip=${skip} failed after 3 attempts, stopping early`, err);
        } else {
          await sleep(300 * (attempt + 1)); // backoff before retry
        }
      }
    }
    if (!ok) break; // partial result beats a crash; callers already tolerate []
    let added = 0;
    for (const r of page) {
      if (!r || seen.has(r.id)) continue;
      seen.add(r.id); out.push(r); added++;
    }
    // Stop on: short page (true end), no progress (skip unsupported), or cap.
    if (page.length < PAGE || added === 0 || out.length >= max) break;
    skip += page.length;
    if (delayMs) await sleep(delayMs);
  }
  return out;
}

// Fetch every row matching a filter query.
export function fetchAllFiltered(entity, query, sort = '-created_date', opts) {
  return drain((limit, skip) => entity.filter(query, sort, limit, skip), opts);
}

// Fetch every row of an entity (use max in opts to bound league-wide pulls).
export function fetchAllList(entity, sort = '-created_date', opts) {
  return drain((limit, skip) => entity.list(sort, limit, skip), opts);
}

// Delete every row matching a query, looping until empty. Replaces the old
// "delete the default first page" bug (partial deletes left duplicate rows).
// Per-record deletes only — never a bulk wipe primitive.
export async function deleteAllFiltered(entity, query, onProgress) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let total = 0, emptyRounds = 0;
  while (emptyRounds < 2) {
    const batch = await entity.filter(query, '-created_date', 100).catch(() => []);
    if (!batch.length) { emptyRounds++; await sleep(250); continue; }
    emptyRounds = 0;
    await Promise.all(batch.map(r => entity.delete(r.id).catch(() => {})));
    total += batch.length;
    if (onProgress) onProgress(total);
    await sleep(250);
  }
  return total;
}
