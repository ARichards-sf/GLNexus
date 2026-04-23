import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/sampleData";
import type { ParsedToolCall } from "@/hooks/useAiActions";

export type AiMsg = { role: "user" | "assistant"; content: string; toolCalls?: ParsedToolCall[] };

export function buildContextSnapshot(
  households: any[],
  notes: any[],
  prospects?: any[],
  calendarEvents?: any[]
): string {
  const totalAUM = households.reduce(
    (s, h) => s + Number(h.total_aum), 0
  );
  const active = households.filter(
    h => h.status === "Active"
  ).length;
  const now = new Date();
  const todayStr = now.toDateString();
  const fourteenDaysFromNow =
    new Date(now);
  fourteenDaysFromNow.setDate(
    fourteenDaysFromNow.getDate() + 14
  );

  // Lean overview — just the numbers
  let ctx =
    `Book: ${formatCurrency(totalAUM)} ` +
    `across ${households.length} ` +
    `households (${active} active)\n`;

  // Household ID map — essential for
  // tool calls (schedule, log note etc)
  // Keep tier and AUM for context
  ctx += "\nHOUSEHOLDS:\n";
  const sorted = [...households].sort(
    (a, b) => Number(b.total_aum) -
              Number(a.total_aum)
  );
  sorted.forEach(h => {
    ctx += `${h.id} | ${h.name}`;
    if (h.wealth_tier)
      ctx += ` | ${h.wealth_tier}`;
    ctx += ` | ${formatCurrency(
      Number(h.total_aum)
    )}`;
    ctx += "\n";
  });

  // Calendar — keep full 14-day window
  // RAG can't handle scheduling conflicts
  const upcomingEvents = (
    calendarEvents || []
  ).filter((e: any) => {
    const start = new Date(e.start_time);
    return (
      e.status === "scheduled" &&
      start >= now &&
      start <= fourteenDaysFromNow
    );
  });

  if (upcomingEvents.length > 0) {
    ctx +=
      "\nCALENDAR (next 14 days — " +
      "avoid scheduling conflicts):\n";
    upcomingEvents.forEach((e: any) => {
      const target =
        e.households?.name ||
        (e.prospects
          ? `${e.prospects.first_name} ${e.prospects.last_name}`
          : null) ||
        e.title;
      ctx += `- ${new Date(e.start_time)
        .toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })} | ${e.event_type} | ${target}\n`;
    });
  }

  // Today's meetings highlighted
  const todaysMeetings = (
    calendarEvents || []
  ).filter((e: any) =>
    new Date(e.start_time)
      .toDateString() === todayStr
  );

  if (todaysMeetings.length > 0) {
    ctx += "\nTODAY'S MEETINGS:\n";
    todaysMeetings.forEach((e: any) => {
      ctx += `- ${new Date(e.start_time)
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })} ${e.title}\n`;
    });
  }

  // Active prospects — keep for pipeline
  // questions and referral context
  const activeProspects = (
    prospects || []
  ).filter(p =>
    p.pipeline_stage !== "converted" &&
    p.pipeline_stage !== "lost"
  );

  if (activeProspects.length > 0) {
    ctx += `\nPIPELINE: ` +
      `${activeProspects.length} ` +
      `active prospects\n`;
    activeProspects.forEach((p: any) => {
      ctx += `- ${p.first_name} ` +
        `${p.last_name}`;
      if (p.estimated_aum)
        ctx += ` | $${Number(
          p.estimated_aum
        ).toLocaleString()}`;
      ctx += ` | ${p.pipeline_stage}\n`;
    });
  }

  return ctx;
}

export async function streamChat({
  messages,
  context,
  onDelta,
  onToolCalls,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  context: string;
  onDelta: (t: string) => void;
  onToolCalls: (calls: ParsedToolCall[]) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    onError("Not authenticated.");
    return;
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, context }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    onError(body.error || "Something went wrong");
    return;
  }
  if (!resp.body) {
    onError("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const toolCallAccum: Record<number, { id: string; name: string; args: string }> = {};

  const flushToolCalls = () => {
    const calls = Object.values(toolCallAccum);
    if (calls.length > 0) {
      onToolCalls(
        calls.map((c) => ({
          id: c.id,
          name: c.name,
          args: (() => {
            try {
              return JSON.parse(c.args);
            } catch {
              return {};
            }
          })(),
          status: "pending" as const,
        }))
      );
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        flushToolCalls();
        onDone();
        return;
      }
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.content) onDelta(delta.content);
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const tcIdx = tc.index ?? 0;
            if (!toolCallAccum[tcIdx]) {
              toolCallAccum[tcIdx] = { id: tc.id || `tc_${tcIdx}`, name: "", args: "" };
            }
            if (tc.function?.name) toolCallAccum[tcIdx].name = tc.function.name;
            if (tc.function?.arguments) toolCallAccum[tcIdx].args += tc.function.arguments;
            if (tc.id) toolCallAccum[tcIdx].id = tc.id;
          }
        }
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  flushToolCalls();
  onDone();
}
