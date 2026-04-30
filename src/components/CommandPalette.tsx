import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  GitBranch,
  Home,
  Inbox,
  LayoutDashboard,
  Mail,
  Settings,
  StickyNote,
  User,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useHouseholds } from "@/hooks/useHouseholds";
import { useAllContacts } from "@/hooks/useContacts";
import { useProspects } from "@/hooks/useProspects";
import { useTasks } from "@/hooks/useTasks";
import { useAllComplianceNotes } from "@/hooks/useHouseholds";
import { formatCurrency } from "@/data/sampleData";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, keywords: ["home"] },
  { label: "Households", to: "/households", icon: Home, keywords: ["clients", "families"] },
  { label: "Contacts", to: "/contacts", icon: Users, keywords: ["people", "members"] },
  { label: "Calendar", to: "/calendar", icon: CalendarDays, keywords: ["meetings", "schedule", "events"] },
  { label: "Tasks", to: "/tasks", icon: CheckSquare, keywords: ["todo", "follow-up"] },
  { label: "Pipeline", to: "/pipeline", icon: GitBranch, keywords: ["prospects", "leads"] },
  { label: "Goodie", to: "/goodie", icon: Inbox, keywords: ["chat", "ai", "assistant"] },
  { label: "Reports", to: "/reports", icon: FileText, keywords: ["analytics"] },
  { label: "Settings", to: "/settings", icon: Settings, keywords: ["preferences", "booking"] },
];

const RESULT_LIMIT = 5;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Global ⌘K palette. Search jumps to households / contacts / prospects /
 * tasks / notes; nav section short-circuits to top-level routes; selecting
 * a result closes the dialog and navigates. We pre-fetch all the lists
 * (they're already cached by other surfaces) and filter client-side — at
 * advisor-book scale (50–500 households) that's plenty fast.
 */
export default function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Reset the input when the dialog closes so reopening starts fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // All lists are cached by other surfaces; subscribing here is cheap.
  const { data: households = [] } = useHouseholds();
  const { data: contacts = [] } = useAllContacts();
  const { data: prospects = [] } = useProspects();
  const { data: tasks = [] } = useTasks("mine");
  const { data: notes = [] } = useAllComplianceNotes();

  const q = query.trim().toLowerCase();
  const matches = (s: string | null | undefined) =>
    !q || (s ?? "").toLowerCase().includes(q);

  const householdResults = useMemo(() => {
    if (!q) return households.slice(0, RESULT_LIMIT);
    return households.filter((h: any) => matches(h.name)).slice(0, RESULT_LIMIT);
  }, [households, q]);

  const contactResults = useMemo(() => {
    if (!q) return [];
    return contacts
      .filter((c: any) =>
        matches(`${c.first_name ?? ""} ${c.last_name ?? ""}`) ||
        matches(c.email),
      )
      .slice(0, RESULT_LIMIT);
  }, [contacts, q]);

  const prospectResults = useMemo(() => {
    if (!q) return [];
    return (prospects as any[])
      .filter((p) =>
        matches(`${p.first_name ?? ""} ${p.last_name ?? ""}`) ||
        matches(p.company),
      )
      .slice(0, RESULT_LIMIT);
  }, [prospects, q]);

  const taskResults = useMemo(() => {
    if (!q) return [];
    return tasks
      .filter((t) => t.status === "todo" && matches(t.title))
      .slice(0, RESULT_LIMIT);
  }, [tasks, q]);

  const noteResults = useMemo(() => {
    if (!q) return [];
    return (notes as any[])
      .filter((n) => matches(n.summary) || matches(n.households?.name))
      .slice(0, RESULT_LIMIT);
  }, [notes, q]);

  const navResults = useMemo(() => {
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter(
      (n) =>
        matches(n.label) ||
        n.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [q]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const hasAnyResults =
    navResults.length > 0 ||
    householdResults.length > 0 ||
    contactResults.length > 0 ||
    prospectResults.length > 0 ||
    taskResults.length > 0 ||
    noteResults.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search households, contacts, notes — or jump to a page…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!hasAnyResults && <CommandEmpty>No matches.</CommandEmpty>}

        {navResults.length > 0 && (
          <CommandGroup heading="Navigate">
            {navResults.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.to}
                  value={`nav ${item.label} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={() => go(item.to)}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {householdResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Households">
              {householdResults.map((h: any) => (
                <CommandItem
                  key={h.id}
                  value={`household ${h.name} ${h.id}`}
                  onSelect={() => go(`/household/${h.id}`)}
                >
                  <Home className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{h.name}</span>
                  {h.total_aum != null && (
                    <span className="text-xs text-muted-foreground tabular-nums ml-2">
                      {formatCurrency(Number(h.total_aum))}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {contactResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contacts">
              {contactResults.map((c: any) => (
                <CommandItem
                  key={c.id}
                  value={`contact ${c.first_name} ${c.last_name} ${c.email ?? ""}`}
                  onSelect={() => go(`/contacts/${c.id}`)}
                >
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {c.first_name} {c.last_name}
                  </span>
                  {c.households?.name && (
                    <span className="text-xs text-muted-foreground ml-2 truncate">
                      {c.households.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {prospectResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Prospects">
              {prospectResults.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`prospect ${p.first_name} ${p.last_name} ${p.company ?? ""}`}
                  onSelect={() => go(`/prospects/${p.id}`)}
                >
                  <GitBranch className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {p.first_name} {p.last_name}
                  </span>
                  {p.company && (
                    <span className="text-xs text-muted-foreground ml-2 truncate">
                      {p.company}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {taskResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {taskResults.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`task ${t.title}`}
                  onSelect={() => go(`/tasks/${t.id}`)}
                >
                  <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.due_date && (
                    <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                      {new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {noteResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes">
              {noteResults.map((n) => {
                const preview = (n.summary ?? "").replace(/\s+/g, " ").slice(0, 80);
                return (
                  <CommandItem
                    key={n.id}
                    value={`note ${n.summary ?? ""} ${n.households?.name ?? ""}`}
                    onSelect={() => n.household_id && go(`/household/${n.household_id}`)}
                  >
                    <StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{preview || "(empty note)"}</p>
                      {n.households?.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {n.households.name}
                          {n.type ? ` · ${n.type}` : ""}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Tip">
          <CommandItem disabled value="tip">
            <Mail className="mr-2 h-4 w-4 text-muted-foreground opacity-60" />
            <span className="text-muted-foreground">
              Press <CommandShortcut>⌘K</CommandShortcut> from anywhere to reopen.
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
