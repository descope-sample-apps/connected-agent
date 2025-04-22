"use client";

import { createContext, useContext, type ReactNode, useState } from "react";
import { useSession, useUser, useDescope } from "@descope/nextjs-sdk/client";

interface OAuthRedirectInfo {
  provider: string;
  scopes: string[];
  redirectTo: "chat" | "profile";
}

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  } | null;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean, redirectInfo?: OAuthRedirectInfo) => void;
  signOut: () => void;
  onSuccessfulAuth: () => void;
  redirectInfo: OAuthRedirectInfo | null;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  showAuthModal: false,
  setShowAuthModal: () => {},
  signOut: () => {},
  onSuccessfulAuth: () => {},
  redirectInfo: null,
});

export const useAuth = () => useContext(AuthContext);

export const CustomAuthProvider = ({ children }: { children: ReactNode }) => {
  const { isSessionLoading, isAuthenticated } = useSession();
  const { logout } = useDescope();
  const { user: descopeUser } = useUser();
  const [showAuthModal, setShowAuthModalState] = useState(false);
  const [redirectInfo, setRedirectInfo] = useState<OAuthRedirectInfo | null>(
    null
  );

  // Transform Descope user to our app's user format
  const transformedUser = descopeUser
    ? {
        id: descopeUser.userId,
        name:
          descopeUser.name ||
          `${descopeUser.givenName || ""} ${
            descopeUser.familyName || ""
          }`.trim() ||
          descopeUser.email ||
          "Anonymous User",
        email: descopeUser.email || "no-email@example.com",
        picture: descopeUser.picture,
      }
    : null;

  const setShowAuthModal = (show: boolean, info?: OAuthRedirectInfo) => {
    setShowAuthModalState(show);
    if (info) {
      setRedirectInfo(info);
    }
  };

  const onSuccessfulAuth = () => {
    setShowAuthModalState(false);
    setRedirectInfo(null);
  };

  const signOut = () => {
    logout();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading: isSessionLoading,
        user: transformedUser,
        showAuthModal,
        setShowAuthModal,
        signOut,
        onSuccessfulAuth,
        redirectInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
