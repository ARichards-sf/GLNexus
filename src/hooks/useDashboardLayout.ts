import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_LAYOUT, type WidgetInstance } from "@/lib/dashboardWidgets";

export function useDashboardLayout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hydratedLayout, setHydratedLayout] = useState<WidgetInstance[] | null>(null);

  const { data: savedLayout, isLoading } = useQuery({
    queryKey: ["dashboard_layout", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("dashboard_layout")
        .eq("user_id", user!.id)
        .single();
      return (data?.dashboard_layout as unknown as WidgetInstance[] | null) ?? null;
    },
    enabled: !!user,
  });

  useEffect(() => {
    setHydratedLayout(savedLayout ?? null);
  }, [savedLayout]);

  const layout = hydratedLayout ?? savedLayout ?? DEFAULT_LAYOUT;

  const saveLayout = useMutation({
    mutationFn: async (newLayout: WidgetInstance[]) => {
      await supabase
        .from("profiles")
        .update({
          dashboard_layout: newLayout as any,
        })
        .eq("user_id", user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["dashboard_layout", user?.id],
      });
    },
  });

  const resetLayout = async () => {
    await saveLayout.mutateAsync(DEFAULT_LAYOUT);
  };

  return {
    layout,
    isLoading,
    saveLayout: saveLayout.mutateAsync,
    resetLayout,
    isSaving: saveLayout.isPending,
  };
}
