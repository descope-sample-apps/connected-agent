"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ChatMessage from "@/components/chat-message";
import ActionCard from "@/components/action-card";
import AuthModal from "@/components/auth-modal";
import UserMenu from "@/components/user-menu";
import WelcomeScreen from "@/components/welcome-screen";
import GoogleMeetPrompt from "@/components/google-meet-prompt";
import ProfileScreen from "@/components/profile-screen";
import ShareChatDialog from "@/components/share-chat-dialog";
import PromptExplanation from "@/components/prompt-explanation";
import PromptTrigger from "@/components/prompt-trigger";
import DealSummaryPrompt from "@/components/deal-summary-prompt";
import { useAuth } from "@/context/auth-context";
import { useTimezone } from "@/context/timezone-context";
import {
  Calendar,
  FileText,
  Video,
  Send,
  Settings,
  HelpCircle,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Share2,
  MessageSquare,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import SaveChatDialog from "@/components/save-chat-dialog";
import { toast } from "@/components/ui/use-toast";
import { useToast } from "@/components/ui/use-toast";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { convertToUIMessages } from "@/lib/utils";
import LoginScreen from "@/components/login-screen";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { nanoid } from "nanoid";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarHistory } from "@/components/sidebar-history";

type PromptType =
  | "crm-lookup"
  | "schedule-meeting"
  | "slack"
  | "summarize-deal"
  | "create-google-meet"
  | "add-custom-tool";

interface PromptExplanation {
  title: string;
  description: string;
  logo: string;
  examples: string[];
  steps: Array<{
    title: string;
    description: string;
  }>;
  apis: string[];
  context?: {
    systemPrompt: string;
    followUpQuestions: string[];
  };
}

interface LastScheduledMeeting {
  title: string;
  date: string;
  time: string;
  calendarEventId?: string;
  participants?: string[];
}

interface MeetingDetails {
  title: string;
  date: string;
  time: string;
  calendarEventId?: string;
  participants?: string[];
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: any[];
  chatId?: string; // Add optional chatId property
}

