import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

  // Cast firm to include new fields
  const f = firm as typeof firm & {
    phone?: string | null
    email?: string | null
    website?: string | null
    address_line1?: string | null
    address_line2?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    bd_number?: string | null
    crd_number?: string | null
    notes?: string | null
    founded_year?: number | null
    secondary_color?: string | null
  };

  // New field states
  const [phone, setPhone] = useState(f.phone || "");
  const [email, setEmail] = useState(f.email || "");
  const [website, setWebsite] = useState(f.website || "");
  const [addressLine1, setAddressLine1] = useState(f.address_line1 || "");
  const [addressLine2, setAddressLine2] = useState(f.address_line2 || "");
  const [city, setCity] = useState(f.city || "");
  const [state, setState] = useState(f.state || "");
  const [zip, setZip] = useState(f.zip || "");
  const [bdNumber, setBdNumber] = useState(f.bd_number || "");
  const [crdNumber, setCrdNumber] = useState(f.crd_number || "");
  const [notes, setNotes] = useState(f.notes || "");
  const [foundedYear, setFoundedYear] = useState(f.founded_year ? String(f.founded_year) : "");
  const [secondaryColor, setSecondaryColor] = useState(f.secondary_color || "");

  // Re-sync state if firm prop changes
  useEffect(() => {
    setName(firm.name);
    setAccentColor(firm.accent_color || "#1B3A6B");
    setAllowBookSharing(firm.allow_book_sharing);
    setLogoFile(null);
    setLogoPreview(firm.logo_url);
    setLogoClearedExisting(false);
    // Reset new fields
    setPhone(f.phone || "");
    setEmail(f.email || "");
    setWebsite(f.website || "");
    setAddressLine1(f.address_line1 || "");
    setAddressLine2(f.address_line2 || "");
    setCity(f.city || "");
    setState(f.state || "");
    setZip(f.zip || "");
    setBdNumber(f.bd_number || "");
    setCrdNumber(f.crd_number || "");
    setNotes(f.notes || "");
    setFoundedYear(f.founded_year ? String(f.founded_year) : "");
    setSecondaryColor(f.secondary_color || "");
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
          secondary_color: secondaryColor.trim() || null,
          allow_book_sharing: allowBookSharing,
          logo_url: logoUrl,
          phone: phone.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          address_line1: addressLine1.trim() || null,
          address_line2: addressLine2.trim() || null,
          city: city.trim() || null,
          state: state.trim().toUpperCase() || null,
          zip: zip.trim() || null,
          bd_number: bdNumber.trim() || null,
          crd_number: crdNumber.trim() || null,
          notes: notes.trim() || null,
          founded_year: foundedYear ? parseInt(foundedYear) : null,
        })
        .eq("id", firm.id);

      if (error) throw error;

      toast({ title: "Firm updated" });
      queryClient.invalidateQueries({ queryKey: ["firms_with_counts"] });
      queryClient.invalidateQueries({ queryKey: ["firm", firm.id] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error updating firm", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Firm</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[80vh] overflow-y-auto">
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
              <div className="relative shrink-0">
                <div
                  className="w-9 h-9 rounded-md border border-border cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1 transition-all"
                  style={{ backgroundColor: validHex ? accentColor : "#1B3A6B" }}
                  onClick={() => document.getElementById("accent-color-picker")?.click()}
                />
                <input
                  id="accent-color-picker"
                  type="color"
                  value={validHex ? accentColor : "#1B3A6B"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-secondary-color">Secondary color</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Used for subtle page accents and highlights
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="edit-secondary-color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#C9A96E (optional)"
                className="font-mono"
              />
              <div className="relative shrink-0">
                <div
                  className="w-9 h-9 rounded-md border border-border cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1 transition-all"
                  style={{ backgroundColor: secondaryColor || "#265442" }}
                  onClick={() => document.getElementById("secondary-color-picker")?.click()}
                />
                <input
                  id="secondary-color-picker"
                  type="color"
                  value={secondaryColor || "#265442"}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="edit-book-sharing" className="font-medium">Allow book sharing</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Advisors can share households across the firm.</p>
            </div>
            <Switch id="edit-book-sharing" checked={allowBookSharing} onCheckedChange={setAllowBookSharing} />
          </div>

          {/* Contact Information */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">Contact Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@firm.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.firm.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address-line1">Address Line 1</Label>
            <Input
              id="edit-address-line1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="123 Main Street"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address-line2">Address Line 2</Label>
            <Input
              id="edit-address-line2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Suite 100"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-city">City</Label>
              <Input
                id="edit-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="New York"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-state">State</Label>
              <Input
                id="edit-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="NY"
                maxLength={2}
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-zip">ZIP</Label>
              <Input
                id="edit-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="10001"
              />
            </div>
          </div>

          {/* Regulatory Information */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">Regulatory Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-bd-number">BD Number</Label>
                <Input
                  id="edit-bd-number"
                  value={bdNumber}
                  onChange={(e) => setBdNumber(e.target.value)}
                  placeholder="LPL-XXXXX"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-crd-number">CRD Number</Label>
                <Input
                  id="edit-crd-number"
                  value={crdNumber}
                  onChange={(e) => setCrdNumber(e.target.value)}
                  placeholder="XXXXXXX"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-founded-year">Founded Year</Label>
            <Input
              id="edit-founded-year"
              type="number"
              value={foundedYear}
              onChange={(e) => setFoundedYear(e.target.value)}
              placeholder="2010"
              min="1900"
              max={new Date().getFullYear()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this firm..."
              rows={3}
            />
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
