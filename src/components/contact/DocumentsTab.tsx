import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Download, Trash2, Upload, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const DOCUMENT_CATEGORIES: Record<string, string[]> = {
  "Financial & Tax": [
    "Tax Returns (1040, W-2)",
    "Bank Statements",
    "Pay Stubs",
    "Investment / Brokerage Statements",
    "Retirement Account Statements (401k, IRA)",
    "Social Security Benefit Statement (SSA-1099)",
    "RMD Notices",
  ],
  "Estate & Legal": [
    "Will / Testament",
    "Trust Documents",
    "Power of Attorney (POA)",
    "Healthcare Directive / Living Will",
    "Beneficiary Designations",
  ],
  "Insurance": [
    "Life Insurance Policy",
    "Long-Term Care Insurance",
    "Annuity Contracts",
  ],
  "Account Opening & Compliance": [
    "New Account Forms",
    "Transfer / ACAT Forms",
    "Signed Agreements / Contracts",
    "KYC / AML Documents",
    "Suitability Questionnaire",
  ],
  "Planning Documents": [
    "Financial Plan",
    "Investment Policy Statement (IPS)",
    "Proposal Documents",
    "Risk Tolerance Questionnaire",
    "Retirement Income Plan",
    "Social Security Optimization Report",
    "Meeting Summaries / Reports",
  ],
  "Employer Benefits": [
    "401k Plan Documents",
    "Pension Statements",
    "Stock Option Agreements",
    "ESOP Documents",
    "Employee Benefits Summary",
  ],
  "Real Estate": [
    "Mortgage Statements",
    "Property Deeds",
    "HELOC Agreements",
  ],
};

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.docx";

interface ContactDocument {
  id: string;
  contact_id: string;
  household_id: string;
  category: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

interface Props {
  contactId: string;
  householdId: string;
}

export default function DocumentsTab({ contactId, householdId }: Props) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery<ContactDocument[]>({
    queryKey: ["contact_documents", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_documents" as any)
        .select("*")
        .eq("contact_id", contactId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const grouped = useMemo(() => {
    const map: Record<string, ContactDocument[]> = {};
    for (const cat of Object.keys(DOCUMENT_CATEGORIES)) map[cat] = [];
    for (const d of documents) {
      if (!map[d.category]) map[d.category] = [];
      map[d.category].push(d);
    }
    return map;
  }, [documents]);

  const handleDownload = async (doc: ContactDocument) => {
    const { data, error } = await supabase.storage
      .from("contact-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) throw new Error("Document not found");
      const { error: storageErr } = await supabase.storage
        .from("contact-documents")
        .remove([doc.file_path]);
      if (storageErr) throw storageErr;
      const { error } = await supabase
        .from("contact_documents" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["contact_documents", contactId] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </p>
          <p className="text-xs text-muted-foreground">Organized by category</p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Document
        </Button>
      </div>

      {isLoading ? (
        <Card className="border-border shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading documents…
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.keys(DOCUMENT_CATEGORIES).map((category) => {
            const docs = grouped[category] ?? [];
            return (
              <CategorySection
                key={category}
                category={category}
                documents={docs}
                onDownload={handleDownload}
                onDelete={(id) => setDeleteId(id)}
              />
            );
          })}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contactId={contactId}
        householdId={householdId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteDoc.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategorySection({
  category,
  documents,
  onDownload,
  onDelete,
}: {
  category: string;
  documents: ContactDocument[];
  onDownload: (d: ContactDocument) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(documents.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border shadow-none">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2.5">
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  !open && "-rotate-90"
                )}
              />
              <span className="text-sm font-medium text-foreground">{category}</span>
              <Badge variant="secondary" className="text-[10px] h-5">
                {documents.length}
              </Badge>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No documents uploaded
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{d.file_name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{d.document_type}</span>
                        <span>•</span>
                        <span>{new Date(d.uploaded_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{formatBytes(d.file_size)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownload(d)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(d.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  contactId,
  householdId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string;
  householdId: string;
}) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setCategory("");
    setDocType("");
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!category || !docType || !file) {
      toast.error("Please complete all fields");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${householdId}/${contactId}/${category}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("contact-documents")
        .upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from("contact_documents" as any)
        .insert({
          contact_id: contactId,
          household_id: householdId,
          category,
          document_type: docType,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          uploaded_by: userData.user.id,
        });
      if (insErr) throw insErr;

      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["contact_documents", contactId] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Select a category and document type, then choose a file (PDF, JPG, PNG, DOCX).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setDocType("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(DOCUMENT_CATEGORIES).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType} disabled={!category}>
              <SelectTrigger>
                <SelectValue placeholder={category ? "Select type" : "Select a category first"} />
              </SelectTrigger>
              <SelectContent>
                {(DOCUMENT_CATEGORIES[category] ?? []).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>File</Label>
            <Input
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} • {formatBytes(file.size)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={uploading || !category || !docType || !file}>
            {uploading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
