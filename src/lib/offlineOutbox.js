// ── Offline write outbox (Phase 4.2) ────────────────────────────────────────
// Backs the three scout panel autosave flows (Pitcher/Catcher/Runner) with an
// IndexedDB queue so a dropped connection mid-game doesn't silently lose
// whatever a scout just typed. Every save writes to IndexedDB FIRST — before
// attempting the network call — so even a browser crash or reload during a
// network drop can't lose the edit; it's picked back up and retried on the
// next flush.
//
// Design choices, deliberately narrow in scope:
//  - UPDATE-only. All three scout panels always write a full current-state
//    payload to an ALREADY-CREATED record (`obs.id` is known before any of
//    this runs) — never a create. Record creation (pitcher/hitter subs) is
//    infrequent, already has toast-based manual retry, and would need much
//    riskier temp-id reconciliation to queue offline — out of scope here.
//  - One row per record. Queue key is `${entity}:${recordId}`, so five rapid
//    edits to the same observation coalesce into one queued row holding only
//    the LATEST payload (safe, since these are full-state overwrites, not
//    increments) rather than growing an ever-larger backlog.
const DB_NAME = 'saints-offline-outbox';
const DB_VERSION = 1;
const STORE = 'pending-writes';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

// Persist (or overwrite) the pending payload for a record. `entityName` and
// `payload` are plain-serializable — payload is whatever the caller would
// otherwise pass straight to `entity.update(recordId, payload)`.
export async function outboxPut(key, entityName, recordId, payload) {
  try {
    await withStore('readwrite', store => store.put({ key, entityName, recordId, payload, queuedAt: Date.now() }));
    return true;
  } catch (err) {
    console.warn('[saints] outbox write failed (IndexedDB unavailable?):', err);
    return false;
  }
}

export async function outboxDelete(key) {
  try { await withStore('readwrite', store => store.delete(key)); } catch { /* best-effort */ }
}

export async function outboxGetAll() {
  try {
    return await withStore('readonly', store => new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  } catch {
    return [];
  }
}

export async function outboxCount() {
  try {
    return await withStore('readonly', store => new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    }));
  } catch {
    return 0;
  }
}

// ── Flush: replay every queued write against a live entity map ────────────
// `entityMap` is `{ EntityName: base44.entities.EntityName }` — kept as an
// explicit param (rather than importing base44 here) so this module has zero
// dependency on the SDK and stays trivially testable.
export async function flushOutbox(entityMap, onProgress) {
  const rows = await outboxGetAll();
  let succeeded = 0, failed = 0;
  for (const row of rows) {
    const entity = entityMap[row.entityName];
    if (!entity) { failed++; continue; } // unknown entity — leave queued, don't lose it
    try {
      await entity.update(row.recordId, row.payload);
      await outboxDelete(row.key);
      succeeded++;
    } catch {
      failed++; // network still down, or a real server error — stays queued either way
    }
    if (onProgress) onProgress({ succeeded, failed, total: rows.length });
  }
  return { succeeded, failed, total: rows.length };
}
