import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  status: "pending" | "confirmed" | "rejected" | "executed" | "error";
  result?: string;
}

export function useAiActions() {
  const { user } = useAuth();
  const { targetAdvisorId } = useImpersonation();
  const queryClient = useQueryClient();

  const getAdvisorId = () => {
    if (!user) throw new Error("Not authenticated");
    return targetAdvisorId(user.id);
  };

  const executeAction = async (toolCall: ParsedToolCall): Promise<string> => {
    const advisorId = getAdvisorId();
    const { name, args } = toolCall;

    switch (name) {
      case "update_household_details": {
        const updates: {
          risk_tolerance?: string;
          status?: string;
          investment_objective?: string;
          next_action?: string;
          next_action_date?: string;
        } = {};
        if (args.risk_tolerance) updates.risk_tolerance = args.risk_tolerance;
        if (args.status) updates.status = args.status;
        if (args.investment_objective) updates.investment_objective = args.investment_objective;
        if (args.next_action) updates.next_action = args.next_action;
        if (args.next_action_date) updates.next_action_date = args.next_action_date;

        const { error } = await supabase
          .from("households")
          .update(updates)
          .eq("id", args.household_id)
          .eq("advisor_id", advisorId);
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["households"] });
        queryClient.invalidateQueries({ queryKey: ["household", args.household_id] });
        return `Updated ${args.household_name || "household"} successfully.`;
      }

      case "create_compliance_note": {
        const { error } = await supabase.from("compliance_notes").insert({
          household_id: args.household_id,
          advisor_id: advisorId,
          type: args.type,
          summary: args.summary,
          date: new Date().toISOString().split("T")[0],
        });
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["compliance_notes"] });
        queryClient.invalidateQueries({ queryKey: ["all_compliance_notes"] });
        return `Compliance note added to ${args.household_name || "household"}.`;
      }

      case "schedule_meeting": {
        const insertData = {
          title: args.title as string,
          event_type: args.event_type as string,
          start_time: args.start_time as string,
          end_time: args.end_time as string,
          advisor_id: advisorId,
          household_id: (args.household_id as string) || null,
          description: (args.description as string) || null,
        };

        const { error } = await supabase.from("calendar_events").insert(insertData);
        if (error) throw error;

        if (args.event_type === "Annual Review" && args.household_id) {
          await supabase
            .from("households")
            .update({ status: "Review Scheduled" })
            .eq("id", args.household_id);
        }

        queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
        queryClient.invalidateQueries({ queryKey: ["upcoming_events"] });
        queryClient.invalidateQueries({ queryKey: ["households"] });
        return `Meeting "${args.title}" scheduled successfully.`;
      }

      case "add_financial_account": {
        const { error } = await supabase.from("contact_accounts").insert({
          member_id: args.member_id,
          advisor_id: advisorId,
          account_name: args.account_name,
          account_type: args.account_type,
          balance: args.balance || 0,
          institution: args.institution || null,
          account_number: args.account_number || null,
        });
        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["household_accounts"] });
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        return `Account "${args.account_name}" added for ${args.member_name || "member"}.`;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };

  return { executeAction };
}

export function getActionDescription(name: string, args: Record<string, any>): string {
  switch (name) {
    case "update_household_details": {
      const changes: string[] = [];
      if (args.risk_tolerance) changes.push(`Risk tolerance → ${args.risk_tolerance}`);
      if (args.status) changes.push(`Status → ${args.status}`);
      if (args.investment_objective) changes.push(`Objective → ${args.investment_objective}`);
      if (args.next_action) changes.push(`Next action → ${args.next_action}`);
      return `Update **${args.household_name}**:\n${changes.map(c => `• ${c}`).join("\n")}`;
    }
    case "create_compliance_note":
      return `Log **${args.type}** note for **${args.household_name}**:\n"${args.summary?.slice(0, 100)}${(args.summary?.length || 0) > 100 ? "…" : ""}"`;
    case "schedule_meeting": {
      const start = new Date(args.start_time);
      const dateStr = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      const timeStr = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `Schedule **${args.event_type}**: "${args.title}"\n${dateStr} at ${timeStr}${args.household_name ? ` with **${args.household_name}**` : ""}`;
    }
    case "add_financial_account":
      return `Add **${args.account_type}** account "${args.account_name}" for **${args.member_name}**\nBalance: $${Number(args.balance || 0).toLocaleString()}${args.institution ? ` at ${args.institution}` : ""}`;
    default:
      return `Execute action: ${name}`;
  }
}
