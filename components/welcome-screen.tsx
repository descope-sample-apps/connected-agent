"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { Briefcase, ArrowRight } from "lucide-react";

export default function WelcomeScreen() {
  const { setShowAuthModal } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Briefcase className="h-10 w-10 text-primary" />
      </div>
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
        CRM Assistant
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Your AI-powered assistant for managing customer relationships,
        scheduling meetings, and boosting your sales productivity. Sign in to
        start chatting - you can use the quick actions or simply type any
        question you have.
      </p>
      <Button
        onClick={() => setShowAuthModal(true)}
        className="px-6 py-6 text-lg rounded-full bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
      >
        Sign In to Get Started <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );
}
