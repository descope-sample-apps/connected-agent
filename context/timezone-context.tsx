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
  timezoneOffset: number;
}

const TimezoneContext = createContext<TimezoneContextProps>({
  timezone: "UTC",
  timezoneOffset: 0,
});

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneContextProps>({
    timezone: "UTC",
    timezoneOffset: 0,
  });

  useEffect(() => {
    // Get the timezone from the browser
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const date = new Date();
      const timezoneOffset = date.getTimezoneOffset() * -1; // Invert because getTimezoneOffset returns negative for positive offsets

      // Store in state
      setTimezoneInfo({
        timezone,
        timezoneOffset,
      });

      // Store in localStorage for persistence
      localStorage.setItem("userTimezone", timezone);
      localStorage.setItem("userTimezoneOffset", timezoneOffset.toString());

      // More detailed logging for easier debugging
      const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
      const offsetMinutes = Math.abs(timezoneOffset) % 60;
      const offsetFormatted = `${timezoneOffset >= 0 ? "+" : "-"}${String(
        offsetHours
      ).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;

      console.log(`✅ Timezone detection successful:`);
      console.log(`   Name: ${timezone}`);
      console.log(`   Offset: ${offsetFormatted} (${timezoneOffset} minutes)`);
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
