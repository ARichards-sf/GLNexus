import { useAuth } from "@/contexts/AuthContext";

// Test/demo advisor account. The test-data banner, demo annotations, and
// any other "showcase only" UI keys off this id.
export const TEST_DATA_USER_ID = "2f069cbb-f634-4279-8946-123a33faa9c2";

export function useIsDemoUser(): boolean {
  const { user } = useAuth();
  return user?.id === TEST_DATA_USER_ID;
}

// localStorage keys the DemoTour uses to remember whether it's been seen
// or dismissed. Exported so the "Start Demo" login flow can clear them
// and force the tour to auto-open fresh on every demo sign-in.
export const TOUR_STORAGE_KEYS = {
  seen: "nexus_demo_tour_seen",
  dismissed: "nexus_demo_tour_dismissed",
} as const;

export function resetDemoTour(): void {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEYS.seen);
    localStorage.removeItem(TOUR_STORAGE_KEYS.dismissed);
  } catch {
    // ignore — localStorage may be unavailable
  }
}
