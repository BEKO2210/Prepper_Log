import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal-Verhalten: schließt per Escape, sperrt das Hintergrund-Scrollen,
 * fängt den Tab-Fokus im Dialog und stellt den vorherigen Fokus wieder her.
 * Der zurückgegebene Ref muss am Container des Dialogs gesetzt werden.
 */
export function useModal<T extends HTMLElement = HTMLDivElement>(active: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Fokus in den Dialog setzen
    const node = ref.current;
    const firstFocusable = node?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? node)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return ref;
}
