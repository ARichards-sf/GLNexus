import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, RotateCcw, StopCircle, Check, X, Plus } from "lucide-react";
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

interface ChatTab {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const MAX_TABS = 6;
const STORAGE_KEY = "goodie_chat_tabs";
const ACTIVE_TAB_KEY = "goodie_active_tab";

const SUGGESTED_PROMPTS = [
  "What's my total AUM and how many active households do I have?",
  "Which clients are due for an annual review soon?",
  "Show me my top households by AUM",
  "What tasks are overdue?",
  "Summarize my pipeline",
  "Which households are missing a service timeline?",
];

function saveTabs(tabs: ChatTab[], activeId: string) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        tabs.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          messages: t.messages.map((m) => ({
            ...m,
            timestamp: m.timestamp.toISOString(),
          })),
        }))
      )
    );
    localStorage.setItem(ACTIVE_TAB_KEY, activeId);
  } catch {}
}

function loadTabs(): { tabs: ChatTab[]; activeId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_TAB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      tabs: parsed.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        messages: t.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      })),
      activeId: activeId || parsed[0]?.id || "",
    };
  } catch {
    return null;
  }
}

function makeWelcomeMessage(firstName: string): Message {
  return {
    id: "welcome-" + Date.now(),
    role: "assistant",
    content: `Hi ${firstName}! 👋 I'm Goodie, your GL Nexus AI. Ask me anything about your book, or tell me to take action — schedule a meeting, log a note, create a task, and more. What can I help you with?`,
    timestamp: new Date(),
  };
}

function makeNewTab(firstName: string): ChatTab {
  return {
    id: Date.now().toString(),
    title: "New Chat",
    messages: [makeWelcomeMessage(firstName)],
    createdAt: new Date(),
  };
}

export default function GoodieChat() {
  const { user } = useAuth();
  const { data: households = [] } = useHouseholds();
  const { data: allTasks = [] } = useTasks("mine");
  const { data: prospects = [] } = useProspects();
  const { data: calendarEvents = [] } = useUpcomingEvents(100);
  const { data: recentNotes = [] } = useAllComplianceNotes();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Advisor";

  const [tabs, setTabs] = useState<ChatTab[]>(() => {
    const saved = loadTabs();
    if (saved?.tabs?.length) return saved.tabs;
    return [makeNewTab(firstName)];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const saved = loadTabs();
    return saved?.activeId || "";
  });

  // Ensure activeTabId is valid
  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId) && tabs[0]) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const messages = activeTab?.messages || [];

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

  const updateActiveMessages = useCallback(
    (updater: (msgs: Message[]) => Message[]) => {
      setTabs((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTabId ? { ...t, messages: updater(t.messages) } : t
        );
        saveTabs(updated, activeTabId);
        return updated;
      });
    },
    [activeTabId]
  );

  const autoNameTab = useCallback(
    (text: string) => {
      const title = text.trim().slice(0, 32).trim();
      setTabs((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTabId && t.title === "New Chat" ? { ...t, title } : t
        );
        saveTabs(updated, activeTabId);
        return updated;
      });
    },
    [activeTabId]
  );

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

      updateActiveMessages((prev) => [...prev, userMsg]);
      autoNameTab(text.trim());
      setInput("");
      setIsLoading(true);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };
      updateActiveMessages((prev) => [...prev, assistantMsg]);

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
            updateActiveMessages((prev) => {
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
            updateActiveMessages((prev) => {
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
    [isLoading, messages, households, recentNotes, prospects, calendarEvents, updateActiveMessages, autoNameTab]
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
      updateActiveMessages((prev) => [
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
      updateActiveMessages((prev) => [
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
    updateActiveMessages((prev) => [
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
    const welcome = makeWelcomeMessage(firstName);
    setTabs((prev) => {
      const updated = prev.map((t) =>
        t.id === activeTabId ? { ...t, title: "New Chat", messages: [welcome] } : t
      );
      saveTabs(updated, activeTabId);
      return updated;
    });
    setPendingToolCall(null);
  };

  const handleNewTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) {
      setTabs((prev) => {
        const nonActive = prev
          .filter((t) => t.id !== activeTabId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (nonActive.length === 0) return prev;
        const filtered = prev.filter((t) => t.id !== nonActive[0].id);
        const newTab = makeNewTab(firstName);
        const updated = [...filtered, newTab];
        saveTabs(updated, newTab.id);
        setActiveTabId(newTab.id);
        return updated;
      });
      return;
    }
    const newTab = makeNewTab(firstName);
    setTabs((prev) => {
      const updated = [...prev, newTab];
      saveTabs(updated, newTab.id);
      return updated;
    });
    setActiveTabId(newTab.id);
  }, [tabs, activeTabId, firstName]);

  const handleCloseTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (tabs.length === 1) {
        const reset = makeNewTab(firstName);
        setTabs([reset]);
        setActiveTabId(reset.id);
        saveTabs([reset], reset.id);
        return;
      }
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const filtered = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabId) {
          const newActive = filtered[Math.min(idx, filtered.length - 1)];
          setActiveTabId(newActive.id);
          saveTabs(filtered, newActive.id);
        } else {
          saveTabs(filtered, activeTabId);
        }
        return filtered;
      });
    },
    [tabs, activeTabId, firstName]
  );

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      saveTabs(tabs, tabId);
      setPendingToolCall(null);
    },
    [tabs]
  );

  const isEmpty = messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <h1 className="text-sm font-semibold">Goodie</h1>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-xs text-muted-foreground gap-1.5 h-7"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Tabs bar */}
        <div className="flex items-center gap-1 px-4 pb-0 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => handleSwitchTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap max-w-[160px] group border border-b-0",
                tab.id === activeTabId
                  ? "bg-background border-border text-foreground -mb-px"
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <span className="truncate max-w-[100px]">{tab.title}</span>
              <button
                onClick={(e) => handleCloseTab(tab.id, e)}
                className={cn(
                  "shrink-0 rounded-sm p-0.5 transition-opacity",
                  tab.id === activeTabId
                    ? "opacity-50 hover:opacity-100 hover:bg-secondary"
                    : "opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:bg-secondary"
                )}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {/* New tab button */}
          <button
            onClick={handleNewTab}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0 mb-0.5"
            title="New chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
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
