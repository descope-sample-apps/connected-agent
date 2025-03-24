"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Video } from "lucide-react";

interface ZoomMeetingPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  meetingDetails: {
    title: string;
    date: string;
    time: string;
    participants?: string[];
  } | null;
}

export default function ZoomMeetingPrompt({
  isOpen,
  onClose,
  onConfirm,
  meetingDetails,
}: ZoomMeetingPromptProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would call an API to create the Zoom meeting
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onConfirm();
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  if (!meetingDetails) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="h-6 w-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center">
            Add Zoom Meeting?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Would you like to automatically create a Zoom meeting for your
            scheduled event:
            <span className="mt-2 block font-medium text-foreground">
              "{meetingDetails.title}" on {meetingDetails.date} at{" "}
              {meetingDetails.time}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, thanks</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-primary"
          >
            {isLoading ? "Creating..." : "Yes, add Zoom meeting"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
