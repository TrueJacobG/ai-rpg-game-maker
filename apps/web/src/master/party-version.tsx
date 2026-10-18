import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

type PartyVersion = { version: number; bump: () => void };

const PartyVersionContext = createContext<PartyVersion>({ version: 0, bump: () => {} });

export const PartyVersionProvider = ({ children }: { children: ReactNode }) => {
  const [version, setVersion] = useState(0);
  const value = useMemo(
    () => ({ version, bump: () => setVersion((current) => current + 1) }),
    [version],
  );
  return <PartyVersionContext.Provider value={value}>{children}</PartyVersionContext.Provider>;
};

export const usePartyVersion = (): PartyVersion => useContext(PartyVersionContext);
