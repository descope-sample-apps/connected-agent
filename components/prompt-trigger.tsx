"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, FileText, Search, Video } from "lucide-react";

const icons = {
  "crm-lookup": Search,
  "schedule-meeting": Calendar,
  "create-google-meet": Video,
  "summarize-deal": FileText,
};

interface PromptTriggerProps {
  type: keyof typeof icons;
  title: string;
  description: string;
  logo?: string;
  examples?: string[];
  onClick: () => void;
  disabled?: boolean;
}

export default function PromptTrigger({
  type,
  title,
  description,
  logo,
  examples,
  onClick,
  disabled = false,
}: PromptTriggerProps) {
  const Icon = icons[type];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={`relative h-auto w-full flex-col items-start gap-2 p-4 hover:bg-accent ${
              disabled ? "opacity-50" : ""
            }`}
            onClick={onClick}
            disabled={disabled}
          >
            {logo && (
              <div className="absolute top-2 right-2">
                <div className="relative w-8 h-8">
                  <Image
                    src={logo}
                    alt={`${title} logo`}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}
            <div className="flex w-full items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="font-medium">{title}</span>
            </div>
            <p className="text-sm text-muted-foreground text-left">
              {description}
            </p>
            {examples && examples.length > 0 && (
              <div className="w-full text-left mt-2">
                <p className="text-xs font-medium mb-1">Examples:</p>
                <ul className="list-disc list-inside space-y-1">
                  {examples.map((example, index) => (
                    <li key={index} className="text-xs text-muted-foreground">
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <p>Click to {description.toLowerCase()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
