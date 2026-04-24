import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateComplianceNote, useTargetAdvisorId } from "@/hooks/useHouseholds";
import { supabase } from "@/integrations/supabase/client";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

const NOTE_TYPES = ["Annual Review", "Phone Call", "Email", "Prospecting", "Compliance"];

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  household_id: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContactId?: string;
  defaultContactName?: string;
}

export default function QuickLogNoteDialog({ open, onOpenChange, defaultContactId, defaultContactName }: Props) {
  const { userId, advisorId } = useTargetAdvisorId();

  const { data: contacts = [] } = useQuery({
    queryKey: ["quick_log_contacts", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("id, first_name, last_name, household_id")
        .eq("advisor_id", advisorId!)
        .is("archived_at", null)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContactRow[];
    },
    enabled: !!userId && !!advisorId,
  });

  const createNote = useCreateComplianceNote();

  const preSelected = useMemo(() => {
    if (!defaultContactId) return null;
    const c = contacts.find((x) => x.id === defaultContactId);
    const name =
      defaultContactName ??
      (c ? `${c.first_name} ${c.last_name}` : "Selected contact");
    const householdId = c?.household_id ?? null;
    return { id: defaultContactId, name, householdId };
  }, [defaultContactId, defaultContactName, contacts]);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string; householdId: string | null } | null>(preSelected);
  const [showResults, setShowResults] = useState(false);
  const [type, setType] = useState("");
  const [summary, setSummary] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync pre-selection when the dialog opens with new props
  useEffect(() => {
    if (open) {
      setSelected(preSelected);
      setSearch("");
      setShowResults(false);
    }
  }, [open, preSelected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return contacts
      .filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, contacts]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const reset = () => {
    setSearch("");
    setSelected(preSelected);
    setShowResults(false);
    setType("");
    setSummary("");
  };

  const canSubmit =
    !!selected && !!selected.householdId && !!type && summary.trim().length >= 10 && !createNote.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selected || !selected.householdId) return;

    createNote.mutate(
      { householdId: selected.householdId, contactId: selected.id, type, summary: summary.trim() },
      {
        onSuccess: () => {
          toast.success(`Note logged for ${selected.name}.`);
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to save note."),
      }
    );
  };

  const isLocked = !!defaultContactId;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2" ref={wrapRef}>
            <Label>Contact</Label>
            {selected ? (
              <Badge variant="secondary" className="text-sm py-1.5 pl-3 pr-1.5 gap-1.5">
                {selected.name}
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setSearch("");
                    }}
                    className="rounded-full hover:bg-background/60 p-0.5"
                    aria-label="Clear selection"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  className="pl-8"
                />
                {showResults && filtered.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-auto">
                    {filtered.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelected({
                            id: c.id,
                            name: `${c.first_name} ${c.last_name}`,
                            householdId: c.household_id,
                          });
                          setShowResults(false);
                          setSearch("");
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 transition-colors"
                      >
                        {c.first_name} {c.last_name}
                      </button>
                    ))}
                  </div>
                )}
                {showResults && search.trim() && filtered.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md p-3 text-sm text-muted-foreground">
                    No contacts found.
                  </div>
                )}
              </div>
            )}
            {selected && !selected.householdId && (
              <p className="text-xs text-destructive">
                This contact is not linked to a household and cannot have a note logged.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Summary</Label>
            <Textarea
              placeholder="Enter note details (min 10 characters)..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createNote.isPending ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
