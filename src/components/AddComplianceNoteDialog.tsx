import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateComplianceNote } from "@/hooks/useHouseholds";
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
  contactId?: string;
}

export default function AddComplianceNoteDialog({ open, onOpenChange, householdId, contactId }: Props) {
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const createNote = useCreateComplianceNote();

  const reset = () => {
    setCategory("");
    setContent("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !content.trim()) return;

    createNote.mutate(
      { householdId, type: category, summary: content.trim(), contactId },
      {
        onSuccess: () => {
          toast.success("Compliance note added.");
          reset();
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
            <Button type="submit" disabled={createNote.isPending}>
              {createNote.isPending ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
