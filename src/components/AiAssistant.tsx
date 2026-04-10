import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, X, Loader2 } from "lucide-react";
import { useHouseholds, useAllComplianceNotes } from "@/hooks/useHouseholds";
import { formatCurrency } from "@/data/sampleData";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Msg = { role: "user" | "assistant"; content: string };

function buildContextSnapshot(
  households: any[],
  notes: any[]
): string {
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
    .sort((a: any, b: any) => new Date(a.annual_review_date).getTime() - new Date(b.annual_review_date).getTime());

  let ctx = `Total AUM: ${formatCurrency(totalAUM)}\n`;
  ctx += `Households: ${households.length} total, ${active} active\n\n`;

  ctx += "TOP HOUSEHOLDS BY AUM:\n";
  const sorted = [...households].sort((a, b) => Number(b.total_aum) - Number(a.total_aum)).slice(0, 10);
  sorted.forEach((h, i) => {
    ctx += `${i + 1}. ${h.name} — ${formatCurrency(Number(h.total_aum))} | ${h.status} | Risk: ${h.risk_tolerance}`;
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

  return ctx;
}

async function streamChat({
  messages,
  context,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  context: string;
  onDelta: (t: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    onError("Not authenticated. Please sign in.");
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
  if (!resp.body) { onError("No response body"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

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
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: households = [] } = useHouseholds();
  const { data: recentNotes = [] } = useAllComplianceNotes();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const context = buildContextSnapshot(households, recentNotes);
    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        context,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        onError: (msg) => {
          toast.error(msg);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error("Failed to reach the AI assistant.");
      setIsLoading(false);
    }
  }, [input, isLoading, messages, households, recentNotes]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        >
          <Bot className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            GL Nexus Assistant
          </SheetTitle>
          <SheetDescription className="sr-only">AI assistant for managing your book of business</SheetDescription>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-12">
              <Bot className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">How can I help?</p>
              <p className="mt-1 text-xs">Ask about your households, AUM, upcoming reviews, or compliance notes.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Ask about your book of business…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
