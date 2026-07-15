import { useState, useRef, useEffect, useCallback } from 'react';
import { outboxPut, outboxDelete, flushOutbox, outboxCount } from '@/lib/offlineOutbox';

// ── Offline-aware autosave (Phase 4.2) ──────────────────────────────────────
// Drop-in replacement for useAutosave, extended with an IndexedDB outbox so
// stadium Wi-Fi drops during a live game don't silently lose whatever a
// scout just typed. Same debounce/schedule(fn) API as useAutosave, plus:
//  - every save writes to IndexedDB FIRST, before the network call, so a
//    reload/crash mid-drop can't lose the edit
//  - on network failure the write STAYS queued (status becomes 'offline')
//    instead of the old silent catch-and-drop
//  - flushes automatically on the browser's `online` event and on mount
//    (picks up anything left over from a prior session's crash/reload)
//
// `key` must be stable and unique per record (e.g. `PitcherObservation:${obs.id}`)
// so rapid repeated edits coalesce into one queued row. `entityMap` is
// `{ EntityName: base44.entities.EntityName }` for the flush step.
export default function useOfflineAutosave(key, entityName, recordId, entityMap, delay = 800) {
  const [status, setStatus] = useState(''); // '' | 'saving' | 'saved' | 'offline'
  const [pendingCount, setPendingCount] = useState(0);
  const timerRef = useRef(null);
  const pendingRef = useRef(null); // { payload, run: () => Promise }

  const refreshPendingCount = useCallback(() => {
    outboxCount().then(setPendingCount);
  }, []);

  // Flush leftovers from a prior session on mount, and whenever the browser
  // comes back online.
  useEffect(() => {
    let cancelled = false;
    const doFlush = () => {
      flushOutbox(entityMap).then(() => { if (!cancelled) refreshPendingCount(); });
    };
    doFlush();
    window.addEventListener('online', doFlush);
    return () => { cancelled = true; window.removeEventListener('online', doFlush); };
  }, [entityMap, refreshPendingCount]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    if (pendingRef.current) { pendingRef.current.run().catch(() => {}); pendingRef.current = null; }
  }, []);

  function schedule(payload, updateFn) {
    const run = async () => {
      // Queue first — this is the load-bearing line: the edit is durable on
      // disk before we ever touch the network.
      await outboxPut(key, entityName, recordId, payload);
      refreshPendingCount();
      setStatus('saving');
      try {
        await updateFn();
        await outboxDelete(key);
        refreshPendingCount();
        setStatus('saved');
        setTimeout(() => setStatus(''), 2000);
      } catch {
        // Stays queued in IndexedDB — will retry on the next `online` event
        // or the next successful save on this same key.
        setStatus('offline');
      }
    };
    pendingRef.current = { payload, run };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { pendingRef.current = null; run(); }, delay);
  }

  return { schedule, status, pendingCount };
}
