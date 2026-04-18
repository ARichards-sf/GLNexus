import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/sampleData";
import type { ParsedToolCall } from "@/hooks/useAiActions";

export type AiMsg = { role: "user" | "assistant"; content: string; toolCalls?: ParsedToolCall[] };

export function buildContextSnapshot(households: any[], notes: any[], prospects?: any[]): string {
  const totalAUM = households.reduce((s, h) => s + Number(h.total_aum), 0);
  const active = households.filter((h) => h.status === "Active").length;
  const now = new Date();
  const upcoming = households
    .filter((h) => {
      if (!h.annual_review_date) return false;
      const d = new Date(h.annual_review_date);
      const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 60;
    })
    .sort(
      (a: any, b: any) =>
        new Date(a.annual_review_date).getTime() - new Date(b.annual_review_date).getTime()
    );

  let ctx = `Total AUM: ${formatCurrency(totalAUM)}\nHouseholds: ${households.length} total, ${active} active\n\n`;
  ctx += "HOUSEHOLDS (id | name | AUM | status | risk):\n";
  const sorted = [...households].sort((a, b) => Number(b.total_aum) - Number(a.total_aum));
  sorted.forEach((h) => {
    ctx += `${h.id} | ${h.name} | ${formatCurrency(Number(h.total_aum))} | ${h.status} | ${h.risk_tolerance}`;
    if (h.next_action) ctx += ` | Next: ${h.next_action}`;
    ctx += "\n";
  });

  if (upcoming.length > 0) {
    ctx += "\nUPCOMING REVIEWS (next 60 days):\n";
    upcoming.forEach((h: any) => {
      ctx += `- ${h.name}: ${new Date(h.annual_review_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}\n`;
    });
  }

  if (notes.length > 0) {
    ctx += "\nRECENT ACTIVITY:\n";
    notes.slice(0, 8).forEach((n: any) => {
      ctx += `- [${n.type}] ${(n as any).households?.name || "Household"}: ${n.summary.slice(0, 120)} (${new Date(n.date).toLocaleDateString()})\n`;
    });
  }

  const activeProspects = (prospects || []).filter(
    (p) => p.pipeline_stage !== "converted" && p.pipeline_stage !== "lost"
  );
  if (activeProspects.length > 0) {
    ctx += "\nPROSPECT PIPELINE:\n";
    ctx += `${activeProspects.length} active prospects\n`;
    activeProspects.forEach((p: any) => {
      ctx += `- ${p.first_name} ${p.last_name}`;
      if (p.company) ctx += ` (${p.company})`;
      ctx += ` | Stage: ${p.pipeline_stage}`;
      if (p.estimated_aum) ctx += ` | Est. AUM: $${Number(p.estimated_aum).toLocaleString()}`;
      if (p.source) ctx += ` | Source: ${p.source}`;
      ctx += "\n";
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
