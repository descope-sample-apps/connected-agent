import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, FileText, Search, Video } from "lucide-react";

interface QuickActionsProps {
  onActionSelect: (action: string) => void;
  disabled?: boolean;
}

const tools = [
  {
    id: "crm-lookup",
    name: "CRM Lookup",
    description: "Search and retrieve customer information from your CRM",
    icon: Search,
    logo: "/logos/crm-logo.png",
    examples: [
      "Find customer information for John Smith",
      "Show me recent deals with Acme Corp",
      "Get contact details for Sarah from Marketing",
    ],
  },
  {
    id: "schedule-meeting",
    name: "Schedule Meeting",
    description: "Create calendar events with Google Calendar integration",
    icon: Calendar,
    logo: "/logos/google-calendar.png",
    examples: [
      "Schedule a meeting with John tomorrow at 2 PM",
      "Set up a team sync for next week",
      "Book a client review for Friday afternoon",
    ],
  },
  {
    id: "create-zoom",
    name: "Create Zoom Meeting",
    description: "Generate Zoom video conference links for meetings",
    icon: Video,
    logo: "/logos/zoom-logo.png",
    examples: [
      "Create a Zoom meeting for tomorrow's call",
      "Add video conferencing to the team meeting",
      "Set up a Zoom link for the client presentation",
    ],
  },
  {
    id: "summarize-deal",
    name: "Deal Summary",
    description: "Create and save deal summaries to Google Docs",
    icon: FileText,
    logo: "/logos/google-docs.png",
    examples: [
      "Summarize the Acme Corp deal",
      "Create a deal report for Project Phoenix",
      "Generate a summary of Q1 deals",
    ],
  },
];

export function QuickActions({
  onActionSelect,
  disabled = false,
}: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      {tools.map((tool) => (
        <TooltipProvider key={tool.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                  disabled ? "opacity-50" : ""
                }`}
                onClick={() => !disabled && onActionSelect(tool.id)}
              >
                <div className="absolute top-0 right-0 m-2">
                  <div className="relative w-8 h-8">
                    <Image
                      src={tool.logo}
                      alt={`${tool.name} logo`}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <tool.icon className="w-5 h-5" />
                    {tool.name}
                  </CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Examples:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {tool.examples.map((example, index) => (
                        <li key={index} className="text-xs">
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              <p>Click to {tool.description.toLowerCase()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
