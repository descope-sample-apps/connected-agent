"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ArrowRight } from "lucide-react";
import LogoConnections from "./logo-connections";
import Logo from "./logo";

export default function WelcomeScreen() {
  const { setShowAuthModal } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <Logo size="xl" showText={false} />
      <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mt-6">
        ConnectedAgent
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        A modern Next.js template for building powerful chatbots with tool
        calling capabilities. Seamlessly integrate with external services using
        Descope outbound apps. Sign in to start chatting - you can use quick
        actions or simply type any question.
      </p>
      <Button
        onClick={() => setShowAuthModal(true)}
        className="px-6 py-6 text-lg rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
      >
        Sign In to Get Started <ArrowRight className="ml-2 h-5 w-5" />
      </Button>

      <LogoConnections />

      {/* Add footer with Descope attribution and links */}
      <div className="mt-12 border-t border-primary/10 pt-6 w-full max-w-md">
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
      </div>
    </div>
  );
}
