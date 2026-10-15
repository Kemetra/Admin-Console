/**
 * SF-3 provider. Exposes the read-only active-context projection to every
 * downstream surface (SF-1 auto-select branching, SF-2 indicator/chooser).
 * The actual query + mutators live in useActiveContext; this just shares one
 * instance through React context so the whole shell reads one source of truth.
 */
import { createContext, useContext } from "react";
import { type ActiveContextValue, useActiveContext } from "./useActiveContext";

const ActiveContext = createContext<ActiveContextValue | null>(null);

export function ActiveContextProvider({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const value = useActiveContext();
  return <ActiveContext.Provider value={value}>{children}</ActiveContext.Provider>;
}

export function useActiveContextValue(): ActiveContextValue {
  const value = useContext(ActiveContext);
  if (!value) {
    throw new Error("useActiveContextValue must be used within <ActiveContextProvider>");
  }
  return value;
}
