import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirms } from "@/hooks/useFirms";
import { useAssignInternalUserFirms } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  currentFirmIds: string[];
}

export default function ManageStaffFirmsDialog({ open, onOpenChange, userId, currentFirmIds }: Props) {
  const { data: firms = [], isLoading } = useFirms();
  const assign = useAssignInternalUserFirms();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentFirmIds));

  useEffect(() => {
    if (open) setSelected(new Set(currentFirmIds));
  }, [open, currentFirmIds]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onSave = async () => {
    try {
      await assign.mutateAsync({ user_id: userId, firm_ids: Array.from(selected) });
      toast({ title: "Firm assignments updated" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Firm Assignments</DialogTitle>
          <DialogDescription>Select the firms this staff member is assigned to.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[360px] -mx-2 px-2">
          <div className="space-y-2 py-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading firms…</p>}
            {!isLoading && firms.length === 0 && (
              <p className="text-sm text-muted-foreground">No firms available.</p>
            )}
            {firms.map((firm) => (
              <label
                key={firm.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md border border-border hover:bg-secondary/50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(firm.id)}
                  onCheckedChange={() => toggle(firm.id)}
                />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {firm.accent_color && (
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: firm.accent_color }}
                    />
                  )}
                  <span className="text-sm font-medium text-foreground truncate">{firm.name}</span>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={assign.isPending}>
            {assign.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
