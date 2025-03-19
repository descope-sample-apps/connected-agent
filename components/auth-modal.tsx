"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { Descope } from "@descope/nextjs-sdk";
import { useRouter } from "next/navigation";

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, onSuccessfulAuth, isAuthenticated } =
    useAuth();
  const router = useRouter();

  // This effect will run when isAuthenticated changes
  // It ensures the modal closes when auth succeeds after OAuth callback
  useEffect(() => {
    // If authentication state becomes true and the modal is shown, close it
    if (isAuthenticated && showAuthModal) {
      onSuccessfulAuth();
    }
  }, [isAuthenticated, showAuthModal, onSuccessfulAuth]);

  // This effect handles URL parameters that might indicate an OAuth callback
  useEffect(() => {
    // Check if we're returning from an OAuth redirect
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const hasAuthParams =
        searchParams.has("code") ||
        searchParams.has("state") ||
        searchParams.has("session");

      if (hasAuthParams) {
        console.log("Detected OAuth callback parameters");
        // Show the modal briefly to let Descope handle the callback
        setShowAuthModal(true);

        // After a short delay, check if authentication succeeded
        const checkAuthTimer = setTimeout(() => {
          if (isAuthenticated) {
            onSuccessfulAuth();
            // Clean up the URL
            router.replace(window.location.pathname);
          }
        }, 1000);

        return () => clearTimeout(checkAuthTimer);
      }
    }
  }, [setShowAuthModal, isAuthenticated, onSuccessfulAuth, router]);

  return (
    <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-2">
            Welcome to CRM Assistant
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Descope
            flowId="sign-up-or-in"
            onSuccess={onSuccessfulAuth}
            onError={(e: any) => console.error("Auth error:", e)}
            theme="light"
            className="w-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
