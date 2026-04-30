import { useEffect, useMemo, useState } from "react";
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

/**
 * Scope tells the upload UI where each document type can land. The dialog
 * filters the dropdown to types whose scope is "both" or matches the
 * advisor's currently-selected scope, so e.g. a Trust Document can never
 * be uploaded against a single contact.
 */
type DocScope = "contact" | "household" | "both";

interface DocType {
  name: string;
  scope: DocScope;
}

export const DOCUMENT_CATEGORIES: Record<string, DocType[]> = {
  "Financial & Tax": [
    // 1040 is joint, W-2 is individual — leave on both, advisor decides per upload
    { name: "Tax Returns (1040, W-2)", scope: "both" },
    { name: "Bank Statements", scope: "both" },
    { name: "Pay Stubs", scope: "contact" },
    { name: "Investment / Brokerage Statements", scope: "both" },
    { name: "Retirement Account Statements (401k, IRA)", scope: "both" },
    { name: "Social Security Benefit Statement (SSA-1099)", scope: "contact" },
    { name: "RMD Notices", scope: "contact" },
  ],
  "Estate & Legal": [
    { name: "Will / Testament", scope: "both" },
    { name: "Trust Documents", scope: "household" },
    { name: "Power of Attorney (POA)", scope: "both" },
    { name: "Healthcare Directive / Living Will", scope: "both" },
    { name: "Beneficiary Designations", scope: "both" },
  ],
  "Insurance": [
    { name: "Life Insurance Policy", scope: "both" },
    { name: "Long-Term Care Insurance", scope: "both" },
    { name: "Annuity Contracts", scope: "both" },
  ],
  "Account Opening & Compliance": [
    { name: "New Account Forms", scope: "both" },
    { name: "Transfer / ACAT Forms", scope: "both" },
    { name: "Signed Agreements / Contracts", scope: "both" },
    { name: "KYC / AML Documents", scope: "contact" },
    { name: "Suitability Questionnaire", scope: "contact" },
  ],
  "Planning Documents": [
    { name: "Financial Plan", scope: "household" },
    { name: "Investment Policy Statement (IPS)", scope: "household" },
    { name: "Proposal Documents", scope: "household" },
    { name: "Risk Tolerance Questionnaire", scope: "contact" },
    { name: "Retirement Income Plan", scope: "household" },
    { name: "Social Security Optimization Report", scope: "household" },
    { name: "Meeting Summaries / Reports", scope: "household" },
  ],
  "Employer Benefits": [
    { name: "401k Plan Documents", scope: "contact" },
    { name: "Pension Statements", scope: "contact" },
    { name: "Stock Option Agreements", scope: "contact" },
    { name: "ESOP Documents", scope: "contact" },
    { name: "Employee Benefits Summary", scope: "contact" },
  ],
  "Real Estate": [
    { name: "Mortgage Statements", scope: "household" },
    { name: "Property Deeds", scope: "household" },
    { name: "HELOC Agreements", scope: "household" },
  ],
};

/** Returns the document types in `category` valid for the given scope. */
function typesForScope(category: string, scope: "contact" | "household"): DocType[] {
  return (DOCUMENT_CATEGORIES[category] ?? []).filter(
    (t) => t.scope === "both" || t.scope === scope,
  );
}

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.docx";

interface ContactDocument {
  id: string;
  /** Null when the doc is household-scope (will, joint trust, family POA). */
  contact_id: string | null;
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
  /**
   * When set, the tab runs in **contact** scope: contact-owned docs are the
   * primary list, plus a read-only "From the household" subsection at the
   * bottom that surfaces any household-scope docs without duplicating them.
   * When unset, the tab runs in **household** scope: only household-level
   * docs (contact_id IS NULL) are shown.
   */
  contactId?: string;
  /** Always required — every doc belongs to a household. */
  householdId: string;
}

