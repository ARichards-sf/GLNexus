import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Users,
  Search,
  Check,
  X,
  CreditCard,
  FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useHouseholds, type HouseholdRow } from "@/hooks/useHouseholds";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/data/sampleData";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/hooks/useContacts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    household_id: string;
    household_name: string;
  };
  accounts: AccountRow[];
  onComplete?: () => void;
}

type DestType = "new" | "existing" | null;

export default function ReparentContactDialog({
  open,
  onOpenChange,
  contact,
  accounts,
  onComplete,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: households = [] } = useHouseholds();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [destType, setDestType] = useState<DestType>(null);
  const [householdSearch, setHouseholdSearch] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdRow | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    accounts.map((a) => a.id),
  );
  const [isMoving, setIsMoving] = useState(false);

  const newHouseholdName = `${contact.first_name} ${contact.last_name} Household`;
  const initials = `${contact.first_name[0] ?? ""}${contact.last_name[0] ?? ""}`.toUpperCase();

  const filteredHouseholds = useMemo(() => {
    const q = householdSearch.trim().toLowerCase();
    return households
      .filter((h) => h.id !== contact.household_id)
      .filter((h) => (q ? h.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [households, householdSearch, contact.household_id]);

  const reset = () => {
    setStep(1);
    setDestType(null);
    setHouseholdSearch("");
    setSelectedHousehold(null);
    setSelectedAccountIds(accounts.map((a) => a.id));
    setIsMoving(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const goNextFromStep1 = () => {
    if (destType === "new") {
      // Skip step 2 if no accounts
      setStep(accounts.length === 0 ? 3 : 2);
    } else if (destType === "existing" && selectedHousehold) {
      setStep(accounts.length === 0 ? 3 : 2);
    }
  };

  const recalcHouseholdAum = async (householdId: string) => {
    // Sum balances of all accounts whose member belongs to this household
    const { data: members } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .is("archived_at", null);
    const memberIds = (members ?? []).map((m) => m.id);
    let total = 0;
    if (memberIds.length > 0) {
      const { data: accs } = await supabase
        .from("contact_accounts")
        .select("balance")
        .in("member_id", memberIds);
      total = (accs ?? []).reduce((s, a) => s + Number(a.balance ?? 0), 0);
    }
    await supabase
      .from("households")
      .update({ total_aum: total })
      .eq("id", householdId);
  };

  const handleConfirm = async () => {
    if (!user) return;
    setIsMoving(true);
    try {
      let targetHouseholdId = selectedHousehold?.id;

      // 1. Create new household if needed
      if (destType === "new") {
        const { data: newHousehold, error: hhErr } = await supabase
          .from("households")
          .insert({
            name: newHouseholdName,
            advisor_id: user.id,
            total_aum: 0,
            status: "Active",
            risk_tolerance: "Moderate",
          })
          .select()
          .single();
        if (hhErr) throw hhErr;
        targetHouseholdId = newHousehold.id;
      }

      if (!targetHouseholdId) throw new Error("No destination household");

      // 2. Move the contact (member) to the target household
      const { error: memberErr } = await supabase
        .from("household_members")
        .update({ household_id: targetHouseholdId })
        .eq("id", contact.id);
      if (memberErr) throw memberErr;

      // 3. Move only selected accounts. For accounts NOT selected,
      // reassign them to a different remaining member of the original household
      // so they "stay" with the old household.
      const stayingAccountIds = accounts
        .map((a) => a.id)
        .filter((id) => !selectedAccountIds.includes(id));

      if (stayingAccountIds.length > 0) {
        // Find another member in the original household to own these accounts
        const { data: oldMembers } = await supabase
          .from("household_members")
          .select("id")
          .eq("household_id", contact.household_id)
          .is("archived_at", null)
          .neq("id", contact.id)
          .limit(1);

        const fallbackMember = oldMembers?.[0];
        if (!fallbackMember) {
          throw new Error(
            "Cannot leave accounts behind — the original household has no other members to own them. Move all accounts or add a member to the original household first.",
          );
        }

        const { error: stayErr } = await supabase
          .from("contact_accounts")
          .update({ member_id: fallbackMember.id })
          .in("id", stayingAccountIds);
        if (stayErr) throw stayErr;
      }

      // 4. Recalculate AUM for both households
      await Promise.all([
        recalcHouseholdAum(contact.household_id),
        recalcHouseholdAum(targetHouseholdId),
      ]);

      // 5. Invalidate caches
      queryClient.invalidateQueries({ queryKey: ["households"] });
      queryClient.invalidateQueries({ queryKey: ["household_members"] });
      queryClient.invalidateQueries({ queryKey: ["household_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["contact_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["all_contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact", contact.id] });

      toast({
        title: "Contact moved",
        description: `${contact.first_name} ${contact.last_name} is now in ${
          destType === "new" ? newHouseholdName : selectedHousehold?.name
        }.`,
      });

      onComplete?.();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Move failed", description: e.message, variant: "destructive" });
    } finally {
      setIsMoving(false);
    }
  };

  const movingCount = selectedAccountIds.length;
  const stayingCount = accounts.length - movingCount;
  const canNextStep1 =
    destType === "new" || (destType === "existing" && !!selectedHousehold);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && `Move ${contact.first_name} ${contact.last_name}`}
            {step === 2 && `Which accounts move with ${contact.first_name}?`}
            {step === 3 && "Confirm Move"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && `Currently in ${contact.household_name}`}
            {step === 2 && "Pick the financial accounts that follow this contact."}
            {step === 3 && "Review and confirm the changes below."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                step >= s ? "bg-primary" : "bg-secondary",
              )}
            />
          ))}
        </div>

        {/* STEP 1 — destination */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDestType("new");
                  setSelectedHousehold(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all w-full text-center",
                  destType === "new"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <UserPlus className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Create New Household</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start a fresh household for this contact
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDestType("existing")}
                className={cn(
                  "flex flex-col items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all w-full text-center",
                  destType === "existing"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Move to Existing Household
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add to a household you already manage
                  </p>
                </div>
              </button>
            </div>

            {destType === "existing" && (
              <div className="space-y-2">
                {selectedHousehold ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedHousehold.name}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setSelectedHousehold(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search households..."
                        value={householdSearch}
                        onChange={(e) => setHouseholdSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
                      {filteredHouseholds.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-3">
                          No matching households
                        </p>
                      ) : (
                        filteredHouseholds.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setSelectedHousehold(h)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-secondary/60 text-foreground"
                          >
                            <span className="font-medium">{h.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(Number(h.total_aum))}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={goNextFromStep1} disabled={!canNextStep1} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — accounts */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{movingCount}</strong> moving ·{" "}
                <strong className="text-foreground">{stayingCount}</strong> staying
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setSelectedAccountIds(accounts.map((a) => a.id))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setSelectedAccountIds([])}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {accounts.map((a) => {
                const checked = selectedAccountIds.includes(a.id);
                return (
                  <div
                    key={a.id}
                    onClick={() => toggleAccount(a.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-secondary/40 transition-colors",
                      checked ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleAccount(a.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {a.account_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.account_type} · {formatCurrency(Number(a.balance))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {stayingCount > 0 && (
              <p className="text-xs text-muted-foreground italic">
                Accounts left behind will be reassigned to another member of{" "}
                {contact.household_name}.
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Moving from {contact.household_name}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Moving to:{" "}
                    <strong>
                      {destType === "new"
                        ? `New household: "${newHouseholdName}"`
                        : selectedHousehold?.name}
                    </strong>
                  </span>
                </div>

                {movingCount > 0 && (
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <CreditCard className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {movingCount} account{movingCount !== 1 ? "s" : ""} moving with them
                    </span>
                  </div>
                )}

                {stayingCount > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      {stayingCount} account{stayingCount !== 1 ? "s" : ""} staying with{" "}
                      {contact.household_name}
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-2 text-sm">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    Compliance notes remain on {contact.household_name} (required for
                    regulatory compliance)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(accounts.length === 0 ? 1 : 2)}
                disabled={isMoving}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleConfirm} disabled={isMoving} className="flex-1">
                {isMoving ? (
                  "Moving..."
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" /> Confirm Move
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
