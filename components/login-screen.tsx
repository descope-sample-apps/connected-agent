"use client";

import { useState, useEffect } from "react";
import { Descope } from "@descope/nextjs-sdk";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginScreen() {
  const [isDescopeReady, setIsDescopeReady] = useState(false);
  const { theme, setTheme } = useTheme();

  const onReady = () => {
    setIsDescopeReady(true);
  };

  // Only render login if not authenticated
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
                theme={theme === "system" ? "light" : theme}
                redirectOnSuccess={"/"}
                onReady={onReady}
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
              href="https://www.descope.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <a
              href="https://www.descope.com/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline transition-colors duration-200"
            >
              Terms of Service
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
