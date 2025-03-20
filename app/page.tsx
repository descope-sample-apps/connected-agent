"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback } from "react";
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
import ZoomMeetingPrompt from "@/components/zoom-meeting-prompt";
import ProfileScreen from "@/components/profile-screen";
import ShareChatDialog from "@/components/share-chat-dialog";
import PromptExplanation from "@/components/prompt-explanation";
import PromptTrigger from "@/components/prompt-trigger";
import { useAuth } from "@/context/auth-context";
import {
  Briefcase,
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
} from "lucide-react";
import SaveChatDialog from "@/components/save-chat-dialog";
import { toast } from "@/components/ui/use-toast";
import { useToast } from "@/components/ui/use-toast";

const promptExplanations = {
  "crm-lookup": {
    title: "CRM Customer Lookup",
    description:
      "Access customer information and deal history from your CRM system using secure OAuth connections",
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
    apis: ["Custom CRM API", "Descope OAuth"],
  },
  "schedule-meeting": {
    title: "Schedule Calendar Meeting",
    description:
      "Create calendar events with contacts from your CRM using your Google Calendar",
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
          "The assistant accesses your Google Calendar through a secure OAuth connection established in your profile settings.",
      },
      {
        title: "Event Creation",
        description:
          "A calendar event is created with the specified attendees, date, time, and duration, with invites automatically sent to all participants.",
      },
    ],
    apis: ["Google Calendar API", "Google OAuth", "Custom CRM API"],
  },
  "create-zoom": {
    title: "Create Zoom Meeting",
    description:
      "Generate Zoom video conference links for scheduled calendar events",
    steps: [
      {
        title: "Meeting Enhancement Request",
        description:
          "After scheduling a calendar event, the user requests to add a Zoom meeting link to the event.",
      },
      {
        title: "Calendar Event Identification",
        description:
          "The assistant identifies the relevant calendar event that needs a Zoom meeting link.",
      },
      {
        title: "Zoom API Authorization",
        description:
          "Using the Zoom OAuth token stored securely in your profile, the assistant connects to your Zoom account.",
      },
      {
        title: "Zoom Meeting Creation",
        description:
          "A new Zoom meeting is created with appropriate settings, generating a meeting URL, ID, and password.",
      },
      {
        title: "Calendar Event Update",
        description:
          "The calendar event is updated to include the Zoom meeting details, making them available to all attendees.",
      },
    ],
    apis: ["Zoom API", "Zoom OAuth", "Google Calendar API"],
  },
  "summarize-deal": {
    title: "Summarize Deal to Google Docs",
    description:
      "Create comprehensive deal summaries and save them directly to Google Docs for sharing and collaboration",
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
    apis: ["Google Docs API", "Google OAuth", "Custom CRM API"],
  },
};