const promptExplanations: Record<PromptType, PromptExplanation> = {
  "crm-lookup": {
    title: "CRM Customer Lookup",
    description:
      "Access customer information and deal history from http://10x-crm.app using secure OAuth connections",
    logo: "/logos/crm-logo.png",
    examples: [
      "Find contact information for John Doe",
      "Show me recent deals with Acme Inc",
      "Get contact details for Jane Lane from Globex Corp",
      "What deals is Michael Chen working on?",
    ],
    steps: [
      {
        title: "User Requests Customer Information",
        description:
          "The user asks for information about a specific customer or deal from the CRM system.",
      },
      {
        title: "Authentication Check",
        description:
          "The assistant verifies the user is authenticated and has connected their CRM via OAuth.",
      },
      {
        title: "Custom CRM API Access",
        description:
          "Using the stored OAuth token from Descope, the assistant makes a secure API call to the CRM system to retrieve the requested information.",
      },
      {
        title: "Data Presentation",
        description:
          "The retrieved customer details, deal history, and relevant metrics are formatted and presented to the user in a clear, structured way.",
      },
    ],
    apis: ["Custom CRM API"],
  },
  "schedule-meeting": {
    title: "Schedule Calendar Meeting",
    description:
      "Create calendar events with contacts from your CRM using your Google Calendar",
    logo: "/logos/google-calendar.png",
    examples: [
      "Schedule a product demo with John Doe from Acme Inc tomorrow at 2 PM",
      "Set up a cloud migration discussion with Jane Lane next week",
      "Book a site visit with Michael Chen from TechCorp for Friday afternoon",
    ],
    steps: [
      {
        title: "User Requests Meeting Scheduling",
        description:
          "The user asks to schedule a meeting with specific contacts, often following a CRM lookup.",
      },
      {
        title: "Contact Information Retrieval",
        description:
          "The assistant uses previously retrieved CRM data to identify the relevant contact information for meeting attendees.",
      },
      {
        title: "Calendar Authorization",
        description:
          "The assistant accesses your Google Calendar through an Outbound App connection established in your profile settings.",
      },
      {
        title: "Event Creation",
        description:
          "A calendar event is created with the specified attendees, date, time, and duration, with invites automatically sent to all participants.",
      },
    ],
    apis: ["Google Calendar API", "Custom CRM API"],
  },
  slack: {
    title: "Slack Integration",
    description:
      "Send messages, retrieve conversations, and manage channels in your Slack workspace",
    logo: "/logos/slack-logo.svg",
    examples: [
      "Post a message to #general about the upcoming meeting",
      "Show me recent messages from the #team channel",
      "Create a new channel for the Alpha project",
      "Find messages about the quarterly review in Slack",
    ],
    steps: [
      {
        title: "User Requests Slack Action",
        description:
          "The user asks to interact with Slack, such as sending a message or viewing recent conversations.",
      },
      {
        title: "Authentication Check",
        description:
          "The assistant verifies the user is authenticated and has connected Slack via OAuth.",
      },
      {
        title: "Slack API Access",
        description:
          "Using the stored OAuth token from Descope, the assistant makes a secure API call to Slack.",
      },
      {
        title: "Action Execution",
        description:
          "The assistant performs the requested action and provides confirmation or retrieves the requested information.",
      },
      {
        title: "Results Presentation",
        description:
          "The assistant presents the results or confirmation in a clear, user-friendly format.",
      },
    ],
    apis: ["Slack API"],
  },
  "summarize-deal": {
    title: "Summarize Deal to Google Docs",
    description:
      "Create comprehensive deal summaries and save them directly to Google Docs for sharing and collaboration",
    logo: "/logos/google-docs.png",
    examples: [
      "Summarize the Enterprise Software License deal with John Doe",
      "Create a deal report for the Cloud Migration Project with Jane Lane",
      "Generate a summary of the IT Infrastructure Upgrade deal with Michael Chen",
    ],
    steps: [
      {
        title: "Deal Summary Request",
        description:
          "The user requests a summary of a specific deal, including status, action items, and key information.",
      },
      {
        title: "CRM Data Collection",
        description:
          "The assistant gathers all relevant information about the deal from your CRM system using your stored OAuth credentials.",
      },
      {
        title: "Summary Generation",
        description:
          "An AI-generated summary is created, highlighting key deal metrics, status updates, next steps, and action items.",
      },
      {
        title: "Google Docs Authentication",
        description:
          "The assistant connects to your Google Docs account using the OAuth token stored in your profile settings.",
      },
      {
        title: "Document Creation and Sharing",
        description:
          "A new Google Doc is created with the summarized information, formatted professionally, and ready to be shared with team members.",
      },
    ],
    apis: ["Google Docs API", "Custom CRM API"],
  },
  "create-google-meet": {
    title: "Create Google Meet",
    description:
      "Generate Google Meet video conference links for scheduled calendar events",
    logo: "/logos/google-meet-logo.png",
    examples: [
      "Create a Google Meet for my meeting with John Doe",
      // "Add video conferencing to my call with Jane Lane from Globex Corp",
      "Set up a Google Meet link for the IT infrastructure meeting with Michael Chen",
    ],
    steps: [
      {
        title: "Meeting Enhancement Request",
        description:
          "After scheduling a calendar event, the user requests to add a Google Meet link to the event.",
      },
      {
        title: "Calendar Event Identification",
        description:
          "The assistant identifies the relevant calendar event that needs a Google Meet link.",
      },
      {
        title: "Google Calendar Integration",
        description:
          "Using the Google Calendar API, the assistant adds a Google Meet link to the existing calendar event.",
      },
      {
        title: "Meet Link Generation",
        description:
          "A Google Meet link is automatically generated and added to the calendar event.",
      },
      {
        title: "Calendar Event Update",
        description:
          "The calendar event is updated to include the Google Meet details, making them available to all attendees.",
      },
    ],
    apis: ["Google Calendar API"],
  },
  "add-custom-tool": {
    title: "Add Your Own Tool",
    description:
      "Descope makes it easy to integrate other built-in or your own custom tools with the AI agent",
    logo: "/logos/custom-tool.svg",
    examples: [
      "How can I add a custom tool to the assistant?",
      "I want to integrate my own API with the CRM Assistant",
      "How do I create a new tool for the AI to use?",
      "Can I add a custom integration to this app?",
    ],
    steps: [
      {
        title: "Define Your Tool's Purpose",
        description:
          "Identify what problem your tool will solve and what data or actions it will provide to the assistant. Plan the required parameters, authentication needs, and expected responses.",
      },
      {
        title: "Create the Tool Implementation",
        description:
          "Develop your tool by extending the base Tool class. Implement the required methods: config (tool metadata), validate (input validation), and execute (core functionality). Use the Descope SDK for OAuth authentication and token management.",
      },
      {
        title: "Register Your Tool with the Registry",
        description:
          "Add your tool to the application's tool registry by importing it in lib/tools/index.ts and calling toolRegistry.register(new YourTool()). This makes your tool available to the AI assistant.",
      },
      {
        title: "Update the AI Configuration",
        description:
          "Add your tool's schema to the APPROVED_TOOLS array in lib/ai/models.ts. This defines the function signature that the AI will use to call your tool, including parameters and descriptions.",
      },
      {
        title: "Add UI Components",
        description:
          "Create UI components to showcase your tool in the sidebar and quick actions. Update the actionOptions array in app/page.tsx to include your tool with appropriate icons and descriptions.",
      },
      {
        title: "Test and Deploy",
        description:
          "Verify your tool works correctly with the assistant by testing various scenarios. Deploy your changes to your production environment and monitor for any issues.",
      },
    ],
    apis: ["Custom API", "Descope Outbound Apps"],
    context: {
      systemPrompt: `You are a helpful assistant guiding users through the process of creating custom tools for the CRM Assistant. 
      When users ask about adding custom tools, provide specific, actionable guidance based on the application's architecture.
      Focus on:
      1. Tool implementation using the base Tool class
      2. Integration with Descope's OAuth system
      3. Registration in the tool registry
      4. UI component creation
      5. Testing and deployment best practices
      
      Always reference the existing codebase structure and provide concrete examples when possible.`,
      followUpQuestions: [
        "What specific functionality would you like to add to the CRM Assistant?",
        "Do you have an existing API that you want to integrate?",
        "Would you like to see an example of a custom tool implementation?",
      ],
    },
  },
} as const;

