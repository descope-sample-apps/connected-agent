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
  Send,
  HelpCircle,
  PanelRightClose,
  PanelRightOpen,
  ExternalLink,
  Sparkles,
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
import AnimatedBeamComponent from "@/components/animated-beam";
import Link from "next/link";

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
      "Schedule a product demo with John Doe from Acme Inc tomorrow at 2 PM PST",
      "Set up a cloud migration discussion with Jane Lane next Friday at 10 AM PST",
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
        // Instead of just removing the parameter, replace with the chat path
        window.history.replaceState({}, "", `/chat/${chatIdParam}`);
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(true);
  const historySidebarRef = useRef<{ fetchChatHistory: () => void }>(null);
  const [showProfileScreen, setShowProfileScreen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [hasActivePrompt, setHasActivePrompt] = useState(false);
  const [showPromptExplanation, setShowPromptExplanation] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    // Only execute this logic on the client side
    if (typeof window === "undefined") {
      return null; // Return null for server-side rendering
    }

    // Check if we have an existing chat ID in localStorage
    const storedId = localStorage.getItem("currentChatId");
    if (storedId) {
      return storedId;
    }

    // Generate a new ID once if needed
    const newId = `chat-${nanoid()}`;
    localStorage.setItem("currentChatId", newId);
    console.log("Initialized new chat ID:", newId);
    return newId;
  });
  const [lastScheduledMeeting, setLastScheduledMeeting] =
    useState<LastScheduledMeeting | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentPromptType, setCurrentPromptType] =
    useState<PromptType>("slack");
  const [showDealSummaryPrompt, setShowDealSummaryPrompt] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] =
    useState<string>(DEFAULT_CHAT_MODEL);
  const [showGoogleMeetPrompt, setShowGoogleMeetPrompt] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isHandlingChatChange, setIsHandlingChatChange] = useState(false);
  const [chatRedirectAttempts, setChatRedirectAttempts] = useState(0);

  // Get timezone information from the context
  const { timezone, timezoneOffset } = useTimezone();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: chatHandleSubmit,
    isLoading: isChatLoading,
    error,
    append,
    setMessages,
    reload,
  } = useChat({
    api: "/api/chat",
    body: {
      id: currentChatId,
      selectedChatModel: selectedModel,
      timezone,
      timezoneOffset,
    },
    credentials: "include",
    onFinish: (message) => {
      console.log("Chat finished with message:", message);
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView();
      }

      // Reset active prompt state when a message completes
      setHasActivePrompt(false);
      setShowPromptExplanation(false);

      // Save the chat automatically (create title from first message if needed)
      if (messages.length > 0 && currentChatId) {
        saveChatToDatabase(currentChatId);
      }

      // Extract calendar event details from the assistant's response
      const messageContent =
        typeof message.content === "string" ? message.content : "";

      // More robust pattern matching for meeting detection
      const scheduledMatch = messageContent.match(
        /scheduled|created|added|set up a meeting|calendar event/i
      );
      const titleMatch = messageContent.match(/"([^"]+)"/); // Extracts text in quotes as the title
      const dateTimeMatch = messageContent.match(
        /on\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i
      );

      // Check if we have evidence of a meeting being scheduled
      if (scheduledMatch && titleMatch && dateTimeMatch) {
        const meetingDetails = {
          title: titleMatch[1],
          date: dateTimeMatch[1],
          time: dateTimeMatch[2],
          // We'll get this from the AI response in a real implementation
          calendarEventId: "cal-event-456",
        };

        console.log("Detected meeting:", meetingDetails);
        setLastScheduledMeeting(meetingDetails);
        setShowGoogleMeetPrompt(true);
      }
    },
    onError: (error) => {
      console.error("Chat error details:", error);

      // Log full error info
      if (error && typeof error === "object" && "response" in error) {
        console.error("Error status:", (error as any).status);
        (error as any).response
          .json()
          .then((data: any) => {
            console.error("Error response data:", data);
          })
          .catch((e: Error) => {
            console.error("Error parsing response:", e);
          });
      }

      // Check for specific error messages related to tools
      const errorMessage = error.message || "Failed to get a response";
      const isToolError =
        errorMessage.includes("tool") ||
        errorMessage.includes("function") ||
        errorMessage.includes("Authentication required");

      toast({
        title: isToolError ? "Tool Access Error" : "Error",
        description: isToolError
          ? "This action requires authentication with Google or other services. Please check your connections in profile settings."
          : "Failed to get a response. Please try again.",
        variant: "destructive",
      });

      setHasActivePrompt(false);
    },
  });

  // Load chat messages when currentChatId changes
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/overview");
    }

    const fetchChatMessages = async () => {
      if (!currentChatId || !isAuthenticated) return;

      // Don't try more than twice to avoid infinite loops
      if (chatRedirectAttempts >= 2) {
        console.log("Too many chat redirect attempts, stopping");
        return;
      }

      try {
        setIsHandlingChatChange(true);
        console.log("Fetching messages for chat:", currentChatId);

        // Check if we already have messages for this chat
        if (
          messages.length > 0 &&
          (messages[0] as any)?.chatId === currentChatId
        ) {
          console.log("Messages already loaded for chat:", currentChatId);
          return;
        }

        const response = await fetch(
          `/api/chat/messages?chatId=${currentChatId}`,
          {
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );

        // Handle invalid chat ID cases
        if (!response.ok) {
          if (response.status === 404) {
            console.log("Chat ID not found, creating new chat");
            createNewChat();
            return;
          }
          throw new Error("Failed to fetch chat messages");
        }

        const data = await response.json();
        if (
          data.messages &&
          Array.isArray(data.messages) &&
          data.messages.length > 0
        ) {
          console.log(
            `Loaded ${data.messages.length} messages for chat ${currentChatId}`
          );

          // Transform messages to the format expected by useChat
          const formattedMessages = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: extractMessageContent(msg),
            parts: Array.isArray(msg.parts) ? msg.parts : [],
            chatId: currentChatId, // Add chatId to track message ownership
          }));

          // Set messages in chat
          setMessages(formattedMessages);
        } else {
          // If no messages found for this chat ID, treat as invalid and create new chat
          console.log("No messages found for chat ID, creating new chat");
          createNewChat();
        }
      } catch (error) {
        console.error("Error loading chat messages:", error);
        // On any error, create a new chat
        createNewChat();
      } finally {
        setIsHandlingChatChange(false);
      }
    };

    // Helper function to create a new chat
    const createNewChat = () => {
      setChatRedirectAttempts((prev) => prev + 1);
      const newChatId = `chat-${nanoid()}`;
      console.log("Creating new chat with ID:", newChatId);
      setCurrentChatId(newChatId);
      localStorage.setItem("currentChatId", newChatId);

      // Update URL without reload
      if (typeof window !== "undefined") {
        window.history.pushState({}, "", `/chat/${newChatId}`);
      }
    };

    fetchChatMessages();
  }, [currentChatId, isAuthenticated]); // Remove unnecessary dependencies

  // Helper function to extract message content from different message formats
  const extractMessageContent = (msg: any): string => {
    // If msg has direct content, use it first
    if (typeof msg.content === "string" && msg.content.trim() !== "") {
      return msg.content;
    }

    // Check if parts exists and is an array
    if (!msg.parts || !Array.isArray(msg.parts) || msg.parts.length === 0) {
      return "";
    }

    const firstPart = msg.parts[0];

    // Handle different message part formats
    if (typeof firstPart === "string") {
      return firstPart;
    } else if (typeof firstPart === "object" && firstPart !== null) {
      // Object with text property
      if ("text" in firstPart && firstPart.text) {
        return String(firstPart.text);
      }

      // Object with content property
      if ("content" in firstPart && firstPart.content) {
        return String(firstPart.content);
      }

      // Try to convert the entire object to string as last resort
      return JSON.stringify(firstPart);
    }

    // Fallback
    return "";
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (error) {
      console.error("Chat error detected:", error);
      toast({
        title: "Connection Error",
        description:
          error.message || "There was an error connecting to the AI.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  useEffect(() => {
    // Load sidebar preference
    const storedSidebarPref = localStorage.getItem("sidebarDefault");
    if (storedSidebarPref !== null) {
      setSidebarOpen(storedSidebarPref === "true");
    }

    // Get the selected model from cookie
    const storedModel = document.cookie
      .split("; ")
      .find((row) => row.startsWith("chat-model="));

    if (storedModel) {
      setSelectedModel(storedModel.split("=")[1]);
    }
  }, []);

  useEffect(() => {
    // Check for OAuth redirect
    const url = new URL(window.location.href);

    // Handle OAuth success/error
    const oauthStatus = url.searchParams.get("oauth");
    if (oauthStatus === "success") {
      toast({
        title: "Connection Successful",
        description: "Your account has been connected successfully.",
        variant: "default",
      });

      // Check for redirectTo parameter to determine where to redirect
      const redirectTo = url.searchParams.get("redirectTo") || "chat";
      if (redirectTo === "profile" && isAuthenticated) {
        setShowProfileScreen(true);
      }

      // Remove the query parameters
      url.searchParams.delete("oauth");
      url.searchParams.delete("redirectTo");
      window.history.replaceState({}, "", url.toString());
    } else if (oauthStatus === "error") {
      const error = url.searchParams.get("error") || "Unknown error";
      toast({
        title: "Connection Failed",
        description: `Failed to connect: ${error}`,
        variant: "destructive",
      });

      // Check for redirectTo parameter to determine where to redirect
      const redirectTo = url.searchParams.get("redirectTo") || "chat";
      if (redirectTo === "profile" && isAuthenticated) {
        setShowProfileScreen(true);
      }

      // Remove the query parameters
      url.searchParams.delete("oauth");
      url.searchParams.delete("error");
      url.searchParams.delete("redirectTo");
      window.history.replaceState({}, "", url.toString());
    }

    // Show profile screen if explicitly requested
    const showProfile = url.searchParams.get("profile") === "true";
    if (showProfile && isAuthenticated) {
      setShowProfileScreen(true);

      // Remove the query parameter
      url.searchParams.delete("profile");
      window.history.replaceState({}, "", url.toString());
    }
  }, [isAuthenticated, toast]);

  const handleCreateGoogleMeet = () => {
    chatHandleSubmit(new Event("submit") as any, {
      data: { fromQuickAction: true },
    });
  };

  const handleLoadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setShowProfileScreen(false);
  };

  const togglePromptExplanation = () => {
    setShowPromptExplanation(!showPromptExplanation);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!inputRef.current) return;

    const value = inputRef.current.value.trim();
    if (!value) return;

    // Check if this is a tool-related prompt
    const matchedPrompt = Object.entries(promptExplanations).find(
      ([key, category]) =>
        category.examples.some(
          (example) => value.toLowerCase() === example.toLowerCase()
        )
    );

    if (matchedPrompt) {
      const [key, category] = matchedPrompt;
      // Add the user's message and system context in a single append call
      append({
        role: "user",
        content: value,
        parts: [
          { type: "text", text: value },
          {
            type: "reasoning",
            reasoning:
              category.context?.systemPrompt ||
              `This is a ${category.title} request. Please provide specific guidance.`,
            details: [
              {
                type: "text",
                text:
                  category.context?.systemPrompt ||
                  `This is a ${category.title} request. Please provide specific guidance.`,
              },
            ],
          },
        ],
      });
    } else {
      // Regular message handling
      append({
        role: "user",
        content: value,
      });
    }

    // Clear input using the handleInputChange from useChat
    handleInputChange({
      target: { value: "" },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const usePredefinedPrompt = useCallback(
    (promptText: string, promptType: string) => {
      if (!isAuthenticated) {
        // The user needs to be authenticated, but we'll just return
        // since the WelcomeScreen will show the authentication UI
        return;
      }

      setHasActivePrompt(true);
      setShowPromptExplanation(true);
      setCurrentPromptType(promptType as PromptType);

      // For testing the CRM contacts search by name feature
      let enhancedPrompt = promptText;

      // Test cases for exact and partial name matching
      if (promptText.includes("John Doe") && promptType === "slack") {
        enhancedPrompt = "Show me recent messages from the #general channel";
      } else if (promptText.includes("just John") && promptType === "slack") {
        enhancedPrompt = "Show me recent messages from the #general channel";
      } else if (
        promptText.includes("schedule with John") &&
        promptType === "slack"
      ) {
        enhancedPrompt = "Show me recent messages from the #general channel";
      } else if (promptText.includes("Jane Lane") && promptType === "slack") {
        enhancedPrompt = "Show me recent messages from the #general channel";
      } else if (promptText.includes("just Jane") && promptType === "slack") {
        enhancedPrompt = "Show me recent messages from the #general channel";
      } else if (promptText.includes("Michael") && promptType === "slack") {
        enhancedPrompt = "Show me recent messages from the #general channel";
      } else {
        enhancedPrompt = `${promptText} (Please use tools to respond to this query)`;
      }

      console.log("Submitting predefined prompt:", enhancedPrompt);

      chatHandleSubmit(new Event("submit") as any, {
        data: { fromQuickAction: true },
      });
    },
    [isAuthenticated, chatHandleSubmit]
  );

  const checkOAuthAndPrompt = useCallback(
    (action: () => void) => {
      if (!isAuthenticated) {
        return;
      }

      // In a real implementation, you would check if the user has the required OAuth connections
      // For now, we'll just execute the action
      action();

      setTimeout(() => {
        if (error) {
          toast({
            title: "Connection Required",
            description:
              "This action requires connecting with Google or other services. Please visit your profile to connect services.",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProfileScreen(true)}
              >
                Connect Services
              </Button>
            ),
          });
        }
      }, 500);
    },
    [isAuthenticated, error, toast, setShowProfileScreen]
  );

  const actionOptions = [
    {
      id: "crm-lookup",
      title: "CRM Lookup",
      description: "Get customer information and deal history",
      logo: "/logos/crm-logo.png",
      action: () =>
        checkOAuthAndPrompt(() =>
          usePredefinedPrompt("Find John's contact information", "crm-lookup")
        ),
    },
    {
      id: "schedule-meeting",
      title: "Schedule Meeting",
      description: "Schedule a meeting with contacts from the CRM",
      logo: "/logos/google-calendar.png",
      action: () =>
        usePredefinedPrompt(
          "Schedule a meeting with John next Tuesday",
          "schedule-meeting"
        ),
    },
    {
      id: "create-google-meet",
      title: "Create Google Meet",
      description: "Create a Google Meet for a scheduled event",
      logo: "/logos/google-meet-logo.png",
      action: () =>
        usePredefinedPrompt(
          "Create a Google Meet for my meeting with Jane",
          "create-google-meet"
        ),
    },
    // {
    //   id: "summarize-deal",
    //   title: "Summarize Deal",
    //   description: "Summarize deal status and save to Google Docs",
    //   logo: "/logos/google-docs.png",
    //   action: () =>
    //     checkOAuthAndPrompt(() =>
    //       usePredefinedPrompt(
    //         "Summarize the Enterprise Software License deal",
    //         "summarize-deal"
    //       )
    //     ),
    // },
    {
      id: "slack",
      title: "Slack Integration",
      description: "Send messages and updates to Slack channels",
      logo: "/logos/slack-logo.svg",
      action: () =>
        checkOAuthAndPrompt(() =>
          usePredefinedPrompt(
            "Send a message to the #sales channel about the new deal",
            "slack"
          )
        ),
    },
    {
      id: "add-custom-tool",
      title: "Add Your Own Tool",
      description:
        "Create and integrate your own custom tools with the assistant",
      logo: "/logos/custom-tool.svg",
      action: () =>
        usePredefinedPrompt(
          "How can I add my own custom tool to the assistant?",
          "add-custom-tool"
        ),
    },
  ];

  useEffect(() => {
    // Monitor messages for meeting creation responses
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      try {
        // Ensure content is a string before using match
        const messageContent =
          typeof lastMessage.content === "string" ? lastMessage.content : "";

        // Parse the message for meeting details using regex or other methods
        const meetingTitleMatch = messageContent.match(/scheduled "([^"]+)"/);
        const dateMatch = messageContent.match(
          /on ([\w\s,]+) at ([\d:]+\s?[AP]M)/i
        );

        if (meetingTitleMatch && dateMatch) {
          setMeetingDetails({
            title: meetingTitleMatch[1],
            date: dateMatch[1],
            time: dateMatch[2],
            participants: [], // Extract participants if needed
          });
        }
      } catch (error) {
        console.error("Error parsing meeting details:", error);
        // Don't set meeting details if there's an error
      }
    }
  }, [messages]);

  const handleReconnectComplete = useCallback(() => {
    // Resubmit the last user message to retry the operation with new token
    if (messages.length > 1) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMessage) {
        append({
          role: "user",
          content: lastUserMessage.content,
        });
      }
    }
  }, [messages, append]);

  const handleDealSummarySuccess = (documentUrl: string) => {
    append({
      role: "user",
      content: `I've created a summary document for the deal: ${documentUrl}`,
    });
  };

  // Update the sidebar toggle to save preferences
  const toggleSidebar = () => {
    const newValue = !sidebarOpen;
    setSidebarOpen(newValue);
    // Don't save the preference here - only save when explicitly changed in settings
  };

  // Function to save chat to database
  const saveChatToDatabase = async (chatId: string) => {
    try {
      if (!isAuthenticated || !chatId) return;

      // Extract title from the first user message's parts
      let title = "New Chat";
      const initialUserMessage = messages.find((m) => m.role === "user");
      if (initialUserMessage?.parts?.[0]) {
        const firstPart = initialUserMessage.parts[0];
        if (typeof firstPart === "string") {
          title = firstPart;
        } else if (typeof firstPart === "object" && "text" in firstPart) {
          title = firstPart.text;
        }
        // Limit title length
        title = title.substring(0, 50);
      }

      // Format messages for saving
      const formattedMessages = messages.map((msg) => {
        interface MessagePart {
          type: string;
          text: string;
        }

        // Ensure we have a valid date for createdAt
        let createdAt = new Date();
        // If the message has a createdAt that's a valid date string or timestamp, use it
        if (msg.createdAt) {
          try {
            createdAt = new Date(msg.createdAt);
          } catch (e) {
            console.warn(
              "Invalid date format in message, using current date instead"
            );
          }
        }

        // First, prepare the formatted message structure
        const formattedMsg: {
          id: string;
          chatId: string;
          role: string;
          content: string;
          parts: MessagePart[];
          createdAt: Date;
        } = {
          id: msg.id || `msg-${nanoid()}`, // Ensure all messages have an ID
          chatId: chatId,
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : "",
          parts: [],
          createdAt,
        };

        // Handle different ways content might be stored
        let processedParts: MessagePart[] = [];

        // Case 1: If msg.parts exists and is an array
        if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
          processedParts = msg.parts
            .map((part) => {
              // If part is a string, convert it to the right format
              if (typeof part === "string") {
                return { type: "text", text: part };
              }
              // If part is an object with text property
              else if (typeof part === "object" && part !== null) {
                if ("text" in part) {
                  return { type: "text", text: String(part.text || "") };
                } else if ("type" in part && "text" in part) {
                  return {
                    type: String(part.type),
                    text: String(part.text || ""),
                  };
                }
                // Try to extract content from other possible structures
                else if ("content" in part) {
                  return { type: "text", text: String(part.content || "") };
                }
              }
              // Default empty part (this was causing the issue)
              return { type: "text", text: "" };
            })
            .filter((part) => part.text.trim() !== ""); // Filter out empty text parts
        }
        // Case 2: If no parts but msg.content exists
        else if (typeof msg.content === "string" && msg.content.trim() !== "") {
          processedParts = [{ type: "text", text: msg.content }];
        }
        // Case 3: Check other possible formats
        else if (typeof msg === "object" && msg !== null) {
          // Try to extract from different properties that might contain the message
          if ("message" in msg && typeof msg.message === "string") {
            processedParts = [{ type: "text", text: msg.message }];
          } else if ("value" in msg && typeof msg.value === "string") {
            processedParts = [{ type: "text", text: msg.value }];
          }
        }

        // Use processed parts
        formattedMsg.parts = processedParts;

        // Set the content from the first text part if available and not already set
        if (!formattedMsg.content && processedParts.length > 0) {
          const firstTextPart = processedParts.find(
            (p) => p.type === "text" && p.text
          );
          if (firstTextPart) {
            formattedMsg.content = firstTextPart.text;
          }
        }

        return formattedMsg;
      });

      // Log message count to help with debugging
      console.log(
        `Saving chat ${chatId} with ${formattedMessages.length} messages`
      );

      // Save the chat using the chat API
      const response = await fetch("/api/chat/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: chatId,
          title,
          messages: formattedMessages,
          lastMessageAt: new Date().toISOString(), // Add lastMessageAt
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save chat");
      }

      console.log("Chat saved successfully:", chatId);
    } catch (error) {
      console.error("Error saving chat:", error);
      // Don't show toast to user as this is background functionality
    }
  };

  // Function to handle selecting a chat from history
  const handleChatSelect = async (chatId: string) => {
    if (!chatId || chatId === currentChatId) return;

    try {
      // Update state first
      setCurrentChatId(chatId);
      localStorage.setItem("currentChatId", chatId);
      setMessages([]);

      // Fetch messages for the selected chat
      const response = await fetch(`/api/chat/messages?chatId=${chatId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch chat messages");
      }
      const data = await response.json();

      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Error loading chat messages:", error);
      toast({
        title: "Error",
        description: "Failed to load chat messages",
        variant: "destructive",
      });
    }
  };

  // Function to handle creating a new chat
  const handleNewChat = () => {
    // Prevent multiple executions if already handling a change
    if (isHandlingChatChange) return;

    // Set handling flag to prevent URL updates during this operation
    setIsHandlingChatChange(true);

    // Generate a new chat ID once
    const newChatId = `chat-${nanoid()}`;
    console.log("Creating new chat with ID:", newChatId);

    // Update state and localStorage
    setCurrentChatId(newChatId);
    localStorage.setItem("currentChatId", newChatId);
    setMessages([]); // Clear messages to show the welcome screen

    // Update URL manually once
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `/chat/${newChatId}`);
    }

    // Force a refresh of the chat history
    if (historySidebarRef.current) {
      historySidebarRef.current.fetchChatHistory();
    }

    // Reset handling flag after a short delay
    setTimeout(() => {
      setIsHandlingChatChange(false);
    }, 300);
  };

  // Function to handle chat deletion
  const handleChatDeleted = (deletedChatId: string) => {
    // If the deleted chat was the current one, create a new chat
    if (deletedChatId === currentChatId) {
      handleNewChat();
    }
  };

  // Add this to check for OAuth redirect with chat context
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const oauthStatus = url.searchParams.get("oauth");
      const redirectTo = url.searchParams.get("redirectTo");
      const chatId = url.searchParams.get("chatId");

      if (oauthStatus === "success") {
        console.log("OAuth flow completed successfully");

        // Check if there's a pending reconnect callback
        const hasPendingReconnect =
          localStorage.getItem("pendingReconnectComplete") === "true";
        if (hasPendingReconnect) {
          console.log("Found pending reconnect callback, executing");
          localStorage.removeItem("pendingReconnectComplete");
          setTimeout(() => {
            // Execute the reconnect callback (retry the last message)
            handleReconnectComplete();
          }, 1000);
        }

        if (redirectTo === "chat" && chatId) {
          console.log("Returning from OAuth with chat ID:", chatId);
          setCurrentChatId(chatId);
          localStorage.setItem("currentChatId", chatId);
          setMessages([]);

          // Clear the URL parameters and update URL to show chat ID
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete("oauth");
          newUrl.searchParams.delete("redirectTo");
          newUrl.searchParams.delete("chatId");
          window.history.replaceState({}, "", `/chat/${chatId}`);

          // Reload the chat
          reload();
        }
      }
    }
  }, [reload, setMessages, handleReconnectComplete]);

  // Update chat URL when currentChatId changes - add handling flag here too
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      currentChatId &&
      isAuthenticated &&
      !isHandlingChatChange
    ) {
      // Limit how aggressively we update the URL
      window.history.replaceState({}, "", `/chat/${currentChatId}`);
    }
  }, [currentChatId, isAuthenticated, isHandlingChatChange]);

  // Reset redirect attempts on component mount
  useEffect(() => {
    setChatRedirectAttempts(0);
  }, []);

  const router = useRouter();

  // Save chat after new messages are received
  useEffect(() => {
    // Only save if we have messages and a current chat ID
    if (messages.length > 0 && currentChatId && isAuthenticated) {
      // Use a small delay to ensure all messages are processed
      const saveTimer = setTimeout(() => {
        console.log("Auto-saving chat with messages:", messages.length);
        saveChatToDatabase(currentChatId);
      }, 1000);

      return () => clearTimeout(saveTimer);
    }
  }, [messages, currentChatId, isAuthenticated]);

  // Focus input field after response
  useEffect(() => {
    if (messages.length > 0 && !isChatLoading && inputRef.current) {
      // Small delay to ensure the UI has updated
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages.length, isChatLoading]);

  const [isScrolling, setIsScrolling] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-screen max-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <header className="border-b bg-white dark:bg-gray-900 px-6 py-3 flex items-center justify-between shadow-sm">
          <Link
            href="/overview"
            className="hover:opacity-80 transition-opacity"
          >
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              ConnectedAgent
            </h1>
          </Link>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="rounded-full gap-2"
              onClick={() => setShowProfileScreen(true)}
            >
              Sign In
            </Button>
          </div>
        </header>

        {showProfileScreen ? (
          <LoginScreen />
        ) : (
          <div className="flex-1 flex flex-col items-center p-8 text-center">
            <h1 className="text-3xl font-bold mb-6 mt-12">
              Welcome to ConnectedAgent
            </h1>
            <p className="text-muted-foreground mb-4 max-w-md">
              This sample application showcases AI tool calling using Descope
              Outbound Apps. The assistant can securely access your connected
              services using OAuth tokens.
            </p>
            <p className="text-muted-foreground mb-6 max-w-md">
              Sign in to get started with your AI assistant.
            </p>
            <Button
              size="lg"
              className="rounded-full bg-primary hover:bg-primary/90 text-white font-medium"
              onClick={() => setShowProfileScreen(true)}
            >
              Get Started
            </Button>
            <div className="mt-auto pt-12 border-t border-primary/10 w-full max-w-md fixed bottom-6 left-0 right-0 mx-auto">
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
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showProfileScreen && isAuthenticated) {
    return (
      <ProfileScreen
        onBack={() => setShowProfileScreen(false)}
        onLoadChat={handleLoadChat}
      />
    );
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatParamsHandler
        isAuthenticated={isAuthenticated}
        isHandlingChatChange={isHandlingChatChange}
        setIsHandlingChatChange={setIsHandlingChatChange}
        setCurrentChatId={setCurrentChatId}
        reload={reload}
      />
      <div className="app-container">
        {showGoogleMeetPrompt && lastScheduledMeeting && (
          <GoogleMeetPrompt
            isOpen={showGoogleMeetPrompt}
            onClose={() => setShowGoogleMeetPrompt(false)}
            onConfirm={handleCreateGoogleMeet}
            meetingDetails={{
              title: lastScheduledMeeting.title,
              date: lastScheduledMeeting.date,
              time: lastScheduledMeeting.time,
              participants: lastScheduledMeeting.participants,
            }}
          />
        )}
        <ShareChatDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          chatId={currentChatId || "temp-chat-id"}
        />
        <SaveChatDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={() => {
            // Chat is now saved automatically
            setShowSaveDialog(false);
          }}
        />
        <DealSummaryPrompt
          isOpen={showDealSummaryPrompt}
          onClose={() => setShowDealSummaryPrompt(false)}
          onSuccess={handleDealSummarySuccess}
          dealId={selectedDealId || undefined}
        />

        <div className="flex flex-col h-screen max-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
          <header className="border-b bg-white dark:bg-gray-900 px-6 py-3 flex items-center justify-between shadow-sm">
            <Link
              href="/overview"
              className="hover:opacity-80 transition-opacity"
            >
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                ConnectedAgent
              </h1>
            </Link>

            <div className="flex items-center gap-3">
              {/* {isAuthenticated && messages.length > 0 && (
                <div className="flex items-center gap-2 mr-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareChat}
                    className="h-9"
                  >
                    <Share2 className="h-4 w-4 mr-2" /> Share
                  </Button>
                </div>
              )} */}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      <HelpCircle className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] p-4">
                    <div className="space-y-2">
                      <p className="font-medium">About this demo</p>
                      <p className="text-sm text-muted-foreground">
                        This sample app showcases OpenAI function calling with
                        Descope outbound OAuth apps. AI functions can securely
                        access your connected services using OAuth.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        For more information, visit{" "}
                        <a
                          href="https://docs.descope.com/outbound/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline hover:no-underline"
                        >
                          Descope docs
                        </a>
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {isAuthenticated ? (
                <UserMenu onProfileClick={() => setShowProfileScreen(true)} />
              ) : (
                <Button
                  size="sm"
                  className="rounded-full gap-2"
                  onClick={() => setShowProfileScreen(true)}
                >
                  Sign In
                </Button>
              )}
            </div>
          </header>

          {!isAuthenticated ? (
            <WelcomeScreen />
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Add Chat History Sidebar */}
              <div className="border-r border-gray-100 dark:border-gray-800 h-full">
                <SidebarHistory
                  ref={historySidebarRef}
                  currentChatId={currentChatId || ""}
                  onChatSelect={handleChatSelect}
                  onNewChat={handleNewChat}
                  isCollapsed={!historySidebarOpen}
                  onToggleCollapse={() =>
                    setHistorySidebarOpen(!historySidebarOpen)
                  }
                  isAuthenticated={isAuthenticated}
                />
              </div>

              <div className="flex-1 flex flex-col overflow-hidden relative">
                <ScrollArea
                  className="flex-1 p-6 pb-24"
                  style={{ overflowAnchor: "auto" }}
                >
                  {messages.length === 0 && !isHandlingChatChange ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
                      <h2 className="text-2xl font-bold mb-2">
                        Welcome to CRM Assistant
                      </h2>
                      <p className="text-muted-foreground mb-8 max-w-lg text-center">
                        I can help you manage customer relationships, schedule
                        meetings, and more. Try one of these examples or type
                        your own question below.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                        {(() => {
                          // Create a flat array of all examples from all tools
                          const allExamples = Object.entries(promptExplanations)
                            .filter(([key]) => key !== "add-custom-tool") // Exclude the add-custom-tool
                            .flatMap(([key, category]) =>
                              category.examples.map((example) => ({
                                example,
                                toolKey: key,
                                logo: category.logo,
                                title: category.title,
                              }))
                            );

                          // Shuffle the array and take a subset (12 examples)
                          const shuffled = [...allExamples].sort(
                            () => Math.random() - 0.5
                          );
                          const selectedExamples = shuffled.slice(0, 12);

                          return selectedExamples.map((item, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                // Use the handleInputChange function from useChat
                                const event = {
                                  target: { value: item.example },
                                } as React.ChangeEvent<HTMLInputElement>;
                                handleInputChange(event);
                                inputRef.current?.focus();
                              }}
                              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-left group relative"
                            >
                              <div className="relative w-6 h-6 flex-shrink-0">
                                <Image
                                  src={item.logo}
                                  alt={item.title}
                                  fill
                                  className="object-contain"
                                />
                              </div>
                              <span className="text-sm text-muted-foreground group-hover:text-foreground line-clamp-2">
                                {item.example}
                              </span>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="md:max-w-4xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
                      {messages.map((message, index) => (
                        <ChatMessage
                          key={index}
                          message={{
                            role: message.role,
                            content:
                              typeof message.content === "string" &&
                              message.content.length > 0
                                ? message.content
                                : extractMessageContent(message),
                            parts: message.parts
                              ?.filter((part) => {
                                if (
                                  typeof part === "object" &&
                                  "type" in part
                                ) {
                                  return part.type !== "step-start";
                                }
                                return true;
                              })
                              .map((part) => {})
                              .filter(Boolean) as any,
                          }}
                          onReconnectComplete={handleReconnectComplete}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-6 px-4">
                  <div className="mx-auto max-w-4xl w-full">
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                      <form onSubmit={handleSubmit} className="relative">
                        <Input
                          ref={inputRef}
                          value={input}
                          onChange={handleInputChange}
                          placeholder="Ask anything..."
                          className="pr-20 py-6 resize-none border-muted/30 focus-visible:ring-primary/70 shadow-lg rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm transition-all duration-200 hover:shadow-xl"
                          disabled={isChatLoading}
                        />
                        <div className="absolute top-0 right-0 h-full flex items-center justify-center pr-4">
                          <Button
                            size="icon"
                            type="submit"
                            className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                            disabled={isChatLoading || !input.trim()}
                          >
                            {isChatLoading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            ) : (
                              <Send className="size-4" />
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Sidebar toggle button - now positioned in the main chat area */}
                <div className="absolute top-4 right-4 z-10">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={toggleSidebar}
                          className="rounded-full shadow-sm hover:shadow-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 border-muted/20"
                        >
                          {sidebarOpen ? (
                            <PanelRightClose className="size-4 text-primary" />
                          ) : (
                            <PanelRightOpen className="size-4 text-primary" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg"
                      >
                        {sidebarOpen
                          ? "Hide quick actions"
                          : "Show quick actions"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {sidebarOpen && (
                <div
                  className={`${
                    showPromptExplanation && hasActivePrompt
                      ? "w-[32rem]"
                      : "w-80"
                  } bg-white/95 dark:bg-gray-900/95 shadow-xl overflow-hidden transition-all duration-300 ease-in-out backdrop-blur-sm border-l border-l-slate-200/30 dark:border-l-slate-700/30`}
                  style={{
                    boxShadow: "0 0 20px 0 rgba(0, 0, 0, 0.05)",
                    borderImageSource:
                      "linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
                  }}
                >
                  {showPromptExplanation && hasActivePrompt ? (
                    <div className="animate-in slide-in-from-right duration-300 h-full">
                      <PromptExplanation
                        title={promptExplanations[currentPromptType].title}
                        description={
                          promptExplanations[currentPromptType].description
                        }
                        logo={promptExplanations[currentPromptType].logo}
                        examples={
                          promptExplanations[currentPromptType].examples
                        }
                        steps={promptExplanations[currentPromptType].steps}
                        apis={promptExplanations[currentPromptType].apis}
                        isVisible={true}
                        onToggle={togglePromptExplanation}
                        onExampleClick={(example) => {
                          append({
                            role: "user",
                            content: example,
                          });
                          setShowPromptExplanation(false);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="p-6 animate-in fade-in duration-300">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                          Connected Applications
                        </h2>
                      </div>
                      <div className="space-y-4">
                        {actionOptions.map((option) => (
                          <ActionCard
                            key={option.id}
                            title={option.title}
                            description={option.description}
                            logo={option.logo}
                            onClick={option.action}
                          />
                        ))}
                      </div>

                      <div className="mt-8 pt-6 border-t border-primary/10 dark:border-primary/5">
                        <a
                          href="https://descope.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white hover:text-white border-0 group transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] font-medium rounded-xl">
                            <Sparkles className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                            Learn More About Descope AI
                            <ExternalLink className="w-3 h-3 ml-2 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Suspense>
  );
}
