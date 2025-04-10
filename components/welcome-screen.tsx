"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { Bot, ArrowRight } from "lucide-react";
import LogoConnections from "./logo-connections";

export default function WelcomeScreen() {
  const { setShowAuthModal } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
        <Bot className="h-10 w-10 text-white" />
      </div>
      <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
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
    </div>
  );
}
