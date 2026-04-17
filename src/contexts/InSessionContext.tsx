import { createContext, useContext, useState, type ReactNode } from "react";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

export interface BriefContextType {
  briefEvent: CalendarEvent | null;
  openBrief: (event: CalendarEvent) => void;
  closeBrief: () => void;
  isBriefOpen: boolean;
}

const BriefContext = createContext<BriefContextType | null>(null);

export function BriefProvider({ children }: { children: ReactNode }) {
  const [briefEvent, setBriefEvent] = useState<CalendarEvent | null>(null);

  const openBrief = (event: CalendarEvent) => {
    setBriefEvent(event);
  };

  const closeBrief = () => {
    setBriefEvent(null);
  };

  const isBriefOpen = briefEvent !== null;

  return (
    <BriefContext.Provider value={{ briefEvent, openBrief, closeBrief, isBriefOpen }}>
      {children}
    </BriefContext.Provider>
  );
}

export function useBrief(): BriefContextType {
  const context = useContext(BriefContext);
  if (!context) {
    throw new Error("useBrief must be used within a BriefProvider");
  }
  return context;
}
