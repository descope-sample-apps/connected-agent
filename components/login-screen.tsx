"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Descope } from "@descope/nextjs-sdk";
import { useSession } from "@descope/nextjs-sdk/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Briefcase, Sparkles } from "lucide-react";

export default function LoginScreen() {
  const { isAuthenticated, isSessionLoading } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDescopeReady, setIsDescopeReady] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const onSuccess = () => {
    setIsLoading(true);
    router.push("/");
  };

  const onError = (error: any) => {
    console.error("Authentication error:", error);
    setIsLoading(false);
  };

  const onReady = () => {
    setIsDescopeReady(true);
  };

  // Don't render anything while checking authentication
  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only render login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <Card
          className={`w-full max-w-md transition-all duration-300 shadow-xl border-muted/30 ${
            !isDescopeReady ? "opacity-0 scale-95" : "opacity-100 scale-100"
          }`}
        >
          <CardHeader className="space-y-1 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
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
            <a
              href="https://descope.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white hover:text-white border-0 group transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] font-medium rounded-xl">
                <Sparkles className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                Learn More About Descope AI
              </Button>
            </a>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return null; // Return null while redirecting
}
