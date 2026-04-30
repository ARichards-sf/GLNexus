import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Phone,
  Mail,
  FileCheck,
  FileText,
  TrendingUp,
  Star,
  CheckSquare,
  Gift,
  Cake,
  Newspaper,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: {
    id: string;
    name: string;
    wealth_tier: string;
  };
  onConfirm: () => void;
}

type TouchpointTemplate = Tables<"touchpoint_templates">;
type TouchpointType = TouchpointTemplate["touchpoint_type"];

const TOUCHPOINT_TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  call: "Phone Call",
  letter: "Letter",
  annual_review: "Annual Review",
  account_review: "Account Review",
  market_assessment: "Market Update",
  custodian_statement: "Custodian Statement",
  newsletter: "Newsletter",
  birthday: "Birthday",
  holiday: "Holiday",
  appreciation_event: "Event",
  premium_card: "Premium Card",
  task: "Task",
};

const TOUCHPOINT_ICON_STYLES: Record<string, string> = {
  meeting: "bg-primary/10 text-primary",
  call: "bg-emerald-muted text-emerald",
  letter: "bg-accent/10 text-accent",
  annual_review: "bg-amber-muted text-amber",
  account_review: "bg-blue-100 text-blue-600",
  market_assessment: "bg-secondary text-muted-foreground",
  custodian_statement: "bg-secondary text-muted-foreground",
  newsletter: "bg-secondary text-muted-foreground",
  birthday: "bg-destructive/10 text-destructive",
  holiday: "bg-destructive/10 text-destructive",
  appreciation_event: "bg-amber-muted text-amber",
  premium_card: "bg-amber-muted text-amber",
  task: "bg-secondary text-muted-foreground",
};

const TOUCHPOINT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  meeting: CalendarDays,
  call: Phone,
  letter: Mail,
  annual_review: FileCheck,
  account_review: BarChart3,
  market_assessment: TrendingUp,
  custodian_statement: FileText,
  newsletter: Newspaper,
  birthday: Cake,
  holiday: Gift,
  appreciation_event: Star,
  premium_card: CreditCard,
  task: CheckSquare,
};

const ACTIONABLE_TYPES = ["meeting", "call", "annual_review", "letter", "appreciation_event"];

