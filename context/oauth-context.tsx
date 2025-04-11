"use client";

import { createContext, useContext, useState } from "react";

interface OAuthContextType {
  showReconnectDialog: boolean;
  setShowReconnectDialog: (show: boolean) => void;
  reconnectInfo: {
    appId: string;
    scopes: string[];
  } | null;
  setReconnectInfo: (info: { appId: string; scopes: string[] } | null) => void;
  handleAuthError: (error: Error) => boolean; // Returns true if error was handled
}

export const OAuthContext = createContext<OAuthContextType | undefined>(
  undefined
);

export function OAuthProvider({ children }: { children: React.ReactNode }) {
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [reconnectInfo, setReconnectInfo] = useState<{
    appId: string;
    scopes: string[];
  } | null>(null);

  return (
    <OAuthContext.Provider
      value={{
        showReconnectDialog,
        setShowReconnectDialog,
        reconnectInfo,
        setReconnectInfo,
        handleAuthError: () => false,
      }}
    >
      {children}
    </OAuthContext.Provider>
  );
}

export function useOAuth() {
  const context = useContext(OAuthContext);
  if (context === undefined) {
    throw new Error("useOAuth must be used within an OAuthProvider");
  }
  return context;
}
