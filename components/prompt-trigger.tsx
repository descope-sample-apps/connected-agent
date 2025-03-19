"use client"

import { Button } from "@/components/ui/button"
import { Info, X } from "lucide-react"

interface PromptTriggerProps {
  onToggle: () => void
  isVisible: boolean
  isActive: boolean
}

export default function PromptTrigger({ onToggle, isVisible, isActive }: PromptTriggerProps) {
  if (!isActive) return null

  return (
    <Button
      variant={isVisible ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      className="rounded-full shadow-md transition-all duration-200"
    >
      {isVisible ? (
        <>
          <X className="h-4 w-4 mr-2" />
          Hide Prompt Details
        </>
      ) : (
        <>
          <Info className="h-4 w-4 mr-2" />
          View Prompt Details
        </>
      )}
    </Button>
  )
}

