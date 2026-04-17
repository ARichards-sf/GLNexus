import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateFirm } from "@/hooks/useFirms";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export default function CreateFirmDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState("#1B3A6B");
  const [allowBookSharing, setAllowBookSharing] = useState(false);
  const createFirm = useCreateFirm();
  const { toast } = useToast();

  const validHex = HEX_RE.test(accentColor);

  const reset = () => {
    setName("");
    setAccentColor("#1B3A6B");
    setAllowBookSharing(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Firm name is required", variant: "destructive" });
      return;
    }
    if (accentColor && !validHex) {
      toast({ title: "Invalid hex color", description: "Use format #RRGGBB", variant: "destructive" });
      return;
    }
    try {
      await createFirm.mutateAsync({
        name: name.trim(),
        accent_color: accentColor || null,
        allow_book_sharing: allowBookSharing,
      });
      toast({ title: "Firm created" });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error creating firm", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Firm</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="firm-name">Firm name *</Label>
            <Input
              id="firm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Good Life Companies"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accent-color">Accent color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="accent-color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#1B3A6B"
                className="font-mono"
              />
              <div
                className="w-9 h-9 rounded-md border border-border shrink-0"
                style={{ backgroundColor: validHex ? accentColor : "transparent" }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="book-sharing" className="font-medium">Allow book sharing</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Advisors can share households across the firm.</p>
            </div>
            <Switch id="book-sharing" checked={allowBookSharing} onCheckedChange={setAllowBookSharing} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={createFirm.isPending}>
            {createFirm.isPending ? "Creating..." : "Create Firm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
