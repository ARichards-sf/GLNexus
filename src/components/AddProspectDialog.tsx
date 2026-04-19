import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  PIPELINE_STAGES,
  PROSPECT_SOURCES,
  useCreateProspect,
  type Prospect,
} from "@/hooks/useProspects";
import { useHouseholds } from "@/hooks/useHouseholds";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStage?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  referral: "Referral",
  event: "Event",
  cold_outreach: "Cold Outreach",
  social_media: "Social Media",
  existing_client: "Existing Client",
  other: "Other",
};

export default function AddProspectDialog({
  open,
  onOpenChange,
  defaultStage = "lead",
}: Props) {
  const createMut = useCreateProspect();
  const { data: households = [] } = useHouseholds();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [stage, setStage] = useState<string>(defaultStage);
  const [source, setSource] = useState<string>("");
  const [estimatedAum, setEstimatedAum] = useState("");
  const [referredByHousehold, setReferredByHousehold] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [referralSearch, setReferralSearch] = useState("");
  const [notes, setNotes] = useState("");

  const filteredHouseholds = useMemo(() => {
    if (!referralSearch.trim()) return [];
    const q = referralSearch.toLowerCase();
    return households
      .filter((h) => h.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [households, referralSearch]);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setJobTitle("");
    setStage(defaultStage);
    setSource("");
    setEstimatedAum("");
    setReferredByHousehold(null);
    setReferralSearch("");
    setNotes("");
  };

  // Reset stage when defaultStage changes / dialog reopens
  useEffect(() => {
    if (open) {
      setStage(defaultStage);
    }
  }, [open, defaultStage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }

    try {
      await createMut.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        job_title: jobTitle.trim() || null,
        pipeline_stage: stage as Prospect["pipeline_stage"],
        source: source || null,
        estimated_aum: estimatedAum ? Number(estimatedAum) : null,
        referred_by:
          source === "referral" && referredByHousehold
            ? referredByHousehold.name
            : null,
        referred_by_household_id:
          source === "referral" && referredByHousehold
            ? referredByHousehold.id
            : null,
        notes: notes.trim() || null,
      });

      toast.success(
        `${firstName.trim()} ${lastName.trim()} added to pipeline`
      );
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add prospect");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Prospect</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Names */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Row 2: Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Row 3: Company + Job Title */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Stage + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="stage">Pipeline Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger id="stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: Estimated AUM + (conditional) Referred By household search */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="estimatedAum">Estimated AUM</Label>
              <Input
                id="estimatedAum"
                type="number"
                min="0"
                placeholder="$500,000"
                value={estimatedAum}
                onChange={(e) => setEstimatedAum(e.target.value)}
              />
            </div>
            {source === "referral" && (
              <div className="space-y-2">
                <Label htmlFor="referredBy">
                  Referred By <span className="text-destructive">*</span>
                </Label>

                {referredByHousehold ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/40">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">
                      {referredByHousehold.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReferredByHousehold(null);
                        setReferralSearch("");
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      id="referredBy"
                      placeholder="Search households…"
                      value={referralSearch}
                      onChange={(e) => setReferralSearch(e.target.value)}
                    />
                    {filteredHouseholds.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                        {filteredHouseholds.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              setReferredByHousehold({
                                id: h.id,
                                name: h.name,
                              });
                              setReferralSearch("");
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent"
                          >
                            <Users className="w-4 h-4 text-muted-foreground" />
                            {h.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Link to the client who made this referral
                </p>
              </div>
            )}
          </div>

          {/* Row 6: Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Adding..." : "Add Prospect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
