import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// 30 minutes in milliseconds
// Standard for financial services
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// Warning shown 2 minutes before timeout
const WARNING_BEFORE_MS = 2 * 60 * 1000;

interface UseIdleTimeoutOptions {
  onWarning: () => void;
  onTimeout: () => void;
  enabled: boolean;
}

export function useIdleTimeout({
  onWarning,
  onTimeout,
  enabled,
}: UseIdleTimeoutOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    lastActivityRef.current = Date.now();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      onWarning();
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set logout timer
    timeoutRef.current = setTimeout(async () => {
      onTimeout();
      await supabase.auth.signOut();
    }, IDLE_TIMEOUT_MS);
  }, [enabled, onWarning, onTimeout, clearTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Activity events that reset timer
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "focus",
    ];

    // Throttle resets to once per 30 seconds to avoid
    // excessive timer recreation
    let lastReset = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastReset > 30000) {
        lastReset = now;
        resetTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the timer
    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [enabled, resetTimer, clearTimers]);

  return { resetTimer };
}
