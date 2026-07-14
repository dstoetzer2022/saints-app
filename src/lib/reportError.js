import toast from 'react-hot-toast';

// Central error surface (Phase 2.4). Replaces silent `.catch(() => {})`
// swallowing: users get a toast, developers get a console.warn with context.
// Keep messages short — this shows on phones in the dugout.
export default function reportError(err, context = 'Something went wrong') {
  console.warn(`[saints] ${context}:`, err);
  try {
    toast.error(context, { id: context }); // id dedupes repeat failures (e.g. polling)
  } catch {
    /* toaster not mounted (print views, tests) — console.warn already fired */
  }
}
