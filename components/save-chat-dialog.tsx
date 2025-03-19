"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Check, X } from "lucide-react";

interface SaveChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => void;
  existingTitle?: string;
}

export default function SaveChatDialog({
  open,
  onOpenChange,
  onSave,
  existingTitle,
}: SaveChatDialogProps) {
  const [title, setTitle] = useState(existingTitle || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave(title);
      setIsSaving(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving chat:", error);
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Save className="h-5 w-5 mr-2 text-primary" />
            Save Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Label
            htmlFor="chat-title"
            className="text-sm font-medium mb-2 block"
          >
            Conversation Title
          </Label>
          <Input
            id="chat-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for this conversation"
            className="w-full"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
