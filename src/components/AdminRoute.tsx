import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useAdmin";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { canAccessAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="p-10">
        <div className="animate-pulse h-8 bg-secondary rounded w-48" />
      </div>
    );
  }

  if (!canAccessAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
