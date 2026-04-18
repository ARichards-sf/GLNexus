import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the GL Nexus Assistant named Goodie. You help advisors manage their book of business at Good Life Companies. Use the provided data to answer questions accurately. If you don't have the data, say so.

Keep answers concise and actionable. Format currency values nicely. When referencing households or clients, use their names. If asked about trends, note that you only see the current snapshot, not historical data, unless snapshot history is provided.

You have access to the following tools to take actions on behalf of the advisor. When the user asks you to DO something (update, schedule, log, add), call the appropriate tool. Always confirm the details before calling.

Tools available:
- update_household_details: Update risk tolerance, status, investment objective, or next action for a household.
- create_compliance_note: Log a compliance note, call summary, email log, or meeting note.
- schedule_meeting: Schedule a calendar event for an annual review, discovery call, or other meeting.
- add_financial_account: Add a new financial account linked to a household member.
- create_task: Create a task or reminder. Use when advisor says 'remind me', 'add a task', 'don't forget', 'follow up', or any similar request to remember something.

IMPORTANT: When you want to take an action, use the tool calling mechanism. Do NOT return JSON manually.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "update_household_details",
      description: "Update a household's risk tolerance, status, investment objective, or next action. Use when an advisor asks to change household settings.",
      parameters: {
        type: "object",
        properties: {
          household_id: { type: "string", description: "UUID of the household to update" },
          household_name: { type: "string", description: "Name of the household (for confirmation display)" },
          risk_tolerance: { type: "string", enum: ["Conservative", "Moderate", "Aggressive", "Very Aggressive"], description: "New risk tolerance level" },
          status: { type: "string", enum: ["Active", "Inactive", "Review Scheduled", "Onboarding"], description: "New status" },
          investment_objective: { type: "string", description: "New investment objective" },
          next_action: { type: "string", description: "Next action to take" },
          next_action_date: { type: "string", description: "Date for next action (YYYY-MM-DD)" },
        },
        required: ["household_id", "household_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_compliance_note",
      description: "Log a compliance note for a household. Use when the advisor wants to record a note, call summary, email log, or meeting note.",
      parameters: {
        type: "object",
        properties: {
          household_id: { type: "string", description: "UUID of the household" },
          household_name: { type: "string", description: "Name of the household (for confirmation display)" },
          type: { type: "string", enum: ["Annual Review", "Phone Call", "Email", "Prospecting", "Compliance"], description: "Type of note" },
          summary: { type: "string", description: "Content of the note" },
        },
        required: ["household_id", "household_name", "type", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_meeting",
      description: "Schedule a calendar event/meeting. Use when the advisor asks to schedule a review, call, or meeting.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Meeting title" },
          event_type: { type: "string", enum: ["Annual Review", "Discovery Call", "Portfolio Update", "Prospecting"], description: "Type of event" },
          start_time: { type: "string", description: "Start time in ISO 8601 format" },
          end_time: { type: "string", description: "End time in ISO 8601 format" },
          household_id: { type: "string", description: "UUID of the household (optional)" },
          household_name: { type: "string", description: "Name of the household (for confirmation display)" },
          description: { type: "string", description: "Meeting description" },
        },
        required: ["title", "event_type", "start_time", "end_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_financial_account",
      description: "Add a new financial account linked to a contact/household member.",
      parameters: {
        type: "object",
        properties: {
          member_id: { type: "string", description: "UUID of the household member" },
          member_name: { type: "string", description: "Name of the member (for confirmation display)" },
          account_name: { type: "string", description: "Name for the account" },
          account_type: { type: "string", enum: ["Brokerage", "IRA", "401k", "Roth IRA", "529", "Trust", "Joint", "Custodial"], description: "Type of account" },
          balance: { type: "number", description: "Initial balance" },
          institution: { type: "string", description: "Financial institution name" },
          account_number: { type: "string", description: "Account number (last 4 digits)" },
        },
        required: ["member_id", "member_name", "account_name", "account_type", "balance"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a task or reminder for the advisor. Use when the advisor asks to be reminded of something, wants to create a to-do, or asks Goodie to follow up on something. Also use when the advisor says things like 'remind me to...', 'don't let me forget to...', 'make a note to...', or 'add a task for...'",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Clear, actionable task title. Start with a verb. e.g. 'Call Robert Henderson about home sale proceeds'" },
          description: { type: "string", description: "Additional context or notes about the task. Include any relevant details the advisor mentioned." },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format. Infer from natural language — 'next Tuesday', 'end of week', 'in 3 days' etc. Use today's date if the advisor says 'today' or 'now'. Leave null if no date mentioned." },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority. Default to medium unless the advisor indicates urgency." },
          household_id: { type: "string", description: "UUID of the linked household if the task is about a specific client. Match from the context snapshot." },
          household_name: { type: "string", description: "Name of the household for confirmation display." },
        },
        required: ["title"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemContent = SYSTEM_PROMPT;
    if (context) {
      systemContent += `\n\n--- ADVISOR DATA SNAPSHOT ---\n${context}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        tools: TOOLS,
        tool_choice: "auto",
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
