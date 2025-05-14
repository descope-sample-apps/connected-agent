"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Descope } from "@descope/nextjs-sdk";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { nanoid } from "nanoid";
import { identifyUser } from "@/lib/analytics";

// Separate component to use searchParams
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDescopeReady, setIsDescopeReady] = useState(false);
  const { theme, setTheme } = useTheme();

  const onSuccess = (user: any) => {
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

    // Check if there's a redirectTo query parameter
    const redirectTo = searchParams.get("redirectTo");
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      // Generate a new chat ID if no redirect specified
      const newChatId = `chat-${nanoid()}`;
      console.log(`Login success: Redirecting to new chat: ${newChatId}`);
      router.push(`/chat/${newChatId}`);
    }
  };

  const onReady = () => {
    setIsDescopeReady(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            Sign in to ConnectedAgent
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
            Connect securely to your CRM assistant
          </p>
        </div>

        <Card
          className={`w-full max-w-md transition-all duration-300 shadow-xl border-muted/30 mb-8 ${
            !isDescopeReady ? "opacity-0 scale-95" : "opacity-100 scale-100"
          }`}
        >
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
                  onReady={onReady}
                  theme={theme}
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
    </div>
  );
}

// Loading fallback for Suspense
function LoginLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">Loading login...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
