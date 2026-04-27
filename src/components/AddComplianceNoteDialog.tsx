import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateComplianceNote, useHouseholdMembers } from "@/hooks/useHouseholds";
import { Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";

const NOTE_CATEGORIES = [
  "Annual Review",
  "Phone Call",
  "Email",
  "Prospecting",
  "Compliance",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  /** When provided, this contact is auto-selected and cannot be deselected. */
  contactId?: string;
}

export default function AddComplianceNoteDialog({ open, onOpenChange, householdId, contactId }: Props) {
  const { data: members = [] } = useHouseholdMembers(householdId);
  const createNote = useCreateComplianceNote();

  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setCategory("");
      setContent("");
      setSelectedIds(contactId ? [contactId] : []);
    }
  }, [open, contactId]);

  const memberMap = useMemo(() => {
    const m: Record<string, { first_name: string; last_name: string }> = {};
    members.forEach((mem) => {
      m[mem.id] = { first_name: mem.first_name, last_name: mem.last_name };
    });
    return m;
  }, [members]);

  const availableToAdd = useMemo(
    () => members.filter((m) => !selectedIds.includes(m.id)),
    [members, selectedIds]
  );

  const toggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      if (id === contactId) return; // locked
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const addContact = (id: string) => {
    if (!id) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const canSubmit =
    !!category &&
    content.trim().length > 0 &&
    selectedIds.length > 0 &&
    !createNote.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createNote.mutate(
      {
        householdId,
        type: category,
        summary: content.trim(),
        contactIds: selectedIds,
      },
      {
        onSuccess: () => {
          toast.success("Compliance note added.");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to add note."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Compliance Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Tagged contacts */}
          <div className="space-y-2">
            <Label>
              Tagged Contacts <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Notes are logged on contacts and roll up to the household. Select at least one.
            </p>

            {/* Selected contact badges */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedIds.map((id) => {
                  const m = memberMap[id];
                  if (!m) return null;
                  const locked = id === contactId;
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="text-sm py-1 pl-2.5 pr-1.5 gap-1.5"
                    >
                      {m.first_name} {m.last_name}
                      {locked ? (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSelect(id, false)}
                          className="rounded-full hover:bg-background/60 p-0.5"
                          aria-label="Remove contact"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Household member checklist */}
            {members.length > 0 ? (
              <div className="rounded-md border border-border bg-card divide-y divide-border">
                {members.map((m) => {
                  const checked = selectedIds.includes(m.id);
                  const locked = m.id === contactId;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm ${
                        locked ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:bg-secondary/40"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={locked}
                        onCheckedChange={(v) => toggleSelect(m.id, !!v)}
                      />
                      <span className="text-foreground">
                        {m.first_name} {m.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{m.relationship}</span>
                      {locked && <Lock className="w-3 h-3 text-muted-foreground ml-auto" />}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-destructive">
                No household members yet — add a contact before logging notes.
              </p>
            )}

            {/* + Add Another Contact (mirrors QuickLogNoteDialog) */}
            {availableToAdd.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Select
                  value=""
                  onValueChange={(v) => addContact(v)}
                >
                  <SelectTrigger className="h-8 w-auto text-xs gap-1.5 border-dashed">
                    <Plus className="w-3.5 h-3.5" />
                    <SelectValue placeholder="Add Another Contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Note Type</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {NOTE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              placeholder="Enter note details..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[140px]"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit}>
              {createNote.isPending ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
