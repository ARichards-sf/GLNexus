import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Firm } from "@/hooks/useFirms";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firm: Firm;
}

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export default function EditFirmDialog({ open, onOpenChange, firm }: Props) {
  const [name, setName] = useState(firm.name);
  const [accentColor, setAccentColor] = useState(firm.accent_color || "#1B3A6B");
  const [allowBookSharing, setAllowBookSharing] = useState(firm.allow_book_sharing);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(firm.logo_url);
  const [logoClearedExisting, setLogoClearedExisting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Re-sync state if firm prop changes
  useEffect(() => {
    setName(firm.name);
    setAccentColor(firm.accent_color || "#1B3A6B");
    setAllowBookSharing(firm.allow_book_sharing);
    setLogoFile(null);
    setLogoPreview(firm.logo_url);
    setLogoClearedExisting(false);
  }, [firm]);

  const validHex = HEX_RE.test(accentColor);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Firm name is required", variant: "destructive" });
      return;
    }
    if (accentColor && !validHex) {
      toast({ title: "Invalid hex color", description: "Use format #RRGGBB", variant: "destructive" });
      return;
    }

    let logoUrl: string | null = firm.logo_url;

    if (logoFile) {
      setUploadingLogo(true);
      try {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("firm-logos")
          .upload(fileName, logoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("firm-logos")
          .getPublicUrl(fileName);

        logoUrl = urlData.publicUrl;
      } catch (e: any) {
        toast({
          title: "Logo upload failed",
          description: e.message,
          variant: "destructive",
        });
        setUploadingLogo(false);
        return;
      }
      setUploadingLogo(false);
    } else if (logoClearedExisting) {
      logoUrl = null;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("firms")
        .update({
          name: name.trim(),
          accent_color: accentColor || null,
          allow_book_sharing: allowBookSharing,
          logo_url: logoUrl,
        })
        .eq("id", firm.id);

      if (error) throw error;

      toast({ title: "Firm updated" });
      queryClient.invalidateQueries({ queryKey: ["firms_with_counts"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error updating firm", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Firm</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Firm Logo</Label>
            {logoPreview ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-16 h-16 object-contain rounded bg-secondary/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (logoFile) {
                      // clearing newly-selected file
                      setLogoFile(null);
                      setLogoPreview(firm.logo_url);
                      setLogoClearedExisting(false);
                    } else {
                      // clearing existing logo
                      setLogoFile(null);
                      setLogoPreview(null);
                      setLogoClearedExisting(true);
                    }
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  document.getElementById("edit-logo-upload")?.click()
                }
                className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Click to upload logo
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG, SVG up to 2MB
                </span>
              </button>
            )}
            <input
              id="edit-logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLogoFile(file);
                setLogoClearedExisting(false);
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setLogoPreview(ev.target?.result as string);
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-firm-name">Firm name *</Label>
            <Input
              id="edit-firm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Good Life Companies"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-accent-color">Accent color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="edit-accent-color"
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
              <Label htmlFor="edit-book-sharing" className="font-medium">Allow book sharing</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Advisors can share households across the firm.</p>
            </div>
            <Switch id="edit-book-sharing" checked={allowBookSharing} onCheckedChange={setAllowBookSharing} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploadingLogo}>
            {uploadingLogo
              ? "Uploading logo..."
              : saving
                ? "Saving..."
                : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
