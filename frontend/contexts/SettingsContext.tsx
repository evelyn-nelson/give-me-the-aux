import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

interface SettingsContextType {
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

const NOTIFICATIONS_KEY = "notificationsEnabled";

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notificationsEnabled, setNotificationsEnabledState] =
    useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(NOTIFICATIONS_KEY);
        if (stored == null) {
          // First run: default to enabled and persist it
          setNotificationsEnabledState(true);
          await SecureStore.setItemAsync(NOTIFICATIONS_KEY, "true");
        } else {
          setNotificationsEnabledState(stored === "true");
        }
      } catch {
        // On error, stay disabled to be safe
        setNotificationsEnabledState(false);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setNotificationsEnabled = async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    try {
      await SecureStore.setItemAsync(NOTIFICATIONS_KEY, String(enabled));
    } catch {}
  };

  return (
    <SettingsContext.Provider
      value={{ notificationsEnabled, setNotificationsEnabled, isLoaded }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
