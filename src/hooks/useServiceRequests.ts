import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export interface ServiceRequest {
  id: string;
  advisor_id: string;
  category: string;
  description: string;
  household_name: string | null;
  household_aum: number | null;
  household_id: string | null;
  account_type: string | null;
  account_institution: string | null;
  status: string;
  file_paths: string[];
  created_at: string;
  updated_at: string;
}

export function useMyServiceRequests() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const advisorId = user ? targetAdvisorId(user.id) : undefined;

  return useQuery({
    queryKey: ["service_requests", "mine", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("advisor_id", advisorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!advisorId,
  });
}

export function useAllServiceRequests() {
  return useQuery({
    queryKey: ["service_requests", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
  });
}
