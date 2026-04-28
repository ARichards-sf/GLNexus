import { useAuth } from "@/contexts/AuthContext";

// Test/demo advisor account. The test-data banner, demo annotations, and
// any other "showcase only" UI keys off this id.
export const TEST_DATA_USER_ID = "2f069cbb-f634-4279-8946-123a33faa9c2";

export function useIsDemoUser(): boolean {
  const { user } = useAuth();
  return user?.id === TEST_DATA_USER_ID;
}
