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
        record.household_name ? `Household: ${record.household_name}` : null,
        record.tagged_contact_names?.length
          ? `Contacts: ${record.tagged_contact_names.join(", ")}`
          : null,
        `Note Type: ${record.type}`,
        `Date: ${record.date}`,
        record.summary ? `Summary: ${record.summary}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "calendar_events":
      content = [
        record.household_name ? `Household: ${record.household_name}` : null,
        `Meeting: ${record.title}`,
        `Type: ${record.event_type}`,
        `Start: ${record.start_time}`,
        record.description ? `Description: ${record.description}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "tasks":
      content = [
        record.household_name ? `Household: ${record.household_name}` : null,
        `Task: ${record.title}`,
        record.description ? `Description: ${record.description}` : null,
        `Status: ${record.status}`,
        record.due_date ? `Due Date: ${record.due_date}` : null,
      ].filter(Boolean).join("\n");
      break;

    case "household_members":
      content = [
        record.household_name ? `Household: ${record.household_name}` : null,
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
        record.household_name ? `Household: ${record.household_name}` : null,
        record.member_name ? `Owner: ${record.member_name}` : null,
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

  if (!content) {
    throw new Error(`empty content for ${tableName} ${record.id}`);
  }

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

  if (!embeddingResponse.ok) {
    const errText = await embeddingResponse.text().catch(() => "<no body>");
    throw new Error(
      `OpenAI ${embeddingResponse.status} ${embeddingResponse.statusText}: ${errText.slice(0, 300)}`,
    );
  }

  const embeddingData = await embeddingResponse.json();
  const embedding = embeddingData?.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error(
      `OpenAI returned no embedding: ${JSON.stringify(embeddingData).slice(0, 300)}`,
    );
  }

  const { error: upsertError } = await supabase
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
          backfilled: true,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "record_id,table_name" },
    );

  if (upsertError) {
    throw new Error(
      `upsert failed for ${tableName} ${record.id}: ${upsertError.message}`,
    );
  }
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
    let totalFailed = 0;
    const sampleErrors: string[] = [];
    const trackEmbed = async (fn: () => Promise<void>) => {
      try {
        await fn();
        totalEmbedded++;
      } catch (e) {
        totalFailed++;
        if (sampleErrors.length < 3) {
          sampleErrors.push(e instanceof Error ? e.message : String(e));
        }
      }
    };
    const { table } = await req.json()
      .catch(() => ({ table: "households" }));

    // Build a household_id -> name lookup once (lets us enrich every embed
    // text with the household surname, so semantic search by family name hits).
    const { data: hhRows } = await supabase
      .from("households")
      .select("id, name")
      .eq("advisor_id", advisorId);
    const householdNameById: Record<string, string> = {};
    (hhRows || []).forEach((h: any) => { householdNameById[h.id] = h.name; });

    switch(table) {
      case "households": {
        const { data } = await supabase
          .from("households")
          .select("*")
          .eq("advisor_id", advisorId)
          .is("archived_at", null);
        for (const record of data || []) {
          await trackEmbed(() =>
            embedRecord("households", record, advisorId, OPENAI_API_KEY, supabase),
          );
        }
        break;
      }
      case "compliance_notes": {
        const { data } = await supabase
          .from("compliance_notes")
          .select("*")
          .eq("advisor_id", advisorId);

        // Bulk-fetch all tagged contact links at once.
        const noteIds = (data || []).map((n: any) => n.id);
        const { data: links } = noteIds.length
          ? await supabase
              .from("compliance_note_contacts")
              .select("compliance_note_id, household_members(first_name, last_name)")
              .in("compliance_note_id", noteIds)
          : { data: [] as any[] };
        const tagsByNote: Record<string, string[]> = {};
        (links || []).forEach((l: any) => {
          if (!l.household_members) return;
          const name = `${l.household_members.first_name} ${l.household_members.last_name}`;
          (tagsByNote[l.compliance_note_id] ||= []).push(name);
        });

        for (const record of data || []) {
          const enriched = {
            ...record,
            household_name: householdNameById[record.household_id] || null,
            tagged_contact_names: tagsByNote[record.id] || [],
          };
          await trackEmbed(() =>
            embedRecord("compliance_notes", enriched, advisorId, OPENAI_API_KEY, supabase),
          );
        }
        break;
      }
      case "calendar_events": {
        const { data } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("advisor_id", advisorId);
        for (const record of data || []) {
          const enriched = {
            ...record,
            household_name: record.household_id
              ? householdNameById[record.household_id] || null
              : null,
          };
          await trackEmbed(() =>
            embedRecord("calendar_events", enriched, advisorId, OPENAI_API_KEY, supabase),
          );
        }
        break;
      }
      case "tasks": {
        const { data } = await supabase
          .from("tasks")
          .select("*")
          .eq("advisor_id", advisorId);
        for (const record of data || []) {
          const enriched = {
            ...record,
            household_name: record.household_id
              ? householdNameById[record.household_id] || null
              : null,
          };
          await trackEmbed(() =>
            embedRecord("tasks", enriched, advisorId, OPENAI_API_KEY, supabase),
          );
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
          const enriched = {
            ...record,
            household_name: record.household_id
              ? householdNameById[record.household_id] || null
              : null,
          };
          await trackEmbed(() =>
            embedRecord("household_members", enriched, advisorId, OPENAI_API_KEY, supabase),
          );
        }
        break;
      }
      case "contact_accounts": {
        const { data } = await supabase
          .from("contact_accounts")
          .select("*, household_members!inner(first_name, last_name, household_id)")
          .eq("advisor_id", advisorId)
          .eq("status", "active");
        for (const record of data || []) {
          const m: any = (record as any).household_members;
          const enriched = {
            ...record,
            member_name: m ? `${m.first_name} ${m.last_name}` : null,
            household_name: m?.household_id
              ? householdNameById[m.household_id] || null
              : null,
          };
          await trackEmbed(() =>
            embedRecord("contact_accounts", enriched, advisorId, OPENAI_API_KEY, supabase),
          );
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: totalFailed === 0,
        total_embedded: totalEmbedded,
        total_failed: totalFailed,
        sample_errors: sampleErrors,
        advisor_id: advisorId,
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