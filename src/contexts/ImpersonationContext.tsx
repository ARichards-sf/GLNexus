import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface ImpersonatedUser {
  id: string;
  name: string;
}

interface VpmAdvisor {
  id: string;
  name: string;
  firmName?: string | null;
  vpmBillingType?: string | null;
  isPrime?: boolean;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  startImpersonating: (user: ImpersonatedUser) => void;
  stopImpersonating: () => void;

  vpmAdvisor: VpmAdvisor | null;
  startVpmSession: (advisor: VpmAdvisor) => void;
  stopVpmSession: () => void;
  isVpmSession: boolean;

  targetAdvisorId: (currentUserId: string) => string;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedUser: null,
  startImpersonating: () => {},
  stopImpersonating: () => {},
  vpmAdvisor: null,
  startVpmSession: () => {},
  stopVpmSession: () => {},
  isVpmSession: false,
  targetAdvisorId: (id) => id,
});

export const useImpersonation = () => useContext(ImpersonationContext);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const [vpmAdvisor, setVpmAdvisor] = useState<VpmAdvisor | null>(() => {
    try {
      const saved = localStorage.getItem("vpm_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const startImpersonating = useCallback((user: ImpersonatedUser) => {
    setImpersonatedUser(user);
  }, []);

  const stopImpersonating = useCallback(() => {
    setImpersonatedUser(null);
  }, []);

  const startVpmSession = useCallback((advisor: VpmAdvisor) => {
    setVpmAdvisor(advisor);
    try {
      localStorage.setItem("vpm_session", JSON.stringify(advisor));
    } catch {}
  }, []);

  const stopVpmSession = useCallback(() => {
    const ticketId =
      (window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id ||
      localStorage.getItem("vpm_ticket_id");

    setVpmAdvisor(null);

    try {
      localStorage.removeItem("vpm_session");
      localStorage.removeItem("vpm_ticket_id");
      delete (window as Window & { __vpm_ticket_id?: string }).__vpm_ticket_id;
    } catch {}

    if (ticketId) {
      navigate(`/admin/vpm-requests/${ticketId}`);
    } else {
      navigate("/admin/vpm-requests");
    }
  }, [navigate]);

  const isVpmSession = !!vpmAdvisor && !impersonatedUser;

  const targetAdvisorId = useCallback(
    (currentUserId: string) =>
      impersonatedUser?.id || vpmAdvisor?.id || currentUserId,
    [impersonatedUser, vpmAdvisor]
  );

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        startImpersonating,
        stopImpersonating,
        vpmAdvisor,
        startVpmSession,
        stopVpmSession,
        isVpmSession,
        targetAdvisorId,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}