interface GoogleMeetPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  meetingDetails: MeetingDetails;
}

interface ChatMessageProps {
  message: {
    role: string;
    content: string;
    parts?: Array<{
      type: string;
      text?: string;
      reasoning?: string;
      toolInvocation?: {
        name: string;
        arguments: Record<string, any>;
      };
      source?: {
        type: string;
        content: string;
      };
    }>;
  };
  onReconnectComplete: () => void;
}

const connectionMarkerRegex = /<connection:(.*?)>/;

// Create a separate component that uses useSearchParams
function ChatParamsHandler({
  isAuthenticated,
  isHandlingChatChange,
  setIsHandlingChatChange,
  setCurrentChatId,
  reload,
}: {
  isAuthenticated: boolean;
  isHandlingChatChange: boolean;
  setIsHandlingChatChange: (value: boolean) => void;
  setCurrentChatId: (id: string) => void;
  reload: () => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Reference to track if we've already processed the URL params
  const processedRef = useRef(false);

  useEffect(() => {
    // Skip if not authenticated, already handling a change, or if we've already processed
    if (!isAuthenticated || isHandlingChatChange || processedRef.current)
      return;

    const chatIdParam = searchParams?.get("chatId");

    if (chatIdParam) {
      console.log("Found chatId in URL params:", chatIdParam);

      // Mark as processed to prevent duplicate handling
      processedRef.current = true;

      // Set the handling flag to prevent multiple updates
      setIsHandlingChatChange(true);

      // Set the current chat ID
      setCurrentChatId(chatIdParam);
      localStorage.setItem("currentChatId", chatIdParam);

      // Clean up URL (remove chatId parameter) before loading messages
      if (typeof window !== "undefined") {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("chatId");
        window.history.replaceState({}, "", newUrl.toString());
      }

      // Delay reload to ensure state is updated
      setTimeout(() => {
        reload();
        // Reset the handling flag after reload is called
        setIsHandlingChatChange(false);
      }, 300);
    }
  }, [
    searchParams,
    isAuthenticated,
    isHandlingChatChange,
    setIsHandlingChatChange,
    setCurrentChatId,
    reload,
  ]);

  return null; // This component doesn't render anything
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/chat");
      } else {
        router.push("/landing");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading spinner while checking authentication status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Return null as the redirect will handle navigation
  return null;
}
