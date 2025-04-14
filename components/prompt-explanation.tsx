"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  Lock,
  ArrowRight,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Helper function to convert URLs in text to clickable links
function convertUrlsToLinks(text: string): React.ReactNode {
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  
  // Split the text by URLs
  const parts = text.split(urlPattern);
  
  // Map through parts and convert URLs to links
  return parts.map((part, index) => {
    // Check if this part is a URL
    if (part.match(urlPattern)) {
      return (
        <Link 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center"
        >
          {part}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Link>
      );
    }
    // Return regular text
    return part;
  });
}

interface PromptExplanationProps {
  title: string;
  description: string;
  logo: string;
  examples: string[];
  steps: Array<{
    title: string;
    description: string;
  }>;
  apis: string[];
  isVisible: boolean;
  onToggle: () => void;
  onExampleClick?: (example: string) => void;
}

export default function PromptExplanation({
  title,
  description,
  logo,
  examples,
  steps,
  apis,
  isVisible,
  onToggle,
  onExampleClick,
}: PromptExplanationProps) {
  if (!isVisible) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10">
              <Image src={logo} alt={title} fill className="object-contain" />
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onToggle}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground mt-4">
          {convertUrlsToLinks(description)}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          {examples.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Examples:</h4>
              <ul className="space-y-1">
                {examples.map((example, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => onExampleClick?.(example)}
                  >
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {apis.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">APIs Used:</h4>
              <div className="flex flex-wrap gap-2">
                {apis.map((api) => (
                  <div
                    key={api}
                    className="flex items-center gap-2 px-2 py-1 bg-secondary rounded text-xs"
                  >
                    <div className="relative w-4 h-4">
                      <Image
                        src={getApiLogo(api)}
                        alt={api}
                        fill
                        className="object-contain"
                      />
                    </div>
                    {api}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-medium">How it works:</h4>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div className="relative w-8 h-8 flex-shrink-0">
                    <Image
                      src={getStepIcon(step.title)}
                      alt={step.title}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h5 className="text-sm font-medium">{step.title}</h5>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStepIcon(title: string): string {
  if (title.toLowerCase().includes("user")) {
    return "/logos/user-icon.png";
  }
  if (title.toLowerCase().includes("assistant")) {
    return "/logos/assistant-icon.png";
  }
  if (
    title.toLowerCase().includes("authentication") ||
    title.toLowerCase().includes("authorization")
  ) {
    return "/logos/auth-icon.png";
  }
  if (title.toLowerCase().includes("api")) {
    return "/logos/api-icon.png";
  }
  if (title.toLowerCase().includes("data")) {
    return "/logos/data-icon.png";
  }
  if (
    title.toLowerCase().includes("creation") ||
    title.toLowerCase().includes("generate")
  ) {
    return "/logos/create-icon.png";
  }
  return "/logos/step-icon.png";
}

function getApiLogo(api: string): string {
  const apiLogos: Record<string, string> = {
    "Custom CRM API": "/logos/crm-logo.png",
    "Google Calendar API": "/logos/google-calendar.png",
    "Zoom API": "/logos/zoom-logo.png",
    "Google Docs API": "/logos/google-docs.png",
  };
  return apiLogos[api] || "/logos/api-icon.png";
}
