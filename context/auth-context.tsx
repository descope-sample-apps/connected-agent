"use client";

import { createContext, useContext, type ReactNode, useState } from "react";
import { useSession, useUser, useDescope } from "@descope/nextjs-sdk/client";

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
  setShowAuthModal: (show: boolean) => void;
  signOut: () => void;
  onSuccessfulAuth: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  showAuthModal: false,
  setShowAuthModal: () => {},
  signOut: () => {},
  onSuccessfulAuth: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { isSessionLoading, isAuthenticated } = useSession();
  const { logout } = useDescope();
  const { user: descopeUser } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  const onSuccessfulAuth = () => {
    setShowAuthModal(false);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
