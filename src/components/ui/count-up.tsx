import { useEffect, useRef, useState } from "react";

/**
 * Smooth count-up from a previous value (default 0) to `target`. Used on
 * stat tiles to give them a subtle "alive" feel on first render and when
 * values change. Honors `prefers-reduced-motion` and skips for tiny deltas
 * (animating from 1499 → 1500 looks twitchy, just snap).
 */
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const targetRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delta = Math.abs(target - fromRef.current);
    // Skip the animation for trivial changes or when the user prefers
    // reduced motion — just snap to the new value.
    if (reduced || delta < 2) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const start = performance.now();
    const from = fromRef.current;
    targetRef.current = target;

    // ease-out-cubic: snappy at first, eases into the final value
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = ease(progress);
      const current = from + (targetRef.current - from) * eased;
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = targetRef.current;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

interface Props {
  value: number;
  /** Function to format the animated number (currency, integer, %, etc.). */
  format?: (n: number) => string;
  /**
   * For currency or other formats where intermediate decimals would look
   * jarring, set `integer` to round during animation. Default true.
   */
  integer?: boolean;
  durationMs?: number;
  className?: string;
}

/**
 * Animated numeric display. Wraps `useCountUp` and applies the formatter
 * on every frame so the rendered text reads as a smooth ramp.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  integer = true,
  durationMs,
  className,
}: Props) {
  const animated = useCountUp(value, durationMs);
  const display = integer ? Math.round(animated) : animated;
  return <span className={className}>{format(display)}</span>;
}
