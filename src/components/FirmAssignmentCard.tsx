import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFirms } from "@/hooks/useFirms";
import { useToast } from "@/hooks/use-toast";

interface Props {
  advisorUserId: string;
}

function useAdvisorFirm(userId: string) {
  return useQuery({
    queryKey: ["advisor_firm", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("firm_memberships")
        .select("*, firms(*)")
        .eq("user_id", userId)
        .eq("role", "advisor")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export default function FirmAssignmentCard({ advisorUserId }: Props) {
  const { data: membership, isLoading } = useAdvisorFirm(advisorUserId);
  const { data: firms = [] } = useFirms();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [selectedFirmId, setSelectedFirmId] = useState<string>("");

  const assignFirm = useMutation({
    mutationFn: async (firmId: string) => {
      // Remove existing advisor membership(s) for this user, then insert new
      const { error: delErr } = await supabase
        .from("firm_memberships")
        .delete()
        .eq("user_id", advisorUserId)
        .eq("role", "advisor");
      if (delErr) throw delErr;

      const { error: insErr } = await supabase
        .from("firm_memberships")
        .insert({ user_id: advisorUserId, firm_id: firmId, role: "advisor" });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisor_firm", advisorUserId] });
      queryClient.invalidateQueries({ queryKey: ["firms_with_counts"] });
      queryClient.invalidateQueries({ queryKey: ["firm_memberships"] });
      setEditing(false);
      toast({ title: "Firm assignment updated" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!selectedFirmId) {
      toast({ title: "Please select a firm", variant: "destructive" });
      return;
    }
    assignFirm.mutate(selectedFirmId);
  };

  const startEdit = () => {
    setSelectedFirmId(membership?.firm_id ?? "");
    setEditing(true);
  };

  const currentFirm = membership?.firms;

  return (
    <Card className="border-border shadow-none">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Firm Assignment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-10 bg-secondary rounded animate-pulse" />
        ) : editing ? (
          <div className="flex items-end gap-3 max-w-md">
            <div className="flex-1 space-y-2">
              <Label>Firm</Label>
              <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a firm" />
                </SelectTrigger>
                <SelectContent>
                  {firms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={assignFirm.isPending}>
              {assignFirm.isPending ? "Saving..." : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={assignFirm.isPending}>
              Cancel
            </Button>
          </div>
        ) : currentFirm ? (
          <div className="flex items-center justify-between max-w-md">
            <div className="flex items-center gap-3">
              {currentFirm.accent_color && (
                <div
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: currentFirm.accent_color }}
                />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{currentFirm.name}</p>
                <p className="text-xs text-muted-foreground">Current firm</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={startEdit}>Change Firm</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between max-w-md">
            <p className="text-sm text-muted-foreground">No firm assigned</p>
            <Button size="sm" onClick={startEdit}>Assign</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
