"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { Descope } from "@descope/nextjs-sdk";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot } from "lucide-react";

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for any redirect parameters in URL
  useEffect(() => {
    const hasRedirectParams =
      searchParams.has("code") || searchParams.has("state");
    if (hasRedirectParams) {
      // If we have any redirect parameters, keep the modal open to handle the flow
      setShowAuthModal(true);
    }
  }, [searchParams, setShowAuthModal]);

  // Handle successful authentication
  const handleSuccess = () => {
    setShowAuthModal(false);
    // Clean up the URL by removing any redirect parameters
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("code");
    currentUrl.searchParams.delete("state");
    router.replace(currentUrl.pathname);
  };

  return (
    <Dialog
      open={showAuthModal}
      onOpenChange={(open) => {
        // Only allow closing if we're not in the middle of any auth flow
        const hasRedirectParams =
          searchParams.has("code") || searchParams.has("state");
        if (!open && !hasRedirectParams) {
          setShowAuthModal(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px] border-gray-100 dark:border-gray-800 shadow-lg">
        <DialogHeader className="flex flex-col items-center space-y-3 pb-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl text-center font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Welcome to ConnectedAgent
            </DialogTitle>
            <p className="text-sm text-center text-muted-foreground mt-1">
              Sign in to access your connected services
            </p>
          </div>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6">
          <Descope
            flowId="sign-up-or-in"
            onSuccess={handleSuccess}
            onReady={() => setIsReady(true)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
