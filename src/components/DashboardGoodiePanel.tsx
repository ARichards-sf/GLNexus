import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useHouseholds, useAllComplianceNotes } from "@/hooks/useHouseholds";
import { useAiActions, type ParsedToolCall } from "@/hooks/useAiActions";
import { buildContextSnapshot, streamChat, type AiMsg } from "@/lib/aiChat";
import ActionCard from "@/components/ActionCard";

export default function DashboardGoodiePanel() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  const [messages, setMessages] = useState<AiMsg[]>([
    {
      role: "assistant",
      content: `Hi ${firstName}! 👋 I'm Goodie, your GL Nexus Assistant. I can answer questions about your book of business — and also **take actions** like scheduling meetings, logging notes, and updating households. How can I help?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: households = [] } = useHouseholds();
  const { data: recentNotes = [] } = useAllComplianceNotes();
  const { executeAction } = useAiActions();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleConfirm = useCallback(
    async (tc: ParsedToolCall) => {
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          toolCalls: m.toolCalls?.map((t) =>
            t.id === tc.id ? { ...t, status: "confirmed" as const } : t
          ),
        }))
      );
      try {
        const result = await executeAction(tc);
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((t) =>
              t.id === tc.id ? { ...t, status: "executed" as const, result } : t
            ),
          }))
        );
        toast.success(result);
      } catch (err: any) {
        const errMsg = err?.message || "Action failed";
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((t) =>
              t.id === tc.id ? { ...t, status: "error" as const, result: errMsg } : t
            ),
          }))
        );
        toast.error(errMsg);
      }
    },
    [executeAction]
  );

  const handleReject = useCallback((tc: ParsedToolCall) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        toolCalls: m.toolCalls?.map((t) =>
          t.id === tc.id ? { ...t, status: "rejected" as const } : t
        ),
      }))
    );
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    const userMsg: AiMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const context = buildContextSnapshot(households, recentNotes);
    let assistantSoFar = "";
    const apiMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.toolCalls) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: apiMessages,
        context,
        onDelta: upsert,
        onToolCalls: (calls) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, toolCalls: calls } : m
              );
            }
            return [...prev, { role: "assistant", content: "", toolCalls: calls }];
          });
        },
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
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="mt-2 space-y-2 flex flex-col items-start">
                {m.toolCalls.map((tc) => (
                  <ActionCard
                    key={tc.id}
                    toolCall={tc}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
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

      <div className="border-t border-border px-4 py-3 bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Ask or give instructions…"
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
    </>
  );
}
