import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, RotateCcw, StopCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useHouseholds, useAllComplianceNotes } from "@/hooks/useHouseholds";
import { useTasks } from "@/hooks/useTasks";
import { useProspects } from "@/hooks/useProspects";
import { useUpcomingEvents } from "@/hooks/useCalendarEvents";
import { streamChat, buildContextSnapshot } from "@/lib/aiChat";
import { useAiActions, getActionDescription, type ParsedToolCall } from "@/hooks/useAiActions";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "What's my total AUM and how many active households do I have?",
  "Which clients are due for an annual review soon?",
  "Show me my top households by AUM",
  "What tasks are overdue?",
  "Summarize my pipeline",
  "Which households are missing a service timeline?",
];

export default function GoodieChat() {
  const { user } = useAuth();
  const { data: households = [] } = useHouseholds();
  const { data: allTasks = [] } = useTasks("mine");
  const { data: prospects = [] } = useProspects();
  const { data: calendarEvents = [] } = useUpcomingEvents(100);
  const { data: recentNotes = [] } = useAllComplianceNotes();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Advisor";

  const welcomeMessage = (): Message => ({
    id: "welcome",
    role: "assistant",
    content: `Hi ${firstName}! 👋 I'm Goodie, your GL Nexus AI. Ask me anything about your book, or tell me to take action — schedule a meeting, log a note, create a task, and more. What can I help you with?`,
    timestamp: new Date(),
  });

  const [messages, setMessages] = useState<Message[]>([welcomeMessage()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState<ParsedToolCall | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const { executeAction } = useAiActions();

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      abortRef.current = false;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const context = buildContextSnapshot(
        households as any,
        recentNotes as any,
        prospects as any,
        calendarEvents as any
      );

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        await streamChat({
          messages: apiMessages,
          context,
          onDelta: (chunk) => {
            if (abortRef.current) return;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + chunk,
                };
              }
              return updated;
            });
          },
          onToolCalls: (calls) => {
            if (calls.length > 0) {
              setPendingToolCall(calls[0]);
            }
          },
          onDone: () => {
            setIsLoading(false);
          },
          onError: () => {
            setIsLoading(false);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: "Sorry, something went wrong. Please try again.",
              };
              return updated;
            });
          },
        });
      } catch {
        setIsLoading(false);
      }
    },
    [isLoading, messages, households, recentNotes, prospects, calendarEvents]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingToolCall) return;
    try {
      const result = await executeAction(pendingToolCall);
      setPendingToolCall(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: result || "Done! Action completed.",
          timestamp: new Date(),
        },
      ]);
      toast.success(result);
    } catch (err: any) {
      const msg = err?.message || "Action failed";
      toast.error(msg);
      setPendingToolCall(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Sorry — ${msg}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleCancelAction = () => {
    setPendingToolCall(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "No problem — action cancelled.",
        timestamp: new Date(),
      },
    ]);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hi ${firstName}! 👋 I'm Goodie, your GL Nexus AI. What can I help you with?`,
        timestamp: new Date(),
      },
    ]);
    setPendingToolCall(null);
  };

  const isEmpty = messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">Goodie</h1>
            <p className="text-xs text-muted-foreground">Your GL Nexus AI</p>
          </div>
        </div>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {/* Goodie avatar */}
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
              )}

              {/* Message bubble */}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                )}
              >
                {msg.content || (
                  isLoading && idx === messages.length - 1 ? (
                    <div className="flex gap-1 py-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
                    </div>
                  ) : null
                )}
              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold text-foreground">
                  {firstName[0].toUpperCase()}
                </div>
              )}
            </div>
          ))}

          {/* Tool confirmation */}
          {pendingToolCall && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 max-w-[85%] rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">
                  Proposed Action
                </p>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-4">
                  {getActionDescription(pendingToolCall.name, pendingToolCall.args)}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConfirmAction}>
                    <Check className="w-4 h-4 mr-1.5" />
                    Confirm
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelAction}>
                    <X className="w-4 h-4 mr-1.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested prompts — show only on empty chat */}
        {isEmpty && (
          <div className="max-w-3xl mx-auto px-6 pb-6">
            <p className="text-xs font-medium text-muted-foreground mb-3 px-1">
              Try asking...
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground hover:bg-secondary/60 hover:border-primary/30 transition-colors leading-snug"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-background">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-4 py-3 focus-within:border-primary/40 transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Goodie anything about your book..."
              className="flex-1 resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[24px] max-h-[200px] shadow-none"
              rows={1}
            />
            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 p-0 rounded-xl shrink-0"
            >
              {isLoading ? (
                <StopCircle className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Goodie can make mistakes. Always verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
