import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldCheck, Users, HelpCircle, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CATEGORIES = [
  {
    id: "NIGO Resolution",
    label: "NIGO Resolution",
    description: "I have a rejected application and need help fixing the paperwork.",
    icon: FileText,
  },
  {
    id: "Compliance Review",
    label: "Compliance Review",
    description: "I need a marketing piece or client communication approved.",
    icon: ShieldCheck,
  },
  {
    id: "Account Opening Assist",
    label: "Account Opening Assist",
    description: "Help with a complex multi-owner or trust account setup.",
    icon: Users,
  },
  {
    id: "General Ops",
    label: "General Ops",
    description: "Questions about custodial transfers or ACATs.",
    icon: HelpCircle,
  },
] as const;

export interface AssistContext {
  householdName?: string;
  householdAum?: number;
  householdId?: string;
  accountType?: string;
  accountInstitution?: string;
  accountId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: AssistContext;
}

export default function RequestAssistanceDialog({ open, onOpenChange, context }: Props) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory("");
    setDescription("");
    setFiles([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped].slice(0, 5));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected].slice(0, 5));
    }
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !description.trim() || !user) return;
    setSubmitting(true);

    try {
      // Upload files
      const filePaths: string[] = [];
      for (const file of files) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("service-request-files")
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        filePaths.push(path);
      }

      // Insert request
      const { error } = await supabase.from("service_requests").insert({
        advisor_id: user.id,
        category,
        description: description.trim(),
        household_name: context?.householdName || null,
        household_aum: context?.householdAum || null,
        household_id: context?.householdId || null,
        account_type: context?.accountType || null,
        account_institution: context?.accountInstitution || null,
        account_id: context?.accountId || null,
        file_paths: filePaths,
      });
      if (error) throw error;

      // Try to notify back-office (best effort)
      try {
        await supabase.functions.invoke("route-service-request", {
          body: {
            category,
            description: description.trim(),
            advisor_email: user.email,
            advisor_name: user.user_metadata?.full_name || user.email,
            household_name: context?.householdName,
            household_aum: context?.householdAum,
            account_type: context?.accountType,
            account_institution: context?.accountInstitution,
          },
        });
      } catch {
        // Non-critical — request is still saved
      }

      toast.success("Request submitted! The GL back-office team will reach out shortly.");
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request GL Assistance</DialogTitle>
          <DialogDescription>Select a category and describe your request. Our back-office team typically responds within 2 hours.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Smart Context Badge */}
          {(context?.householdName || context?.accountType) && (
            <div className="rounded-lg bg-secondary/60 p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Auto-attached context</p>
              <div className="flex flex-wrap gap-1.5">
                {context.householdName && (
                  <Badge variant="secondary" className="text-xs">{context.householdName}</Badge>
                )}
                {context.householdAum != null && (
                  <Badge variant="secondary" className="text-xs">AUM: ${(context.householdAum / 1000000).toFixed(1)}M</Badge>
                )}
                {context.accountType && (
                  <Badge variant="secondary" className="text-xs">{context.accountType}</Badge>
                )}
                {context.accountInstitution && (
                  <Badge variant="secondary" className="text-xs">{context.accountInstitution}</Badge>
                )}
              </div>
            </div>
          )}

          {/* Category Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Category</Label>
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30 hover:bg-secondary/40"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>{cat.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Details</Label>
            <Textarea
              placeholder="Describe what you need help with..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[90px]"
              required
            />
          </div>

          {/* File Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Secure Upload (optional)</Label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-muted-foreground/40 transition-colors cursor-pointer"
              onClick={() => document.getElementById("assist-file-input")?.click()}
            >
              <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Drop files here or click to browse</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOC, images — max 5 files</p>
              <input
                id="assist-file-input"
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.xlsx,.csv"
                onChange={handleFileSelect}
              />
            </div>
            {files.length > 0 && (
              <div className="space-y-1 mt-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-secondary/60 rounded-md px-2.5 py-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-foreground">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!category || !description.trim() || submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting...</> : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
