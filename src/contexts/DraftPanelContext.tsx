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
