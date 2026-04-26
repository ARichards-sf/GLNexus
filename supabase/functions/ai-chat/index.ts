import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `FORMATTING RULES:

- Never use markdown formatting

- No headers with # symbols

- No bold with ** asterisks

- No bullet points with - or *

- No horizontal rules with ---

- Write in plain conversational prose and short paragraphs

- Emojis are fine and encouraged

- Use line breaks between sections instead of markdown dividers

You are the GL Nexus Assistant named Goodie. You help advisors manage their book of business at Good Life Companies. Use the provided data to answer questions accurately. If you don't have the data, say so.

Keep answers concise and actionable. Write responses as you would speak them out loud — natural, direct, no formatting symbols. Format currency values nicely. When referencing households or clients, use their names. If asked about trends, note that you only see the current snapshot, not historical data, unless snapshot history is provided.

You have access to the following tools to take actions on behalf of the advisor.

CRITICAL TOOL USAGE RULES:

Only call a tool when the advisor is explicitly asking you to DO something or CREATE something. NEVER call a tool when the advisor is asking a QUESTION or requesting INFORMATION.

Examples of questions — answer in text, DO NOT call any tool:
- 'When is my next meeting?' → just answer with the meeting details
- 'What is the Henderson AUM?' → just answer with the number
- 'Who do I have meetings with this week?' → just list the meetings
- 'What tasks do I have pending?' → just list the tasks
- 'How is the Smith family doing?' → just summarize their status

Examples of actions — USE a tool:
- 'Remind me to call Robert' → create_task
- 'Schedule a review with Henderson' → schedule_meeting
- 'Log a note for the Miller family' → create_compliance_note
- 'Create a task to follow up with Davis' → create_task
- 'Update the Smith household risk tolerance to conservative' → update_household_details

The key distinction: questions start with 'what', 'when', 'who', 'how', 'show me', 'tell me'. Actions start with verbs like 'create', 'schedule', 'log', 'remind', 'add', 'update', 'make'.

If you are unsure whether a request is a question or an action, ANSWER IN TEXT first. Never proactively create tasks or take actions unless explicitly asked.

Tools available:
- update_household_details: Update risk tolerance, status, investment objective, or next action for a household.
- create_compliance_note: Log a compliance note, call summary, email log, or meeting note.
- schedule_meeting: Schedule a calendar event for an annual review, discovery call, or other meeting.
- add_financial_account: Add a new financial account linked to a household member.
- create_task: Create a task or reminder. Use when advisor says 'remind me', 'add a task', 'don't forget', 'follow up', or any similar request to remember something.

IMPORTANT: When you want to take an action, use the tool calling mechanism. Do NOT return JSON manually.

IMPORTANT DATE FORMAT RULE:
When using schedule_meeting or any tool that requires a date or time, ALWAYS format dates as ISO 8601: "2026-05-02T10:00:00". Never use natural language dates like "May 2nd" in tool arguments. Only use ISO format in tool calls.`;

