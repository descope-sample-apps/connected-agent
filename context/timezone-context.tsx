"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface TimezoneContextProps {
  timezone: string;
}

const TimezoneContext = createContext<TimezoneContextProps>({
  timezone: "UTC",
});

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneContextProps>({
    timezone: "UTC",
  });

  useEffect(() => {
    // Get the timezone from the browser
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Store in state
      setTimezoneInfo({
        timezone,
      });

      // Store in localStorage for persistence
      localStorage.setItem("userTimezone", timezone);

      // More detailed logging for easier debugging
      console.log(`✅ Timezone detection successful:`);
      console.log(`   Name: ${timezone}`);
      console.log(`   Current local time: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error("Error detecting timezone:", error);
    }
  }, []);

  return (
    <TimezoneContext.Provider value={timezoneInfo}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  return useContext(TimezoneContext);
}
