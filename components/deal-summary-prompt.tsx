"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Check, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

interface DealSummaryPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (documentUrl: string) => void;
  dealId?: string;
}

interface WorkflowStep {
  name: string;
  success: boolean;
  executionTimeMs: number;
  error?: string;
}

interface WorkflowResult {
  success: boolean;
  document: {
    id: string;
    url: string;
    title: string;
  };
  executionTimeMs: number;
  steps: WorkflowStep[];
}

export default function DealSummaryPrompt({
  isOpen,
  onClose,
  onSuccess,
  dealId: initialDealId,
}: DealSummaryPromptProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dealId, setDealId] = useState(initialDealId || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  // Reset state when dialog is opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setResult(null);
      setCurrentStep(null);
      setIsLoading(false);
      setDealId(initialDealId || "");
    }
  }, [isOpen, initialDealId]);

  const handleSubmit = async () => {
    if (!dealId.trim()) {
      setError("Please enter a deal ID");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setResult(null);
      setCurrentStep("Starting workflow...");

      const response = await fetch("/api/tools/deal-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dealId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate deal summary");
      }

      setResult(data);

      // Show success toast
      toast({
        title: "Deal summary created!",
        description: `Document "${data.document.title}" was created successfully.`,
        duration: 5000,
      });

      // Call the success handler with the document URL
      onSuccess(data.document.url);

      // Close the dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Error summarizing deal:", error);
    } finally {
      setIsLoading(false);
      setCurrentStep(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Summarize Deal to Google Doc</DialogTitle>
          <DialogDescription>
            Create a comprehensive summary of a deal and save it to Google Docs
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dealId">Deal ID</Label>
            <Input
              id="dealId"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              placeholder="Enter deal ID"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 p-3 rounded-md flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {currentStep && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {currentStep}
            </div>
          )}

          {result && (
            <div className="space-y-2 text-sm">
              <div className="font-medium">Workflow Steps:</div>
              <div className="space-y-1">
                {result.steps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {step.success ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span>{step.name}</span>
                    </div>
                    <Badge variant="outline">
                      {(step.executionTimeMs / 1000).toFixed(2)}s
                    </Badge>
                  </div>
                ))}
              </div>

              {result.success && (
                <div className="mt-4 p-3 bg-primary/10 rounded-md">
                  <div className="font-medium mb-1">Document created:</div>
                  <a
                    href={result.document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {result.document.title}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !dealId.trim()}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? "Processing..." : "Generate Summary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
