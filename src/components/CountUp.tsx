import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animates a number from its previous value to `target` whenever `target` changes.
 * Skips the animation when the user prefers reduced motion. Inspired by the
 * react-bits CountUp effect, implemented dependency-free for this project.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  displayRef.current = display;

  useEffect(() => {
    const from = displayRef.current;
    if (prefersReducedMotion() || from === target) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}

export function CountUp({
  value,
  durationMs,
  decimals = 0,
  suffix = '',
  className,
}: {
  value: number;
  durationMs?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const current = useCountUp(value, durationMs);
  const text = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toString();
  return <span className={className}>{text}{suffix}</span>;
}
