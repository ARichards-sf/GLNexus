import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, RotateCcw, StopCircle, Check, X, Plus, Shield } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────

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
  dbId?: string;
  actionsTaken: any[];
  actionsCancelled: any[];
}

// ─── Constants ───────────────────

const MAX_TABS = 6;
const tabsKey = (userId: string) => `goodie_chat_tabs:${userId}`;
const activeTabKey = (userId: string) => `goodie_active_tab:${userId}`;
const disclosureKey = (userId: string) => `goodie_disclosure_shown:${userId}`;

const SUGGESTED_PROMPTS = [
  "What's my total AUM and how many active households do I have?",
  "Which clients are due for an annual review soon?",
  "Show me my top households by AUM",
  "What tasks are overdue?",
  "Summarize my pipeline",
  "Which households are missing a client experience?",
];

// ─── Helpers ─────────────────────

function makeWelcomeMessage(firstName: string): Message {
  return {
    id: "welcome-" + Date.now(),
    role: "assistant",
    content: `Hi ${firstName}! 👋 I'm Goodie, your Nexus AI. Ask me anything about your book, or tell me to take action — schedule a meeting, log a note, create a task, and more. What can I help you with?`,
    timestamp: new Date(),
  };
}

function makeNewTab(firstName: string): ChatTab {
  return {
    id: Date.now().toString(),
    title: "New Chat",
    messages: [makeWelcomeMessage(firstName)],
    createdAt: new Date(),
    actionsTaken: [],
    actionsCancelled: [],
  };
}

function saveTabs(tabs: ChatTab[], activeId: string, userId: string | undefined) {
  if (!userId) return;
  try {
    localStorage.setItem(
      tabsKey(userId),
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
    localStorage.setItem(activeTabKey(userId), activeId);
  } catch {}
}

function loadTabs(firstName: string, userId: string | undefined): { tabs: ChatTab[]; activeId: string } {
  if (!userId) {
    const tab = makeNewTab(firstName);
    return { tabs: [tab], activeId: tab.id };
  }
  try {
    const raw = localStorage.getItem(tabsKey(userId));
    const activeId = localStorage.getItem(activeTabKey(userId));
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    if (!parsed?.length) throw new Error("empty");
    return {
      tabs: parsed.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        actionsTaken: t.actionsTaken || [],
        actionsCancelled: t.actionsCancelled || [],
        messages: t.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      })),
      activeId: activeId || parsed[0]?.id || "",
    };
  } catch {
    const tab = makeNewTab(firstName);
    return { tabs: [tab], activeId: tab.id };
  }
}

function categorizeConversation(
  tab: ChatTab,
  households: any[]
): { retention_category: string; contains_client_data: boolean } {
  const hasActions = tab.actionsTaken.length > 0;
  const allText = tab.messages.map((m) => m.content.toLowerCase()).join(" ");
  const mentionsClient = households.some(
    (h) => h.name && allText.includes(h.name.toLowerCase())
  );

  let retention_category = "standard";
  if (mentionsClient) {
    retention_category = "compliance_relevant";
  } else if (hasActions) {
    retention_category = "action_taken";
  }

  return { retention_category, contains_client_data: mentionsClient };
}

// ─── Main Component ──────────────

