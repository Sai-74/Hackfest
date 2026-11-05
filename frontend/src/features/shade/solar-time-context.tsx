import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface SolarTimeContextValue {
  timeMinutes: number;
  setTimeMinutes: (minutes: number) => void;
  setTimeToNow: () => void;
}

const SolarTimeContext = createContext<SolarTimeContextValue | null>(null);

function currentLocalTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function SolarTimeProvider({ children }: { children: ReactNode }) {
  const [timeMinutes, setTime] = useState(12 * 60);

  const setTimeMinutes = useCallback((minutes: number) => {
    setTime(Math.max(0, Math.min(1439, Math.round(minutes))));
  }, []);

  const setTimeToNow = useCallback(() => {
    setTime(currentLocalTimeMinutes());
  }, []);

  return (
    <SolarTimeContext.Provider
      value={{ timeMinutes, setTimeMinutes, setTimeToNow }}
    >
      {children}
    </SolarTimeContext.Provider>
  );
}

export function useSolarTime() {
  const context = useContext(SolarTimeContext);

  if (!context) {
    throw new Error("useSolarTime must be used inside SolarTimeProvider.");
  }

  return context;
}
