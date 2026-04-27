import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function embedRecord(
  tableName: string,
  record: any,
  advisorId: string,
  openAiKey: string,
  supabase: any
) {
  let content = "";
  
  switch (tableName) {
    case "households":
      content = [
        `Household: ${record.name}`,
        record.wealth_tier ? `Tier: ${record.wealth_tier}` : null,
        record.total_aum ? `AUM: $${Number(record.total_aum).toLocaleString()}` : null,
        record.status ? `Status: ${record.status}` : null,
        record.risk_tolerance ? `Risk Tolerance: ${record.risk_tolerance}` : null,
        record.investment_objective ? `Investment Objective: ${record.investment_objective}` : null,
        record.next_action ? `Next Action: ${record.next_action}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "compliance_notes":
      content = [
        `Note Type: ${record.type}`,
        `Date: ${record.date}`,
        record.summary ? `Summary: ${record.summary}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "calendar_events":
      content = [
        `Meeting: ${record.title}`,
        `Type: ${record.event_type}`,
        `Start: ${record.start_time}`,
        record.description ? `Description: ${record.description}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "tasks":
      content = [
        `Task: ${record.title}`,
        record.description ? `Description: ${record.description}` : null,
        `Status: ${record.status}`,
        record.due_date ? `Due Date: ${record.due_date}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "household_members":
      content = [
        `Member: ${record.first_name} ${record.last_name}`,
        record.relationship ? `Relationship: ${record.relationship}` : null,
        record.email ? `Email: ${record.email}` : null,
        record.phone ? `Phone: ${record.phone}` : null,
        record.date_of_birth ? `Date of Birth: ${record.date_of_birth}` : null,
        record.job_title ? `Job Title: ${record.job_title}` : null,
        record.company ? `Company: ${record.company}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "contact_accounts":
      content = [
        `Account: ${record.account_name}`,
        `Type: ${record.account_type}`,
        record.balance ? `Balance: $${Number(record.balance).toLocaleString()}` : null,
        record.institution ? `Institution: ${record.institution}` : null,
        record.status ? `Status: ${record.status}` : null,
      ].filter(Boolean).join("\n");
      break;

    default:
      content = JSON.stringify(record);
  }

  if (!content) return;

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
        input: content,
      }),
    }
  );

  if (!embeddingResponse.ok) return;

  const embeddingData = 
    await embeddingResponse.json();
  const embedding = 
    embeddingData.data[0].embedding;

  await supabase
    .from("embeddings")
    .upsert(
      {
        record_id: record.id,
        table_name: tableName,
        content,
        embedding,
        advisor_id: advisorId,
        metadata: { 
          table: tableName,
          backfilled: true 
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "record_id,table_name" }
    );
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, 
      { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = 
      Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY)
      throw new Error(
        "OPENAI_API_KEY not configured"
      );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = 
      req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = 
      await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const advisorId = user.id;
    let totalEmbedded = 0;
    const { table } = await req.json()
      .catch(() => ({ table: "households" }));

    switch(table) {
      case "households": {
        const { data } = await supabase
          .from("households")
          .select("*")
          .eq("advisor_id", advisorId)
          .is("archived_at", null);
        for (const record of data || []) {
          await embedRecord(
            "households", record,
            advisorId, OPENAI_API_KEY, 
            supabase
          );
          totalEmbedded++;
        }
        break;
      }
      case "compliance_notes": {
        const { data } = await supabase
          .from("compliance_notes")
          .select("*")
          .eq("advisor_id", advisorId);
        for (const record of data || []) {
          await embedRecord(
            "compliance_notes", record,
            advisorId, OPENAI_API_KEY,
            supabase
          );
          totalEmbedded++;
        }
        break;
      }
      case "calendar_events": {
        const { data } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("advisor_id", advisorId);
        for (const record of data || []) {
          await embedRecord(
            "calendar_events", record,
            advisorId, OPENAI_API_KEY,
            supabase
          );
          totalEmbedded++;
        }
        break;
      }
      case "tasks": {
        const { data } = await supabase
          .from("tasks")
          .select("*")
          .eq("advisor_id", advisorId);
        for (const record of data || []) {
          await embedRecord(
            "tasks", record,
            advisorId, OPENAI_API_KEY,
            supabase
          );
          totalEmbedded++;
        }
        break;
      }
      case "household_members": {
        const { data } = await supabase
          .from("household_members")
          .select("*")
          .eq("advisor_id", advisorId)
          .is("archived_at", null);
        for (const record of data || []) {
          await embedRecord(
            "household_members", record,
            advisorId, OPENAI_API_KEY,
            supabase
          );
          totalEmbedded++;
        }
        break;
      }
      case "contact_accounts": {
        const { data } = await supabase
          .from("contact_accounts")
          .select("*")
          .eq("advisor_id", advisorId)
          .eq("status", "active");
        for (const record of data || []) {
          await embedRecord(
            "contact_accounts", record,
            advisorId, OPENAI_API_KEY,
            supabase
          );
          totalEmbedded++;
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_embedded: totalEmbedded,
        advisor_id: advisorId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (e) {
    console.error("backfill error:", e);
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