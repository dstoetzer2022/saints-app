import { useState, useRef, useEffect } from 'react';

export default function useAutosave(delay = 800) {
  const [status, setStatus] = useState('');
  const timerRef = useRef(null);
  const pendingFnRef = useRef(null);

  // On unmount: cancel timer and immediately run any pending save
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    if (pendingFnRef.current) {
      pendingFnRef.current().catch(() => {});
      pendingFnRef.current = null;
    }
  }, []);

  function schedule(fn) {
    pendingFnRef.current = fn;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      pendingFnRef.current = null;
      setStatus('saving');
      try { await fn(); } catch (e) { /* silent */ }
      setStatus('saved');
      setTimeout(() => setStatus(''), 2000);
    }, delay);
  }

  return { schedule, status };
}