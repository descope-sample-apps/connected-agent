"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, Share2, Link2 } from "lucide-react";

interface ShareChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

export default function ShareChatDialog({
  isOpen,
  onClose,
  chatId,
}: ShareChatDialogProps) {
  const [copied, setCopied] = useState(false);
  const [allowComments, setAllowComments] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  // In a real app, this would be generated on the server
  const shareUrl = `${window.location.origin}/shared/${chatId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Share2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Share Chat</DialogTitle>
          <DialogDescription className="text-center">
            Create a shareable link to this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="share-link">Shareable Link</Label>
            <div className="flex items-center gap-2">
              <Input
                id="share-link"
                value={shareUrl}
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={copyToClipboard}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="public-access">Public Access</Label>
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can view this chat
                </p>
              </div>
              <Switch
                id="public-access"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow-comments">Allow Comments</Label>
                <p className="text-xs text-muted-foreground">
                  Let viewers add comments to the shared chat
                </p>
              </div>
              <Switch
                id="allow-comments"
                checked={allowComments}
                onCheckedChange={setAllowComments}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="flex-1 sm:flex-none"
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy Link
            </Button>
            <Button
              onClick={() => {
                // In a real app, this would open the native share dialog
                if (navigator.share) {
                  navigator.share({
                    title: "Shared Chat from Sales Assistant",
                    text: "Check out this conversation from Sales Assistant",
                    url: shareUrl,
                  });
                } else {
                  copyToClipboard();
                }
                onClose();
              }}
              className="flex-1 sm:flex-none"
            >
              <Link2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
