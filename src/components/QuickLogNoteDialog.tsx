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
import { Search, X, Plus } from "lucide-react";
import { toast } from "sonner";

const NOTE_TYPES = ["Annual Review", "Phone Call", "Email", "Prospecting", "Compliance"];

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  household_id: string | null;
};

type SelectedContact = { id: string; name: string; householdId: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContactId?: string;
  defaultContactName?: string;
}

interface ContactRowSelectorProps {
  contacts: ContactRow[];
  excludeIds: string[];
  selected: SelectedContact | null;
  onSelect: (c: SelectedContact | null) => void;
  onRemove?: () => void;
  canRemove: boolean;
  locked?: boolean;
}

function ContactRowSelector({
  contacts, excludeIds, selected, onSelect, onRemove, canRemove, locked,
}: ContactRowSelectorProps) {
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return contacts
      .filter((c) => !excludeIds.includes(c.id))
      .filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, contacts, excludeIds]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="flex items-start gap-2" ref={wrapRef}>
      <div className="flex-1">
        {selected ? (
          <Badge variant="secondary" className="text-sm py-1.5 pl-3 pr-1.5 gap-1.5">
            {selected.name}
            {!locked && (
              <button
                type="button"
                onClick={() => onSelect(null)}
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
                      onSelect({
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
          <p className="text-xs text-destructive mt-1">
            This contact is not linked to a household.
          </p>
        )}
      </div>
      {canRemove && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRemove}
          aria-label="Remove contact"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
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

  const preSelected = useMemo<SelectedContact | null>(() => {
    if (!defaultContactId) return null;
    const c = contacts.find((x) => x.id === defaultContactId);
    const name =
      defaultContactName ?? (c ? `${c.first_name} ${c.last_name}` : "Selected contact");
    const householdId = c?.household_id ?? null;
    return { id: defaultContactId, name, householdId };
  }, [defaultContactId, defaultContactName, contacts]);

  const [rows, setRows] = useState<(SelectedContact | null)[]>([preSelected]);
  const [type, setType] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (open) {
      setRows([preSelected]);
      setType("");
      setSummary("");
    }
  }, [open, preSelected]);

  const selectedIds = rows.filter((r): r is SelectedContact => !!r).map((r) => r.id);
  const firstSelected = rows.find((r): r is SelectedContact => !!r) || null;
  const householdId = firstSelected?.householdId ?? null;

  const canSubmit =
    selectedIds.length > 0 &&
    !!householdId &&
    !!type &&
    summary.trim().length >= 10 &&
    !createNote.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !householdId) return;

    createNote.mutate(
      { householdId, contactIds: selectedIds, type, summary: summary.trim() },
      {
        onSuccess: () => {
          toast.success(`Note logged for ${selectedIds.length} contact${selectedIds.length > 1 ? "s" : ""}.`);
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to save note."),
      }
    );
  };

  const isLocked = !!defaultContactId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Contacts</Label>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <ContactRowSelector
                  key={idx}
                  contacts={contacts}
                  excludeIds={selectedIds.filter((id) => id !== row?.id)}
                  selected={row}
                  onSelect={(c) => {
                    setRows((prev) => prev.map((r, i) => (i === idx ? c : r)));
                  }}
                  onRemove={() => {
                    setRows((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  canRemove={rows.length > 1 && !(isLocked && idx === 0)}
                  locked={isLocked && idx === 0}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setRows((prev) => [...prev, null])}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Another Contact
            </Button>
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
