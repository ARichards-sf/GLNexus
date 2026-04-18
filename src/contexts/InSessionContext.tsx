import { createContext, useContext, useState, type ReactNode } from "react";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

export interface InSessionContextType {
  sessionEvent: CalendarEvent | null;
  startSession: (event: CalendarEvent) => void;
  endSession: () => void;
  isInSession: boolean;
  isProspectSession: boolean;
}

const InSessionContext = createContext<InSessionContextType | null>(null);

export function InSessionProvider({ children }: { children: ReactNode }) {
  const [sessionEvent, setSessionEvent] = useState<CalendarEvent | null>(null);

  const startSession = (event: CalendarEvent) => {
    setSessionEvent(event);
  };

  const endSession = () => {
    setSessionEvent(null);
  };

  const isInSession = sessionEvent !== null;
  const isProspectSession =
    !!sessionEvent?.prospect_id && !sessionEvent?.household_id;

  return (
    <InSessionContext.Provider
      value={{ sessionEvent, startSession, endSession, isInSession, isProspectSession }}
    >
      {children}
    </InSessionContext.Provider>
  );
}

export function useInSession(): InSessionContextType {
  const context = useContext(InSessionContext);
  if (!context) {
    throw new Error("useInSession must be used within an InSessionProvider");
  }
  return context;
}
