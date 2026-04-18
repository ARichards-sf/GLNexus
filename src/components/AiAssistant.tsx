import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Bot, Send, Loader2, Mic, MicOff, DollarSign, CalendarCheck, Users, Bell } from "lucide-react";
import { useHouseholds, useAllComplianceNotes } from "@/hooks/useHouseholds";
import { useProspects } from "@/hooks/useProspects";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ParsedToolCall, useAiActions } from "@/hooks/useAiActions";
import ActionCard from "@/components/ActionCard";
import { buildContextSnapshot, streamChat, type AiMsg as Msg } from "@/lib/aiChat";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@/hooks/useSpeechInput";

const PROMPT_CHIPS = [
  {
    icon: DollarSign,
    label: "What's my total AUM?",
    prompt: "What is my total AUM?",
  },
  {
    icon: CalendarCheck,
    label: "Which clients need a review?",
    prompt: "Which of my clients have annual reviews coming up or overdue?",
  },
  {
    icon: Users,
    label: "Show me my top households",
    prompt: "Show me my top 5 households by AUM",
  },
  {
    icon: Bell,
    label: "Remind me to follow up...",
    prompt: "Remind me to follow up with ",
  },
];

export default function AiAssistant() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const hideOnPage = pathname.startsWith("/admin") || pathname === "/settings";
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: `Hi ${firstName}! 👋 I'm Goodie, your GL Nexus Assistant. I can answer questions about your book of business — and now I can also **take actions** for you like scheduling meetings, logging notes, and updating households. How can I help?` },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { executeAction } = useAiActions();

  const { data: households = [] } = useHouseholds();
  const { data: recentNotes = [] } = useAllComplianceNotes();
  const { data: prospects = [] } = useProspects();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleConfirm = useCallback(async (tc: ParsedToolCall) => {
    // Update status to confirmed
    setMessages(prev => prev.map(m => ({
      ...m,
      toolCalls: m.toolCalls?.map(t => t.id === tc.id ? { ...t, status: "confirmed" as const } : t),
    })));

    try {
      const result = await executeAction(tc);
      setMessages(prev => prev.map(m => ({
        ...m,
        toolCalls: m.toolCalls?.map(t => t.id === tc.id ? { ...t, status: "executed" as const, result } : t),
      })));
      toast.success(result);
    } catch (err: any) {
      const errMsg = err?.message || "Action failed";
      setMessages(prev => prev.map(m => ({
        ...m,
        toolCalls: m.toolCalls?.map(t => t.id === tc.id ? { ...t, status: "error" as const, result: errMsg } : t),
      })));
      toast.error(errMsg);
    }
  }, [executeAction]);

  const handleReject = useCallback((tc: ParsedToolCall) => {
    setMessages(prev => prev.map(m => ({
      ...m,
      toolCalls: m.toolCalls?.map(t => t.id === tc.id ? { ...t, status: "rejected" as const } : t),
    })));
  }, []);

  const sendWithText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const context = buildContextSnapshot(households, recentNotes, prospects);
    let assistantSoFar = "";

    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.toolCalls) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
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
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, toolCalls: calls } : m);
            }
            return [...prev, { role: "assistant", content: "", toolCalls: calls }];
          });
        },
        onDone: () => setIsLoading(false),
        onError: (msg) => { toast.error(msg); setIsLoading(false); },
      });
    } catch {
      toast.error("Failed to reach the AI assistant.");
      setIsLoading(false);
    }
  }, [isLoading, messages, households, recentNotes, prospects]);

  const send = useCallback(() => sendWithText(input), [input, sendWithText]);

  const { isListening, isSupported, startListening, stopListening } = useSpeechInput((text) => {
    setInput(text);
    setTimeout(() => sendWithText(text), 100);
  });

  if (hideOnPage) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className={cn(
            "fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90",
            "2xl:hidden"
          )}
        >
          <Bot className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" hideOverlay className="w-[400px] sm:max-w-[400px] flex flex-col p-0 shadow-2xl">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            Goodie — GL Nexus Assistant
          </SheetTitle>
          <SheetDescription className="sr-only">AI assistant for managing your book of business</SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i}>
              <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}>
                  {m.content}
                </div>
              </div>
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mt-2 space-y-2 flex flex-col items-start">
                  {m.toolCalls.map((tc) => (
                    <ActionCard key={tc.id} toolCall={tc} onConfirm={handleConfirm} onReject={handleReject} />
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
          {messages.length === 1 && !isLoading && (
            <div className="px-4 pb-2 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
              <div className="flex flex-col gap-2">
                {PROMPT_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      if (chip.prompt.endsWith(" ")) {
                        setInput(chip.prompt);
                        setTimeout(() => {
                          const inputEl = document.querySelector(
                            "input[placeholder]"
                          ) as HTMLInputElement;
                          inputEl?.focus();
                        }, 50);
                      } else {
                        sendWithText(chip.prompt);
                      }
                    }}
                    className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary/60 hover:border-primary/30 transition-colors group text-sm"
                  >
                    <chip.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <span className="text-foreground/80 group-hover:text-foreground transition-colors">{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 items-center">
            <Input
              placeholder={isListening ? "Listening…" : "Ask or give instructions…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            {isSupported && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={cn(
                  "h-8 w-8 shrink-0 transition-colors",
                  isListening
                    ? "text-red-500 animate-pulse"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={isListening ? "Listening... click to stop" : "Click to speak"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
