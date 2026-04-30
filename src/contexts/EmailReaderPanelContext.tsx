import { createContext, useContext, useState, type ReactNode } from "react";
import type { PriorityEmail } from "@/hooks/usePriorityEmails";

interface ContextValue {
  email: PriorityEmail | null;
  openEmailReader: (email: PriorityEmail) => void;
  closeEmailReader: () => void;
}

const EmailReaderPanelContext = createContext<ContextValue | null>(null);

/**
 * Renders the priority-inbox email reader inside the right sidebar (same
 * slot as MessageDraftPanel). The reader displays the full email body and
 * lets the advisor draft a tier-aware reply in place — without losing the
 * page they were on.
 */
export function EmailReaderPanelProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<PriorityEmail | null>(null);
  return (
    <EmailReaderPanelContext.Provider
      value={{
        email,
        openEmailReader: setEmail,
        closeEmailReader: () => setEmail(null),
      }}
    >
      {children}
    </EmailReaderPanelContext.Provider>
  );
}

export function useEmailReaderPanel(): ContextValue {
  const ctx = useContext(EmailReaderPanelContext);
  if (!ctx) {
    throw new Error(
      "useEmailReaderPanel must be used within EmailReaderPanelProvider",
    );
  }
  return ctx;
}
