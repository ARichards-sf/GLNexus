import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckSquare,
  FileCheck,
  Loader2,
  Mail,
  Sparkles,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/aiChat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const ALL_LIFE_EVENTS = [
  "Generational wealth transfer or estate planning",
  "Received or expecting an inheritance",
  "Selling or buying a home",
  "Major purchase planned (vehicle, renovation, etc)",
  "Job change, promotion, or new business",
  "Approaching or entering retirement",
  "Child starting college or major education expense",
  "Long-term care or insurance review needed",
  "Business sale or transition",
  "Tax situation has changed",
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  touchpoint: {
    id: string;
    household_id: string;
    name: string;
  };
  household: {
    id: string;
    name: string;
    wealth_tier: string;
  };
  primaryMember: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

export default function AnnualReviewOutreach({
  touchpoint,
  household,
  primaryMember,
  open,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"configure" | "review">("configure");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...ALL_LIFE_EVENTS]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedEmail("");

    const prompt = `Write a warm, professional annual review outreach email for a financial advisor.

Client: ${primaryMember?.first_name || ""} ${primaryMember?.last_name || ""}
Advisor: James Mitchell

The email should:
1. Open personally (2 sentences)
2. Present these life events as a "which of these applies to you?" prompt:
${selectedEvents.map((event) => `- ${event}`).join("\n")}
3. Ask them to reply or reach out if any apply so we can schedule a conversation
4. Note that if none apply, no meeting is needed but they will receive their annual financial summary
5. Close warmly

Keep under 150 words.
Use the actual client and advisor names. No placeholders.`;

    try {
      await new Promise<void>((resolve, reject) => {
        streamChat({
          messages: [{ role: "user", content: prompt }],
          context: "",
          onDelta: (chunk) => {
            setGeneratedEmail((prev) => prev + chunk);
          },
          onToolCalls: () => {},
          onDone: () => resolve(),
          onError: (message) => reject(new Error(message)),
        }).catch(reject);
      });

      setStep("review");
    } catch {
      toast.error("Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTask = async () => {
    if (!user?.id) {
      toast.error("You must be signed in to create a task");
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);

    const { error: taskError } = await supabase.from("tasks").insert({
      advisor_id: user.id,
      assigned_to: user.id,
      created_by: user.id,
      title: `Send annual review outreach — ${household.name}`,
      description: generatedEmail,
      task_type: "annual_review_outreach",
      priority: "high",
      due_date: dueDate.toISOString().split("T")[0],
      status: "todo",
      household_id: household.id,
      metadata: {
        email_draft: generatedEmail,
        selected_events: selectedEvents,
        recipient_email: primaryMember?.email || null,
        is_multiple_choice: true,
        touchpoint_id: touchpoint.id,
      },
    });

    if (taskError) {
      toast.error("Failed to create send task");
      return;
    }

    const { error: touchpointError } = await supabase
      .from("touchpoints")
      .update({ status: "active" })
      .eq("id", touchpoint.id);

    if (touchpointError) {
      toast.error("Task created, but failed to update touchpoint");
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["touchpoints", household.id] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    ]);

    toast.success("Send task created — check your task list");
    onOpenChange(false);
  };

  const handleClientDeclined = async () => {
    if (!user?.id) {
      toast.error("You must be signed in to log compliance");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const { error: noteError } = await supabase.from("compliance_notes").insert({
      household_id: household.id,
      advisor_id: user.id,
      type: "Annual Review",
      summary:
        "Annual review outreach sent via multiple choice life event prompts. Client reviewed options and declined meeting. Annual review requirement fulfilled per LPL-approved process.",
      date: today,
      auto_generated: true,
      pillars_covered: [],
    });

    if (noteError) {
      toast.error("Failed to log compliance note");
      return;
    }

    const { error: touchpointError } = await supabase
      .from("touchpoints")
      .update({
        status: "completed",
        completed_date: today,
      })
      .eq("id", touchpoint.id);

    if (touchpointError) {
      toast.error("Compliance note saved, but touchpoint update failed");
      return;
    }

    const { error: householdError } = await supabase
      .from("households")
      .update({ last_review_date: today })
      .eq("id", household.id);

    if (householdError) {
      toast.error("Compliance note saved, but household update failed");
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["touchpoints", household.id] }),
      queryClient.invalidateQueries({ queryKey: ["compliance_notes"] }),
      queryClient.invalidateQueries({ queryKey: ["households"] }),
    ]);

    toast.success("Annual review logged — compliance requirement fulfilled");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Annual Review Outreach</DialogTitle>
              <DialogDescription>
                {household.name} · {step === "configure"
                  ? "Select life event prompts to include in the outreach"
                  : "Review and send or log client decline"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "configure" && (
          <div className="space-y-6 pt-2">
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Instead of asking "do you want to meet?", we send the client a curated list of
                life events. If any apply, they reach out to schedule. Select the prompts to
                include:
              </p>
            </div>

            <div className="space-y-3 rounded-md border border-border p-4">
              {ALL_LIFE_EVENTS.map((event) => {
                const checked = selectedEvents.includes(event);

                return (
                  <div key={event} className="flex items-start gap-3 rounded-sm py-1">
                    <Checkbox
                      id={event}
                      checked={checked}
                      onCheckedChange={(value) => {
                        const isChecked = value === true;
                        setSelectedEvents((prev) =>
                          isChecked ? [...prev, event] : prev.filter((item) => item !== event),
                        );
                      }}
                    />
                    <Label htmlFor={event} className="text-sm font-normal leading-5">
                      {event}
                    </Label>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {selectedEvents.length} of {ALL_LIFE_EVENTS.length} selected
              </p>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerate} disabled={isGenerating || selectedEvents.length === 0}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate with Goodie
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 pt-2">
            <Textarea
              value={generatedEmail}
              onChange={(e) => setGeneratedEmail(e.target.value)}
              rows={10}
              className="resize-none text-sm font-mono"
            />

            {primaryMember?.email && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                Will be sent to: {primaryMember.email}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleCreateTask} className="w-full">
                <CheckSquare className="mr-1.5 h-4 w-4" />
                Create Send Task
              </Button>

              <Button
                variant="outline"
                onClick={handleClientDeclined}
                className="w-full text-muted-foreground"
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Client Declined — Log Compliance Note
              </Button>

              <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep("configure")}>
                ← Back to Edit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}