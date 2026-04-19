import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, AlertCircle, Zap, X, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHouseholds, type HouseholdRow } from "@/hooks/useHouseholds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUEST_TYPES = [
  { value: "financial_planning_review", label: "Financial Planning Review" },
  { value: "portfolio_analysis", label: "Portfolio Analysis" },
  { value: "client_meeting_prep", label: "Client Meeting Prep" },
  { value: "proposal_preparation", label: "Proposal Preparation" },
  { value: "tax_planning_support", label: "Tax Planning Support" },
  { value: "estate_planning_support", label: "Estate Planning Support" },
  { value: "general_advisory_support", label: "General Advisory Support" },
  { value: "other", label: "Other" },
] as const;

const TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "24_hours", label: "Within 24 hours" },
  { value: "3_days", label: "Within 3 days" },
  { value: "this_week", label: "This week" },
  { value: "no_rush", label: "No rush" },
] as const;

const PRIORITIES = [
  { value: "normal", label: "Normal", icon: Clock, className: "" },
  { value: "urgent", label: "Urgent", icon: AlertCircle, className: "text-destructive" },
] as const;

export default function VpmRequestDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: households = [] } = useHouseholds();

  const [requestType, setRequestType] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [timeline, setTimeline] = useState("");
  const [description, setDescription] = useState("");
  const [householdSearch, setHouseholdSearch] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdRow | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filteredHouseholds = useMemo(() => {
    if (!householdSearch.trim()) return [];
    const q = householdSearch.toLowerCase();
    return households.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 8);
  }, [householdSearch, households]);

  const reset = () => {
    setRequestType("");
    setSubject("");
    setPriority("normal");
    setTimeline("");
    setDescription("");
    setHouseholdSearch("");
    setSelectedHousehold(null);
    setShowDropdown(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleSelectHousehold = (h: HouseholdRow) => {
    setSelectedHousehold(h);
    setHouseholdSearch("");
    setShowDropdown(false);
  };

  const canSubmit =
    !!requestType &&
    subject.trim().length > 0 &&
    !!timeline &&
    description.trim().length > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmit) return;
    setSubmitting(true);

    try {
      const composedDescription = `${subject.trim()}\n\n${description.trim()}`;

      const insertPayload: any = {
        advisor_id: user.id,
        category: "VPM Support",
        description: composedDescription,
        status: "open",
        is_vpm: true,
        vpm_request_type: requestType,
        vpm_timeline: timeline,
        household_id: selectedHousehold?.id || null,
        household_name: selectedHousehold?.name || null,
        household_aum: selectedHousehold?.total_aum ?? null,
      };

      const { error } = await supabase.from("service_requests").insert(insertPayload);
      if (error) throw error;

      // Best-effort routing notification
      try {
        await supabase.functions.invoke("route-service-request", {
          body: {
            category: "VPM Support",
            description: composedDescription,
            advisor_email: user.email,
            advisor_name: user.user_metadata?.full_name || user.email,
            household_name: selectedHousehold?.name,
            household_aum: selectedHousehold?.total_aum,
            is_vpm: true,
            vpm_request_type: requestType,
            vpm_timeline: timeline,
            priority,
            subject: subject.trim(),
          },
        });
      } catch {
        // Non-critical
      }

      queryClient.invalidateQueries({ queryKey: ["service_requests"] });
      toast.success("VPM support request submitted. Our team will be in touch shortly.");
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit VPM request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            VPM Support Request
          </DialogTitle>
          <DialogDescription>
            Tell us what you need and our Virtual Practice Management team will get to work.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Request Type */}
          <div className="space-y-2">
            <Label>What do you need help with?</Label>
            <Select value={requestType} onValueChange={setRequestType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a request type" />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder="Brief description of your request"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              required
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => {
                const Icon = p.icon;
                const isSelected = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value as "normal" | "urgent")}
                    className={cn(
                      "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                      isSelected && p.className
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linked Household */}
          <div className="space-y-2">
            <Label>Related Client (optional)</Label>
            {selectedHousehold ? (
              <div>
                <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1 text-sm">
                  {selectedHousehold.name}
                  <button
                    type="button"
                    onClick={() => setSelectedHousehold(null)}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    aria-label="Clear household"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search your households..."
                  value={householdSearch}
                  onChange={(e) => {
                    setHouseholdSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                {showDropdown && filteredHouseholds.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto">
                    {filteredHouseholds.map((h) => (
                      <button
                        type="button"
                        key={h.id}
                        onClick={() => handleSelectHousehold(h)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        {h.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <Label>When do you need this?</Label>
            <Select value={timeline} onValueChange={setTimeline} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a timeline" />
              </SelectTrigger>
              <SelectContent>
                {TIMELINES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea
              placeholder="Describe what you need and any relevant context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              VPM Support request
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