const TOOLS = [
  {
    name: "update_household_details",
    description: "Update a household's risk tolerance, status, investment objective, or next action. Use when an advisor asks to change household settings.",
    input_schema: {
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
  {
    name: "create_compliance_note",
    description: "Log a compliance note for a household. Use when the advisor wants to record a note, call summary, email log, or meeting note.",
    input_schema: {
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
  {
    name: "schedule_meeting",
    description: "Schedule a calendar event/meeting. Use when the advisor asks to schedule a review, call, or meeting.",
    input_schema: {
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
  {
    name: "add_financial_account",
    description: "Add a new financial account linked to a contact/household member.",
    input_schema: {
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
  {
    name: "create_task",
    description: "Create a task or reminder for the advisor. Use when the advisor asks to be reminded of something, wants to create a to-do, or asks Goodie to follow up on something.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Clear, actionable task title. Start with a verb." },
        description: { type: "string", description: "Additional context or notes about the task." },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority. Default to medium." },
        household_id: { type: "string", description: "UUID of the linked household." },
        household_name: { type: "string", description: "Name of the household for confirmation display." },
      },
      required: ["title"],
    },
  },
];

async function retrieveRelevantContext(
  query: string,
  advisorId: string,
  supabaseAdmin: any,
  openAiKey: string
): Promise<string> {
  try {
    const embeddingResponse = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: query,
        }),
      }
    );

    if (!embeddingResponse.ok) return "";

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    const { data: matches, error } = await supabaseAdmin.rpc(
      "match_embeddings",
      {
        query_embedding: queryEmbedding,
        match_advisor_id: advisorId,
        match_count: 5,
        filter_table: null,
      }
    );

    if (error || !matches?.length) return "";

    const contextLines = matches
      .filter((m: any) => m.similarity > 0.5)
      .map((m: any) =>
        `[${m.table_name.toUpperCase()}]\n${m.content}`
      )
      .join("\n\n---\n\n");

    return contextLines
      ? `\n\n--- RELEVANT RECORDS ---\n${contextLines}`
      : "";
  } catch (e) {
    console.error("RAG retrieval error:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") 
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, context } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array required" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) 
      throw new Error("ANTHROPIC_API_KEY is not configured");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const advisorId = user.id;

    const today = new Date();
    const todayStr = today.toLocaleDateString(
      "en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );
    // Static — will be cached
    // Never changes between calls
    const staticSystem = SYSTEM_PROMPT;

    // Dynamic — built fresh each call
    // Date, advisor context, RAG
    let dynamicContext =
      `\n\nToday's date is ${todayStr}.` +
      ` Use this for all date calculations,` +
      ` scheduling, and relative date` +
      ` references like 'tomorrow',` +
      ` 'next week', 'end of month' etc.`;
    if (context) {
      dynamicContext += `\n\n--- ADVISOR OVERVIEW ---\n${context}`;
    }

    if (OPENAI_API_KEY && messages?.length) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m: any) => m.role === "user");
      if (lastUserMessage?.content) {
        const ragContext = await retrieveRelevantContext(
          lastUserMessage.content,
          advisorId,
          supabaseAdmin,
          OPENAI_API_KEY
        );
        if (ragContext) {
          dynamicContext += ragContext;
        }
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6-20251113",
        max_tokens: 600,
        system: [
          {
            type: "text",
            text: staticSystem,
            cache_control: {
              type: "ephemeral"
            }
          },
          {
            type: "text",
            text: dynamicContext,
          }
        ],
        messages: messages,
        tools: TOOLS,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again shortly." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta"
            ) {
              const chunk = {
                choices: [{ 
                  delta: { content: event.delta.text } 
                }],
              };
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify(chunk)}\n\n`
                )
              );
            }

            if (
              event.type === "content_block_start" &&
              event.content_block?.type === "tool_use"
            ) {
              const chunk = {
                choices: [{
                  delta: {
                    tool_calls: [{
                      index: 0,
                      id: event.content_block.id,
                      type: "function",
                      function: {
                        name: event.content_block.name,
                        arguments: "",
                      },
                    }],
                  },
                }],
              };
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify(chunk)}\n\n`
                )
              );
            }

            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "input_json_delta"
            ) {
              const chunk = {
                choices: [{
                  delta: {
                    tool_calls: [{
                      index: 0,
                      function: {
                        arguments: event.delta.partial_json,
                      },
                    }],
                  },
                }],
              };
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify(chunk)}\n\n`
                )
              );
            }

            if (event.type === "message_stop") {
              controller.enqueue(
                new TextEncoder().encode("data: [DONE]\n\n")
              );
            }

          } catch {
          }
        }
      },
    });

    return new Response(
      response.body!.pipeThrough(transformStream),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "text/event-stream" 
        },
      }
    );

  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ 
        error: e instanceof Error ? e.message : "Unknown error" 
      }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
