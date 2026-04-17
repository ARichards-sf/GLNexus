import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface FirmContextType {
  selectedFirmId: string | null;
  setSelectedFirmId: (id: string | null) => void;
  clearSelectedFirm: () => void;
}

const FirmContext = createContext<FirmContextType>({
  selectedFirmId: null,
  setSelectedFirmId: () => {},
  clearSelectedFirm: () => {},
});

export const useSelectedFirm = () => useContext(FirmContext);

export function FirmProvider({ children }: { children: ReactNode }) {
  const [selectedFirmId, setSelectedFirmIdState] = useState<string | null>(null);

  const setSelectedFirmId = useCallback((id: string | null) => {
    setSelectedFirmIdState(id);
  }, []);

  const clearSelectedFirm = useCallback(() => {
    setSelectedFirmIdState(null);
  }, []);

  return (
    <FirmContext.Provider value={{ selectedFirmId, setSelectedFirmId, clearSelectedFirm }}>
      {children}
    </FirmContext.Provider>
  );
}
