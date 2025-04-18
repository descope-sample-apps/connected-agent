"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Descope } from "@descope/nextjs-sdk";
import { useSession, useUser } from "@descope/nextjs-sdk/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { nanoid } from "nanoid";
import { identifyUser } from "@/lib/analytics";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user: descopeUser } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDescopeReady, setIsDescopeReady] = useState(false);
  const { isAuthenticated: authIsAuthenticated, isLoading: authIsLoading } = useAuth();

  // Redirect to chat if already authenticated
  useEffect(() => {
    if (isAuthenticated && descopeUser) {
      // Identify user on automatic login
      identifyUser(descopeUser.userId, {
        email: descopeUser.email,
        name:
          descopeUser.name ||
          `${descopeUser.givenName || ""} ${
            descopeUser.familyName || ""
          }`.trim(),
        firstName: descopeUser.givenName,
        lastName: descopeUser.familyName,
        loginAt: new Date().toISOString(),
      });

      // Generate a new chat ID
      const newChatId = `chat-${nanoid()}`;

      // Don't store in localStorage, just navigate directly
      console.log(`Login: Redirecting to new chat: ${newChatId}`);
      router.push(`/chat/${newChatId}`);
    }
  }, [isAuthenticated, router, descopeUser]);

  // Redirect to landing page if not authenticated and not loading
  useEffect(() => {
    if (!authIsLoading && !authIsAuthenticated) {
      router.push("/landing");
    }
  }, [authIsAuthenticated, authIsLoading, router]);

  const onSuccess = (user: any) => {
    setIsLoading(true);

    // Identify the user in analytics when they log in
    if (user) {
      identifyUser(user.userId, {
        email: user.email,
        name:
          user.name ||
          `${user.givenName || ""} ${user.familyName || ""}`.trim(),
        firstName: user.givenName,
        lastName: user.familyName,
        createdAt: new Date().toISOString(),
        loginAt: new Date().toISOString(),
      });
    }

    // Generate a new chat ID
    const newChatId = `chat-${nanoid()}`;

    // Don't store in localStorage, just navigate directly
    console.log(`Login success: Redirecting to new chat: ${newChatId}`);
    router.push(`/chat/${newChatId}`);
  };

  const onError = (error: any) => {
    console.error("Authentication error:", error);
    setIsLoading(false);
  };

  const onReady = () => {
    setIsDescopeReady(true);
  };

  // Don't render anything while checking authentication
  if (isSessionLoading || isLoading || authIsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <Card
        className={`w-full max-w-md transition-all duration-300 shadow-xl border-muted/30 ${
          !isDescopeReady ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
            ConnectedAgent
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to access your CRM assistant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <div
              className={`transition-opacity duration-300 ${
                !isDescopeReady ? "opacity-0" : "opacity-100"
              }`}
            >
              <Descope
                flowId="sign-up-or-in"
                onSuccess={onSuccess}
                onError={onError}
                onReady={onReady}
                theme="light"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center pt-4 border-t border-primary/10">
          <p className="text-xs text-muted-foreground mb-2">
            Powered by Descope AI
          </p>
          <div className="flex items-center justify-center space-x-4 w-full mt-2">
            <a
              href="https://www.descope.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <a
              href="https://www.descope.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline transition-colors duration-200"
            >
              Terms of Service
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center w-full max-w-[280px] mx-auto px-1 pt-3 border-t border-gray-100 dark:border-gray-800">
            In addition to our Privacy Policy, it's important to note that
            Google Workspace APIs are not used to develop, improve, or train
            generalized AI and/or ML models.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
