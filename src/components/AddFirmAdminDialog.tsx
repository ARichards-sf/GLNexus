import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, UserRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  firmId: string;
}

interface CandidateUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

function getInitials(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function AddFirmAdminDialog({ open, onOpenChange, firmId }: Props) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: availableUsers = [], isFetching } = useQuery({
    queryKey: ["available_admins", firmId, search],
    enabled: open && search.trim().length > 1,
    queryFn: async (): Promise<CandidateUser[]> => {
      // Get existing members to exclude
      const { data: existing } = await supabase
        .from("firm_memberships")
        .select("user_id")
        .eq("firm_id", firmId);

      const existingIds = (existing || []).map((e) => e.user_id);

      let query = supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_gl_internal", false)
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(8);

      if (existingIds.length > 0) {
        query = query.not("user_id", "in", `(${existingIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CandidateUser[];
    },
  });

  const addAdmin = useMutation({
    mutationFn: async (user: CandidateUser) => {
      const { error } = await supabase.from("firm_memberships").insert({
        firm_id: firmId,
        user_id: user.user_id,
        role: "advisor_admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Admin added to firm" });
      queryClient.invalidateQueries({ queryKey: ["firm_admins", firmId] });
      queryClient.invalidateQueries({ queryKey: ["firm_memberships"] });
      queryClient.invalidateQueries({ queryKey: ["available_admins", firmId] });
      setSearch("");
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSearch("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Firm Admin</DialogTitle>
          <DialogDescription>
            Search for an existing user to add as a firm administrator.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>

        <div className="min-h-[120px] max-h-[280px] overflow-y-auto -mx-6 px-2">
          {search.trim().length <= 1 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <UserRound className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                Type at least 2 characters to search
              </p>
            </div>
          ) : isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {availableUsers.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  disabled={addAdmin.isPending}
                  onClick={() => addAdmin.mutate(u)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                    {getInitials(u.full_name, u.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {u.full_name || u.email?.split("@")[0] || "User"}
                    </p>
                    {u.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
