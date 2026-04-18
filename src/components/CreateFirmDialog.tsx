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
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export default function CreateFirmDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState("#1B3A6B");
  const [allowBookSharing, setAllowBookSharing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const createFirm = useCreateFirm();
  const { toast } = useToast();

  const validHex = HEX_RE.test(accentColor);

  const reset = () => {
    setName("");
    setAccentColor("#1B3A6B");
    setAllowBookSharing(false);
    setLogoFile(null);
    setLogoPreview(null);
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

    let logoUrl: string | null = null;

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
    }

    try {
      await createFirm.mutateAsync({
        name: name.trim(),
        accent_color: accentColor || null,
        allow_book_sharing: allowBookSharing,
        logo_url: logoUrl,
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
                    setLogoFile(null);
                    setLogoPreview(null);
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
                  document.getElementById("logo-upload")?.click()
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
              id="logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLogoFile(file);
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setLogoPreview(ev.target?.result as string);
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>

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
          <Button onClick={handleSave} disabled={createFirm.isPending || uploadingLogo}>
            {uploadingLogo
              ? "Uploading logo..."
              : createFirm.isPending
                ? "Creating..."
                : "Create Firm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