export default function DocumentsTab({ contactId, householdId }: Props) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isHouseholdScope = !contactId;

  // Primary list — contact-scope docs OR household-scope docs depending on mode.
  const { data: documents = [], isLoading } = useQuery<ContactDocument[]>({
    queryKey: isHouseholdScope
      ? ["household_documents", householdId]
      : ["contact_documents", contactId],
    queryFn: async () => {
      let query = supabase
        .from("contact_documents" as any)
        .select("*")
        .eq("household_id", householdId)
        .order("uploaded_at", { ascending: false });
      if (isHouseholdScope) {
        query = query.is("contact_id", null);
      } else {
        query = query.eq("contact_id", contactId!);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  // Sibling household-scope docs surfaced read-only on the contact tab so
  // the advisor sees the family will/trust without leaving the contact.
  const { data: householdDocs = [] } = useQuery<ContactDocument[]>({
    queryKey: ["household_documents", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_documents" as any)
        .select("*")
        .eq("household_id", householdId)
        .is("contact_id", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
    // Only needed in contact mode — household mode already shows these as
    // its primary list above.
    enabled: !isHouseholdScope,
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
      // Refresh both caches — a delete on either scope can affect the
      // other view's "From the household" subsection.
      qc.invalidateQueries({ queryKey: ["contact_documents", contactId] });
      qc.invalidateQueries({ queryKey: ["household_documents", householdId] });
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
            {isHouseholdScope && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                · household-scope
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {isHouseholdScope
              ? "Wills, trusts, joint POAs, and other family-level files."
              : "Organized by category"}
          </p>
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

      {/* Read-only roll-up of household-scope docs on contact tabs only.
          Lets the advisor see the family will/trust without leaving the
          contact, but edits/deletes route through the Household tab. */}
      {!isHouseholdScope && householdDocs.length > 0 && (
        <div className="pt-4 mt-2 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              From the household
            </p>
            <Badge variant="secondary" className="text-[10px] h-5">
              {householdDocs.length}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            These documents apply to the whole household. Manage them on the household's Documents tab.
          </p>
          <ul className="rounded-lg border border-border divide-y divide-border bg-card">
            {householdDocs.map((d) => (
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
                  onClick={() => handleDownload(d)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
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
  /** Undefined when launched from a household tab. The dialog still lets
   *  the advisor upload an individual contact's doc by picking a member
   *  from the household. */
  contactId?: string;
  householdId: string;
}) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"contact" | "household">(
    contactId ? "contact" : "household",
  );
  // Which contact the doc gets attached to when scope === "contact".
  // - On the contact tab: locked to the prop contactId.
  // - On the household tab: chosen via the member-picker dropdown.
  const [targetContactId, setTargetContactId] = useState<string | null>(
    contactId ?? null,
  );
  const [category, setCategory] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Re-sync defaults when the dialog re-opens after a contact-id change.
  useEffect(() => {
    setScope(contactId ? "contact" : "household");
    setTargetContactId(contactId ?? null);
  }, [contactId, open]);

  // Members for the household-tab "Individual contact" path. Skipped when
  // the dialog is on a contact tab (we already know the target).
  const { data: members = [] } = useQuery({
    queryKey: ["household_members_for_upload", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("id, first_name, last_name, relationship")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("relationship", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string;
        relationship: string | null;
      }>;
    },
    enabled: open && !contactId,
  });

  const reset = () => {
    setScope(contactId ? "contact" : "household");
    setTargetContactId(contactId ?? null);
    setCategory("");
    setDocType("");
    setFile(null);
  };

  // Filter the type dropdown by the currently-selected scope.
  const availableTypes = useMemo<DocType[]>(() => {
    if (!category) return [];
    return typesForScope(category, scope);
  }, [category, scope]);

  const handleSubmit = async () => {
    if (!category || !docType || !file) {
      toast.error("Please complete all fields");
      return;
    }
    if (scope === "contact" && !targetContactId) {
      toast.error("Pick a contact for this document");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // _household/ is a fixed bucket prefix for household-scope files so
      // the storage layout still groups by household at the top level.
      const ownerSegment =
        scope === "contact" && targetContactId ? targetContactId : "_household";
      const path = `${householdId}/${ownerSegment}/${category}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("contact-documents")
        .upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from("contact_documents" as any)
        .insert({
          contact_id: scope === "contact" ? targetContactId : null,
          household_id: householdId,
          category,
          document_type: docType,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          uploaded_by: userData.user.id,
        });
      if (insErr) throw insErr;

      toast.success(
        scope === "household"
          ? "Document uploaded to household"
          : "Document uploaded",
      );
      // Invalidate both caches and the specific target so all surfaces refresh.
      qc.invalidateQueries({ queryKey: ["contact_documents", contactId] });
      if (targetContactId && targetContactId !== contactId) {
        qc.invalidateQueries({ queryKey: ["contact_documents", targetContactId] });
      }
      qc.invalidateQueries({ queryKey: ["household_documents", householdId] });
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
            <Label>Save to</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setScope("contact");
                  // Reset target if we're on the household tab and the
                  // user is flipping back to "Individual contact" — they
                  // need to pick someone from the dropdown.
                  if (!contactId) setTargetContactId(null);
                  // Drop type if it's not valid in the new scope.
                  if (docType && category) {
                    const allowed = typesForScope(category, "contact").map((t) => t.name);
                    if (!allowed.includes(docType)) setDocType("");
                  }
                }}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors",
                  scope === "contact"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-background hover:border-primary/30",
                )}
              >
                <p className="text-sm font-medium text-foreground">
                  {contactId ? "This contact" : "Individual contact"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Personal IDs, employer benefits, signed forms.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("household");
                  if (docType && category) {
                    const allowed = typesForScope(category, "household").map((t) => t.name);
                    if (!allowed.includes(docType)) setDocType("");
                  }
                }}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors",
                  scope === "household"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-background hover:border-primary/30",
                )}
              >
                <p className="text-sm font-medium text-foreground">Household</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Wills, trusts, joint POAs.
                </p>
              </button>
            </div>
          </div>

          {/* When uploading from the household tab and scope=contact, the
              advisor still has to pick which contact the doc belongs to. */}
          {!contactId && scope === "contact" && (
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select
                value={targetContactId ?? ""}
                onValueChange={(v) => setTargetContactId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a household member" />
                </SelectTrigger>
                <SelectContent>
                  {members.length === 0 ? (
                    <SelectItem value="__no_members__" disabled>
                      No active members
                    </SelectItem>
                  ) : (
                    members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                        {m.relationship ? ` · ${m.relationship}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

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
                {availableTypes.length === 0 && category ? (
                  <SelectItem value="__none__" disabled>
                    No types available for this scope
                  </SelectItem>
                ) : (
                  availableTypes.map((t) => (
                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                  ))
                )}
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
          <Button
            onClick={handleSubmit}
            disabled={
              uploading ||
              !category ||
              !docType ||
              !file ||
              (scope === "contact" && !targetContactId)
            }
          >
            {uploading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
