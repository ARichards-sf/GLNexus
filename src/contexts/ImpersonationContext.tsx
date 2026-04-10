import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface ImpersonatedUser {
  id: string;
  name: string;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  startImpersonating: (user: ImpersonatedUser) => void;
  stopImpersonating: () => void;
  targetAdvisorId: (currentUserId: string) => string;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedUser: null,
  startImpersonating: () => {},
  stopImpersonating: () => {},
  targetAdvisorId: (id) => id,
});

export const useImpersonation = () => useContext(ImpersonationContext);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const startImpersonating = useCallback((user: ImpersonatedUser) => {
    setImpersonatedUser(user);
  }, []);

  const stopImpersonating = useCallback(() => {
    setImpersonatedUser(null);
  }, []);

  const targetAdvisorId = useCallback(
    (currentUserId: string) => impersonatedUser?.id || currentUserId,
    [impersonatedUser]
  );

  return (
    <ImpersonationContext.Provider value={{ impersonatedUser, startImpersonating, stopImpersonating, targetAdvisorId }}>
      {children}
    </ImpersonationContext.Provider>
  );
}