export default function Home() {
  const { isAuthenticated, isLoading, setShowAuthModal } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showZoomPrompt, setShowZoomPrompt] = useState(false);
  const [showProfileScreen, setShowProfileScreen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [hasActivePrompt, setHasActivePrompt] = useState(false);
  const [showPromptExplanation, setShowPromptExplanation] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [lastScheduledMeeting, setLastScheduledMeeting] = useState<{
    title: string;
    date: string;
    time: string;
  } | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentPromptType, setCurrentPromptType] =
    useState<string>("crm-lookup");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptExplanationRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: chatHandleSubmit,
    isLoading: isChatLoading,
    error,
  } = useChat({
    api: "/api/chat",
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
    onFinish: (message) => {
      console.log("Chat finished with message:", message);
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }

      // Reset active prompt state when a message completes
      setHasActivePrompt(false);
      setShowPromptExplanation(false);

      if (
        message.parts &&
        message.parts.some(
          (part) =>
            part.type === "text" &&
            part.text.includes("meeting") &&
            part.text.includes("scheduled")
        )
      ) {
        const meetingDetails = {
          title: "Follow-up Meeting",
          date: "April 10, 2025",
          time: "2:00 PM",
        };

        setLastScheduledMeeting(meetingDetails);
        setShowZoomPrompt(true);
      }
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleCreateZoomMeeting = () => {
    chatHandleSubmit(new Event("submit") as any, {
      data: { fromQuickAction: true },
    });
  };

  const generateDefaultTitle = useCallback(() => {
    const firstUserMessage = messages
      .find((m) => m.role === "user")
      ?.parts.find((p) => p.type === "text")?.text;
    let title = "";

    if (firstUserMessage) {
      const words = firstUserMessage.split(" ");
      title = words.slice(0, 5).join(" ");
      if (words.length > 5) title += "...";
    }

    if (!title || title.length < 10) {
      const now = new Date();
      title = `Chat ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    }

    return title;
  }, [messages]);

  const handleSaveChat = useCallback(
    async (customTitle?: string) => {
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }

      try {
        const title = customTitle || generateDefaultTitle();

        toast({
          title: "Saving conversation...",
          description: customTitle ? undefined : "Using auto-generated title",
          duration: 2000,
        });

        const response = await fetch("/api/save-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
            title,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setCurrentChatId(data.id);
          toast({
            title: "Conversation saved",
            description: `Saved as "${title}"`,
            duration: 3000,
          });
        } else {
          throw new Error(data.error || "Failed to save chat");
        }
      } catch (error) {
        console.error("Error saving chat:", error);
        toast({
          title: "Save failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [messages, isAuthenticated, setShowAuthModal, generateDefaultTitle]
  );

  const handleShareChat = () => {
    if (!currentChatId) {
      const chatId = `chat-${Date.now()}`;
      setCurrentChatId(chatId);
    }
    setShowShareDialog(true);
  };

  const handleLoadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setShowProfileScreen(false);
    alert(`Loading chat ${chatId}`);
  };

  const togglePromptExplanation = () => {
    setShowPromptExplanation(!showPromptExplanation);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    chatHandleSubmit(e);
  };

  const usePredefinedPrompt = useCallback(
    (promptText: string, promptType: string) => {
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }

      setHasActivePrompt(true);
      setShowPromptExplanation(true);
      setCurrentPromptType(promptType);

      const enhancedPrompt = `${promptText} (Please use tools to respond to this query)`;
      console.log("Submitting predefined prompt:", enhancedPrompt);

      chatHandleSubmit(new Event("submit") as any, {
        data: { fromQuickAction: true },
      });
    },
    [isAuthenticated, setShowAuthModal, chatHandleSubmit]
  );

  const checkOAuthAndPrompt = useCallback(
    (action: () => void) => {
      if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
      }

      // In a real implementation, you would check if the user has the required OAuth connections
      // For now, we'll just execute the action
      action();

      // After submitting, check for any errors that might indicate OAuth issues
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
    [isAuthenticated, setShowAuthModal, error, toast, setShowProfileScreen]
  );

  const actionOptions = [
    {
      id: "crm-lookup",
      title: "CRM Lookup",
      description: "Get customer information and deal history",
      icon: <Briefcase className="h-5 w-5" />,
      action: () =>
        checkOAuthAndPrompt(() =>
          usePredefinedPrompt(
            "I need to look up customer information in the CRM",
            "crm-lookup"
          )
        ),
    },
    {
      id: "schedule-meeting",
      title: "Schedule Meeting",
      description: "Schedule a meeting with contacts from the CRM",
      icon: <Calendar className="h-5 w-5" />,
      action: () =>
        usePredefinedPrompt(
          "I need to schedule a meeting with the contacts from my last CRM lookup",
          "schedule-meeting"
        ),
    },
    {
      id: "create-zoom",
      title: "Create Zoom Meeting",
      description: "Create a Zoom meeting for a scheduled event",
      icon: <Video className="h-5 w-5" />,
      action: () =>
        usePredefinedPrompt(
          "Create a Zoom meeting for my next scheduled meeting",
          "create-zoom"
        ),
    },
    {
      id: "summarize-deal",
      title: "Summarize Deal",
      description: "Summarize deal status and save to Google Docs",
      icon: <FileText className="h-5 w-5" />,
      action: () =>
        usePredefinedPrompt(
          "Summarize the current deal status and save it to Google Docs",
          "summarize-deal"
        ),
    },
  ];

  const handleQuickActionSchedule = () => {
    const prompt =
      "Schedule a follow-up meeting with the Acme Corp team for next Tuesday at 2pm for 60 minutes.";
    chatHandleSubmit(new Event("submit") as any, {
      data: { fromQuickAction: true },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
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
    <>
      <AuthModal />
      <ZoomMeetingPrompt
        isOpen={showZoomPrompt}
        onClose={() => setShowZoomPrompt(false)}
        onConfirm={handleCreateZoomMeeting}
        meetingDetails={lastScheduledMeeting}
      />
      <ShareChatDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        chatId={currentChatId || "temp-chat-id"}
      />
      <SaveChatDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveChat}
      />

      <div className="flex flex-col h-screen max-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <header className="border-b bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-between shadow-sm">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
            CRM Assistant
          </h1>

          <div className="flex items-center gap-3">
            {isAuthenticated && messages.length > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSaveChat()}
                  className="rounded-full"
                  title="Save conversation"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareChat}
                  className="h-9"
                >
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
              </div>
            )}

            <Button variant="ghost" size="icon" className="rounded-full">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" />
            </Button>
            {isAuthenticated ? (
              <UserMenu onProfileClick={() => setShowProfileScreen(true)} />
            ) : (
              <Button
                size="sm"
                className="rounded-full gap-2"
                onClick={() => setShowAuthModal(true)}
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
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden relative">
                <ScrollArea className="flex-1 p-6">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                        <Briefcase className="h-10 w-10 text-primary" />
                      </div>
                      <h2 className="text-2xl font-bold mb-2">
                        Welcome to CRM Assistant
                      </h2>
                      <p className="text-muted-foreground mb-6 max-w-md">
                        I can help you manage customer relationships, schedule
                        meetings, and more. You can use the quick actions in the
                        sidebar or simply type any question in the chat box
                        below.
                      </p>
                      <div className="flex gap-4">
                        <Button
                          onClick={() => {
                            chatHandleSubmit(new Event("submit") as any, {
                              data: { fromQuickAction: true },
                            });
                          }}
                          className="px-6"
                        >
                          Start a conversation
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            chatHandleSubmit(new Event("submit") as any, {
                              data: { fromQuickAction: true },
                            });
                          }}
                          className="px-6"
                        >
                          See examples
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 pb-4">
                      {messages.map((message) => (
                        <ChatMessage key={message.id} message={message} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="p-4 border-t bg-white dark:bg-gray-900">
                  <form
                    id="chat-form"
                    onSubmit={handleSubmit}
                    className="flex gap-2 items-center relative"
                  >
                    {hasActivePrompt && (
                      <div className="absolute bottom-20 right-4 z-10">
                        <PromptTrigger
                          onToggle={togglePromptExplanation}
                          isVisible={showPromptExplanation}
                          isActive={hasActivePrompt}
                        />
                      </div>
                    )}

                    <div className="flex-1 relative">
                      <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type your message..."
                        className="rounded-full border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-6 pr-12"
                        disabled={isChatLoading}
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Button
                          type="submit"
                          disabled={isChatLoading || !input.trim()}
                          size="icon"
                          className="rounded-full h-10 w-10 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </form>

                  {messages.length > 0 && (
                    <div className="flex items-center justify-center mt-3">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        <span>{messages.length} messages</span>
                        {currentChatId && (
                          <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                            Saved
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-4 top-4 rounded-full shadow-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                      >
                        {sidebarOpen ? (
                          <PanelRightClose className="h-4 w-4" />
                        ) : (
                          <PanelRightOpen className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {sidebarOpen
                        ? "Hide quick actions"
                        : "Show quick actions"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {sidebarOpen && (
                <div
                  className={`${
                    showPromptExplanation && hasActivePrompt
                      ? "w-96 md:w-[28rem]"
                      : "w-80"
                  } border-l bg-white dark:bg-gray-900 shadow-sm overflow-auto transition-all duration-300 ease-in-out`}
                >
                  {showPromptExplanation && hasActivePrompt ? (
                    <div className="animate-in slide-in-from-right duration-300">
                      <PromptExplanation
                        title={promptExplanations[currentPromptType].title}
                        description={
                          promptExplanations[currentPromptType].description
                        }
                        steps={promptExplanations[currentPromptType].steps}
                        apis={promptExplanations[currentPromptType].apis}
                        isVisible={true}
                        onToggle={togglePromptExplanation}
                      />
                    </div>
                  ) : (
                    <div className="p-4 animate-in fade-in duration-300">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Quick Actions</h2>
                        {hasActivePrompt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={togglePromptExplanation}
                            className="text-xs"
                          >
                            View Prompt Details
                          </Button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {actionOptions.map((option) => (
                          <ActionCard
                            key={option.id}
                            title={option.title}
                            description={option.description}
                            icon={option.icon}
                            onClick={option.action}
                          />
                        ))}
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <a
                          href="https://descope.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white hover:text-white border-0 group transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] font-medium">
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
          </div>
        )}
      </div>
    </>
  );
}
