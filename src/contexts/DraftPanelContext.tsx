import { createContext, useContext, useState, type ReactNode } from "react";

export type DraftKind = "email" | "text";

export interface DraftPanelState {
  kind: DraftKind;
  recipientName: string;
  recipientFirstName?: string;
  reason: string;
  callToAction?: string;
  /**
   * Household this draft is for. When present, "Send" logs a
   * compliance note on this household so the outreach is part of the
   * client record.
   */
  householdId?: string;
  /**
   * If this draft is opened from an AI Inbox row, the id of the
   * `pending_drafts` row. MessageDraftPanel uses this to mark the draft
   * sent/dismissed and skip AI regeneration in favor of `prefillBody`.
   */
  pendingDraftId?: string;
  /**
   * Pre-populated content from the AI Inbox. When present, MessageDraftPanel
   * uses this verbatim instead of streaming a new draft from Claude.
   */
  prefillBody?: string;
  prefillSubject?: string;
  /**
   * Deep-link path for the booking button when this draft was opened from
   * the AI Inbox (e.g. `/book/joe-tester/annual-review`). MessageDraftPanel
   * prefixes the origin and renders the button to this URL. If unset, the
   * panel falls back to the advisor's general /book/:slug page.
   */
  bookingUrlPath?: string | null;
  /** Fires after the user clicks Send (mock send path). */
  onSent?: () => void;
}

interface ContextValue {
  draft: DraftPanelState | null;
  openDraftPanel: (state: DraftPanelState) => void;
  closeDraftPanel: () => void;
}

const DraftPanelContext = createContext<ContextValue | null>(null);

/**
 * Lets any component request the right sidebar render an AI-drafted message
 * (email or text) for review in-place — alongside the page they navigated to.
 * This keeps the household profile visible so the advisor can confirm the
 * draft matches the underlying data.
 */
export function DraftPanelProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftPanelState | null>(null);

  const value: ContextValue = {
    draft,
    openDraftPanel: setDraft,
    closeDraftPanel: () => setDraft(null),
  };

  return <DraftPanelContext.Provider value={value}>{children}</DraftPanelContext.Provider>;
}

export function useDraftPanel(): ContextValue {
  const ctx = useContext(DraftPanelContext);
  if (!ctx) throw new Error("useDraftPanel must be used within DraftPanelProvider");
  return ctx;
}