export default function GoodieChat() {
  const { user } = useAuth();
  const userId = user?.id;
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Advisor";

  const { data: households = [] } = useHouseholds();
  const { data: allTasks = [] } = useTasks("mine");
  const { data: prospects = [] } = useProspects();
  const { data: calendarEvents = [] } = useUpcomingEvents(100);
  const { data: recentNotes = [] } = useAllComplianceNotes();

  // Tab state
  const [tabs, setTabs] = useState<ChatTab[]>(() => loadTabs(firstName, userId).tabs);
  const [activeTabId, setActiveTabId] = useState<string>(() => loadTabs(firstName, userId).activeId);

  // Ensure activeTabId is valid
  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId) && tabs[0]) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const messages = activeTab?.messages || [];

  // Chat state
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState<ParsedToolCall | null>(null);

  // Disclosure
  const [showDisclosure, setShowDisclosure] = useState(
    () => typeof window !== "undefined" && !!userId && !localStorage.getItem(disclosureKey(userId))
  );

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const { executeAction } = useAiActions();

  // ── Compliance save ──
  const saveConversation = useCallback(
    async (tab: ChatTab) => {
      if (!user?.id) return;
      if (tab.messages.length <= 1) return;

      const { retention_category, contains_client_data } = categorizeConversation(
        tab,
        households as any[]
      );

      const payload: any = {
        advisor_id: user.id,
        title: tab.title,
        messages: tab.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
        actions_confirmed: tab.actionsTaken,
        actions_cancelled: tab.actionsCancelled,
        message_count: tab.messages.length,
        contains_client_data,
        retention_category,
        last_message_at: new Date().toISOString(),
      };

      try {
        if (tab.dbId) {
          await supabase.from("goodie_conversations").update(payload).eq("id", tab.dbId);
        } else {
          const { data } = await supabase
            .from("goodie_conversations")
            .insert(payload)
            .select("id")
            .single();

          if (data?.id) {
            setTabs((prev) => {
              const updated = prev.map((t) =>
                t.id === tab.id ? { ...t, dbId: data.id } : t
              );
              saveTabs(updated, activeTabId, userId);
              return updated;
            });
          }
        }
      } catch (e) {
        console.error("Failed to save conversation:", e);
      }
    },
    [user?.id, households, activeTabId]
  );

  const scheduleSave = useCallback(
    (tab: ChatTab) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveConversation(tab), 2000);
    },
    [saveConversation]
  );

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const t = activeTabRef.current;
      if (t && t.messages.length > 1) {
        saveConversation(t);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab updaters ──
  const updateActiveMessages = useCallback(
    (updater: (msgs: Message[]) => Message[]) => {
      setTabs((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTabId ? { ...t, messages: updater(t.messages) } : t
        );
        saveTabs(updated, activeTabId, userId);
        return updated;
      });
    },
    [activeTabId]
  );

  const autoNameTab = useCallback(
    (text: string) => {
      const title = text.trim().slice(0, 35).trim();
      setTabs((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTabId && t.title === "New Chat" ? { ...t, title } : t
        );
        saveTabs(updated, activeTabId, userId);
        return updated;
      });
    },
    [activeTabId]
  );

  // ── Chat ──
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

      autoNameTab(text.trim());
      updateActiveMessages((prev) => [...prev, userMsg]);
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
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + chunk,
                };
              }
              return updated;
            });
          },
          onToolCalls: (calls) => {
            if (calls.length > 0) setPendingToolCall(calls[0]);
          },
          onDone: () => {
            setIsLoading(false);
            setTabs((prev) => {
              const current = prev.find((t) => t.id === activeTabId);
              if (current) scheduleSave(current);
              return prev;
            });
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
    [
      isLoading,
      messages,
      households,
      recentNotes,
      prospects,
      calendarEvents,
      updateActiveMessages,
      autoNameTab,
      activeTabId,
      scheduleSave,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingToolCall) return;
    const toolCall = pendingToolCall;
    try {
      const result = await executeAction(toolCall);
      // Track action for compliance
      setTabs((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                actionsTaken: [
                  ...t.actionsTaken,
                  {
                    tool: toolCall.name,
                    args: toolCall.args,
                    timestamp: new Date().toISOString(),
                    result,
                  },
                ],
              }
            : t
        );
        saveTabs(updated, activeTabId, userId);
        const current = updated.find((t) => t.id === activeTabId);
        if (current) scheduleSave(current);
        return updated;
      });
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
    if (!pendingToolCall) return;
    const toolCall = pendingToolCall;
    setTabs((prev) => {
      const updated = prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              actionsCancelled: [
                ...t.actionsCancelled,
                {
                  tool: toolCall.name,
                  args: toolCall.args,
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : t
      );
      saveTabs(updated, activeTabId, userId);
      return updated;
    });
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
        t.id === activeTabId
          ? {
              ...t,
              title: "New Chat",
              messages: [welcome],
              actionsTaken: [],
              actionsCancelled: [],
              dbId: undefined,
            }
          : t
      );
      saveTabs(updated, activeTabId, userId);
      return updated;
    });
    setPendingToolCall(null);
  };

  const handleNewTab = useCallback(() => {
    const newTab = makeNewTab(firstName);
    setTabs((prev) => {
      let list = [...prev];
      if (list.length >= MAX_TABS) {
        const nonActive = list
          .filter((t) => t.id !== activeTabId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (nonActive.length) {
          list = list.filter((t) => t.id !== nonActive[0].id);
        }
      }
      const updated = [...list, newTab];
      saveTabs(updated, newTab.id, userId);
      return updated;
    });
    setActiveTabId(newTab.id);
    setPendingToolCall(null);
    setInput("");
  }, [activeTabId, firstName]);

  const handleCloseTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setTabs((prev) => {
        if (prev.length === 1) {
          const reset = makeNewTab(firstName);
          saveTabs([reset], reset.id, userId);
          setActiveTabId(reset.id);
          return [reset];
        }
        const idx = prev.findIndex((t) => t.id === tabId);
        const filtered = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabId) {
          const newActive = filtered[Math.min(idx, filtered.length - 1)];
          setActiveTabId(newActive.id);
          saveTabs(filtered, newActive.id, userId);
        } else {
          saveTabs(filtered, activeTabId, userId);
        }
        return filtered;
      });
      setPendingToolCall(null);
    },
    [activeTabId, firstName]
  );

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      const current = activeTabRef.current;
      if (current && current.messages.length > 1) {
        saveConversation(current);
      }
      setActiveTabId(tabId);
      setTabs((prev) => {
        saveTabs(prev, tabId, userId);
        return prev;
      });
      setPendingToolCall(null);
      setInput("");
    },
    [saveConversation]
  );

  const handleAcceptDisclosure = async () => {
    if (userId) localStorage.setItem(disclosureKey(userId), "true");
    setShowDisclosure(false);
    if (user?.id) {
      try {
        await supabase
          .from("profiles")
          .update({
            goodie_disclosure_accepted: true,
            goodie_disclosure_date: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      } catch (e) {
        console.error("Failed to save disclosure acceptance:", e);
      }
    }
  };

  const isEmpty = messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Disclosure modal */}
      {showDisclosure && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Conversation Storage Notice
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Please review before continuing
                </p>
              </div>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              Goodie conversations are stored for compliance and record-keeping purposes in
              accordance with FINRA Rule 4511 and applicable securities regulations.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Conversations involving client data are retained for 7 years. All data is encrypted
              and accessible only to you and authorized GL compliance staff.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Conversations are also used to improve Goodie over time.
            </p>
            <Button onClick={handleAcceptDisclosure} className="w-full">
              I understand — Continue
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-card border-b border-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <h1 className="text-sm font-semibold">Goodie</h1>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="w-3 h-3" />
              Conversations logged
            </div>
          </div>
          {!isEmpty && (
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

        {/* Tabs bar */}
        <div className="flex items-center gap-1 px-4 pb-0 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => handleSwitchTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap max-w-[180px] group border border-b-0 min-w-[80px]",
                tab.id === activeTabId
                  ? "bg-background border-border text-foreground shadow-sm -mb-px relative z-10"
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <span className="truncate max-w-[120px] flex-1">{tab.title}</span>
              {tab.actionsTaken.length > 0 && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                  title={`${tab.actionsTaken.length} action(s) taken`}
                />
              )}
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
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                )}
              >
                {msg.content ||
                  (isLoading && idx === messages.length - 1 ? (
                    <div className="flex gap-1 py-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]" />
                    </div>
                  ) : null)}
              </div>

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

        {/* Suggested prompts */}
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

      {/* Input */}
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
            Goodie can make mistakes. Always verify important information. Conversations are
            logged for compliance.
          </p>
        </div>
      </div>
    </div>
  );
}