export default function TouchpointGenerationDialog({
  open,
  onOpenChange,
  household,
  onConfirm,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["touchpoint_templates", household.wealth_tier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("touchpoint_templates")
        .select("*")
        .eq("tier", household.wealth_tier)
        .order("month_offset");

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!household.wealth_tier,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["touchpoint_members", household.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("household_members")
        .select("id, first_name, last_name, date_of_birth, relationship")
        .eq("household_id", household.id)
        .in("relationship", ["Primary", "Spouse"])
        .is("archived_at", null);

      return data || [];
    },
    enabled: open && !!household.id,
  });

  const groupedTemplates = useMemo(() => {
    const baseDate = new Date();

    const templatesWithDates = templates
      .filter((template) => template.touchpoint_type !== "birthday")
      .map((template) => {
        let scheduledDate: Date;

        if (template.scheduling_type === "fixed_month" && template.fixed_month) {
          const year = baseDate.getFullYear();
          const month = template.fixed_month - 1;
          const day = template.fixed_day || 1;

          scheduledDate = new Date(year, month, day);

          if (scheduledDate < baseDate) {
            scheduledDate = new Date(year + 1, month, day);
          }
        } else {
          scheduledDate = new Date(baseDate);
          scheduledDate.setMonth(scheduledDate.getMonth() + (template.month_offset || 0));
        }

        return {
          ...template,
          scheduledDate,
        };
      })
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

    const grouped = templatesWithDates.reduce(
      (acc, template) => {
        const key = template.scheduledDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

        if (!acc[key]) acc[key] = [];
        acc[key].push(template);
        return acc;
      },
      {} as Record<string, typeof templatesWithDates>,
    );

    members
      .filter(
        (member) =>
          member.date_of_birth &&
          (member.relationship === "Primary" || member.relationship === "Spouse"),
      )
      .forEach((member) => {
        const dob = new Date(member.date_of_birth!);
        const today = new Date();
        let nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

        if (nextBirthday < today) {
          nextBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        }

        const key = nextBirthday.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

        if (!grouped[key]) grouped[key] = [];

        grouped[key].push({
          id: `birthday-${member.id}`,
          name: `Birthday — ${member.first_name} ${member.last_name}`,
          touchpoint_type: "birthday",
          scheduledDate: nextBirthday,
          scheduling_type: "fixed_month",
          description: "Birthday outreach",
          tier: household.wealth_tier,
          month_offset: null,
          fixed_month: nextBirthday.getMonth() + 1,
          fixed_day: nextBirthday.getDate(),
          is_billable: false,
          created_at: new Date().toISOString(),
        } as any);
      });

    return Object.entries(grouped).sort(([, aItems], [, bItems]) => {
      return aItems[0].scheduledDate.getTime() - bItems[0].scheduledDate.getTime();
    });
  }, [templates, members]);

  const birthdayMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.date_of_birth &&
          (member.relationship === "Primary" || member.relationship === "Spouse"),
      ),
    [members],
  );

  const hasMembersMissingDob = useMemo(
    () =>
      members.some(
        (member) =>
          !member.date_of_birth &&
          (member.relationship === "Primary" || member.relationship === "Spouse"),
      ),
    [members],
  );

  const handleConfirm = async () => {
    if (!user) return;

    try {
      setGenerating(true);
      const baseDate = new Date();

      for (const template of templates) {
        if (template.touchpoint_type === "birthday") {
          continue;
        }

        let scheduledDate: Date;

        if (template.scheduling_type === "fixed_month" && template.fixed_month) {
          const year = baseDate.getFullYear();
          const month = template.fixed_month - 1;
          const day = template.fixed_day || 1;

          scheduledDate = new Date(year, month, day);

          if (scheduledDate < baseDate) {
            scheduledDate = new Date(year + 1, month, day);
          }
        } else {
          scheduledDate = new Date(baseDate);
          scheduledDate.setMonth(scheduledDate.getMonth() + (template.month_offset || 0));
        }

        const dateStr = scheduledDate.toISOString().split("T")[0];

        const { data: touchpointData, error: touchpointError } = await supabase
          .from("touchpoints")
          .insert({
            household_id: household.id,
            advisor_id: user.id,
            template_id: template.id,
            name: template.name,
            touchpoint_type: template.touchpoint_type,
            scheduled_date: dateStr,
            status: "upcoming",
            metadata: {},
          })
          .select()
          .single();

        if (touchpointError) throw touchpointError;

        if (ACTIONABLE_TYPES.includes(template.touchpoint_type)) {
          const { data: taskData, error: taskError } = await supabase
            .from("tasks")
            .insert({
              advisor_id: user.id,
              assigned_to: user.id,
              created_by: user.id,
              title: `${template.name} — ${household.name}`,
              description: template.description,
              task_type: template.touchpoint_type,
              due_date: dateStr,
              priority:
                template.touchpoint_type === "annual_review" || template.touchpoint_type === "meeting"
                  ? "high"
                  : "medium",
              status: "todo",
              household_id: household.id,
              metadata: {
                touchpoint_type: template.touchpoint_type,
                is_touchpoint: true,
                touchpoint_id: touchpointData?.id,
              },
            })
            .select()
            .single();

          if (taskError) throw taskError;

          if (taskData?.id) {
            await supabase.from("touchpoints").update({ linked_task_id: taskData.id }).eq("id", touchpointData!.id);
          }
        }
      }

      for (const member of birthdayMembers) {
        const dob = new Date(member.date_of_birth!);
        const today = new Date();

        let birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

        if (birthdayThisYear < today) {
          birthdayThisYear = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        }

        const dateStr = birthdayThisYear.toISOString().split("T")[0];

        const { data: birthdayTouchpoint, error: birthdayError } = await supabase
          .from("touchpoints")
          .insert({
            household_id: household.id,
            advisor_id: user.id,
            template_id: null,
            name: `Birthday — ${member.first_name} ${member.last_name}`,
            touchpoint_type: "birthday",
            scheduled_date: dateStr,
            status: "upcoming",
            metadata: {
              member_id: member.id,
              member_name: `${member.first_name} ${member.last_name}`,
            },
          })
          .select()
          .single();

        if (birthdayError) throw birthdayError;

        const { data: birthdayTask, error: birthdayTaskError } = await supabase
          .from("tasks")
          .insert({
            advisor_id: user.id,
            assigned_to: user.id,
            created_by: user.id,
            title: `Birthday outreach — ${member.first_name} ${member.last_name}`,
            description: `Send birthday message to ${member.first_name} ${member.last_name} (${household.name})`,
            task_type: "birthday",
            due_date: dateStr,
            priority: "medium",
            status: "todo",
            household_id: household.id,
            metadata: {
              touchpoint_type: "birthday",
              is_touchpoint: true,
              member_id: member.id,
            },
          })
          .select()
          .single();

        if (birthdayTaskError) throw birthdayTaskError;

        if (birthdayTask?.id && birthdayTouchpoint?.id) {
          await supabase
            .from("touchpoints")
            .update({ linked_task_id: birthdayTask.id })
            .eq("id", birthdayTouchpoint.id);
        }
      }

      // refetchQueries (vs invalidateQueries) awaits the fresh data before
      // resolving — so when we close the dialog the timeline cache already
      // holds the new touchpoints. invalidate alone fires the refetch but
      // returns immediately, which let the timeline render mid-flight on
      // partial state.
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["touchpoints", household.id] }),
        queryClient.refetchQueries({ queryKey: ["touchpoints_presence", household.id] }),
        queryClient.refetchQueries({ queryKey: ["touchpoint_stats", household.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);

      onConfirm();
      onOpenChange(false);
      toast.success(`${templates.length} touchpoints generated for ${household.name}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to generate touchpoints");
    } finally {
      setGenerating(false);
    }
  };

  const tierLabel = household.wealth_tier || "Selected";
  const currentMonthKey = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{`Client Experience — ${household.name}`}</DialogTitle>
          <DialogDescription>
            {`This is the ${tierLabel} service plan for the next 12 months. Review and confirm to generate all touchpoints.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {groupedTemplates.length > 0 ? (
            <div className="space-y-5 py-1">
              {groupedTemplates.map(([key, touchpointsForMonth], groupIndex) => (
                <div key={key} className="flex gap-4">
                  <div className="flex w-16 shrink-0 flex-col items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-secondary-foreground">
                      {groupIndex + 1}
                    </div>
                    {groupIndex < groupedTemplates.length - 1 && <div className="mt-2 h-full w-px bg-border" />}
                  </div>

                  <div className="flex-1 space-y-3 pb-5">
                    <div className="pt-1">
                      <p className="text-sm font-semibold text-foreground">
                        {key === currentMonthKey ? "This Month" : key}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {touchpointsForMonth.map((template) => {
                        const Icon = TOUCHPOINT_ICONS[template.touchpoint_type as TouchpointType] ?? CheckSquare;
                        const label = TOUCHPOINT_TYPE_LABELS[template.touchpoint_type] ?? template.touchpoint_type;
                        const iconStyle =
                          TOUCHPOINT_ICON_STYLES[template.touchpoint_type] ?? "bg-secondary text-muted-foreground";

                        return (
                          <div
                            key={template.id}
                            className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
                          >
                            <div
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                                iconStyle,
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-medium text-foreground">{template.name}</p>
                              <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                          </div>
                        );
                      })}

                    </div>

                    {hasMembersMissingDob && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-amber">
                        <AlertCircle className="h-3 w-3" />
                        Some members are missing a date of birth — birthday touchpoints will be skipped for those
                        members. Add DOB in the household profile.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No service plan found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {household.wealth_tier
                  ? `No touchpoint templates are configured for the ${household.wealth_tier} tier.`
                  : "This household needs a confirmed tier before touchpoints can be generated."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!templates.length || generating || !user}>
            {generating ? "Generating..." : `Generate ${templates.length} Touchpoints`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}