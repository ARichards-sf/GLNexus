import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildContentText(
  tableName: string,
  record: Record<string, any>
): string {
  switch (tableName) {
    case "households":
      return [
        `Household: ${record.name}`,
        record.wealth_tier ? 
          `Tier: ${record.wealth_tier}` : null,
        record.total_aum ? 
          `AUM: $${Number(record.total_aum).toLocaleString()}` : null,
        record.status ? 
          `Status: ${record.status}` : null,
        record.risk_tolerance ? 
          `Risk Tolerance: ${record.risk_tolerance}` : null,
        record.investment_objective ? 
          `Investment Objective: ${record.investment_objective}` : null,
        record.next_action ? 
          `Next Action: ${record.next_action}` : null,
        record.annual_review_date ? 
          `Annual Review Date: ${record.annual_review_date}` : null,
      ].filter(Boolean).join("\n");

    case "household_members":
      return [
        `Member: ${record.first_name} ${record.last_name}`,
        record.relationship ? 
          `Relationship: ${record.relationship}` : null,
        record.email ? 
          `Email: ${record.email}` : null,
        record.phone ? 
          `Phone: ${record.phone}` : null,
        record.date_of_birth ? 
          `Date of Birth: ${record.date_of_birth}` : null,
        record.job_title ? 
          `Job Title: ${record.job_title}` : null,
        record.company ? 
          `Company: ${record.company}` : null,
      ].filter(Boolean).join("\n");

    case "compliance_notes":
      return [
        `Compliance Note Type: ${record.type}`,
        `Date: ${record.date}`,
        record.summary ? 
          `Summary: ${record.summary}` : null,
        record.pillars_covered?.length ? 
          `Topics Covered: ${record.pillars_covered.join(", ")}` : null,
      ].filter(Boolean).join("\n");

    case "calendar_events":
      return [
        `Meeting: ${record.title}`,
        `Type: ${record.event_type}`,
        `Start: ${record.start_time}`,
        `End: ${record.end_time}`,
        record.description ? 
          `Description: ${record.description}` : null,
        record.location ? 
          `Location: ${record.location}` : null,
      ].filter(Boolean).join("\n");

    case "tasks":
      return [
        `Task: ${record.title}`,
        record.description ? 
          `Description: ${record.description}` : null,
        `Status: ${record.status}`,
        `Priority: ${record.priority}`,
        record.due_date ? 
          `Due Date: ${record.due_date}` : null,
        record.task_type ? 
          `Type: ${record.task_type}` : null,
        record.completed_at ? 
          `Completed: ${record.completed_at}` : null,
      ].filter(Boolean).join("\n");

    case "contact_accounts":
      return [
        `Account: ${record.account_name}`,
        `Type: ${record.account_type}`,
        record.balance ? 
          `Balance: $${Number(record.balance).toLocaleString()}` : null,
        record.institution ? 
          `Institution: ${record.institution}` : null,
        record.account_number ? 
          `Account Number: ${record.account_number}` : null,
        record.status ? 
          `Status: ${record.status}` : null,
      ].filter(Boolean).join("\n");

    case "touchpoints":
      return [
        `Touchpoint: ${record.name}`,
        `Type: ${record.touchpoint_type}`,
        `Scheduled: ${record.scheduled_date}`,
        `Status: ${record.status}`,
        record.notes ? 
          `Notes: ${record.notes}` : null,
        record.completed_date ? 
          `Completed: ${record.completed_date}` : null,
      ].filter(Boolean).join("\n");

    default:
      return JSON.stringify(record);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = 
      Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY)
      throw new Error("OPENAI_API_KEY not configured");

    const supabaseUrl = 
      Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(
      supabaseUrl, 
      supabaseServiceKey
    );

    const { 
      table_name, 
      record, 
      advisor_id 
    } = await req.json();

    if (!table_name || !record || !advisor_id) {
      return new Response(
        JSON.stringify({ 
          error: "table_name, record, and advisor_id required" 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json" 
          } 
        }
      );
    }

    const content = buildContentText(
      table_name, record
    );

    const embeddingResponse = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: content,
        }),
      }
    );

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      throw new Error(`OpenAI error: ${error}`);
    }

    const embeddingData = 
      await embeddingResponse.json();
    const embedding = 
      embeddingData.data[0].embedding;

    const { error: upsertError } = 
      await supabase
        .from("embeddings")
        .upsert(
          {
            record_id: record.id,
            table_name,
            content,
            embedding,
            advisor_id,
            metadata: {
              table: table_name,
              record_id: record.id,
              updated_at: new Date()
                .toISOString(),
            },
            updated_at: new Date()
              .toISOString(),
          },
          { 
            onConflict: "record_id,table_name" 
          }
        );

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_length: content.length 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (e) {
    console.error("embed-record error:", e);
    return new Response(
      JSON.stringify({ 
        error: e instanceof Error ? 
          e.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});